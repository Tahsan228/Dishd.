import { describe, expect, it } from "vitest";
import {
  WEEKLY_WINNER_MIN_REVIEWS,
  allowedCategories,
  avoidReason,
  cuisineFacets,
  filterReviews,
  kitchenOfTheWeek,
  kitchensToAvoid,
  reviewPhotos,
  sortReviews,
  trendingKitchens,
  type CommunityKitchenStat,
  type FeedReview,
} from "./community";

function kitchen(over: Partial<CommunityKitchenStat> = {}): CommunityKitchenStat {
  return {
    id: "k1",
    name: "A Kitchen",
    slug: "a-kitchen",
    status: "active",
    neighborhood_label: "Hackensack, NJ",
    cuisine_tags: ["afghan"],
    hero_url: null,
    avg_rating_10: 8,
    upheld_flags: 0,
    banned_reason: null,
    weekly_reviews: 5,
    weekly_rating_10: 8,
    monthly_reviews: 20,
    ...over,
  };
}

describe("kitchen of the week", () => {
  it("picks the best weekly average", () => {
    const winner = kitchenOfTheWeek([
      kitchen({ id: "a", weekly_rating_10: 8 }),
      kitchen({ id: "b", weekly_rating_10: 9.5 }),
      kitchen({ id: "c", weekly_rating_10: 9 }),
    ]);
    expect(winner?.id).toBe("b");
  });

  it("refuses to crown a kitchen on too few reviews", () => {
    // A perfect score from one friend must not win the week.
    const winner = kitchenOfTheWeek([
      kitchen({ id: "thin", weekly_rating_10: 10, weekly_reviews: 1 }),
      kitchen({ id: "solid", weekly_rating_10: 8, weekly_reviews: 9 }),
    ]);
    expect(winner?.id).toBe("solid");
  });

  it("requires at least the documented minimum", () => {
    const justUnder = kitchen({ weekly_reviews: WEEKLY_WINNER_MIN_REVIEWS - 1 });
    const justEnough = kitchen({ weekly_reviews: WEEKLY_WINNER_MIN_REVIEWS });
    expect(kitchenOfTheWeek([justUnder])).toBeNull();
    expect(kitchenOfTheWeek([justEnough])).not.toBeNull();
  });

  it("never crowns a kitchen carrying an upheld report", () => {
    expect(kitchenOfTheWeek([kitchen({ weekly_rating_10: 10, upheld_flags: 1 })])).toBeNull();
  });

  it("never crowns a kitchen that is not open", () => {
    for (const status of ["suspended", "banned", "draft"] as const) {
      expect(kitchenOfTheWeek([kitchen({ status, weekly_rating_10: 10 })])).toBeNull();
    }
  });

  it("breaks a tie toward more reviews", () => {
    const winner = kitchenOfTheWeek([
      kitchen({ id: "few", weekly_rating_10: 9, weekly_reviews: 4 }),
      kitchen({ id: "many", weekly_rating_10: 9, weekly_reviews: 12 }),
    ]);
    expect(winner?.id).toBe("many");
  });

  it("returns null rather than inventing a winner", () => {
    expect(kitchenOfTheWeek([])).toBeNull();
  });
});

describe("popular this week", () => {
  it("ranks by weekly review volume, not rating", () => {
    const list = trendingKitchens([
      kitchen({ id: "quiet", weekly_reviews: 2, weekly_rating_10: 10 }),
      kitchen({ id: "busy", weekly_reviews: 30, weekly_rating_10: 6 }),
    ]);
    expect(list[0].id).toBe("busy");
  });

  it("leaves out kitchens with no activity and any that are closed", () => {
    const list = trendingKitchens([
      kitchen({ id: "none", weekly_reviews: 0 }),
      kitchen({ id: "banned", status: "banned", weekly_reviews: 50 }),
      kitchen({ id: "ok", weekly_reviews: 3 }),
    ]);
    expect(list.map((k) => k.id)).toEqual(["ok"]);
  });

  it("honours the limit", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      kitchen({ id: `k${i}`, weekly_reviews: i + 1 }),
    );
    expect(trendingKitchens(many, 4)).toHaveLength(4);
  });
});

describe("confirmed problems", () => {
  it("lists only upheld flags, suspensions and bans", () => {
    const list = kitchensToAvoid([
      kitchen({ id: "bad-rating", avg_rating_10: 2 }),
      kitchen({ id: "flagged", upheld_flags: 2 }),
      kitchen({ id: "suspended", status: "suspended" }),
      kitchen({ id: "banned", status: "banned" }),
    ]);
    // A low rating is an opinion; listing it here would be defamatory.
    expect(list.map((k) => k.id)).not.toContain("bad-rating");
    expect(list.map((k) => k.id)).toEqual(["banned", "suspended", "flagged"]);
  });

  it("explains each entry with the actual cause", () => {
    expect(avoidReason(kitchen({ status: "banned", banned_reason: "Sourcing fraud." }))).toBe(
      "Sourcing fraud.",
    );
    expect(avoidReason(kitchen({ status: "suspended" }))).toMatch(/investigated/i);
    expect(avoidReason(kitchen({ upheld_flags: 1 }))).toBe("1 upheld report against this kitchen.");
    expect(avoidReason(kitchen({ upheld_flags: 3 }))).toBe("3 upheld reports against this kitchen.");
  });

  it("falls back when a ban has no recorded reason", () => {
    expect(avoidReason(kitchen({ status: "banned", banned_reason: null }))).toBe(
      "Removed from Dishd.",
    );
  });
});

