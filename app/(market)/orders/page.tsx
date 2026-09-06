import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowRight,
  Ban,
  CheckCircle2,
  ChefHat,
  Clock,
  PackageCheck,
  Receipt,
  Star,
} from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/market/site-header";
import { formatCents } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types";

export const metadata: Metadata = {
  title: "Your orders · Dishd",
  description: "Every pickup you have placed, and where each one is up to.",
};

/**
 * How each status reads to the buyer.
 *
 * `live` decides whether the order still moves on its own, which is what
 * earns the prominent "Track order" button — a finished order does not need
 * one, and a cancelled order must not look like it is still coming.
 */
const STATUS: Record<
  OrderStatus,
  { label: string; note: string; live: boolean; tone: string; icon: typeof Clock }
> = {
  pending: {
    label: "Waiting on the cook",
    note: "They confirm before cooking.",
    live: true,
    tone: "bg-amber/15 text-amber",
    icon: Clock,
  },
  accepted: {
    label: "Accepted",
    note: "The pickup address is unlocked.",
    live: true,
    tone: "bg-forest-soft text-forest",
    icon: CheckCircle2,
  },
  ready: {
    label: "Ready for pickup",
    note: "Show your pickup code when you arrive.",
    live: true,
    tone: "bg-forest text-cream",
    icon: PackageCheck,
  },
  completed: {
    label: "Collected",
    note: "In your diary.",
    live: false,
    tone: "bg-forest-soft text-forest",
    icon: ChefHat,
  },
  cancelled: {
    label: "Cancelled",
    note: "This order did not go ahead.",
    live: false,
    tone: "bg-surface-sunk text-ink-muted",
    icon: Ban,
  },
  declined: {
    label: "Declined",
    note: "The cook could not take this one.",
    live: false,
    tone: "bg-surface-sunk text-ink-muted",
    icon: Ban,
  },
};

export default async function OrdersPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) redirect("/signin?next=%2Forders");

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=%2Forders");

  // RLS already limits orders to this buyer or their kitchen; the explicit
  // filter keeps a cook's own incoming orders out of their buyer history.
  const { data: orders } = await supabase
    .from("orders")
    .select(
      `id, status, payment_method, payment_status, subtotal_cents, pickup_code,
       created_at, kitchen_id,
       kitchens ( name, slug ),
       order_items ( qty, name_snapshot )`,
    )
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(60);

  const rows = orders ?? [];

  // One query for every review, rather than one per order.
  const completedIds = rows.filter((o) => o.status === "completed").map((o) => o.id);
  const { data: logs } = completedIds.length
    ? await supabase
        .from("logs")
        .select("id, order_id, rating_10")
        .eq("buyer_id", user.id)
        .in("order_id", completedIds)
    : { data: [] };

  const reviewByOrder = new Map<string, { id: string; rating_10: number | null }>();
  for (const log of logs ?? []) {
    if (log.order_id) reviewByOrder.set(log.order_id, { id: log.id, rating_10: log.rating_10 });
  }

  const live = rows.filter((o) => STATUS[o.status as OrderStatus]?.live);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <h1 className="font-display text-3xl text-forest sm:text-4xl">Your orders</h1>
        <p className="mt-2 leading-relaxed text-ink-muted">
          Every pickup you have placed, and where each one is up to.
          {live.length > 0 && (
            <>
              {" "}
              <span className="font-medium text-forest">
                {live.length === 1 ? "One order is" : `${live.length} orders are`} still in
                progress.
              </span>
            </>
          )}
        </p>

        {rows.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-line bg-surface-sunk p-12 text-center">
            <Receipt className="mx-auto h-7 w-7 text-ink-muted" aria-hidden />
            <p className="mt-3 text-ink-muted">You haven&rsquo;t ordered anything yet.</p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-full bg-forest px-5 py-2.5 text-sm font-medium text-cream hover:bg-forest-deep"
            >
              Find a kitchen
            </Link>
          </div>
        ) : (
          <ul className="stagger mt-8 space-y-4">
            {rows.map((order) => {
              const kitchen = order.kitchens as unknown as { name: string; slug: string } | null;
              const items = (order.order_items ?? []) as unknown as {
                qty: number;
                name_snapshot: string;
              }[];
              const status = STATUS[order.status as OrderStatus] ?? STATUS.pending;
              const review = reviewByOrder.get(order.id);
              const Icon = status.icon;

              return (
                <li
                  key={order.id}
                  className="lift rounded-2xl border border-line bg-surface p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${status.tone}`}
                      >
                        <Icon className="h-3 w-3" aria-hidden />
                        {status.label}
                      </span>
                      <p className="mt-2 font-display text-xl text-forest">
                        {kitchen ? (
                          <Link href={`/k/${kitchen.slug}`} className="hover:underline">
                            {kitchen.name}
                          </Link>
                        ) : (
                          "Kitchen unavailable"
                        )}
                      </p>
                      <p className="mt-1 text-sm text-ink-muted">
                        {items.length > 0
                          ? items.map((i) => `${i.qty} × ${i.name_snapshot}`).join(", ")
                          : "No items recorded"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="tabular font-display text-xl text-forest">
                        {formatCents(order.subtotal_cents)}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {new Date(order.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-ink-muted">{status.note}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {/* The button the buyer wanted: get back to a live order's
                        status after navigating away. */}
                    <Link
                      href={`/order/${order.id}`}
                      className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-medium ${
                        status.live
                          ? "bg-forest text-cream hover:bg-forest-deep"
                          : "border border-line text-ink-muted hover:border-forest hover:text-forest"
                      }`}
                    >
                      {status.live ? "Track order" : "View order"}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>

                    {order.status === "completed" &&
                      (review ? (
                        <Link
                          href={`/log/${review.id}`}
                          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brass/50 bg-brass/10 px-5 text-sm font-medium text-brass-ink hover:bg-brass/20"
                        >
                          <Star className="h-3.5 w-3.5" aria-hidden />
                          {review.rating_10 === null ? "Rate your meal" : "View diary entry"}
                        </Link>
                      ) : (
                        // The trigger writes the log on completion; if it is not
                        // there yet the order page can recover it.
                        <Link
                          href={`/order/${order.id}`}
                          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brass/50 bg-brass/10 px-5 text-sm font-medium text-brass-ink hover:bg-brass/20"
                        >
                          <Star className="h-3.5 w-3.5" aria-hidden />
                          Write your review
                        </Link>
                      ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
