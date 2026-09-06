import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ChefHat,
  Clock,
  ShieldCheck,
  TriangleAlert,
  Utensils,
  ReceiptText,
  ArrowRight,
} from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/market/site-header";
import { OrderActions } from "@/components/market/order-actions-buttons";
import { MenuAvailabilityToggle } from "@/components/market/menu-availability-toggle";
import { scoreKitchen, tierLabel } from "@/lib/social/credibility";
import { DemoAd } from "@/components/market/demo-ad";
import { formatCents, toStars } from "@/lib/utils";
import type { KitchenCounters } from "@/lib/types";

/**
 * The cook's operations console.
 *
 * Everything a cook has to act on today, in the order they act on it: orders
 * waiting, then sourcing that needs attention, then the menu. The credibility
 * panel is here too because the score is the product's promise to them — it has
 * to be visible from their side, not only to buyers.
 */
export default async function CookDashboard() {
  // Every other page guards this; without it a missing or mistyped Supabase
  // URL takes the dashboard down with a 500 instead of sending the cook to
  // sign in, which is where an unauthenticated visitor belongs anyway.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) redirect("/signin?next=/cook");

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=/cook");

  const { data: kitchen } = await supabase
    .from("kitchens")
    .select(
      `id, name, slug, status, orders_completed, trust_streak, permit_status,
       avg_rating_10, distinct_customers, repeat_customers, upheld_flags,
       open_incidents, cook_cancellations, created_at, revenue_cents`,
    )
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!kitchen) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-2xl px-4 py-16 text-center">
          <ChefHat className="mx-auto h-8 w-8 text-forest" aria-hidden />
          <h1 className="mt-3 font-display text-3xl text-forest">Start selling on Dishd</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
            You&apos;ll need your county&apos;s home kitchen permit, and a purchase
            receipt for any meat you cook with. Six steps, and nothing you can
            skip — that is what the badge on your page is worth.
          </p>
          <Link
            href="/cook/start"
            className="mt-5 inline-block rounded-full bg-forest px-5 py-2.5 text-sm font-medium text-cream hover:bg-forest-deep"
          >
            Start setting up
          </Link>
        </main>
      </>
    );
  }

  const [ordersResult, batchesResult, menuResult] = await Promise.all([
    supabase
      .from("orders")
      .select(
        `id, status, payment_method, subtotal_cents, tip_cents, cash_fee_cents, pickup_code, created_at,
         profiles ( display_name, handle ),
         order_items ( qty, name_snapshot )`,
      )
      .eq("kitchen_id", kitchen.id)
      .in("status", ["pending", "accepted", "ready"])
      .order("created_at", { ascending: true }),
    supabase
      .from("sourcing_batches")
      .select("id, ocr_store, ocr_date, match_status")
      .eq("kitchen_id", kitchen.id)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("menu_items")
      .select("id, name, price_cents, is_available, contains_meat")
      .eq("kitchen_id", kitchen.id)
      .order("created_at", { ascending: true }),
  ]);

  const live = ordersResult.data ?? [];
  const batches = batchesResult.data ?? [];
  const menu = menuResult.data ?? [];
  const isDraft = kitchen.status !== "active";

  // The same scoring the buyer sees, from the same trigger-maintained counters.
  const credibility = scoreKitchen(kitchen as unknown as KitchenCounters);

  const stats = [
    { label: "Meals served", value: String(kitchen.orders_completed) },
    { label: "Revenue", value: formatCents(kitchen.revenue_cents ?? 0) },
    {
      label: "Rating",
      value: Number(kitchen.avg_rating_10) > 0
        ? `${toStars(Number(kitchen.avg_rating_10)).toFixed(1)}★`
        : "—",
    },
    { label: "Repeat buyers", value: String(kitchen.repeat_customers) },
  ];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl text-forest">{kitchen.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
              <span
                className={
                  isDraft
                    ? "rounded-full bg-surface-sunk px-2 py-0.5 text-xs text-ink-muted"
                    : "rounded-full bg-forest px-2 py-0.5 text-xs text-cream"
                }
              >
                {isDraft ? "Draft" : "Open"}
              </span>
              <Link href={`/k/${kitchen.slug}`} className="underline-offset-2 hover:underline">
                View public page
              </Link>
            </p>
          </div>

          <div className="rounded-xl border border-line bg-surface px-4 py-3 text-right">
            <p className="text-xs text-ink-muted">Credibility</p>
            <p className="tabular font-display text-2xl text-forest">{credibility.score}</p>
            <p className="text-xs font-medium text-brass-ink">{tierLabel(credibility.tier)}</p>
          </div>
        </div>

        {isDraft && (
          <p className="rise mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber/40 bg-amber/10 p-4 text-xs text-ink">
            <span>
              <strong className="font-medium">Your kitchen is a draft.</strong> Nobody
              can order from it until you finish setting up.
            </span>
            <Link
              href="/cook/start"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-forest px-4 py-2 font-medium text-cream hover:bg-forest-deep"
            >
              Finish setup
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </p>
        )}

        <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-surface px-3 py-3.5 text-center">
              <dd className="tabular font-display text-xl text-forest">{s.value}</dd>
              <dt className="mt-0.5 text-[11px] text-ink-muted">{s.label}</dt>
            </div>
          ))}
        </dl>

        {credibility.nextTier && (
          <p className="mt-2 text-center text-xs text-ink-muted">
            <span className="tabular">{credibility.pointsToNextTier}</span> points to{" "}
            {tierLabel(credibility.nextTier)}
          </p>
        )}

        <Link href="/cook/payments" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-forest/20 bg-forest-soft p-5 text-forest">
          <span><span className="block text-sm font-medium">Cash sales &amp; payments</span><span className="mt-1 block text-sm">View your 5% cash-sale fees and settle by card. Tips are excluded.</span></span>
          <ArrowRight className="h-5 w-5 shrink-0" aria-hidden />
        </Link>

        {/* ------------------------------------------------------ orders --- */}
        <h2 className="mt-8 font-display text-xl text-forest">
          Live orders{" "}
          {live.length > 0 && <span className="tabular text-ink-muted">({live.length})</span>}
        </h2>

        {live.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-line bg-surface-sunk p-8 text-center text-sm text-ink-muted">
            Nothing waiting. New orders appear here.
          </p>
        ) : (
          <ul className="stagger mt-3 space-y-3">
            {live.map((o) => {
              const buyer = o.profiles as unknown as { display_name: string; handle: string };
              const items = (o.order_items ?? []) as unknown as {
                qty: number;
                name_snapshot: string;
              }[];
              return (
                <li key={o.id} className="rounded-xl border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-ink">{buyer?.display_name}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {items.map((i) => `${i.qty} × ${i.name_snapshot}`).join(", ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="tabular text-sm font-medium text-forest">
                        {formatCents(o.subtotal_cents + o.tip_cents)}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {o.payment_method === "cash" ? "Cash at pickup" : "Card"}
                      </p>
                    </div>
                  </div>

                  {(o.status === "accepted" || o.status === "ready") && (
                    <p className="mt-3 rounded-lg bg-surface-sunk px-3 py-2 text-xs text-ink-muted">
                      Pickup code:{" "}
                      <span className="tabular font-display text-base tracking-widest text-forest">
                        {o.pickup_code}
                      </span>{" "}
                      — check it before marking collected.
                    </p>
                  )}

                  <p className="mt-3 text-sm text-ink-muted">Tip: {formatCents(o.tip_cents)}{o.payment_method === "cash" && <> &middot; Dishd fee on collection: {formatCents(o.cash_fee_cents)}</>}</p>
                  <OrderActions orderId={o.id} status={o.status} />
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-ink-muted">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Marking an order collected records a verified visit for the buyer and
          updates your credibility. It cannot be undone.
        </p>

        {/* ----------------------------------------------------- sourcing --- */}
        <div className="mt-10 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-xl text-forest">
            <ReceiptText className="h-5 w-5" aria-hidden />
            Sourcing
          </h2>
          <Link
            href="/cook/start"
            className="text-xs text-forest underline-offset-2 hover:underline"
          >
            Upload a receipt
          </Link>
        </div>

        {batches.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-line bg-surface-sunk p-6 text-center text-sm text-ink-muted">
            No receipts yet. Meat dishes need one behind them.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {batches.map((b) => (
              <li
                key={b.id}
                className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${
                  b.match_status === "verified"
                    ? "border-forest/25 bg-forest-soft/60 text-forest"
                    : b.match_status === "pending"
                      ? "border-amber/30 bg-amber/10 text-amber"
                      : "border-clay/30 bg-clay/10 text-clay"
                }`}
              >
                {b.match_status === "verified" ? (
                  <ShieldCheck className="mt-px h-4 w-4 shrink-0" aria-hidden />
                ) : b.match_status === "pending" ? (
                  <Clock className="mt-px h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <TriangleAlert className="mt-px h-4 w-4 shrink-0" aria-hidden />
                )}
                <span>
                  {b.ocr_store ?? "Receipt"} · {b.ocr_date ?? "undated"} —{" "}
                  {b.match_status === "verified"
                    ? "verified, backing your meat dishes"
                    : b.match_status === "pending"
                      ? "with a reviewer; your sourcing badge goes live once confirmed"
                      : "rejected, so dishes relying on it are not on sale"}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* --------------------------------------------------------- menu --- */}
        <div className="mt-10 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-xl text-forest">
            <Utensils className="h-5 w-5" aria-hidden />
            Menu{" "}
            {menu.length > 0 && <span className="tabular text-sm text-ink-muted">({menu.length})</span>}
          </h2>
          <Link
            href="/cook/start"
            className="text-xs text-forest underline-offset-2 hover:underline"
          >
            Add a dish
          </Link>
        </div>

        {menu.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-line bg-surface-sunk p-6 text-center text-sm text-ink-muted">
            Nothing listed yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
            {menu.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 p-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                  <p className="tabular mt-0.5 text-xs text-ink-muted">
                    {formatCents(item.price_cents)}
                    {item.contains_meat && " · contains meat"}
                  </p>
                </div>
                <MenuAvailabilityToggle
                  itemId={item.id}
                  name={item.name}
                  available={item.is_available}
                />
              </li>
            ))}
          </ul>
        )}
        <DemoAd variant={1} />
      </main>
    </>
  );
}
