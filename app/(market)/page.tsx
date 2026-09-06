import Link from "next/link";
import {
  ArrowRight,
  ChefHat,
  MapPinned,
  ReceiptText,
  ShieldCheck,
  Star,
  Sparkles,
  Utensils,
} from "lucide-react";
import {
  listActiveKitchens,
  getPlatformStats,
  getRecentActivity,
} from "@/lib/market/kitchens";
import { KitchenCard } from "@/components/market/kitchen-card";
import { SiteHeader } from "@/components/market/site-header";
import { BuyerHome } from "@/components/market/buyer-home";
import { LocationSearch } from "@/components/market/location-search";
import { currentProfile } from "@/lib/market/auth-actions";
import { formatMiles, rankByDistance, resolveLocation } from "@/lib/market/nearby";
import { cn, toStars } from "@/lib/utils";

function timeAgo(iso: string) {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 864e5);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

/**
 * Decorative rating chips scattered around the hero plate.
 *
 * Each carries its own drift speed and tilt so they never bob in unison, which
 * is what makes floating elements read as mechanical.
 */
const HERO_RATINGS = [
  { score: "4.8", label: "Dishd Verified", at: "-top-3 -left-5", drift: "drift", tilt: "-3deg" },
  { score: "4.9", label: "Amina's Kitchen", at: "top-1/3 -right-6", drift: "drift-slow", tilt: "2.5deg" },
  { score: "4.6", label: "Hafsa's Table", at: "-bottom-4 -left-8", drift: "drift-slower", tilt: "3deg" },
] as const;

/** Three steps, told as a story rather than a feature list. */
const TRUST_STEPS = [
  {
    icon: ReceiptText,
    title: "The cook shows the receipt",
    body: "No meat dish goes on sale until the cook uploads a purchase receipt from a halal supplier they registered with us.",
  },
  {
    icon: ShieldCheck,
    title: "We check what can be checked",
    body: "Duplicate images, receipts already claimed elsewhere, unregistered shops and stale dates are rejected the moment they are submitted. A person confirms the rest.",
  },
  {
    icon: Star,
    title: "Only diners who paid can rate",
    body: "A review is written against a completed pickup. There is no way to leave one without having collected food, so the score cannot be farmed.",
  },
];

