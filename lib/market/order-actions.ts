"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/types";
import { ACK_VERSION, ACKNOWLEDGMENTS } from "@/lib/market/order-consent";
import { transitionError, type OrderActor } from "@/lib/market/order-lifecycle";
import { paymentMethodError } from "@/lib/market/payments";
import { createCheckoutSession, stripeConfigured } from "@/lib/market/stripe";

export type PlaceOrderState = { error?: string } | null;

/**
 * Place a pickup order.
 *
 * All three acknowledgments are required and each is written to `agreements`
 * with the doc version, IP and user agent. Per-order consent is far stronger
 * evidence than a one-time checkbox at signup, and the home-kitchen disclosure
 * is close to statutory wording under MEHKO.
 */
export async function placeOrder(
  _prev: PlaceOrderState,
  form: FormData,
): Promise<PlaceOrderState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const kitchenId = String(form.get("kitchenId") ?? "");
  const slug = String(form.get("slug") ?? "");

  if (!user) redirect(`/signin?next=/k/${slug}`);

  for (const ack of ACKNOWLEDGMENTS) {
    if (form.get(`ack_${ack.key}`) !== "on") {
      return { error: "All three acknowledgments are required before ordering." };
    }
  }

  // Quantities arrive as qty_<menuItemId>.
  const wanted: { id: string; qty: number }[] = [];
  for (const [k, v] of form.entries()) {
    if (k.startsWith("qty_")) {
      const qty = Number(v);
      if (qty > 0) wanted.push({ id: k.slice(4), qty });
    }
  }
  if (wanted.length === 0) return { error: "Choose at least one dish." };

  // Re-read prices and provenance server-side. Never trust posted prices.
  const { data: items } = await supabase
    .from("menu_items")
    .select(
      `id, name, price_cents, meat_type, contains_meat, kitchen_id,
       sourcing_batches ( ocr_store, ocr_date, match_status,
                          halal_sources ( store_name, cert_body ) )`,
    )
    .eq("kitchen_id", kitchenId)
    .in("id", wanted.map((w) => w.id));

  if (!items?.length) return { error: "Those dishes are no longer available." };

  const subtotal = wanted.reduce((sum, w) => {
    const it = items.find((i) => i.id === w.id);
    return sum + (it ? it.price_cents * w.qty : 0);
  }, 0);

  const paymentMethod = String(form.get("paymentMethod") ?? "cash") === "card" ? "card" : "cash";

  // The disabled radio is a hint, not a control: a form post can name any
  // method. Card requires a Stripe key on this deployment and a cook who has
  // finished payment setup — without both, an order would be placed that
  // nothing could ever charge.
  const { data: kitchenPayment } = await supabase
    .from("kitchens")
    .select("accepts_cash, accepts_card, stripe_onboarded")
    .eq("id", kitchenId)
    .maybeSingle();
  if (!kitchenPayment) return { error: "That kitchen is no longer available." };

  const paymentProblem = paymentMethodError(paymentMethod, kitchenPayment, stripeConfigured());
  if (paymentProblem) return { error: paymentProblem };

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      buyer_id: user.id,
      kitchen_id: kitchenId,
      status: "pending",
      payment_method: paymentMethod,
      payment_status: "unpaid",
      subtotal_cents: subtotal,
    })
    .select("id")
    .single();

  if (error || !order) return { error: error?.message ?? "Could not place the order." };

  // Freeze provenance at order time so the meal stays traceable even if the
  // cook later deletes the batch.
  await supabase.from("order_items").insert(
    wanted.map((w) => {
      const it = items.find((i) => i.id === w.id)!;
      const batch = it.sourcing_batches as unknown as
        | { ocr_store: string | null; ocr_date: string | null; match_status: string;
            halal_sources: { store_name: string; cert_body: string | null } | null }
        | null;
      return {
        order_id: order.id,
        menu_item_id: it.id,
        qty: w.qty,
        unit_price_cents: it.price_cents,
        name_snapshot: it.name,
        meat_snapshot: it.meat_type,
        provenance_snapshot: it.contains_meat && batch
          ? {
              store: batch.halal_sources?.store_name ?? batch.ocr_store,
              cert_body: batch.halal_sources?.cert_body ?? null,
              receipt_date: batch.ocr_date,
              status_at_order: batch.match_status,
            }
          : null,
      };
    }),
  );

  // The consent ledger. Append-only, one row per acknowledgment.
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = h.get("user-agent");
  await supabase.from("agreements").insert(
    ACKNOWLEDGMENTS.map((a) => ({
      user_id: user.id,
      doc_type: `order_ack:${a.key}`,
      doc_version: ACK_VERSION,
      ip,
      user_agent: ua,
    })),
  );

  // Card orders detour through Stripe Checkout. The order row already exists,
  // unpaid, so an abandoned checkout leaves a pending order the cook can
  // decline rather than a silent gap — and the cook is never shown it as paid.
  if (paymentMethod === "card") {
    const lines = wanted.map((w) => {
      const it = items.find((i) => i.id === w.id)!;
      return { name: it.name, unitAmountCents: it.price_cents, qty: w.qty };
    });

    let checkoutUrl: string | null = null;
    try {
      const { data: kitchenName } = await supabase
        .from("kitchens")
        .select("name")
        .eq("id", kitchenId)
        .maybeSingle();

      const session = await createCheckoutSession({
        orderId: order.id,
        kitchenName: kitchenName?.name ?? "a Dishd kitchen",
        buyerEmail: user.email ?? null,
        lines,
      });

      // payment_status and stripe_session_id are locked to the service role by
      // migration 0005's trigger, so this write cannot go through the user's
      // client — that is the point of the lock.
      await createServiceClient()
        .from("orders")
        .update({ stripe_session_id: session.id })
        .eq("id", order.id);

      checkoutUrl = session.url;
    } catch (error) {
      // The order exists but cannot be paid for. Say so plainly rather than
      // dropping the buyer on a confirmation page for an order nothing will
      // charge.
      const detail = error instanceof Error ? error.message : "Unknown error";
      return { error: `Card checkout could not be started (${detail}). Your order is saved as unpaid.` };
    }

    if (checkoutUrl) redirect(checkoutUrl);
  }

  redirect(`/order/${order.id}`);
}

