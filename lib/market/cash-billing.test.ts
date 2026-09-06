import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), from: vi.fn(), retrieve: vi.fn(), create: vi.fn(), list: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => ({ rpc: mocks.rpc, from: mocks.from }) }));
vi.mock("@/lib/market/stripe", () => ({ appUrl: () => "http://localhost:4173", getStripe: () => ({ checkout: { sessions: { retrieve: mocks.retrieve, create: mocks.create, list: mocks.list } } }) }));
import { cashPaymentUrl, settleCashSession, type CashBill } from "./cash-billing";

const bill: CashBill = { id: "bill", kitchen_id: "kitchen", amount_cents: 100, status: "pending", stripe_session_id: null,
  attempt_id: "attempt", attempt_started_at: "2026-09-06T12:00:00Z", expires_at: "2026-09-06T13:00:00Z", created_at: "2026-09-06T12:00:00Z", paid_at: null };
function session(patch: Record<string, unknown> = {}) {
  return { id: "cs_test_fee", mode: "payment", currency: "usd", amount_total: 100, payment_status: "paid", status: "complete",
    metadata: { kind: "cash_commission", paymentId: "bill", attemptId: "attempt" }, ...patch } as unknown as Stripe.Checkout.Session;
}
function chain(result: Record<string, unknown>) {
  const query = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn().mockResolvedValue(result), then: (resolve: (value: unknown) => void) => Promise.resolve(result).then(resolve) };
  query.update.mockReturnValue(query); query.eq.mockReturnValue(query); query.select.mockReturnValue(query);
  return query;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-06T12:01:00Z"));
  mocks.list.mockImplementation(async function* () {});
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.from.mockReturnValue(chain({ error: null }));
});
describe("cash fee confirmation", () => {
  it.each([{ payment_status: "unpaid" }, { currency: "eur" }, { mode: "setup" }, { amount_total: null }, { metadata: { kind: "order" } }])("rejects unverified or unrelated payment %j", async patch => {
    expect(await settleCashSession(session(patch))).toBe(false); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("binds settlement to exact bill, attempt, session and amount", async () => {
    expect(await settleCashSession(session())).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("dishd_settle_cash_payment", { p_payment: "bill", p_attempt: "attempt", p_session: "cs_test_fee", p_amount: 100 });
  });
  it("propagates storage outages so webhooks retry", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "offline" } });
    await expect(settleCashSession(session())).rejects.toThrow("record");
  });
});
describe("cash checkout recovery", () => {
  it("reuses an open session instead of charging the balance twice", async () => {
    mocks.retrieve.mockResolvedValue(session({ status: "open", payment_status: "unpaid", url: "https://checkout.stripe.com/existing" }));
    expect(await cashPaymentUrl({ ...bill, stripe_session_id: "cs_test_fee" })).toContain("/existing");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("recovers a paid session whose database save was interrupted", async () => {
    mocks.list.mockImplementation(async function* () { yield session(); });
    expect(await cashPaymentUrl(bill)).toBe("/cook/payments?paid=1");
    expect(mocks.rpc).toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("creates card-only checkout with a fixed expiry and idempotency key", async () => {
    mocks.create.mockResolvedValue(session({ status: "open", payment_status: "unpaid", url: "https://checkout.stripe.com/new" }));
    expect(await cashPaymentUrl(bill)).toContain("/new");
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      payment_method_types: ["card"], expires_at: Date.parse(bill.expires_at) / 1000,
      metadata: { kind: "cash_commission", paymentId: "bill", attemptId: "attempt" },
    }), { idempotencyKey: "cash-commission-attempt" });
  });
  it("retains the batch when checkout persistence fails", async () => {
    mocks.create.mockResolvedValue(session({ url: "https://checkout.stripe.com/new" }));
    mocks.from.mockReturnValue(chain({ error: { message: "offline" } }));
    await expect(cashPaymentUrl(bill)).rejects.toThrow("saved");
  });
  it("does not rotate an unknown unexpired attempt during the recovery window", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-06T12:45:00Z"));
    await expect(cashPaymentUrl(bill)).rejects.toThrow("recovered");
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled();
  });
  it("only rotates an expired session after looking it up", async () => {
    mocks.retrieve.mockResolvedValue(session({ status: "expired", payment_status: "unpaid" }));
    mocks.from.mockReturnValueOnce(chain({ data: { ...bill, attempt_id: "next" }, error: null }));
    mocks.create.mockResolvedValue(session({ url: "https://checkout.stripe.com/retry" }));
    expect(await cashPaymentUrl({ ...bill, stripe_session_id: "cs_test_fee" })).toContain("/retry");
    expect(mocks.create.mock.calls[0][1]).toEqual({ idempotencyKey: "cash-commission-next" });
  });
});
