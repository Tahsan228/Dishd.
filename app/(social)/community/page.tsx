import Link from "next/link";
import type { Metadata } from "next";
import { Crown, Flame, ShieldAlert, Star } from "lucide-react";
import { SiteHeader } from "@/components/market/site-header";
import { CommunityFeed, type CommunityPost } from "@/components/social/community-feed";
import { CommunityComposer } from "@/components/social/community-composer";
import { createServerClient } from "@/lib/supabase/server";
import { currentProfile } from "@/lib/market/auth-actions";
import {
  avoidReason,
  cuisineFacets,
  kitchenOfTheWeek,
  kitchensToAvoid,
  trendingKitchens,
  WEEKLY_WINNER_MIN_REVIEWS,
  type CommunityKitchenStat,
  type FeedReview,
} from "@/lib/social/community";
import { toStars } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Community · Dishd",
  description:
    "What the neighbourhood is eating: verified reviews, kitchen news, and this week's standouts.",
};

export default async function CommunityPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
          <p className="text-ink-muted">Connect Supabase to see the community.</p>
        </main>
      </>
    );
  }

  const supabase = await createServerClient();

  const [statsResult, reviewsResult, postsResult, profile] = await Promise.all([
    supabase.from("community_kitchen_stats").select("*"),
    supabase
      .from("logs")
      .select(
        `id, rating_10, body, photo_url, photo_urls, logged_at, is_verified,
         profiles!logs_buyer_id_fkey ( handle, display_name, avatar_url ),
         kitchens!logs_kitchen_id_fkey ( name, slug, cuisine_tags )`,
      )
      .eq("is_verified", true)
      .not("rating_10", "is", null)
      .order("logged_at", { ascending: false })
      .limit(60),
    supabase
      .from("community_posts")
      .select(
        `id, category, body, photo_urls, created_at,
         profiles ( handle, display_name ),
         kitchens ( name, slug )`,
      )
      .order("created_at", { ascending: false })
      .limit(40),
    currentProfile(),
  ]);

  const kitchens = (statsResult.data ?? []) as CommunityKitchenStat[];

  const reviews: FeedReview[] = (reviewsResult.data ?? []).map((row) => ({
    id: row.id as string,
    rating_10: row.rating_10 as number | null,
    body: row.body as string | null,
    photo_url: row.photo_url as string | null,
    photo_urls: (row.photo_urls ?? null) as string[] | null,
    logged_at: row.logged_at as string,
    is_verified: Boolean(row.is_verified),
    author: (row.profiles as unknown as FeedReview["author"]) ?? null,
    kitchen: (row.kitchens as unknown as FeedReview["kitchen"]) ?? null,
  }));

  const posts: CommunityPost[] = (postsResult.data ?? []).map((row) => ({
    id: row.id as string,
    category: row.category as string,
    body: row.body as string,
    photo_urls: (row.photo_urls ?? []) as string[],
    created_at: row.created_at as string,
    author: (row.profiles as unknown as CommunityPost["author"]) ?? null,
    kitchen: (row.kitchens as unknown as CommunityPost["kitchen"]) ?? null,
  }));

  const winner = kitchenOfTheWeek(kitchens);
  const trending = trendingKitchens(kitchens, 6);
  const avoid = kitchensToAvoid(kitchens, 4);

  // Only offer the business categories to someone who actually owns a kitchen.
  let ownedKitchenName: string | null = null;
  if (profile) {
    const { data } = await supabase
      .from("kitchens")
      .select("name")
      .eq("owner_id", profile.id)
      .eq("status", "active")
      .maybeSingle();
    ownedKitchenName = data?.name ?? null;
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">
        <h1 className="font-display text-3xl text-forest sm:text-4xl">Community</h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-ink-muted">
          What the neighbourhood is actually eating. Every review here is tied to
          a pickup someone completed — nothing on this page can be bought.
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
          <div className="order-2 lg:order-1">
            {profile && (
              <div className="mb-6">
                <CommunityComposer
                  hasKitchen={Boolean(ownedKitchenName)}
                  kitchenName={ownedKitchenName}
                />
              </div>
            )}

            <CommunityFeed
              reviews={reviews}
              posts={posts}
              cuisines={cuisineFacets(kitchens)}
            />
          </div>

          <aside className="order-1 space-y-6 lg:order-2">
            {/* ------------------------------------------- kitchen of week */}
            <section className="overflow-hidden rounded-2xl border border-brass/40 bg-brass/5">
              <h2 className="flex items-center gap-2 border-b border-brass/25 px-5 py-3 font-display text-lg text-forest">
                <Crown className="h-4 w-4 text-brass" aria-hidden />
                Kitchen of the week
              </h2>
              {winner ? (
                <div className="p-5">
                  <Link
                    href={`/k/${winner.slug}`}
                    className="font-display text-xl text-forest underline-offset-2 hover:underline"
                  >
                    {winner.name}
                  </Link>
                  <p className="mt-1 text-xs text-ink-muted">{winner.neighborhood_label}</p>
                  <p className="tabular mt-3 flex items-center gap-1.5 text-sm text-ink">
                    <Star className="h-4 w-4 fill-brass text-brass" aria-hidden />
                    {toStars(Number(winner.weekly_rating_10 ?? 0)).toFixed(1)} from{" "}
                    {winner.weekly_reviews} reviews this week
                  </p>
                </div>
              ) : (
                <p className="p-5 text-xs leading-relaxed text-ink-muted">
                  No kitchen has {WEEKLY_WINNER_MIN_REVIEWS} verified reviews this
                  week yet. One review is not a winner, so nothing is crowned
                  until there is enough to mean something.
                </p>
              )}
            </section>

            {/* --------------------------------------------------- trending */}
            <section className="rounded-2xl border border-line bg-surface">
              <h2 className="flex items-center gap-2 border-b border-line px-5 py-3 font-display text-lg text-forest">
                <Flame className="h-4 w-4" aria-hidden />
                Popular this week
              </h2>
              {trending.length === 0 ? (
                <p className="p-5 text-xs text-ink-muted">Quiet week so far.</p>
              ) : (
                <ol className="divide-y divide-line">
                  {trending.map((k, i) => (
                    <li key={k.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="tabular w-4 shrink-0 font-display text-lg text-ink-muted">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/k/${k.slug}`}
                          className="block truncate text-sm font-medium text-ink hover:text-forest"
                        >
                          {k.name}
                        </Link>
                        <p className="truncate text-[11px] text-ink-muted">
                          {k.neighborhood_label}
                        </p>
                      </div>
                      <span className="tabular shrink-0 text-xs text-ink-muted">
                        {k.weekly_reviews}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {/* ------------------------------------------------------ avoid */}
            {avoid.length > 0 && (
              <section className="rounded-2xl border border-clay/35 bg-clay/5">
                <h2 className="flex items-center gap-2 border-b border-clay/25 px-5 py-3 font-display text-lg text-clay">
                  <ShieldAlert className="h-4 w-4" aria-hidden />
                  Confirmed problems
                </h2>
                <ul className="divide-y divide-clay/15">
                  {avoid.map((k) => (
                    <li key={k.id} className="px-5 py-3">
                      <Link
                        href={`/k/${k.slug}`}
                        className="text-sm font-medium text-clay underline-offset-2 hover:underline"
                      >
                        {k.name}
                      </Link>
                      <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                        {avoidReason(k)}
                      </p>
                    </li>
                  ))}
                </ul>
                <p className="border-t border-clay/20 px-5 py-3 text-[11px] leading-relaxed text-ink-muted">
                  Only upheld reports and suspensions appear here. A low rating is
                  an opinion and never lands a kitchen on this list.
                </p>
              </section>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}
