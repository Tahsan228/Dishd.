import { Suspense } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { KitchenPublic, ProfilePublic } from "@/lib/types";
import { SiteHeader } from "@/components/market/site-header";
import { DiscoveryFeed } from "@/components/market/discovery-feed";
import { getDiscoveryData } from "@/lib/market/discovery-data";
import { getRewardSummary } from "@/lib/market/reward-summary";
import { resolveLocation } from "@/lib/market/nearby";
import { newYorkDate } from "@/lib/market/discovery";
import { PendingPickupReviews } from "@/components/social/pending-pickup-reviews";
import { BuyerSummary, BuyerSummaryPreview } from "@/components/market/buyer-summary";

async function BuyerPoints({ id }: { id: string }) {
  const points = await getRewardSummary(id);
  return <Link href="/rewards" className="flex shrink-0 items-center gap-3 rounded-2xl border border-brass/30 bg-brass/10 px-5 py-4 text-forest">
    <Sparkles className="h-5 w-5 text-brass-ink" aria-hidden />
    <span><strong className="tabular block text-lg">{points.available ? points.balance.toLocaleString() + " points" : "Your rewards"}</strong><span className="text-xs text-ink-muted">Spendable Neighborhood Points</span></span>
  </Link>;
}
async function HomeDiscovery({ kitchens, profile, near }: { kitchens: KitchenPublic[]; profile: ProfilePublic; near?: string }) {
  const data = await getDiscoveryData(kitchens, profile.id);
  const now = new Date();
  return <DiscoveryFeed {...data} initialLocation={resolveLocation(near ?? profile.city ?? "Hackensack")} today={newYorkDate(now)} now={now.getTime()} />;
}
export function BuyerHome({ profile, kitchens, near }: { profile: ProfilePublic; kitchens: KitchenPublic[]; near?: string }) {
  return <><SiteHeader /><main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-7 sm:px-6">
    <Suspense fallback={<BuyerSummaryPreview profile={profile} />}><BuyerSummary profile={profile} /></Suspense>
    <div className="mt-8 flex flex-wrap items-start justify-between gap-5">
      <div><p className="text-sm text-ink-muted">Good food, close to home.</p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl leading-tight text-forest sm:text-5xl">What&apos;s cooking near me?</h1>
        <p className="mt-3 max-w-xl text-base text-ink-muted">Tonight&apos;s dinner. A new favorite. A meal for everyone at the table.</p></div>
      <Suspense fallback={<Link href="/rewards" className="rounded-2xl bg-brass/10 px-5 py-4 text-sm text-forest">Your Neighborhood Points</Link>}><BuyerPoints id={profile.id} /></Suspense>
    </div>
    <Suspense fallback={null}><PendingPickupReviews buyerId={profile.id} /></Suspense>
    <Suspense fallback={<div role="status" className="mt-7 rounded-2xl bg-forest-soft p-6 text-sm text-forest">Bringing the neighborhood menu to your table…</div>}><HomeDiscovery kitchens={kitchens} profile={profile} near={near} /></Suspense>
  </main></>;
}
