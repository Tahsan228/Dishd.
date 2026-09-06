import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getStripe, stripeConfigured } from "@/lib/market/stripe";
import { settleCashSession, type CashBill } from "@/lib/market/cash-billing";
import { SiteHeader } from "@/components/market/site-header";
import { CashPaymentButton } from "@/components/market/cash-payment-button";
import { DemoAd } from "@/components/market/demo-ad";
import { formatCents } from "@/lib/utils";

export const metadata = { title: "Kitchen payments | Dishd" };

export default async function KitchenPayments({ searchParams }: { searchParams: Promise<{ session_id?: string; cancelled?: string }> }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) redirect("/signin?next=%2Fcook%2Fpayments");
  const client = await createServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/signin?next=%2Fcook%2Fpayments");
  const { data: kitchen } = await client.from("kitchens").select("id,name").eq("owner_id", user.id).maybeSingle();
  if (!kitchen) redirect("/cook");
  const query = await searchParams;
  let notice = query.cancelled ? "Checkout was closed. Your balance is still due; you can resume payment below." : "";
  if (query.session_id && stripeConfigured()) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(query.session_id);
      // Owner-scoped read must succeed before this page can reconcile a bill.
      const { data: ownBill } = await client.from("cash_fee_payments").select("id").eq("id", session.metadata?.paymentId ?? "").eq("kitchen_id", kitchen.id).maybeSingle();
      if (ownBill && await settleCashSession(session)) notice = "Card payment confirmed. Your cash-sale fees have been settled.";
      else notice = "Payment is not confirmed yet. Your balance stays due until confirmation arrives.";
    } catch { notice = "We could not confirm the card payment yet. Refresh shortly; please do not pay again elsewhere."; }
  }
  const [feesResult, billsResult] = await Promise.all([
    client.from("cash_commissions").select("order_id,food_cents,amount_cents,created_at,due_at,paid_at,payment_id").eq("kitchen_id", kitchen.id).is("paid_at", null).order("created_at"),
    client.from("cash_fee_payments").select("*").eq("kitchen_id", kitchen.id).order("created_at", { ascending: false }).limit(30),
  ]);
  const unavailable = Boolean(feesResult.error || billsResult.error);
  const fees = feesResult.data ?? [];
  const bills = (billsResult.data ?? []) as CashBill[];
  const balance = fees.reduce((sum, fee) => sum + fee.amount_cents, 0);
  const pendingBill = bills.find(bill => bill.status === "pending");
  const payable = pendingBill?.amount_cents ?? balance;
  const overdue = balance >= 50 && fees.some(fee => Date.parse(fee.due_at) <= Date.now());
  return <><SiteHeader /><main className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8 sm:px-6">
    <Link href="/cook" className="text-sm text-forest underline underline-offset-4">Back to your kitchen</Link>
    <h1 className="mt-5 font-display text-3xl text-forest">Your kitchen payments</h1>
    <p className="mt-2 text-ink-muted">{kitchen.name} &middot; Cash-sale commission</p>
    {notice && <p role="status" className="mt-5 rounded-xl bg-forest-soft p-4 text-sm text-forest">{notice}</p>}
    <section className="mt-6 rounded-2xl border border-line bg-surface p-6">
      <p className="text-sm text-ink-muted">Outstanding cash-sale fees</p>
      <p className="tabular mt-2 font-display text-4xl text-forest">{unavailable ? "Unavailable" : formatCents(balance)}</p>
      <p className="mt-4 text-sm text-ink-muted">Dishd earns 5% of the food amount after reward discounts on each completed cash pickup, rounded to the nearest cent. Tips are excluded. Your customer pays you; you settle Dishd&apos;s fee by card here.</p>
      <p className="mt-3 text-sm text-ink-muted">Fees are due within 7 days. Balances below $0.50 carry forward until they can be paid by card. An overdue balance of $0.50 or more pauses new cash orders until paid. Existing pickups can still be completed.</p>
      {unavailable ? <p role="alert" className="mt-4 text-sm text-clay">Payment records are unavailable. Please try again later.</p> : <>
        {overdue && <p role="alert" className="mt-4 rounded-xl bg-clay/10 p-4 text-sm text-clay">Cash ordering is paused. Settle your overdue balance to reopen cash checkout.</p>}
        {pendingBill && balance > payable && <p className="mt-3 text-sm text-ink-muted">Your current checkout covers {formatCents(payable)}. Newer fees remain for your next payment.</p>}
        <CashPaymentButton amount={payable} enabled={stripeConfigured()} />
        {!stripeConfigured() && <p className="mt-3 text-sm text-ink-muted">Card billing is not configured yet. Fees remain recorded until billing is available.</p>}
        {balance > 0 && balance < 50 && <p className="mt-3 text-sm text-ink-muted">No payment needed yet. Your balance will carry forward.</p>}
      </>}
    </section>
    <section className="mt-8"><h2 className="text-lg font-medium text-forest">Unsettled cash pickups</h2>
      {!unavailable && fees.length === 0 && <p className="mt-3 text-sm text-ink-muted">You&apos;re all caught up. A completed cash pickup will appear here.</p>}
      <ul className="mt-3 space-y-3">{fees.map(fee => <li key={fee.order_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
        <div><Link href={"/order/" + fee.order_id} className="text-sm text-forest underline">Order {fee.order_id.slice(0,8)}</Link>
          <p className="mt-1 text-sm text-ink-muted">{formatCents(fee.food_cents)} food &middot; Due {new Date(fee.due_at).toLocaleDateString("en-US", { timeZone: "America/New_York" })}</p></div>
        <p className="tabular text-sm font-medium text-forest">{formatCents(fee.amount_cents)} fee</p>
      </li>)}</ul>
    </section>
    <section className="mt-8"><h2 className="text-lg font-medium text-forest">Recent card settlements</h2>
      <ul className="mt-3 space-y-2">{bills.filter(bill => bill.status === "paid").map(bill => <li key={bill.id} className="flex justify-between gap-4 rounded-xl bg-forest-soft p-4 text-sm text-forest">
        <span>Paid {new Date(bill.paid_at!).toLocaleDateString("en-US", { timeZone: "America/New_York" })}</span><span className="tabular">{formatCents(bill.amount_cents)}</span>
      </li>)}</ul>
    </section>
    <p className="mt-8 text-sm text-ink-muted">Card meal payments and tips are recorded separately from cash fees. Automatic transfers to kitchens are still awaiting payout setup.</p>
    <DemoAd variant={1} />
  </main></>;
}
