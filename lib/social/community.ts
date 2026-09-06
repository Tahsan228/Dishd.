/**
 * Community rankings.
 *
 * These are editorial claims about real businesses — "top of the week",
 * "avoid" — so they are computed from the same verified logs everything else
 * uses, and they refuse to rank on thin evidence. A single five-star review
 * must never crown a kitchen, and a kitchen must never appear under "avoid"
 * for anything softer than an upheld flag or an actual suspension.
 */

export type CommunityKitchenStat = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "active" | "suspended" | "banned";
  neighborhood_label: string;
  cuisine_tags: string[];
  hero_url: string | null;
  avg_rating_10: number;
  upheld_flags: number;
  banned_reason: string | null;
  weekly_reviews: number;
  weekly_rating_10: number | null;
  monthly_reviews: number;
};

/**
 * A kitchen needs this many verified reviews in the last seven days before it
 * can be named kitchen of the week. Three is low enough that a small
 * neighbourhood still produces a winner and high enough that one friend cannot.
 */
export const WEEKLY_WINNER_MIN_REVIEWS = 3;

/** Only a kitchen that is actually open can be recommended. */
function isOpen(k: CommunityKitchenStat): boolean {
  return k.status === "active";
}

/**
 * Kitchen of the week: best average over the last seven days, among kitchens
 * with enough reviews to mean anything. Ties break toward more reviews.
 */
export function kitchenOfTheWeek(kitchens: CommunityKitchenStat[]): CommunityKitchenStat | null {
  const eligible = kitchens.filter(
    (k) =>
      isOpen(k) &&
      k.upheld_flags === 0 &&
      k.weekly_reviews >= WEEKLY_WINNER_MIN_REVIEWS &&
      k.weekly_rating_10 !== null,
  );
  if (eligible.length === 0) return null;

  return [...eligible].sort((a, b) => {
    const byRating = (b.weekly_rating_10 ?? 0) - (a.weekly_rating_10 ?? 0);
    if (byRating !== 0) return byRating;
    return b.weekly_reviews - a.weekly_reviews;
  })[0];
}

/** Busiest kitchens this week — activity, not quality. */
export function trendingKitchens(
  kitchens: CommunityKitchenStat[],
  limit = 6,
): CommunityKitchenStat[] {
  return kitchens
    .filter((k) => isOpen(k) && k.weekly_reviews > 0)
    .sort((a, b) => b.weekly_reviews - a.weekly_reviews || b.monthly_reviews - a.monthly_reviews)
    .slice(0, limit);
}

/**
 * Kitchens carrying a confirmed problem.
 *
 * Deliberately narrow. Only an upheld flag, a suspension or a ban qualifies —
 * a low rating is an opinion, and listing someone under "avoid" for it would
 * be defamatory rather than informative.
 */
export function kitchensToAvoid(
  kitchens: CommunityKitchenStat[],
  limit = 6,
): CommunityKitchenStat[] {
  return kitchens
    .filter((k) => k.status === "banned" || k.status === "suspended" || k.upheld_flags > 0)
    .sort((a, b) => {
      const severity = (k: CommunityKitchenStat) =>
        k.status === "banned" ? 2 : k.status === "suspended" ? 1 : 0;
      return severity(b) - severity(a) || b.upheld_flags - a.upheld_flags;
    })
    .slice(0, limit);
}

/** Why a kitchen appears under "avoid", in one sentence. */
export function avoidReason(kitchen: CommunityKitchenStat): string {
  if (kitchen.status === "banned") {
    return kitchen.banned_reason ?? "Removed from Dishd.";
  }
  if (kitchen.status === "suspended") return "Suspended while a report is investigated.";
  const n = kitchen.upheld_flags;
  return `${n} upheld ${n === 1 ? "report" : "reports"} against this kitchen.`;
}

/* -------------------------------------------------------------------------- */
/* Feed sorting                                                               */
/* -------------------------------------------------------------------------- */

export type FeedSort = "recent" | "top_rated" | "most_liked" | "with_photos";

export const FEED_SORTS: { key: FeedSort; label: string }[] = [
  { key: "recent", label: "Newest" },
  { key: "top_rated", label: "Highest rated" },
  { key: "most_liked", label: "Most appreciated" },
  { key: "with_photos", label: "With photos" },
];

