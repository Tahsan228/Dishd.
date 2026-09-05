import type {
  BuyerCounters,
  BuyerTier,
  CredibilityResult,
  CredibilityTier,
  KitchenCounters,
  ScoreComponent,
} from "@/lib/types";

export const KITCHEN_TIERS: ReadonlyArray<{
  tier: CredibilityTier;
  threshold: number;
  unlocks: string;
}> = [
  { tier: "new_kitchen", threshold: 0, unlocks: "5 orders/day" },
  { tier: "established", threshold: 150, unlocks: "15 orders/day · Appears in Rising" },
  {
    tier: "trusted_kitchen",
    threshold: 400,
    unlocks: "Featured placement · 30 orders/day · Reduced commission",
  },
  { tier: "dishd_verified", threshold: 800, unlocks: "Top placement · Exportable Business Record" },
];

const LABELS: Record<CredibilityTier | BuyerTier, string> = {
  new_kitchen: "New kitchen",
  established: "Established",
  trusted_kitchen: "Trusted kitchen",
  dishd_verified: "Dishd verified",
  newcomer: "Newcomer",
  regular: "Regular",
  trusted_taster: "Trusted taster",
  community_pillar: "Community pillar",
};

export function tierLabel(tier: CredibilityTier | BuyerTier): string {
  return LABELS[tier];
}

export function scoreKitchen(c: KitchenCounters, now = new Date()): CredibilityResult {
  const weeks = Math.floor((now.getTime() - new Date(c.created_at).getTime()) / 604_800_000);
  if (!Number.isFinite(weeks)) throw new RangeError("Credibility requires valid dates.");

  const components: ScoreComponent[] = [
    { label: "Completed orders", points: 12 * c.orders_completed, detail: `${c.orders_completed} orders × 12` },
    { label: "Average rating", points: 8 * c.avg_rating_10, detail: `${c.avg_rating_10}/10 × 8` },
    { label: "Sourcing streak", points: 20 * c.trust_streak, detail: `${c.trust_streak} verified batches × 20` },
    { label: "Verified permit", points: c.permit_status === "verified" ? 30 : 0, detail: `${c.permit_status === "verified" ? 1 : 0} verified permits × 30` },
    { label: "Returning customers", points: 5 * c.repeat_customers, detail: `${c.repeat_customers} returning customers × 5` },
    { label: "Time on Dishd", points: 2 * weeks, detail: `${weeks} full weeks × 2` },
    { label: "Upheld flags", points: -40 * c.upheld_flags, detail: `${c.upheld_flags} upheld flags × −40` },
    { label: "Open incidents", points: -25 * c.open_incidents, detail: `${c.open_incidents} open incidents × −25` },
    { label: "Cook cancellations", points: -15 * c.cook_cancellations, detail: `${c.cook_cancellations} cancellations × −15` },
  ];
  const rawScore = components.reduce((sum, component) => sum + component.points, 0);
  const score = Math.max(0, rawScore);
  // Keep every penalty visible while making the displayed arithmetic reconcile.
  if (rawScore < 0) {
    components.push({ label: "Minimum score adjustment", points: -rawScore, detail: "Scores stop at zero; penalties remain shown above." });
  }
  const index = score >= 800 ? 3 : score >= 400 ? 2 : score >= 150 ? 1 : 0;
  const next = KITCHEN_TIERS[index + 1];
  return {
    score,
    tier: KITCHEN_TIERS[index].tier,
    components,
    nextTier: next?.tier ?? null,
    pointsToNextTier: next ? next.threshold - score : null,
  };
}

export function scoreBuyer(c: BuyerCounters, now = new Date()): { score: number; tier: BuyerTier } {
  // Part of the shared signature; buyer credibility deliberately has no age bonus.
  void now;
  const score = Math.max(0,
    10 * c.verified_logs + 15 * c.distinct_kitchens + 5 * c.substantive_reviews
    + 3 * c.photo_logs + 2 * c.likes_received + 25 * c.upheld_flags - 20 * c.dismissed_flags,
  );
  const tier = score >= 700 ? "community_pillar" : score >= 300 ? "trusted_taster" : score >= 100 ? "regular" : "newcomer";
  return { score, tier };
}