export default async function DiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ near?: string }>;
}) {
  const { near } = await searchParams;

  const [kitchens, profile] = await Promise.all([
    listActiveKitchens(),
    currentProfile(),
  ]);

  // Someone signed in has already been sold the idea; they came here to order.
  // The pitch below is for a first visit.
  if (profile) return <BuyerHome profile={profile} kitchens={kitchens} near={near} />;

  const [stats, activity] = await Promise.all([getPlatformStats(), getRecentActivity(6)]);

  // A typed town or ZIP re-orders the list by distance from that point.
  const location = near ? resolveLocation(near) : null;
  const ranked = location ? rankByDistance(kitchens, location.point) : null;
  const shown = ranked ?? kitchens.map((k) => ({ ...k, miles: Number.NaN }));

  return (
    <>
      <SiteHeader />

      <main className="pb-20">
        {/* ------------------------------------------------------------ hero */}
        <section className="relative overflow-hidden border-b border-line bg-forest">
          {/* A single soft warm wash rather than a photo behind the type. The
              photo lives in its own column to the right, so nothing competes
              with the words for contrast. */}
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(120%_80%_at_15%_0%,color-mix(in_oklab,var(--color-brass)_18%,transparent),transparent_60%)]"
          />

          <div className="rise relative mx-auto grid w-full max-w-7xl items-center gap-10 px-4 pt-10 pb-12 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14 lg:pt-14 lg:pb-16">
            {/* Copy column. Measure is capped near 60 characters so lines break
                where the eye expects rather than running the full page width. */}
            <div className="slide-left max-w-xl">
              <p className="flex items-center gap-2 text-xs font-medium tracking-[0.14em] text-brass uppercase">
                <MapPinned className="h-3.5 w-3.5" aria-hidden />
                Bergen County &middot; New Jersey
              </p>

              <h1 className="mt-3 font-display text-[2.5rem] leading-[1.06] text-cream sm:text-5xl lg:text-6xl">
                Home cooks,
                <br />
                <em className="italic text-brass">properly</em> vouched for.
              </h1>

              <p className="mt-4 text-base leading-relaxed text-cream/85 sm:text-lg">
                Halal meals cooked by neighbours in their own kitchens, collected
                from their door — every meat dish backed by a receipt you can
                actually read.
              </p>

              <div className="mt-6">
                <LocationSearch initial={near ?? ""} />
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <Link
                  href="/signup"
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brass px-6 py-3 text-sm font-semibold text-forest transition-colors hover:bg-brass/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream"
                >
                  Create your account
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/signin"
                  className="inline-flex min-h-12 items-center rounded-full border border-cream/35 px-5 py-3 text-sm font-medium text-cream transition-colors hover:bg-cream/10"
                >
                  Sign in
                </Link>
              </div>
            </div>

            {/* Dish column. Hidden below lg: at phone width a decorative photo
                would push the search box under the fold, which is the one thing
                the hero exists to show. */}
            <div className="slide-right delay-1 relative hidden lg:block">
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl bg-forest-deep shadow-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=1100&q=75"
                  alt="Kabuli pulao served from a home kitchen"
                  className="h-full w-full object-cover"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-forest/70 via-transparent to-transparent"
                />

                <figcaption className="absolute inset-x-5 bottom-5 flex items-center gap-3 rounded-2xl bg-cream/95 p-3.5 backdrop-blur-sm">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest">
                    <ShieldCheck className="h-4.5 w-4.5 text-cream" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">
                      Kabuli Pulao &middot; Amina&rsquo;s Kitchen
                    </span>
                    <span className="block text-xs text-ink-muted">
                      Lamb from Al-Khayam Halal Meat &middot; receipt verified
                    </span>
                  </span>
                </figcaption>
              </div>

              {/* Ratings scattered around the plate, each drifting on its own
                  clock so they never move in lockstep. Decorative: the real
                  numbers are on the cards below, and a screen reader gets
                  nothing useful from a floating "4.8". */}
              {HERO_RATINGS.map((chip) => (
                <div
                  key={chip.label}
                  aria-hidden
                  style={{ ["--tilt" as string]: chip.tilt }}
                  className={cn(
                    "absolute rounded-2xl border border-brass/40 bg-cream px-4 py-3 shadow-lg",
                    chip.at,
                    chip.drift,
                  )}
                >
                  <p className="tabular font-display text-2xl leading-none text-forest">
                    {chip.score}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] whitespace-nowrap text-brass-ink">
                    <Star className="h-3 w-3 fill-brass text-brass" aria-hidden />
                    {chip.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          {/* ---------------------------------------------------------- stats */}
          {stats && (
            <dl className="stagger -mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-sm sm:grid-cols-4">
              {[
                { k: "Kitchens open", v: stats.kitchens },
                { k: "Meals collected", v: stats.mealsServed },
                { k: "Receipts verified", v: stats.verifiedBatches },
                { k: "Neighbourhoods", v: stats.neighbourhoods },
              ].map((s) => (
                <div key={s.k} className="bg-surface px-4 py-6 text-center sm:px-6">
                  <dd className="tabular font-display text-3xl text-forest sm:text-4xl">{s.v}</dd>
                  <dt className="mt-1.5 text-xs text-ink-muted">{s.k}</dt>
                </div>
              ))}
            </dl>
          )}

          {/* -------------------------------------------------------- kitchens */}
          <section id="kitchens" className="mt-12 scroll-mt-20">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl text-forest sm:text-4xl">
                  {location ? `Kitchens near ${location.label}` : "Kitchens near you"}
                </h2>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-muted">
                  <MapPinned className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {location
                    ? "Distances are to an approximate neighbourhood point, not a doorstep."
                    : "Approximate areas only until a cook accepts your order."}
                </p>
              </div>
              {location && (
                <Link
                  href="/#kitchens"
                  className="text-sm text-forest underline-offset-2 hover:underline"
                >
                  Clear
                </Link>
              )}
            </div>

            {location && !location.matched && (
              <p className="mt-4 rounded-xl border border-amber/40 bg-amber/10 p-4 text-sm text-ink">
                We don&rsquo;t know <strong>{location.label}</strong> yet, so these
                are the kitchens around Bergen County. Dishd is only open here for
                now.
              </p>
            )}

            {kitchens.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-line bg-surface-sunk p-12 text-center">
                <p className="text-ink-muted">
                  No kitchens yet. Run <code className="text-ink">npm run seed</code> once
                  Supabase is connected.
                </p>
              </div>
            ) : (
              <ul className="stagger mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {shown.map((k) => (
                  <li key={k.id} className="relative">
                    {Number.isFinite(k.miles) && (
                      <span className="absolute top-3 right-3 z-10 rounded-full bg-forest/90 px-2.5 py-1 text-[11px] font-medium text-cream backdrop-blur-sm">
                        {formatMiles(k.miles)}
                      </span>
                    )}
                    <KitchenCard kitchen={k} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ----------------------------------------------------- how it works */}
          <section className="mt-16">
            <h2 className="font-display text-3xl text-forest sm:text-4xl">
              Why a rating here means something
            </h2>
            <p className="mt-2 max-w-2xl leading-relaxed text-ink-muted">
              Anyone can write five stars on a review site. Dishd is built so
              that neither the sourcing claim nor the rating can be made up.
            </p>

            <ol className="stagger mt-8 grid gap-5 lg:grid-cols-3">
              {TRUST_STEPS.map((step, i) => (
                <li
                  key={step.title}
                  className="lift relative overflow-hidden rounded-2xl border border-line bg-surface p-6"
                >
                  <span
                    aria-hidden
                    className="tabular absolute top-4 right-5 font-display text-5xl text-forest/5"
                  >
                    {i + 1}
                  </span>
                  <step.icon className="h-6 w-6 text-brass" aria-hidden />
                  <h3 className="mt-4 font-display text-xl text-forest">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* ------------------------------------------------- credibility note */}
          <section className="mt-14 grid gap-8 overflow-hidden rounded-3xl border border-line bg-surface lg:grid-cols-2">
            <div className="p-8 sm:p-10">
              <p className="text-xs font-medium tracking-[0.14em] text-brass-ink uppercase">
                The part that outlasts the meal
              </p>
              <h2 className="mt-3 font-display text-3xl text-forest">
                A trading record a cook can actually use
              </h2>
              <p className="mt-4 leading-relaxed text-ink-muted">
                A home cook has no verifiable trading history, which is exactly
                why banks, landlords and suppliers turn them away. Every
                completed pickup on Dishd builds one: meals served, repeat
                customers, average rating, and an unbroken halal sourcing streak.
              </p>
              <p className="mt-3 leading-relaxed text-ink-muted">
                At the top tier it becomes a one-page Business Record they can
                print and hand over — real figures, not a badge we invented.
              </p>
              <Link
                href="/community"
                className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-forest underline-offset-4 hover:underline"
              >
                See this week&rsquo;s kitchens
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>

            <div className="relative min-h-64 bg-surface-sunk">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=1000&q=70"
                alt="A home kitchen mid-service"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          </section>

          {/* ------------------------------------------------- recently eaten */}
          {activity.length > 0 && (
            <section className="mt-16">
              <h2 className="font-display text-3xl text-forest sm:text-4xl">Recently eaten</h2>
              <p className="mt-2 text-sm text-ink-muted">
                Every entry below is tied to a pickup someone actually completed.
              </p>

              <ul className="stagger mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {activity.map((a) => (
                  <li
                    key={a.id}
                    className="lift flex flex-col rounded-2xl border border-line bg-surface p-5"
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
                        className="mt-1 text-xs text-forest underline-offset-2 hover:underline"
                      >
                        {a.kitchen.name}
                      </Link>
                    )}

                    {a.body && (
                      <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-ink-muted">
                        &ldquo;{a.body}&rdquo;
                      </p>
                    )}

                    <p className="mt-auto flex items-center gap-1.5 pt-4 text-[11px] text-ink-muted">
                      <ShieldCheck className="h-3 w-3 text-forest" aria-hidden />
                      Verified pickup &middot; {timeAgo(a.logged_at)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* --------------------------------------------------- two audiences */}
          <section className="mt-16 grid gap-5 lg:grid-cols-2">
            <div className="lift rounded-3xl border border-line bg-surface p-8">
              <Utensils className="h-6 w-6 text-forest" aria-hidden />
              <h2 className="mt-4 font-display text-2xl text-forest">Come hungry</h2>
              <p className="mt-2 leading-relaxed text-ink-muted">
                Order a pickup, collect it from the cook, then keep a diary of
                every kitchen you have eaten at. Collecting meals earns
                Neighborhood Points you can spend on credit at the same small
                kitchens.
              </p>
              <Link
                href="/signup"
                className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream transition-colors hover:bg-forest-deep"
              >
                Create your account
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>

            <div className="lift relative overflow-hidden rounded-3xl bg-forest p-8">
              <Sparkles
                aria-hidden
                className="absolute -top-6 -right-6 h-32 w-32 text-brass/15"
              />
              <ChefHat className="h-6 w-6 text-brass" aria-hidden />
              <h2 className="mt-4 font-display text-2xl text-cream">Cooking already?</h2>
              <p className="mt-2 leading-relaxed text-cream/75">
                Six steps to open: your kitchen and address, your county permit,
                the halal shops you buy from, a sourcing receipt, your menu, then
                you are live. Nothing skippable — that is what the badge on your
                page is worth.
              </p>
              <Link
                href="/cook/start"
                className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-cream px-6 py-3 text-sm font-semibold text-forest transition-colors hover:bg-white"
              >
                Set up your kitchen
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </section>

          {/* ------------------------------------------------------ honest note */}
          <section className="mt-14 rounded-2xl border border-line bg-surface-sunk p-6 sm:p-8">
            <h2 className="font-display text-xl text-forest">What Dishd does not claim</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-muted">
              Dishd does not certify any food as halal and is not a certifying
              body. What it does is narrower and worth understanding: a cook
              declares where they bought their meat and uploads the receipt, and
              we check that paperwork holds up. Food here is prepared in private
              homes that are not routinely inspected by a health department.
            </p>
            <Link
              href="/legal"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-forest underline-offset-4 hover:underline"
            >
              Read the full terms
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </section>
        </div>
      </main>
    </>
  );
}
