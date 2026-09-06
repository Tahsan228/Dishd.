import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Clock, CheckCircle2, ChefHat, Lock } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { settleFromCheckout } from "@/lib/market/payment-settlement";
import { SiteHeader } from "@/components/market/site-header";
import { OrderReviewLink } from "@/components/social/order-review-link";
import { ClearCartOnOrder } from "@/components/market/clear-cart-on-order";
import { ReportDialog } from "@/components/social/report-dialog";
import { OrderLiveRefresh } from "@/components/market/order-live-refresh";
import { DemoAd } from "@/components/market/demo-ad";
import { formatCents } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types";

const STEPS: { key: OrderStatus; label: string; note: string }[] = [
  { key: "pending", label: "Requested", note: "Waiting for the cook to confirm" },
  { key: "accepted", label: "Accepted", note: "Address unlocked below" },
  { key: "ready", label: "Ready", note: "Collect during the pickup window" },
  { key: "completed", label: "Collected", note: "Rate your meal" },
];

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { id } = await params;
  const { session_id: sessionId } = await searchParams;

  // Returning from Stripe Checkout. The session id in the URL is not trusted:
  // it is looked up through Stripe's API, and settlement only happens if Stripe
  // itself says the session is paid AND names this order. Locally this is what
  // records payment, since Stripe cannot reach localhost to fire the webhook.
  if (sessionId) await settleFromCheckout(id, sessionId);

  const supabase = await createServerClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      `id, status, payment_method, payment_status, subtotal_cents, discount_cents, tip_cents, pickup_code,
       created_at, kitchen_id,
       kitchens ( name, slug, neighborhood_label ),
       order_items ( qty, name_snapshot, unit_price_cents, provenance_snapshot )`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) notFound();

  const kitchen = order.kitchens as unknown as {
    name: string; slug: string; neighborhood_label: string;
  };
  const items = (order.order_items ?? []) as unknown as {
    qty: number; name_snapshot: string; unit_price_cents: number;
    provenance_snapshot: { store?: string; cert_body?: string | null } | null;
  }[];

  // RLS decides this: the row only exists once the cook has accepted.
  const { data: address } = await supabase
    .from("kitchen_addresses")
    .select("line1, line2, city, zip")
    .eq("kitchen_id", order.kitchen_id)
    .maybeSingle();

  const activeIndex = STEPS.findIndex((s) => s.key === order.status);
  const cancelled = order.status === "cancelled" || order.status === "declined";

  return (
    <>
      <SiteHeader />
      <OrderLiveRefresh active={!cancelled && order.status !== "completed"} />
      <ClearCartOnOrder orderId={order.id} kitchenId={order.kitchen_id} />
      <main className="mx-auto w-full max-w-2xl px-4 pb-20 pt-8">
        <p className="text-sm text-ink-muted">
          Order from{" "}
          <Link href={`/k/${kitchen.slug}`} className="font-medium text-forest underline-offset-2 hover:underline">
            {kitchen.name}
          </Link>
        </p>
        <h1 className="mt-1 font-display text-3xl text-forest">
          {cancelled ? "Order cancelled" : STEPS[Math.max(activeIndex, 0)].label}
        </h1>

        {!cancelled && (
          <ol className="stagger mt-6 space-y-2">
            {STEPS.map((step, i) => {
              const done = i < activeIndex;
              const active = i === activeIndex;
              return (
                <li
                  key={step.key}
                  className={`flex items-start gap-3 rounded-xl border p-3 ${
                    active
                      ? "border-forest bg-forest-soft"
                      : done
                        ? "border-line bg-surface"
                        : "border-line bg-surface opacity-55"
                  }`}
                >
                  <span
                    className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs ${
                      done || active ? "bg-forest text-cream" : "bg-surface-sunk text-ink-muted"
                    }`}
                  >
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : i + 1}
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-ink">{step.label}</span>
                    <span className="block text-xs text-ink-muted">{step.note}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {/* The pickup code is what the cook checks to complete the order — it is
            what makes the resulting log a verified one. */}
        {(order.status === "accepted" || order.status === "ready") && (
          <div className="seal mt-6 rounded-xl border border-brass/40 bg-brass/10 p-5 text-center">
            <p className="text-xs font-medium tracking-wide text-brass-ink uppercase">
              Show this at pickup
            </p>
            <p className="tabular mt-1 font-display text-4xl tracking-[0.2em] text-forest">
              {order.pickup_code}
            </p>
          </div>
        )}

        <section className="mt-6 rounded-xl border border-line bg-surface p-4">
          <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
            <MapPin className="h-4 w-4" aria-hidden />
            Pickup location
          </h2>
          {address ? (
            <address className="rise mt-2 text-sm not-italic leading-relaxed text-ink">
              {address.line1}
              {address.line2 && <>, {address.line2}</>}
              <br />
              {address.city} {address.zip}
            </address>
          ) : (
            <p className="mt-2 flex items-start gap-2 text-sm text-ink-muted">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                {kitchen.neighborhood_label} — the exact address is revealed once the
                cook accepts your order. This is enforced by the database, not the page.
              </span>
            </p>
          )}
        </section>

        <section className="mt-4 rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-medium text-ink">Items</h2>
          <ul className="mt-2 space-y-2">
            {items.map((it, i) => (
              <li key={i} className="flex items-start justify-between gap-3 text-sm">
                <span>
                  <span className="text-ink">
                    {it.qty} × {it.name_snapshot}
                  </span>
                  {it.provenance_snapshot?.store && (
                    <span className="block text-xs text-ink-muted">
                      Sourced from {it.provenance_snapshot.store}
                      {it.provenance_snapshot.cert_body && ` · ${it.provenance_snapshot.cert_body}`}
                    </span>
                  )}
                </span>
                <span className="tabular shrink-0 text-ink">
                  {formatCents(it.unit_price_cents * it.qty)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
            {order.discount_cents > 0 && <div className="flex justify-between gap-3 text-forest"><dt>Reward credit</dt><dd className="tabular">&minus;{formatCents(order.discount_cents)}</dd></div>}
            <div className="flex justify-between gap-3"><dt>Tip for your cook</dt><dd className="tabular">{formatCents(order.tip_cents)}</dd></div>
          </dl>
          <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
            <span className="text-sm text-ink-muted">
              Total · {order.payment_method === "cash" ? "cash at pickup" : "card"}
            </span>
            <span className="tabular font-display text-xl text-forest">
              {formatCents(order.subtotal_cents + order.tip_cents)}
            </span>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
            Sourcing shown here is frozen as it stood when you ordered, and is
            self-reported by the cook. Dishd does not certify any food as halal.
          </p>
        </section>

        {order.status === "pending" && (
          <p className="mt-4 flex items-center gap-2 text-xs text-ink-muted">
            <Clock className="h-3.5 w-3.5 pulse-soft" aria-hidden />
            Waiting for {kitchen.name} to confirm.
          </p>
        )}
        {order.status === "completed" && (
          <div className="mt-4">
            <p className="flex items-center gap-2 text-xs text-ink-muted">
              <ChefHat className="h-3.5 w-3.5" aria-hidden />
              Collected. This meal is now in your diary.
            </p>
            {/* The completing trigger already wrote the verified log; this
                resolves it so the buyer can actually rate the meal. */}
            <div className="mt-3">
              <OrderReviewLink orderId={id} />
            </div>

            {/* Tied to this order, which is what makes the report worth acting
                on: a reviewer can see exactly which pickup is being described. */}
            <ReportDialog
              kitchenId={order.kitchen_id}
              kitchenName={kitchen.name}
              orderId={order.id}
            />
          </div>
        )}
        {order.status === "completed" && <DemoAd variant={2} />}
      </main>
    </>
  );
}