/* -------------------------------------------------------------------------- */

function review(over: Partial<FeedReview> = {}): FeedReview {
  return {
    id: "r1",
    rating_10: 8,
    body: "Lovely food",
    photo_url: null,
    photo_urls: null,
    logged_at: "2026-09-01T12:00:00Z",
    is_verified: true,
    like_count: 0,
    author: { handle: "yusuf", display_name: "Yusuf Ali", avatar_url: null },
    kitchen: { name: "Amina's Kitchen", slug: "aminas-kitchen", cuisine_tags: ["afghan"] },
    ...over,
  };
}

describe("review photos", () => {
  it("prefers the gallery over the single legacy field", () => {
    expect(reviewPhotos(review({ photo_urls: ["a", "b"], photo_url: "old" }))).toEqual(["a", "b"]);
  });

  it("falls back to the single photo when there is no gallery", () => {
    expect(reviewPhotos(review({ photo_urls: [], photo_url: "old" }))).toEqual(["old"]);
    expect(reviewPhotos(review({ photo_urls: null, photo_url: "old" }))).toEqual(["old"]);
  });

  it("returns nothing when there is no photo at all", () => {
    expect(reviewPhotos(review())).toEqual([]);
  });
});

describe("feed sorting", () => {
  const older = review({ id: "old", logged_at: "2026-08-01T00:00:00Z", rating_10: 10, like_count: 1 });
  const newer = review({ id: "new", logged_at: "2026-09-01T00:00:00Z", rating_10: 6, like_count: 9 });
  const withPhoto = review({ id: "photo", logged_at: "2026-07-01T00:00:00Z", photo_urls: ["x"] });
  const all = [older, newer, withPhoto];

  it("sorts newest first by default", () => {
    expect(sortReviews(all, "recent")[0].id).toBe("new");
  });

  it("sorts by rating when asked", () => {
    expect(sortReviews(all, "top_rated")[0].id).toBe("old");
  });

  it("sorts by appreciation when asked", () => {
    expect(sortReviews(all, "most_liked")[0].id).toBe("new");
  });

  it("keeps only reviews that have a photo in the photo view", () => {
    const shown = sortReviews(all, "with_photos");
    expect(shown.map((r) => r.id)).toEqual(["photo"]);
  });

  it("does not mutate the array it was given", () => {
    const input = [older, newer];
    sortReviews(input, "top_rated");
    expect(input.map((r) => r.id)).toEqual(["old", "new"]);
  });
});

describe("feed filtering", () => {
  const rows = [
    review({ id: "a", body: "Best biryani", kitchen: { name: "Amina's", slug: "a", cuisine_tags: ["afghan"] } }),
    review({
      id: "b",
      body: "Good kebab",
      author: { handle: "sana", display_name: "Sana Iqbal", avatar_url: null },
      kitchen: { name: "Omar's Grill", slug: "omars-grill", cuisine_tags: ["turkish"] },
    }),
  ];

  it("matches on body, author, kitchen and cuisine", () => {
    expect(filterReviews(rows, "biryani").map((r) => r.id)).toEqual(["a"]);
    expect(filterReviews(rows, "sana").map((r) => r.id)).toEqual(["b"]);
    expect(filterReviews(rows, "afghan").map((r) => r.id)).toEqual(["a"]);
  });

  it("is case insensitive and ignores surrounding space", () => {
    expect(filterReviews(rows, "  BIRYANI ").map((r) => r.id)).toEqual(["a"]);
  });

  it("returns everything for an empty query", () => {
    expect(filterReviews(rows, "   ")).toHaveLength(2);
  });
});

describe("cuisine facets", () => {
  it("orders cuisines by how many kitchens use them", () => {
    const facets = cuisineFacets([
      kitchen({ id: "1", cuisine_tags: ["afghan", "halal"] }),
      kitchen({ id: "2", cuisine_tags: ["halal"] }),
      kitchen({ id: "3", cuisine_tags: ["halal", "turkish"] }),
    ]);
    expect(facets[0]).toBe("halal");
    expect(facets).toContain("turkish");
  });

  it("survives kitchens with no tags", () => {
    expect(cuisineFacets([kitchen({ cuisine_tags: [] })])).toEqual([]);
  });
});

describe("who may post what", () => {
  it("limits a buyer to diner stories", () => {
    expect(allowedCategories(false)).toEqual(["story"]);
  });

  it("lets a kitchen owner post business categories too", () => {
    const allowed = allowedCategories(true);
    expect(allowed).toContain("story");
    expect(allowed).toContain("announcement");
    expect(allowed).toContain("offer");
    expect(allowed).toContain("behind_the_scenes");
  });
});
