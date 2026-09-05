import type { BadgeDef, BuyerCounters, KitchenCounters } from "@/lib/types";

export const BADGES: BadgeDef[] = [
  { code: "chain_of_trust", label: "Chain of Trust", description: "Ten sourcing batches, all verified.", appliesTo: "kitchen" },
  { code: "permit_verified", label: "Permit verified", description: "Local permit checked and confirmed.", appliesTo: "kitchen" },
  { code: "hundred_meals", label: "A hundred meals", description: "One hundred pickups, made with care.", appliesTo: "kitchen" },
  { code: "neighborhood_favorite", label: "Neighborhood favorite", description: "Twenty neighbors came back for more.", appliesTo: "kitchen" },
  { code: "spotless", label: "Spotless", description: "Fifty orders; no open incidents or upheld flags.", appliesTo: "kitchen" },
  { code: "first_bite", label: "First bite", description: "Your first verified meal. Welcome in.", appliesTo: "user" },
  { code: "explorer", label: "Local explorer", description: "Ten kitchens, so many new favorites.", appliesTo: "user" },
  { code: "photographer", label: "Before the first bite", description: "Ten meals remembered in photos.", appliesTo: "user" },
  { code: "wordsmith", label: "Wordsmith", description: "Ten thoughtful reviews for your neighbors.", appliesTo: "user" },
  { code: "trust_guardian", label: "Trust guardian", description: "Spoke up and helped protect the community.", appliesTo: "user" },
  { code: "founding_kitchen", label: "Founding kitchen", description: "One of our first twenty-five kitchens.", appliesTo: "kitchen" },
  { code: "always_on_time", label: "Always on time", description: "Ready on time, at least 95% of orders.", appliesTo: "kitchen" },
  { code: "founding_taster", label: "Founding taster", description: "Here for the first hundred seats.", appliesTo: "user" },
];

export const GRANTED_BADGE_CODES = ["founding_kitchen", "always_on_time", "founding_taster"] as const;

export function computedKitchenBadges(c: KitchenCounters): string[] {
  return [
    c.trust_streak >= 10 && "chain_of_trust",
    c.permit_status === "verified" && "permit_verified",
    c.orders_completed >= 100 && "hundred_meals",
    c.repeat_customers >= 20 && "neighborhood_favorite",
    c.orders_completed >= 50 && c.open_incidents === 0 && c.upheld_flags === 0 && "spotless",
  ].filter((code): code is string => typeof code === "string");
}

export function computedUserBadges(c: BuyerCounters): string[] {
  return [
    c.verified_logs >= 1 && "first_bite",
    c.distinct_kitchens >= 10 && "explorer",
    c.photo_logs >= 10 && "photographer",
    c.substantive_reviews >= 10 && "wordsmith",
    c.upheld_flags >= 1 && "trust_guardian",
  ].filter((code): code is string => typeof code === "string");
}

export function earnedBadges(appliesTo: BadgeDef["appliesTo"], computed: string[], granted: string[]): BadgeDef[] {
  const allowedGrants = granted.filter((code) => GRANTED_BADGE_CODES.some((grant) => grant === code));
  const codes = new Set([...computed, ...allowedGrants]);
  return BADGES.filter((badge) => badge.appliesTo === appliesTo && codes.has(badge.code));
}
