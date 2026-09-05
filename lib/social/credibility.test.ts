import { describe, expect, it } from "vitest";
import type { BuyerCounters, KitchenCounters } from "../types";
import { scoreBuyer, scoreKitchen, tierLabel } from "./credibility";
import { BADGES, computedKitchenBadges, computedUserBadges, earnedBadges } from "./badges";

const now = new Date("2026-09-05T12:00:00Z");
const kitchen: KitchenCounters = {
  orders_completed: 0, avg_rating_10: 0, distinct_customers: 0, repeat_customers: 0,
  trust_streak: 0, permit_status: "none", upheld_flags: 0, open_incidents: 0,
  cook_cancellations: 0, created_at: now.toISOString(),
};
const buyer: BuyerCounters = {
  verified_logs: 0, distinct_kitchens: 0, substantive_reviews: 0, photo_logs: 0,
  likes_received: 0, upheld_flags: 0, dismissed_flags: 0, created_at: now.toISOString(),
};

describe("kitchen credibility", () => {
  it("starts at zero with all nine formula lines", () => {
    const result = scoreKitchen(kitchen, now);
    expect(result).toMatchObject({ score: 0, tier: "new_kitchen", nextTier: "established", pointsToNextTier: 150 });
    expect(result.components).toHaveLength(9);
  });
  it.each([
    [149, "new_kitchen", "established", 1], [150, "established", "trusted_kitchen", 250],
    [399, "established", "trusted_kitchen", 1], [400, "trusted_kitchen", "dishd_verified", 400],
    [799, "trusted_kitchen", "dishd_verified", 1], [800, "dishd_verified", null, null],
  ] as const)("scores %i at the correct boundary", (score, tier, nextTier, pointsToNextTier) => {
    // Five points per repeat customer plus two per full week can reach every boundary.
    const repeats = score % 2 === 0 ? 0 : 1;
    const weeks = (score - repeats * 5) / 2;
    const result = scoreKitchen({ ...kitchen, repeat_customers: repeats, created_at: new Date(now.getTime() - weeks * 604_800_000).toISOString() }, now);
    expect(result).toMatchObject({ score, tier, nextTier, pointsToNextTier });
  });
  it("matches the narrated formula, including every penalty", () => {
    const result = scoreKitchen({ ...kitchen, orders_completed: 20, avg_rating_10: 9, trust_streak: 4,
      permit_status: "verified", repeat_customers: 3, upheld_flags: 1, open_incidents: 2,
      cook_cancellations: 1, created_at: "2026-08-22T12:00:00Z" }, now);
    expect(result.score).toBe(240 + 72 + 80 + 30 + 15 + 4 - 40 - 50 - 15);
    expect(result.components.map((part) => part.points)).toEqual([240, 72, 80, 30, 15, 4, -40, -50, -15]);
    expect(result.components.reduce((sum, part) => sum + part.points, 0)).toBe(result.score);
  });
  it.each([["upheld_flags", -40], ["open_incidents", -25], ["cook_cancellations", -15]] as const)("retains %s below zero and reconciles the floor", (counter, penalty) => {
    const result = scoreKitchen({ ...kitchen, [counter]: 1 }, now);
    expect(result.score).toBe(0);
    expect(result.components.some((part) => part.points === penalty)).toBe(true);
    expect(result.components.reduce((sum, part) => sum + part.points, 0)).toBe(0);
  });
  it("counts full weeks, including the exact instant of a boundary", () => {
    const c = { ...kitchen, created_at: "2026-08-29T12:00:00Z" };
    expect(scoreKitchen(c, new Date(now.getTime() - 1)).score).toBe(0);
    expect(scoreKitchen(c, now).score).toBe(2);
  });
  it("awards permit points only after verification", () => {
    expect(scoreKitchen({ ...kitchen, permit_status: "claimed" }, now).score).toBe(0);
    expect(scoreKitchen({ ...kitchen, permit_status: "verified" }, now).score).toBe(30);
  });
  it("preserves decimal average ratings", () => {
    expect(scoreKitchen({ ...kitchen, avg_rating_10: 8.37 }, now).score).toBeCloseTo(66.96);
  });
});

describe("buyer credibility", () => {
  it.each([[0, "newcomer"], [99, "newcomer"], [100, "regular"], [299, "regular"], [300, "trusted_taster"], [699, "trusted_taster"], [700, "community_pillar"]] as const)("scores %i at the correct tier", (score, tier) => {
    const photos = score % 2 === 0 ? 0 : 1;
    expect(scoreBuyer({ ...buyer, photo_logs: photos, likes_received: (score - photos * 3) / 2 }, now)).toEqual({ score, tier });
  });
  it("includes every term, including dismissed reports", () => {
    expect(scoreBuyer({ ...buyer, verified_logs: 12, distinct_kitchens: 4, substantive_reviews: 3, photo_logs: 2, likes_received: 7, upheld_flags: 1, dismissed_flags: 2 }, now).score).toBe(200);
  });
  it("cannot go negative or earn points just for account age", () => {
    expect(scoreBuyer({ ...buyer, dismissed_flags: 2 }, now).score).toBe(0);
    expect(scoreBuyer(buyer, new Date("2030-01-01"))).toEqual(scoreBuyer(buyer, now));
  });
  it("labels both ladders for people", () => {
    expect(tierLabel("dishd_verified")).toBe("Dishd verified");
    expect(tierLabel("community_pillar")).toBe("Community pillar");
  });
});

describe("earned badges", () => {
  it("defines exactly thirteen unique badges", () => {
    expect(BADGES).toHaveLength(13);
    expect(new Set(BADGES.map((badge) => badge.code)).size).toBe(13);
  });
  it("does not award badges below their thresholds", () => {
    expect(computedKitchenBadges({ ...kitchen, orders_completed: 49, trust_streak: 9, repeat_customers: 19, permit_status: "claimed" })).toEqual([]);
    expect(computedUserBadges({ ...buyer, distinct_kitchens: 9, photo_logs: 9, substantive_reviews: 9 })).toEqual([]);
  });
  it("awards all five computed kitchen badges at their thresholds", () => {
    expect(computedKitchenBadges({ ...kitchen, orders_completed: 100, trust_streak: 10, repeat_customers: 20, permit_status: "verified" })).toEqual(["chain_of_trust", "permit_verified", "hundred_meals", "neighborhood_favorite", "spotless"]);
  });
  it("requires fifty orders and no upheld flags or open incidents for spotless", () => {
    expect(computedKitchenBadges({ ...kitchen, orders_completed: 50 })).toContain("spotless");
    expect(computedKitchenBadges({ ...kitchen, orders_completed: 50, upheld_flags: 1 })).not.toContain("spotless");
    expect(computedKitchenBadges({ ...kitchen, orders_completed: 50, open_incidents: 1 })).not.toContain("spotless");
  });
  it("awards all five computed buyer badges at their thresholds", () => {
    expect(computedUserBadges({ ...buyer, verified_logs: 1, distinct_kitchens: 10, photo_logs: 10, substantive_reviews: 10, upheld_flags: 1 })).toEqual(["first_bite", "explorer", "photographer", "wordsmith", "trust_guardian"]);
  });
  it("merges grants without duplicates, wrong subjects, or stale computed awards", () => {
    const result = earnedBadges("kitchen", ["chain_of_trust"], ["founding_kitchen", "founding_kitchen", "founding_taster", "unknown", "spotless"]);
    expect(result.map((badge) => badge.code)).toEqual(["chain_of_trust", "founding_kitchen"]);
  });
});
