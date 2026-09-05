import { createServiceClient } from "@/lib/supabase/server";
import { getStripe, stripeConfigured } from "@/lib/market/stripe";

/**
 * Record that an order has been paid.
 *
 * Two independent paths reach this — Stripe's webhook, and the buyer landing
 * back on the order page — so it must be idempotent and must never downgrade a
 * paid order. Whichever arrives first wins and the other is a no-op.
 *
 * The service role is required, not convenient: migration 0005 locks
 * payment_status and stripe_session_id against every authenticated caller, so
 * only a server-side path with no end-user JWT can write them. That is what
 * stops a buyer marking their own order paid.
 */
export async function markOrderPaid(
  orderId: string,
  sessionId: string,
): Promise<{ ok: boolean; alreadyPaid: boolean }> {
  const admin = createServiceClient();

  const { data: order } = await admin
    .from("orders")
    .select("id, payment_status, stripe_session_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return { ok: false, alreadyPaid: false };
  if (order.payment_status === "paid") return { ok: true, alreadyPaid: true };

  // If the row already names a session, the one settling it must be that one.
  // Otherwise a session created for one order could be replayed against another.
  if (order.stripe_session_id && order.stripe_session_id !== sessionId) {
    return { ok: false, alreadyPaid: false };
  }

  const { error } = await admin
    .from("orders")
    .update({ payment_status: "paid", stripe_session_id: sessionId })
    .eq("id", orderId)
    .neq("payment_status", "paid");

  return { ok: !error, alreadyPaid: false };
}

/**
 * Settle an order from a Checkout Session id handed back in the return URL.
 *
 * The id from the query string is a lookup key, never evidence. Stripe is asked
 * what the session actually is, and the order is only marked paid when Stripe
 * says it is paid and the session names this order — so pasting someone else's
 * session id, or any id at all, onto an order URL achieves nothing.
 *
 * Failures are swallowed on purpose: this runs while rendering the order page,
 * and a Stripe outage should leave the order visible and unpaid rather than
 * replacing it with an error.
 */
export async function settleFromCheckout(orderId: string, sessionId: string): Promise<void> {
  if (!stripeConfigured()) return;
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const claimed = session.metadata?.orderId ?? session.client_reference_id;
    if (claimed !== orderId) return;
    if (session.payment_status !== "paid") return;
    await markOrderPaid(orderId, session.id);
  } catch {
    // Leave it unpaid; the webhook is the durable path.
  }
}