/**
 * Advance an order. Cook: pending -> accepted -> ready -> completed.
 * Buyer: cancel only, and only before the food has been made ready.
 *
 * Moving to 'completed' fires dishd_autolog_on_complete(), which writes the
 * verified log row. Accepting is what reveals the exact address to the buyer.
 *
 * A server action is reachable from the client with whatever arguments the
 * caller likes, so this establishes who is asking and whether the move is legal
 * before touching the row. Migration 0005 enforces the same rules in a trigger,
 * which is the boundary that actually holds; this layer exists so an illegal
 * move fails with a sentence a cook can read instead of a Postgres exception.
 */
export async function advanceOrder(orderId: string, to: OrderStatus) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, buyer_id, kitchen_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { error: "That order is no longer available." };

  const { data: owned } = await supabase
    .from("kitchens")
    .select("id")
    .eq("id", order.kitchen_id)
    .eq("owner_id", user.id)
    .maybeSingle();

  const actor: OrderActor | null = owned
    ? "cook"
    : order.buyer_id === user.id
      ? "buyer"
      : null;
  if (!actor) return { error: "You are not a party to this order." };

  const problem = transitionError(order.status as OrderStatus, to, actor);
  if (problem) return { error: problem };

  const patch: Record<string, unknown> = { status: to };
  if (to === "accepted") patch.address_revealed_at = new Date().toISOString();
  if (to === "completed") patch.completed_at = new Date().toISOString();

  // Re-assert the starting status so two taps in flight cannot double-advance.
  const { data: updated, error } = await supabase
    .from("orders")
    .update(patch)
    .eq("id", orderId)
    .eq("status", order.status)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!updated) return { error: "That order just changed. Refresh and try again." };

  revalidatePath("/cook");
  revalidatePath(`/order/${orderId}`);
  return { ok: true };
}

