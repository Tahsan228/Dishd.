import { notFound } from "next/navigation";
import { MapPin, BadgeCheck, Home, Ban } from "lucide-react";
import { getKitchenBySlug, getKitchenMenu } from "@/lib/market/kitchens";
import { currentProfile } from "@/lib/market/auth-actions";
import { OrderPanel } from "@/components/market/order-panel";
import { MenuGrid } from "@/components/market/menu-grid";
import { SiteHeader } from "@/components/market/site-header";
import { cardAvailability } from "@/lib/market/payments";

// Guest workstream (Codex) owns these three. They are stubs until then.
// This file composes them and does not change.
import { KitchenCredibilityPanel } from "@/components/social/kitchen-credibility-panel";
import { KitchenBadgeShelf } from "@/components/social/kitchen-badge-shelf";
import { ReviewFeed } from "@/components/social/review-feed";

export default async function KitchenPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const kitchen = await getKitchenBySlug(slug);
  if (!kitchen) notFound();

  const banned = kitchen.status === "banned";
  const [menu, profile] = await Promise.all([
    getKitchenMenu(kitchen.id),
    currentProfile(),
  ]);

  // Only dishes that are actually orderable: available, and if they contain
  // meat, backed by a receipt that has cleared review.
  const orderable = menu
    .filter((m) => m.is_available)
    .filter((m) => !m.contains_meat || m.sourcing_batches?.match_status === "verified")
    .map((m) => ({
      id: m.id,
      name: m.name,
      price_cents: m.price_cents,
      contains_meat: m.contains_meat,
    }));

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6">
        <div className="fade mt-4 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-surface-sunk sm:aspect-[21/8] lg:aspect-[3/1]">
          {kitchen.hero_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={kitchen.hero_url}
              alt=""
              className={`h-full w-full object-cover ${banned ? "grayscale" : ""}`}
            />
          )}
        </div>

        {/* The accountability record. A banned kitchen keeps its page on purpose. */}
        {banned && (
          <div className="mt-4 rounded-xl border border-clay/40 bg-clay/10 p-5">
            <h2 className="flex items-center gap-2 font-display text-lg text-clay">
              <Ban className="h-5 w-5" aria-hidden />
              Removed from Dishd
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink">{kitchen.banned_reason}</p>
            <p className="mt-3 text-xs text-ink-muted">
              This page stays public so the record is permanent.
            </p>
          </div>
        )}

        <div className="rise mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[2rem] leading-[1.05] text-forest sm:text-5xl">
              {kitchen.name}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {kitchen.neighborhood_label}
              </span>
              {kitchen.cuisine_tags.length > 0 && <span>{kitchen.cuisine_tags.join(" · ")}</span>}
            </p>
          </div>

          {kitchen.permit_status === "verified" && (
            <span className="flex items-center gap-1.5 rounded-full bg-forest px-3 py-1.5 text-xs font-medium text-cream">
              <BadgeCheck className="h-4 w-4" aria-hidden />
              MEHKO permit verified
            </span>
          )}
        </div>

        {kitchen.bio && (
          <p className="mt-4 max-w-2xl leading-relaxed text-ink">{kitchen.bio}</p>
        )}

        {/* Approximate location only. The exact address is RLS-gated in Postgres
            and is revealed after the cook accepts an order. */}
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-line bg-surface-sunk p-3 text-xs text-ink-muted">
          <Home className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            This food is prepared in a <strong className="text-ink">private home kitchen
            that is not routinely inspected by a health department</strong>. The exact
            address is shared once your order is accepted.
          </span>
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
          <div className="order-2 lg:order-1">
            <h2 className="font-display text-2xl text-forest sm:text-3xl">On the menu</h2>
            <div className="mt-4">
              <MenuGrid kitchenId={kitchen.id} />
            </div>

            <h2 className="mt-12 font-display text-2xl text-forest sm:text-3xl">Reviews</h2>
            <div className="mt-4">
              <ReviewFeed kitchenId={kitchen.id} />
            </div>
          </div>

          <aside className="order-1 space-y-4 lg:order-2 lg:sticky lg:top-20 lg:self-start">
            <KitchenCredibilityPanel kitchenId={kitchen.id} />
            <KitchenBadgeShelf kitchenId={kitchen.id} />
            {!banned && orderable.length > 0 && (
              <OrderPanel
                kitchenId={kitchen.id}
                slug={kitchen.slug}
                items={orderable}
                cardUnavailableReason={cardAvailability(kitchen).reason}
                signedIn={Boolean(profile)}
              />
            )}
          </aside>
        </div>
      </main>
    </>
  );
}