export type FeedReview = {
  id: string;
  rating_10: number | null;
  body: string | null;
  photo_url: string | null;
  photo_urls?: string[] | null;
  logged_at: string;
  is_verified: boolean;
  like_count?: number | null;
  author: { handle: string; display_name: string; avatar_url: string | null } | null;
  kitchen: { name: string; slug: string; cuisine_tags?: string[] } | null;
};

export function reviewPhotos(review: FeedReview): string[] {
  const gallery = review.photo_urls ?? [];
  if (gallery.length > 0) return gallery;
  return review.photo_url ? [review.photo_url] : [];
}

export function sortReviews(reviews: FeedReview[], sort: FeedSort): FeedReview[] {
  const list = [...reviews];
  switch (sort) {
    case "top_rated":
      return list.sort(
        (a, b) => (b.rating_10 ?? -1) - (a.rating_10 ?? -1) || +new Date(b.logged_at) - +new Date(a.logged_at),
      );
    case "most_liked":
      return list.sort(
        (a, b) => (b.like_count ?? 0) - (a.like_count ?? 0) || +new Date(b.logged_at) - +new Date(a.logged_at),
      );
    case "with_photos":
      return list
        .filter((r) => reviewPhotos(r).length > 0)
        .sort((a, b) => +new Date(b.logged_at) - +new Date(a.logged_at));
    case "recent":
    default:
      return list.sort((a, b) => +new Date(b.logged_at) - +new Date(a.logged_at));
  }
}

/** Free-text filter across author, kitchen, body and cuisine. */
export function filterReviews(reviews: FeedReview[], query: string): FeedReview[] {
  const q = query.trim().toLowerCase();
  if (!q) return reviews;
  return reviews.filter((r) => {
    const haystack = [
      r.author?.display_name,
      r.author?.handle,
      r.kitchen?.name,
      r.body,
      ...(r.kitchen?.cuisine_tags ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

/** Every cuisine present in a set of kitchens, most common first. */
export function cuisineFacets(kitchens: CommunityKitchenStat[]): string[] {
  const counts = new Map<string, number>();
  for (const k of kitchens) {
    for (const tag of k.cuisine_tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
}

/* -------------------------------------------------------------------------- */
/* Posts                                                                      */
/* -------------------------------------------------------------------------- */

export type PostCategory = "story" | "announcement" | "behind_the_scenes" | "offer";

export const POST_CATEGORIES: { key: PostCategory; label: string; byKitchen: boolean }[] = [
  { key: "story", label: "Diner story", byKitchen: false },
  { key: "announcement", label: "Announcement", byKitchen: true },
  { key: "behind_the_scenes", label: "Behind the scenes", byKitchen: true },
  { key: "offer", label: "Offer", byKitchen: true },
];

export function categoryLabel(category: string): string {
  return POST_CATEGORIES.find((c) => c.key === category)?.label ?? category;
}

/** Categories a given author may post in. Only cooks speak for a kitchen. */
export function allowedCategories(hasKitchen: boolean): PostCategory[] {
  return POST_CATEGORIES.filter((c) => (c.byKitchen ? hasKitchen : true)).map((c) => c.key);
}

/* -------------------------------------------------------------------------- */
/* Reports                                                                    */
/* -------------------------------------------------------------------------- */

export type ReportReason =
  | "haram_sourcing"
  | "misrepresentation"
  | "allergen"
  | "hygiene"
  | "quality"
  | "other";

/**
 * The reasons a buyer can raise, most serious first.
 *
 * This lives here rather than beside the server action on purpose. A
 * `"use server"` module may only export async functions — a plain constant
 * exported from one is replaced by `undefined` in the client bundle, so
 * `REPORT_REASONS[0]` threw and took the whole completed-order page down with
 * a 500. Shared data belongs in a plain module both sides can import.
 */
export const REPORT_REASONS: { key: ReportReason; label: string; hint: string }[] = [
  {
    key: "haram_sourcing",
    label: "The food was not halal",
    hint: "The meat or its sourcing did not match what the kitchen claimed.",
  },
  {
    key: "misrepresentation",
    label: "Sourcing was misrepresented",
    hint: "The receipt or supplier shown does not match what was served.",
  },
  {
    key: "allergen",
    label: "An allergen was undeclared",
    hint: "Something was present that the listing did not declare.",
  },
  {
    key: "hygiene",
    label: "A hygiene problem",
    hint: "Handling, packaging or storage was unsafe.",
  },
  {
    key: "quality",
    label: "Quality fell below standard",
    hint: "Cold, spoiled, or not what was ordered.",
  },
  { key: "other", label: "Something else", hint: "Anything not covered above." },
];
