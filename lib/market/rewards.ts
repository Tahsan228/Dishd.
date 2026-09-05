/**
 * Neighborhood Points — the buyer-facing rewards system.
 *
 * Deliberately separate from credibility. Credibility is a *kitchen's* trading
 * record and must stay hard to move; points are a *buyer's* loyalty balance and
 * are meant to be spent. Mixing them would let someone buy their way up a score
 * that banks are supposed to be able to trust.
 *
 * Every earning rule here mirrors a trigger in migration 0009. The database is
 * what actually awards points — this table exists so the UI can explain the
 * rules without inventing numbers that drift from them.
 */

export type EarnRule = {
  kind: string;
  label: string;
  points: string;
  detail: string;
  /** True when a human reviews the submission before points land. */
  moderated?: boolean;
};

export const EARN_RULES: EarnRule[] = [
  {
    kind: "pickup",
    label: "Collect a meal",
    points: "10",
    detail: "Every completed pickup from a neighbourhood kitchen.",
  },
  {
    kind: "purchase",
    label: "Spend at a small kitchen",
    points: "5 / $1",
    detail: "Five points for every dollar that reaches a cook.",
  },
  {
    kind: "discovery",
    label: "Try somewhere new",
    points: "25",
    detail: "The first time you order from a kitchen you have never used.",
  },
  {
    kind: "review",
    label: "Write a verified review",
    points: "20",
    detail: "Only for a pickup you actually completed.",
  },
  {
    kind: "photo",
    label: "Add a photo",
    points: "10",
    detail: "A photo on a verified review, so the next buyer sees the real dish.",
  },
  {
    kind: "promotion",
    label: "Post a video about Dishd",
    points: "200",
    detail: "Share a video that gets people to install the app.",
    moderated: true,
  },
  {
    kind: "promotion",
    label: "Post a video about a kitchen",
    points: "150",
    detail: "Feature one kitchen you have ordered from.",
    moderated: true,
  },
];

export type RewardEvent = {
  id: string;
  source_key: string;
  kind: string;
  points: number;
  description: string;
  created_at: string;
};

export type RewardCatalogItem = {
  code: string;
  name: string;
  points_cost: number;
  credit_cents: number;
  minimum_order_cents: number;
  active: boolean;
};

export type RewardRedemption = {
  id: string;
  reward_code: string;
  credit_cents: number;
  minimum_order_cents: number;
  status: "available" | "reserved" | "used";
  order_id: string | null;
  created_at: string;
};

export type RewardClaim = {
  id: string;
  mission: "app_video" | "kitchen_video";
  kitchen_id: string | null;
  proof_url: string;
  notes: string;
  status: "pending" | "approved" | "declined";
  resolution_note: string | null;
  created_at: string;
};

export function pointsBalance(events: Pick<RewardEvent, "points">[]): number {
  return events.reduce((total, e) => total + e.points, 0);
}

/** Points earned, ignoring anything spent. Used for the lifetime figure. */
export function pointsEarned(events: Pick<RewardEvent, "points">[]): number {
  return events.reduce((total, e) => total + (e.points > 0 ? e.points : 0), 0);
}

/**
 * Whether a credit can be applied to a basket.
 *
 * The minimum exists so a $10 credit cannot be spent on an $8 order and turn
 * into cash back. The database enforces it too, in `dishd_place_order`.
 */
export function creditUsable(
  redemption: Pick<RewardRedemption, "status" | "minimum_order_cents">,
  subtotalCents: number,
): boolean {
  return redemption.status === "available" && subtotalCents >= redemption.minimum_order_cents;
}

export function creditBlockedReason(
  redemption: Pick<RewardRedemption, "status" | "minimum_order_cents" | "credit_cents">,
  subtotalCents: number,
): string | null {
  if (redemption.status === "used") return "Already used.";
  if (redemption.status === "reserved") return "Held against an order that is still open.";
  if (subtotalCents < redemption.minimum_order_cents) {
    const short = redemption.minimum_order_cents - subtotalCents;
    return `Spend $${(short / 100).toFixed(2)} more to use this.`;
  }
  return null;
}

/** How far along the buyer is toward the cheapest reward they cannot yet afford. */
export function nextRewardProgress(
  balance: number,
  catalog: Pick<RewardCatalogItem, "name" | "points_cost">[],
): { name: string; needed: number; percent: number } | null {
  const next = catalog
    .filter((c) => c.points_cost > balance)
    .sort((a, b) => a.points_cost - b.points_cost)[0];
  if (!next) return null;
  return {
    name: next.name,
    needed: next.points_cost - balance,
    percent: Math.min(100, Math.round((balance / next.points_cost) * 100)),
  };
}
