import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { KITCHEN_TIERS, scoreKitchen, tierLabel } from "@/lib/social/credibility";
import { formatNumber, KITCHEN_COUNTER_COLUMNS, socialClient, type KitchenSummary } from "@/lib/social/data";
import { cn } from "@/lib/utils";
import { SocialNotice } from "@/components/social/social-notice";
import { TierMark } from "@/components/social/tier-mark";

export async function KitchenCredibilityPanel({ kitchenId }: { kitchenId: string }) {
  const supabase = await socialClient();
  if (!supabase) return <SocialNotice title="A reputation built meal by meal">This kitchen’s credibility record will appear when Dishd is connected.</SocialNotice>;
  const { data, error } = await supabase.from("kitchens")
    .select(`id,name,slug,status,${KITCHEN_COUNTER_COLUMNS}`).eq("id", kitchenId).maybeSingle();
  if (error || !data) return <SocialNotice title="Credibility unavailable">We couldn’t load this kitchen’s record. Please try again shortly.</SocialNotice>;
  const kitchen = data as KitchenSummary;
  const result = scoreKitchen(kitchen);
  const current = KITCHEN_TIERS.find((entry) => entry.tier === result.tier)!;
  const next = KITCHEN_TIERS.find((entry) => entry.tier === result.nextTier);

  return (
    <section aria-label="Kitchen credibility" className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="bg-forest p-5 text-cream sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest"><ShieldCheck className="size-4 text-brass" aria-hidden="true" /> Built on real meals</p>
          <TierMark tier={result.tier} />
        </div>
        <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="tabular font-display text-6xl leading-none sm:text-7xl">{formatNumber(result.score)}</span>
          <span className="text-sm text-cream/80">credibility points</span>
        </div>
        <h2 className="mt-4 font-display text-2xl">Good food builds a good name.</h2>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-cream/80">Every fulfilled order, verified sourcing batch, and returning neighbor contributes. Here’s the whole picture.</p>
      </div>
      <div className="space-y-6 p-5 sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">This tier unlocks</p>
          <p className="mt-2 text-sm font-medium text-forest">{current.unlocks}</p>
          {kitchen.status !== "active" && <p className="mt-2 text-sm text-clay">Kitchen status: {kitchen.status}. Ordering and placement also require an active kitchen.</p>}
        </div>
        {next ? (
          <div>
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span className="font-medium">Next: {tierLabel(next.tier)}</span>
              <span className="tabular text-ink-muted">{formatNumber(result.pointsToNextTier!)} points to go</span>
            </div>
            <progress aria-label={`Progress to ${tierLabel(next.tier)}`} className="mt-3 h-2 w-full overflow-hidden rounded-full appearance-none [&::-webkit-progress-bar]:bg-surface-sunk [&::-webkit-progress-value]:bg-brass [&::-moz-progress-bar]:bg-brass" value={result.score - current.threshold} max={next.threshold - current.threshold} />
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">{next.unlocks}</p>
          </div>
        ) : kitchen.status === "active" ? (
          <Link href={`/k/${encodeURIComponent(kitchen.slug)}/record`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-forest px-4 py-2 text-sm font-semibold text-forest hover:bg-forest-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">View Business Record <ArrowUpRight aria-hidden="true" className="size-4" /></Link>
        ) : null}
        <div className="border-t border-line pt-5">
          <h3 className="font-display text-xl">Every point, explained</h3>
          <dl className="mt-3 divide-y divide-line">
            {result.components.map((component) => (
              <div key={component.label} className="flex items-start justify-between gap-4 py-3">
                <dt className="min-w-0 text-sm"><span className="font-medium">{component.label}</span><span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">{component.detail}</span></dt>
                <dd className={cn("tabular shrink-0 text-sm font-semibold", component.points < 0 ? "text-clay" : "text-forest")}>{component.points > 0 ? "+" : ""}{formatNumber(component.points)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-ink-muted">Sourcing batches awaiting review do not count toward or break a verified streak.</p>
        </div>
      </div>
    </section>
  );
}
