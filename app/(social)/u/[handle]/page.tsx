import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import type { BuyerCounters, ProfilePublic } from "@/lib/types";
import { computedUserBadges, earnedBadges } from "@/lib/social/badges";
import { scoreBuyer } from "@/lib/social/credibility";
import { formatDate, formatNumber, PROFILE_COLUMNS, REVIEW_COLUMNS, safeImageUrl, socialClient, type ReviewEntry } from "@/lib/social/data";
import { DIARY_PAGE_SIZE, pageNumber } from "@/lib/social/pagination";
import { BadgeShelf } from "@/components/social/badge-shelf";
import { DiaryPagination } from "@/components/social/diary-pagination";
import { RatingHistogram } from "@/components/social/rating-histogram";
import { ReviewCard } from "@/components/social/review-card";
import { SocialNotice } from "@/components/social/social-notice";
import { TierMark } from "@/components/social/tier-mark";
import { DiaryEditor } from "@/components/social/diary-editor";
import { FollowButton } from "@/components/social/follow-button";
import { accentClasses } from "@/lib/social/profile";
import { cn } from "@/lib/utils";

export default async function BuyerProfilePage({ params, searchParams }: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { handle } = await params;
  const page = pageNumber((await searchParams).page);
  const supabase = await socialClient();
  if (!supabase) return <main className="mx-auto max-w-3xl p-5"><SocialNotice title="A diary of good meals">Buyer profiles will appear when Dishd is connected.</SocialNotice></main>;
  const profileResult = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("handle", handle).maybeSingle();
  if (profileResult.error) return <main className="mx-auto max-w-3xl p-5"><SocialNotice title="Profile unavailable">Please try again shortly.</SocialNotice></main>;
  if (!profileResult.data) notFound();
  const profile = profileResult.data as ProfilePublic;
  const start = (page - 1) * DIARY_PAGE_SIZE;
  const [counters, granted, diary] = await Promise.all([
    supabase.from("buyer_counters").select("*").eq("user_id", profile.id).maybeSingle(),
    supabase.from("user_badges").select("badge_code").eq("user_id", profile.id),
    supabase.from("logs").select(REVIEW_COLUMNS).eq("buyer_id", profile.id)
      .order("logged_at", { ascending: false }).order("id", { ascending: false }).range(start, start + DIARY_PAGE_SIZE),
  ]);
  // Who is looking, whether they already follow, and the public counts.
  const { data: { user: viewer } } = await supabase.auth.getUser();
  const isOwner = viewer?.id === profile.id;
  const [followCounts, followRow] = await Promise.all([
    supabase.from("profile_follow_counts").select("followers, following").eq("user_id", profile.id).maybeSingle(),
    viewer && !isOwner
      ? supabase.from("follows").select("follower_id").eq("follower_id", viewer.id).eq("following_id", profile.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const follows = { followers: followCounts.data?.followers ?? 0, following: followCounts.data?.following ?? 0 };
  const isFollowing = Boolean(followRow.data);
  const accent = accentClasses(profile.accent ?? "forest");
  const banner = safeImageUrl(profile.banner_url);

  const stats = !counters.error && counters.data ? counters.data as BuyerCounters : null;
  const credibility = stats ? scoreBuyer(stats) : null;
  const badges = stats ? earnedBadges("user", computedUserBadges(stats), (granted.data ?? []).map((badge) => badge.badge_code)) : [];
  const rows = (diary.data ?? []) as unknown as ReviewEntry[];
  const entries = rows.slice(0, DIARY_PAGE_SIZE);
  const avatar = safeImageUrl(profile.avatar_url);
  const figures = stats ? [
    { label: "Verified meals", value: stats.verified_logs },
    { label: "Kitchens explored", value: stats.distinct_kitchens },
    { label: "Thoughtful reviews", value: stats.substantive_reviews },
    { label: "Appreciations", value: stats.likes_received },
  ] : [];

  return <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-5 sm:py-12">
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      {/* Banner. A plain accent band when there is no image, so the header has
          the same shape either way and nothing shifts once one is added.

          Deliberately NOT positioned: a positioned element paints above a
          static sibling whatever the DOM order, so `relative` here put the
          banner on top of the avatar and name that are pulled up over it. */}
      <div className={cn("h-28 w-full sm:h-40", accent.band)}>
        {banner && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banner} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
        )}
      </div>

      {/* Positioned instead, so the overlap resolves in this direction. */}
      <div className="relative z-10 p-5 sm:p-8">
        {/* Only the avatar and the tier mark overlap the banner, and both carry
            their own opaque ground — the avatar its border-4 ring, the tier mark
            its filled pill — so they stay legible over any uploaded image.

            The name deliberately does NOT sit here. On the baseline of a 96px
            avatar it painted across the bottom of the banner, and forest ink on
            somebody's photograph is a coin toss: dark ink on a dark picture is
            simply unreadable, and no banner is under our control. Dropping it
            below the overlap puts it back on the surface ground the palette was
            designed against, which fixes every banner rather than most of them. */}
        <div className="-mt-16 flex flex-wrap items-end justify-between gap-4 sm:-mt-20">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" width={96} height={96} referrerPolicy="no-referrer" className="size-20 shrink-0 rounded-full border-4 border-surface bg-forest-soft object-cover sm:size-24" />
          ) : <span aria-hidden="true" className="flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-surface bg-forest-soft font-display text-3xl text-forest sm:size-24">{profile.display_name.slice(0, 1)}</span>}

          {credibility && <div className="shrink-0"><TierMark tier={credibility.tier} /></div>}
        </div>

        {/* min-w-0/break-words let a long name wrap instead of widening the card. */}
        <div className="mt-4 min-w-0">
          <h1 className="font-display text-3xl break-words sm:text-4xl">{profile.display_name}</h1>
          <p className="mt-1 text-sm break-all text-ink-muted">@{profile.handle}</p>
        </div>

        {profile.tagline && (
          <p className={cn("mt-4 inline-block max-w-full rounded-full px-3 py-1.5 text-xs font-medium break-words", accent.chip)}>
            {profile.tagline}
          </p>
        )}

        {profile.bio && <p className="mt-4 max-w-2xl text-sm leading-relaxed break-words whitespace-pre-wrap">{profile.bio}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-muted">
          {profile.city && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5 shrink-0" aria-hidden="true" />{profile.city}</span>}
          <span>At the table since {formatDate(profile.created_at)}</span>
          {credibility && <span className="tabular font-medium text-forest">{formatNumber(credibility.score)} community points</span>}
          <span className="tabular">
            <span className="font-medium text-ink">{follows.following}</span> following
          </span>
        </div>

        <div className="mt-5">
          {isOwner ? (
            <DiaryEditor
              displayName={profile.display_name}
              tagline={profile.tagline ?? ""}
              bio={profile.bio ?? ""}
              city={profile.city ?? ""}
              accent={profile.accent ?? "forest"}
              avatarUrl={profile.avatar_url ?? ""}
              bannerUrl={profile.banner_url ?? ""}
            />
          ) : (
            <FollowButton
              targetId={profile.id}
              targetHandle={profile.handle}
              initialFollowing={isFollowing}
              initialFollowers={follows.followers}
              signedIn={Boolean(viewer)}
            />
          )}
        </div>

        {stats ? <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 sm:grid-cols-4">{figures.map((figure) => <div key={figure.label} className="min-w-0"><dd className="tabular font-display text-3xl text-forest">{formatNumber(figure.value)}</dd><dt className="mt-1 text-xs break-words text-ink-muted">{figure.label}</dt></div>)}</dl> : <p className="mt-5 text-sm text-ink-muted">Community stats are temporarily unavailable.</p>}
      </div>
    </section>
    <div className="grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_18rem]">
      <section aria-label="Meal diary" className="min-w-0 space-y-4">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-brass-ink">The meal diary</p><h2 className="mt-1 font-display text-3xl">Places, plates & memories.</h2><p className="mt-2 text-sm text-ink-muted">Newest meals first. Every verified mark starts with a pickup.</p></div>
        {diary.error ? <SocialNotice title="Diary unavailable">Please try again shortly.</SocialNotice> : <>
          {entries.length ? entries.map((entry) => <ReviewCard key={entry.id} review={entry} showKitchen editable={isOwner} />) : <SocialNotice title={page === 1 ? "The first bite is still ahead." : "No entries on this page"}>{page === 1 ? "Completed pickups will find a home in this diary." : "Head back to the newer entries."}</SocialNotice>}
          <DiaryPagination page={page} hasMore={rows.length > DIARY_PAGE_SIZE} path={`/u/${encodeURIComponent(profile.handle)}`} />
        </>}
      </section>
      <aside className="space-y-6">
        <section><h2 className="mb-4 font-display text-xl">Little milestones</h2>{stats && !granted.error ? <BadgeShelf badges={badges} /> : <p className="text-sm text-ink-muted">Badges are temporarily unavailable.</p>}</section>
        {!diary.error && <RatingHistogram entries={entries} />}
      </aside>
    </div>
  </main>;
}
