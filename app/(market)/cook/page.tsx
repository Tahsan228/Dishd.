import Link from "next/link";
import { redirect } from "next/navigation";
import { ChefHat, Clock, ShieldCheck, TriangleAlert } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/market/site-header";
import { OrderActions } from "@/components/market/order-actions-buttons";
import { formatCents } from "@/lib/utils";

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
    .select("id, name, slug, status, orders_completed, trust_streak, permit_status")
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
            You&apos;ll need a MEHKO permit for your county, and a receipt for any
            meat you cook with. Onboarding isn&apos;t built yet — sign in as a
            seeded cook to see the dashboard.
          </p>
          <Link
            href="/signin?next=/cook"
            className="mt-5 inline-block rounded-full bg-forest px-5 py-2.5 text-sm font-medium text-cream hover:bg-forest-deep"
          >
            Sign in as a cook
          </Link>
        </main>
      </>
    );
  }

  const { data: orders } = await supabase
    .from("orders")
    .select(
      `id, status, payment_method, subtotal_cents, pickup_code, created_at,
       profiles ( display_name, handle ),
       order_items ( qty, name_snapshot )`,
    )
    .eq("kitchen_id", kitchen.id)
    .in("status", ["pending", "accepted", "ready"])
    .order("created_at", { ascending: true });

  const { data: pendingBatches } = await supabase
    .from("sourcing_batches")
    .select("id, ocr_store, ocr_date, match_status")
    .eq("kitchen_id", kitchen.id)
    .in("match_status", ["pending", "mismatch"])
    .order("created_at", { ascending: false });

  const live = orders ?? [];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl text-forest">{kitchen.name}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              <Link href={`/k/${kitchen.slug}`} className="underline-offset-2 hover:underline">
                View public page
              </Link>
            </p>
          </div>
          <dl className="stagger flex gap-5 text-right">
            <div>
              <dt className="text-xs text-ink-muted">Meals served</dt>
              <dd className="tabular font-display text-2xl text-forest">
                {kitchen.orders_completed}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Sourcing streak</dt>
              <dd className="tabular font-display text-2xl text-brass-ink">
                {kitchen.trust_streak}
              </dd>
            </div>
          </dl>
        </div>

        {(pendingBatches ?? []).length > 0 && (
          <section className="stagger mt-6 space-y-2">
            {(pendingBatches ?? []).map((b) =>
              b.match_status === "pending" ? (
                <p
                  key={b.id}
                  className="flex items-center gap-2 rounded-lg border border-amber/30 bg-amber/10 p-3 text-xs text-amber"
                >
                  <Clock className="h-4 w-4 shrink-0" aria-hidden />
                  Receipt from {b.ocr_store} ({b.ocr_date}) is with a reviewer. Your
                  sourcing badge goes live once they confirm it.
                </p>
              ) : (
                <p
                  key={b.id}
                  className="flex items-center gap-2 rounded-lg border border-clay/30 bg-clay/10 p-3 text-xs text-clay"
                >
                  <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
                  Receipt from {b.ocr_store} was rejected. Dishes relying on it are
                  not on sale.
                </p>
              ),
            )}
          </section>
        )}

        <h2 className="mt-8 font-display text-xl text-forest">
          Live orders {live.length > 0 && <span className="tabular text-ink-muted">({live.length})</span>}
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
                qty: number; name_snapshot: string;
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
                        {formatCents(o.subtotal_cents)}
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

                  <OrderActions orderId={o.id} status={o.status} />
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-8 flex items-start gap-2 text-xs leading-relaxed text-ink-muted">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Marking an order collected records a verified visit for the buyer and
          updates your credibility. It cannot be undone.
        </p>
      </main>
    </>
  );
}
