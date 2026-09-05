/**
 * Dishd shared domain contract.
 *
 * FROZEN FILE — this is the seam between the two workstreams.
 * The social workstream (profiles, credibility, badges) reads from here and
 * must not edit it. If you need a new field, ask the host to add it and
 * update README.md in the same commit.
 *
 * Conventions used throughout:
 *   - money is ALWAYS integer cents, never floats
 *   - ratings are stored 0-10 and displayed as 0-5 stars (rating_10 / 2)
 *   - timestamps are ISO 8601 strings
 */

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

export type PermitStatus = "none" | "claimed" | "verified";
export type KitchenStatus = "draft" | "active" | "suspended" | "banned";
export type MeatType = "beef" | "lamb" | "chicken" | "goat" | "other" | "none";
/** pending = deterministic checks passed, awaiting human review of the image. */
export type BatchMatchStatus = "pending" | "verified" | "mismatch" | "unreadable";
export type OrderStatus =
  | "pending"
  | "accepted"
  | "ready"
  | "completed"
  | "cancelled"
  | "declined";
export type PaymentMethod = "cash" | "card";

/* -------------------------------------------------------------------------- */
/* Credibility — the social workstream's primary input                        */
/* -------------------------------------------------------------------------- */

/**
 * Denormalised counters maintained on `kitchens` by Postgres triggers.
 * Read these directly — never aggregate across orders/logs at render time.
 */
export type KitchenCounters = {
  orders_completed: number;
  avg_rating_10: number; // 0-10, i.e. 4.5 stars -> 9
  distinct_customers: number;
  repeat_customers: number;
  trust_streak: number; // consecutive verified sourcing batches
  permit_status: PermitStatus;
  upheld_flags: number;
  open_incidents: number;
  cook_cancellations: number;
  created_at: string; // ISO
};

export type BuyerCounters = {
  verified_logs: number;
  distinct_kitchens: number;
  substantive_reviews: number; // body length >= 80 chars
  photo_logs: number;
  likes_received: number;
  upheld_flags: number;
  dismissed_flags: number;
  created_at: string; // ISO
};

export type CredibilityTier =
  | "new_kitchen"
  | "established"
  | "trusted_kitchen"
  | "dishd_verified";

export type BuyerTier = "newcomer" | "regular" | "trusted_taster" | "community_pillar";

/** One line of the transparent score breakdown shown on the kitchen page. */
export type ScoreComponent = {
  label: string;
  points: number; // may be negative
  detail: string; // e.g. "18 batches x 20"
};

export type CredibilityResult = {
  score: number;
  tier: CredibilityTier;
  components: ScoreComponent[];
  nextTier: CredibilityTier | null;
  pointsToNextTier: number | null;
};

export type BadgeDef = {
  code: string;
  label: string;
  description: string;
  appliesTo: "kitchen" | "user";
};

/* -------------------------------------------------------------------------- */
/* Public entities                                                            */
/* -------------------------------------------------------------------------- */

/** Everything safe to render publicly. Note: NO exact address — see KitchenAddress. */
export type KitchenPublic = KitchenCounters & {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  bio: string | null;
  hero_url: string | null;
  cuisine_tags: string[];
  state_code: string;
  county: string;
  neighborhood_label: string;
  approx_lat: number; // deterministically fuzzed 300-500m — never the real point
  approx_lng: number;
  accepts_cash: boolean;
  accepts_card: boolean;
  stripe_onboarded: boolean;
  status: KitchenStatus;
  banned_reason: string | null;
  banned_at: string | null;
};

/** Exact address. RLS-gated: owner, or a buyer with an accepted/ready/completed order. */
export type KitchenAddress = {
  kitchen_id: string;
  line1: string;
  line2: string | null;
  city: string;
  zip: string;
  lat: number;
  lng: number;
};

export type ProfilePublic = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  created_at: string;
};

export type SourcingBatch = {
  id: string;
  kitchen_id: string;
  halal_source_id: string | null;
  receipt_path: string;
  purchased_on: string | null;
  ocr_store: string | null;
  ocr_total_cents: number | null;
  ocr_date: string | null;
  match_status: BatchMatchStatus;
  mismatch_reasons: string[];
  backs_items_until: string | null;
  declared_meat_types: MeatType[];
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  created_at: string;
};

export type HalalSource = {
  id: string;
  kitchen_id: string;
  store_name: string;
  store_address: string | null;
  cert_body: string | null;
  in_directory: boolean; // false => rendered as "unlisted source"
};

export type MenuItem = {
  id: string;
  kitchen_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  photo_url: string | null;
  contains_meat: boolean;
  meat_type: MeatType;
  sourcing_batch_id: string | null; // REQUIRED when contains_meat (DB constraint)
  allergens: string[]; // required; ["none_declared"] is the explicit empty case
  is_available: boolean;
  daily_qty: number;
};

/** A diary entry. `is_verified` is true only when backed by a completed order. */
export type Log = {
  id: string;
  buyer_id: string;
  kitchen_id: string;
  order_id: string | null;
  rating_10: number; // 0-10
  body: string | null;
  photo_url: string | null;
  is_verified: boolean;
  sourcing_affirmed: boolean | null; // null = not asked/answered
  logged_at: string;
};

/** What ReviewFeed renders: a log joined to its author and like count. */
export type LogWithAuthor = Log & {
  author: ProfilePublic;
  like_count: number;
  kitchen_name?: string; // present on buyer-profile diary queries
  kitchen_slug?: string;
};
