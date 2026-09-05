"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Camera, Search, ShieldCheck, Star } from "lucide-react";
import {
  FEED_SORTS,
  categoryLabel,
  filterReviews,
  reviewPhotos,
  sortReviews,
  type FeedReview,
  type FeedSort,
} from "@/lib/social/community";
import { cn, toStars } from "@/lib/utils";

export type CommunityPost = {
  id: string;
  category: string;
  body: string;
  photo_urls: string[];
  created_at: string;
  author: { handle: string; display_name: string } | null;
  kitchen: { name: string; slug: string } | null;
};

type Tab = "reviews" | "posts";

/**
 * The community feed.
 *
 * Reviews and business posts are different things and are kept apart: a review
 * is transaction-backed and carries a rating, a post is a kitchen or diner
 * talking. Blending them into one stream would let a promotional post sit where
 * a verified review appears to be.
 *
 * Filtering runs on the client over a page the server already fetched — a
 * neighbourhood produces tens of entries, not thousands, so a round trip per
 * keystroke would be slower and worse.
 */
export function CommunityFeed({
  reviews,
  posts,
  cuisines,
}: {
  reviews: FeedReview[];
  posts: CommunityPost[];
  cuisines: string[];
}) {
  const [tab, setTab] = useState<Tab>("reviews");
  const [sort, setSort] = useState<FeedSort>("recent");
  const [query, setQuery] = useState("");
  const [cuisine, setCuisine] = useState<string | null>(null);

  const shownReviews = useMemo(() => {
    let list = filterReviews(reviews, query);
    if (cuisine) {
      list = list.filter((r) => r.kitchen?.cuisine_tags?.includes(cuisine));
    }
    return sortReviews(list, sort);
  }, [reviews, query, cuisine, sort]);

  const shownPosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) =>
      [p.body, p.author?.display_name, p.kitchen?.name, categoryLabel(p.category)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [posts, query]);

  return (
    <div>
      <div role="tablist" aria-label="Community" className="flex gap-2">
        {(
          [
            { key: "reviews", label: `Reviews (${reviews.length})` },
            { key: "posts", label: `Posts (${posts.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "min-h-11 rounded-full border px-5 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-forest bg-forest text-cream"
                : "border-line bg-surface text-ink-muted hover:border-forest/40",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search the community</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people, kitchens, dishes"
            className="min-h-11 w-full rounded-full border border-line bg-surface pr-4 pl-9 text-base text-ink outline-none focus:border-forest focus-visible:ring-2 focus-visible:ring-forest/20"
          />
        </label>

        {tab === "reviews" && (
          <label className="flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm">
            <span className="sr-only">Sort reviews</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as FeedSort)}
              className="bg-transparent py-2 text-ink outline-none"
            >
              {FEED_SORTS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {tab === "reviews" && cuisines.length > 0 && (
        <ul className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1">
          <li>
            <button
              type="button"
              onClick={() => setCuisine(null)}
              aria-pressed={cuisine === null}
              className={cn(
                "min-h-9 shrink-0 rounded-full border px-4 text-sm whitespace-nowrap",
                cuisine === null
                  ? "border-forest bg-forest text-cream"
                  : "border-line bg-surface text-ink-muted hover:border-forest/40",
              )}
            >
              All cuisines
            </button>
          </li>
          {cuisines.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                onClick={() => setCuisine(cuisine === tag ? null : tag)}
                aria-pressed={cuisine === tag}
                className={cn(
                  "min-h-9 shrink-0 rounded-full border px-4 text-sm whitespace-nowrap capitalize",
                  cuisine === tag
                    ? "border-forest bg-forest text-cream"
                    : "border-line bg-surface text-ink-muted hover:border-forest/40",
                )}
              >
                {tag}
              </button>
            </li>
          ))}
        </ul>
      )}

      {tab === "reviews" ? (
        shownReviews.length === 0 ? (
          <Empty>No reviews match that yet.</Empty>
        ) : (
          <ul className="stagger mt-5 grid gap-4 sm:grid-cols-2">
            {shownReviews.map((review) => (
              <li key={review.id}>
                <ReviewCard review={review} />
              </li>
            ))}
          </ul>
        )
      ) : shownPosts.length === 0 ? (
        <Empty>Nothing posted yet. Be the first.</Empty>
      ) : (
        <ul className="stagger mt-5 space-y-4">
          {shownPosts.map((post) => (
            <li key={post.id}>
              <PostCard post={post} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-5 rounded-2xl border border-dashed border-line bg-surface-sunk p-12 text-center text-sm text-ink-muted">
      {children}
    </p>
  );
}

function ReviewCard({ review }: { review: FeedReview }) {
  const photos = reviewPhotos(review);
  const stars = review.rating_10 === null ? null : toStars(review.rating_10);

  return (
    <article className="lift flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-px bg-line">
          {photos.slice(0, 3).map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt=""
              className={cn(
                "h-28 w-full bg-surface-sunk object-cover",
                photos.length === 1 && "col-span-3 h-44",
                photos.length === 2 && i === 0 && "col-span-2",
              )}
            />
          ))}
        </div>
      )}

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {review.author && (
              <Link
                href={`/u/${review.author.handle}`}
                className="truncate text-sm font-medium text-ink hover:text-forest"
              >
                {review.author.display_name}
              </Link>
            )}
            {review.kitchen && (
              <Link
                href={`/k/${review.kitchen.slug}`}
                className="mt-0.5 block truncate text-xs text-forest underline-offset-2 hover:underline"
              >
                {review.kitchen.name}
              </Link>
            )}
          </div>
          {stars !== null && (
            <span className="tabular flex shrink-0 items-center gap-1 text-sm text-ink">
              <Star className="h-3.5 w-3.5 fill-brass text-brass" aria-hidden />
              {stars.toFixed(1)}
            </span>
          )}
        </div>

        {review.body && (
          <p className="mt-2.5 line-clamp-5 text-sm leading-relaxed text-ink-muted">
            {review.body}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-[11px] text-ink-muted">
          {review.is_verified && (
            <span className="flex items-center gap-1 text-forest">
              <ShieldCheck className="h-3 w-3" aria-hidden />
              Verified pickup
            </span>
          )}
          {photos.length > 0 && (
            <span className="flex items-center gap-1">
              <Camera className="h-3 w-3" aria-hidden />
              {photos.length}
            </span>
          )}
          <span>
            {new Date(review.logged_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
      </div>
    </article>
  );
}

function PostCard({ post }: { post: CommunityPost }) {
  const isBusiness = post.category !== "story";
  return (
    <article
      className={cn(
        "rounded-2xl border p-5",
        isBusiness ? "border-brass/35 bg-brass/5" : "border-line bg-surface",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-medium",
            isBusiness ? "bg-brass/20 text-brass-ink" : "bg-forest-soft text-forest",
          )}
        >
          {categoryLabel(post.category)}
        </span>
        {post.kitchen ? (
          <Link
            href={`/k/${post.kitchen.slug}`}
            className="text-sm font-medium text-forest underline-offset-2 hover:underline"
          >
            {post.kitchen.name}
          </Link>
        ) : (
          post.author && (
            <Link
              href={`/u/${post.author.handle}`}
              className="text-sm font-medium text-ink hover:text-forest"
            >
              {post.author.display_name}
            </Link>
          )
        )}
        <span className="ml-auto text-[11px] text-ink-muted">
          {new Date(post.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>

      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink">{post.body}</p>

      {post.photo_urls.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {post.photo_urls.slice(0, 3).map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt=""
              className="h-24 w-full rounded-lg bg-surface-sunk object-cover"
            />
          ))}
        </div>
      )}
    </article>
  );
}
