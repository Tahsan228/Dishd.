import Link from "next/link";
import { ShieldCheck, Star } from "lucide-react";
import type { KitchenPublic } from "@/lib/types";
import { toStars } from "@/lib/utils";

/**
 * Discovery card. Shows marketplace facts only — rating, volume, sourcing.
 *
 * Deliberately does NOT show the credibility tier: that lives on the kitchen
 * page in the social workstream's credibility panel, so this file has no
 * dependency on the scoring formula.
 */
export function KitchenCard({ kitchen }: { kitchen: KitchenPublic }) {
  const stars = toStars(Number(kitchen.avg_rating_10));
  const hasSourcingStreak = kitchen.trust_streak > 0;

  return (
    <Link
      href={`/k/${kitchen.slug}`}
      className="group block overflow-hidden rounded-xl border border-line bg-surface transition hover:border-forest/30"
    >
      <div className="aspect-[16/10] w-full bg-surface-sunk">
        {kitchen.hero_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={kitchen.hero_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg leading-tight text-forest">
            {kitchen.name}
          </h3>
          {Number(kitchen.avg_rating_10) > 0 && (
            <span className="tabular flex shrink-0 items-center gap-1 text-sm text-ink">
              <Star className="h-3.5 w-3.5 fill-brass text-brass" aria-hidden />
              {stars.toFixed(1)}
            </span>
          )}
        </div>

        <p className="mt-1 text-sm text-ink-muted">
          {kitchen.neighborhood_label}
          {kitchen.cuisine_tags.length > 0 && (
            <> &middot; {kitchen.cuisine_tags.slice(0, 2).join(", ")}</>
          )}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
          {kitchen.orders_completed > 0 && (
            <span className="tabular">{kitchen.orders_completed} meals served</span>
          )}
          {hasSourcingStreak && (
            <span className="flex items-center gap-1 text-brass-ink">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Receipt-verified sourcing
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
