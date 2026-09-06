import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripe, stripeConfigured } from "@/lib/market/stripe";

/** A signed Stripe event or API lookup is required; browser IDs are not proof. */
export async function markOrderPaid(session: Stripe.Checkout.Session): Promise<boolean> {
  const orderId = session.metadata?.orderId ?? session.client_reference_id;
  if (!orderId || session.metadata?.kind === "cash_commission" || session.mode !== "payment" ||
      session.currency !== "usd" || session.payment_status !== "paid") return false;
  const admin = createServiceClient();
  const { data: order, error } = await admin.from("orders")
    .select("id,payment_method,payment_status,stripe_session_id,subtotal_cents,tip_cents")
    .eq("id", orderId).maybeSingle();
  if (error) throw new Error("Could not read the order payment.");
  if (!order || order.payment_method !== "card" ||
      session.amount_total !== order.subtotal_cents + order.tip_cents ||
      (order.stripe_session_id && order.stripe_session_id !== session.id)) return false;
  if (order.payment_status === "paid") return true;
  // Compare the stored session in the write too, so a concurrent setup cannot
  // replace the session between our read and update.
  let update = admin.from("orders").update({ payment_status: "paid", stripe_session_id: session.id })
    .eq("id", orderId).eq("payment_status", "unpaid");
  update = order.stripe_session_id ? update.eq("stripe_session_id", session.id) : update.is("stripe_session_id", null);
  const result = await update.select("id").maybeSingle();
  if (result.error) throw new Error("Could not record the order payment.");
  if (result.data) return true;
  const { data: current, error: readError } = await admin.from("orders").select("payment_status,stripe_session_id").eq("id", orderId).maybeSingle();
  if (readError) throw new Error("Could not confirm the order payment.");
  return current?.payment_status === "paid" && current.stripe_session_id === session.id;
}

export async function settleFromCheckout(orderId: string, sessionId: string): Promise<void> {
  if (!stripeConfigured()) return;
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if ((session.metadata?.orderId ?? session.client_reference_id) !== orderId) return;
    await markOrderPaid(session);
  } catch {
    // Keep the order visible; signed webhooks retry transient storage failures.
  }
}
