import Link from "next/link";
import { ShieldCheck, ReceiptText, MapPinned, Star } from "lucide-react";
import {
  listActiveKitchens,
  getPlatformStats,
  getRecentActivity,
} from "@/lib/market/kitchens";
import { KitchenCard } from "@/components/market/kitchen-card";
import { SiteHeader } from "@/components/market/site-header";
import { BuyerHome } from "@/components/market/buyer-home";
import { currentProfile } from "@/lib/market/auth-actions";
import { toStars } from "@/lib/utils";

function timeAgo(iso: string) {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 864e5);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

export default async function DiscoveryPage() {
  const [kitchens, stats, activity, profile] = await Promise.all([
    listActiveKitchens(),
    getPlatformStats(),
    getRecentActivity(6),
    currentProfile(),
  ]);

  // Someone signed in has already been sold the idea; they came here to order.
  // The pitch below is for a first visit.
  if (profile) return <BuyerHome profile={profile} kitchens={kitchens} />;

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6">
        {/* Hero */}
        <section className="rise grid gap-8 pt-8 pb-10 lg:grid-cols-[1.15fr_1fr] lg:items-end lg:gap-14 lg:pt-14 lg:pb-14">
          <div>
            <p className="text-xs font-medium tracking-[0.14em] text-brass-ink uppercase">
              Fremont &middot; Alameda County
            </p>
            <h1 className="mt-3 font-display text-[2.5rem] leading-[1.02] text-forest sm:text-6xl lg:text-7xl">
              Home cooks,
              <br />
              <em className="italic">properly</em> vouched for.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-muted sm:text-lg">
              Halal meals cooked in real kitchens by real neighbours. Every meat
              dish is backed by a purchase receipt you can actually inspect, and
              every rating comes from someone who collected the food.
            </p>
          </div>

          {/* Three-step trust explainer. This is the product in one glance. */}
          <ul className="stagger space-y-3">
            {[
              {
                icon: ReceiptText,
                title: "The cook shows the receipt",
                body: "No meat dish goes on sale without a purchase receipt from a registered halal supplier.",
              },
              {
                icon: ShieldCheck,
                title: "We check what can be checked",
                body: "Duplicate receipts, unregistered shops and stale dates are rejected automatically. A reviewer confirms the rest.",
              },
              {
                icon: Star,
                title: "Only diners who paid can rate",
                body: "A review is written against a completed pickup, so the score cannot be farmed.",
              },
            ].map((s) => (
              <li
                key={s.title}
                className="flex gap-3 rounded-xl border border-line bg-surface p-4"
              >
                <s.icon className="mt-0.5 h-5 w-5 shrink-0 text-brass" aria-hidden />
                <span>
                  <span className="block text-sm font-medium text-ink">{s.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
                    {s.body}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {stats && (
          <dl className="stagger grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
            {[
              { k: "Kitchens open", v: stats.kitchens },
              { k: "Meals collected", v: stats.mealsServed },
              { k: "Receipts verified", v: stats.verifiedBatches },
              { k: "Neighbourhoods", v: stats.neighbourhoods },
            ].map((s) => (
              <div key={s.k} className="bg-cream px-4 py-5 text-center sm:px-6">
                <dd className="tabular font-display text-3xl text-forest sm:text-4xl">{s.v}</dd>
                <dt className="mt-1 text-xs text-ink-muted">{s.k}</dt>
              </div>
            ))}
          </dl>
        )}

        {/* Kitchens */}
        <section className="mt-14">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-3xl text-forest sm:text-4xl">
              Kitchens near you
            </h2>
            <p className="flex items-center gap-1.5 text-xs text-ink-muted">
              <MapPinned className="h-3.5 w-3.5" aria-hidden />
              Approximate areas only until an order is accepted
            </p>
          </div>

          {kitchens.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-line bg-surface-sunk p-12 text-center">
              <p className="text-ink-muted">
                No kitchens yet. Run <code className="text-ink">npm run seed</code> once
                Supabase is connected.
              </p>
            </div>
          ) : (
            <div className="stagger mt-6 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {kitchens.map((k) => (
                <KitchenCard key={k.id} kitchen={k} />
              ))}
            </div>
          )}
        </section>

        {/* Recent verified meals — the social proof, from real data. */}
        {activity.length > 0 && (
          <section className="mt-16">
            <h2 className="font-display text-3xl text-forest sm:text-4xl">
              Recently eaten
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              Every entry below is tied to a pickup someone actually completed.
            </p>

            <div className="stagger mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activity.map((a) => (
                <article
                  key={a.id}
                  className="flex flex-col rounded-xl border border-line bg-surface p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-ink">
                      {a.author?.display_name ?? "A diner"}
                    </span>
                    {a.rating_10 !== null && (
                      <span className="tabular flex items-center gap-1 text-sm text-ink">
                        <Star className="h-3.5 w-3.5 fill-brass text-brass" aria-hidden />
                        {toStars(a.rating_10).toFixed(1)}
                      </span>
                    )}
                  </div>

                  {a.kitchen && (
                    <Link
                      href={`/k/${a.kitchen.slug}`}
                      className="mt-0.5 text-xs text-forest underline-offset-2 hover:underline"
                    >
                      {a.kitchen.name}
                    </Link>
                  )}

                  {a.body && (
                    <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-ink-muted">
                      &ldquo;{a.body}&rdquo;
                    </p>
                  )}

                  <p className="mt-auto pt-3 text-[11px] text-ink-muted">
                    <ShieldCheck className="mr-1 inline h-3 w-3 text-forest" aria-hidden />
                    Verified pickup &middot; {timeAgo(a.logged_at)}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Cook CTA */}
        <section className="mt-16 overflow-hidden rounded-2xl bg-forest px-6 py-12 text-center sm:px-12 sm:py-16">
          <h2 className="font-display text-3xl text-cream sm:text-4xl">
            Cooking already? Start selling.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-cream/75">
            Dishd builds you a verifiable trading history — meals served, repeat
            customers, sourcing streak — the kind of record no bank has ever let a
            home cook prove.
          </p>
          <Link
            href="/cook"
            className="mt-6 inline-block rounded-full bg-cream px-6 py-3 text-sm font-medium text-forest hover:bg-white"
          >
            Set up your kitchen
          </Link>
        </section>
      </main>
    </>
  );
}
