import { beforeEach, expect, it, vi } from "vitest";
import type Stripe from "stripe";
const mocks = vi.hoisted(() => ({ from: vi.fn(), retrieve: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => ({ from: mocks.from }) }));
vi.mock("@/lib/market/stripe", () => ({ stripeConfigured: () => true, getStripe: () => ({ checkout: { sessions: { retrieve: mocks.retrieve } } }) }));
import { markOrderPaid, settleFromCheckout } from "./payment-settlement";
const order = { id: "order", payment_method: "card", payment_status: "unpaid", stripe_session_id: "cs_test_order", subtotal_cents: 2000, tip_cents: 300 };
function session(patch: Record<string, unknown> = {}) {
  return { id: "cs_test_order", mode: "payment", currency: "usd", amount_total: 2300, payment_status: "paid",
    metadata: { kind: "order", orderId: "order" }, ...patch } as unknown as Stripe.Checkout.Session;
}
function query(data: unknown, error: unknown = null) {
  const q = { select: vi.fn(), update: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data, error }) };
  q.select.mockReturnValue(q); q.update.mockReturnValue(q); q.eq.mockReturnValue(q); q.is.mockReturnValue(q);
  return q;
}
beforeEach(() => { vi.clearAllMocks(); });
it.each([{ amount_total: 2000 }, { currency: "eur" }, { payment_status: "unpaid" }, { id: "cs_wrong" }, { metadata: { kind: "cash_commission", orderId: "order" } }])("rejects a mismatched payment %j", async patch => {
  mocks.from.mockReturnValue(query(order));
  expect(await markOrderPaid(session(patch))).toBe(false);
  expect(mocks.from.mock.calls.length).toBeLessThanOrEqual(1);
});
it("requires a card order even when metadata and amount match", async () => {
  mocks.from.mockReturnValue(query({ ...order, payment_method: "cash" }));
  expect(await markOrderPaid(session())).toBe(false);
});
it("confirms the full food-plus-tip amount", async () => {
  mocks.from.mockReturnValueOnce(query(order)).mockReturnValueOnce(query({ id: "order" }));
  expect(await markOrderPaid(session())).toBe(true);
});
it("does not rewrite an already paid matching order", async () => {
  mocks.from.mockReturnValue(query({ ...order, payment_status: "paid" }));
  expect(await markOrderPaid(session())).toBe(true);
  expect(mocks.from).toHaveBeenCalledTimes(1);
});
it("propagates persistence failure to the webhook retry path", async () => {
  mocks.from.mockReturnValueOnce(query(order)).mockReturnValueOnce(query(null, { message: "offline" }));
  await expect(markOrderPaid(session())).rejects.toThrow("record");
});
it("never trusts the session ID pasted into another order URL", async () => {
  mocks.retrieve.mockResolvedValue(session());
  await settleFromCheckout("someone-else", "cs_test_order");
  expect(mocks.from).not.toHaveBeenCalled();
});
