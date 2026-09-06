import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { appUrl, getStripe } from "@/lib/market/stripe";

export type CashBill = {
  id: string; kitchen_id: string; amount_cents: number; status: "pending" | "paid";
  stripe_session_id: string | null; attempt_id: string;
  attempt_started_at: string; expires_at: string; created_at: string; paid_at: string | null;
};

/** Only call with a Stripe API result or an event whose signature was verified. */
export async function settleCashSession(session: Stripe.Checkout.Session): Promise<boolean> {
  if (session.metadata?.kind !== "cash_commission" || session.payment_status !== "paid" ||
      session.mode !== "payment" || session.currency !== "usd" || !session.amount_total ||
      !session.metadata.paymentId || !session.metadata.attemptId) return false;
  const { data, error } = await createServiceClient().rpc("dishd_settle_cash_payment", {
    p_payment: session.metadata.paymentId, p_attempt: session.metadata.attemptId,
    p_session: session.id, p_amount: session.amount_total,
  });
  if (error) throw new Error("Could not record the commission payment.");
  return data === true;
}

/** Recover an interrupted save before creating any second payable session. */
async function findSession(bill: CashBill): Promise<Stripe.Checkout.Session | null> {
  const stripe = getStripe();
  if (bill.stripe_session_id) return stripe.checkout.sessions.retrieve(bill.stripe_session_id);
  for await (const session of stripe.checkout.sessions.list({
    created: { gte: Math.floor(Date.parse(bill.attempt_started_at) / 1000) - 5,
      lte: Math.floor(Date.parse(bill.expires_at) / 1000) },
    limit: 100,
  })) {
    if (session.metadata?.paymentId === bill.id && session.metadata?.attemptId === bill.attempt_id) return session;
  }
  return null;
}

export async function cashPaymentUrl(initialBill: CashBill): Promise<string> {
  const admin = createServiceClient();
  const stripe = getStripe();
  let bill = initialBill;
  const previous = await findSession(bill);
  if (previous?.payment_status === "paid") {
    if (!await settleCashSession(previous)) throw new Error("This payment needs reconciliation. Please contact Dishd.");
    return "/cook/payments?paid=1";
  }
  if (previous?.status === "open" && previous.url) return previous.url;
  // An expired attempt can never accept another card payment. Recover its
  // Stripe result first, including the case where saving its session ID failed.
  if (previous?.status === "expired" || (!previous && Date.parse(bill.expires_at) <= Date.now())) {
    const now = Date.now();
    const { data, error } = await admin.from("cash_fee_payments").update({
      attempt_id: crypto.randomUUID(), stripe_session_id: null,
      attempt_started_at: new Date(now).toISOString(), expires_at: new Date(now + 3600000).toISOString(),
    }).eq("id", bill.id).eq("attempt_id", bill.attempt_id).eq("status", "pending").select("*").maybeSingle();
    if (error || !data) throw new Error("Your payment just changed. Refresh and try again.");
    bill = data as CashBill;
  } else if (previous) {
    throw new Error("Your card payment is processing. Please refresh shortly.");
  }
  // Stripe requires >=30 minutes until expiry on creation. Do not rotate an
  // unexpired unknown attempt: an earlier request may still be in flight.
  if (Date.parse(bill.expires_at) - Date.now() < 31 * 60000) {
    throw new Error("This checkout is being recovered. Try again after its one-hour window expires.");
  }
  const session = await stripe.checkout.sessions.create({
    mode: "payment", payment_method_types: ["card"],
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: bill.amount_cents,
      product_data: { name: "Dishd - 5% cash-sale commission" } } }],
    metadata: { kind: "cash_commission", paymentId: bill.id, attemptId: bill.attempt_id },
    client_reference_id: bill.id,
    expires_at: Math.floor(Date.parse(bill.expires_at) / 1000),
    success_url: appUrl() + "/cook/payments?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: appUrl() + "/cook/payments?cancelled=1",
  }, { idempotencyKey: "cash-commission-" + bill.attempt_id });
  const { error } = await admin.from("cash_fee_payments").update({ stripe_session_id: session.id })
    .eq("id", bill.id).eq("attempt_id", bill.attempt_id).eq("status", "pending");
  if (error || !session.url) throw new Error("Checkout could not be saved. Try again; your balance is retained.");
  return session.url;
}
