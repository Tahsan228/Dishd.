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

  return <main className="mx-auto max-w-5xl space-y-8 px-5 py-8 sm:py-12">
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-8">
      <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-ink-muted">A seat at the neighborhood table</p>
      <div className="flex flex-wrap items-center gap-4">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" width={72} height={72} referrerPolicy="no-referrer" className="size-18 rounded-full bg-forest-soft object-cover" />
        ) : <span aria-hidden="true" className="flex size-18 items-center justify-center rounded-full bg-forest-soft font-display text-3xl text-forest">{profile.display_name.slice(0, 1)}</span>}
        <div className="min-w-0 flex-1"><h1 className="break-words font-display text-3xl sm:text-4xl">{profile.display_name}</h1><p className="mt-1 break-all text-sm text-ink-muted">@{profile.handle}</p></div>
        {credibility && <TierMark tier={credibility.tier} />}
      </div>
      {profile.bio && <p className="mt-5 max-w-2xl whitespace-pre-wrap break-words text-sm leading-relaxed">{profile.bio}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-muted">
        {profile.city && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden="true" />{profile.city}</span>}
        <span>At the table since {formatDate(profile.created_at)}</span>
        {credibility && <span className="tabular font-medium text-forest">{formatNumber(credibility.score)} community points</span>}
      </div>
      {stats ? <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 sm:grid-cols-4">{figures.map((figure) => <div key={figure.label}><dd className="tabular font-display text-3xl text-forest">{formatNumber(figure.value)}</dd><dt className="mt-1 text-xs text-ink-muted">{figure.label}</dt></div>)}</dl> : <p className="mt-5 text-sm text-ink-muted">Community stats are temporarily unavailable.</p>}
    </section>
    <div className="grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_18rem]">
      <section aria-label="Meal diary" className="min-w-0 space-y-4">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-brass-ink">The meal diary</p><h2 className="mt-1 font-display text-3xl">Places, plates & memories.</h2><p className="mt-2 text-sm text-ink-muted">Newest meals first. Every verified mark starts with a pickup.</p></div>
        {diary.error ? <SocialNotice title="Diary unavailable">Please try again shortly.</SocialNotice> : <>
          {entries.length ? entries.map((entry) => <ReviewCard key={entry.id} review={entry} showKitchen />) : <SocialNotice title={page === 1 ? "The first bite is still ahead." : "No entries on this page"}>{page === 1 ? "Completed pickups will find a home in this diary." : "Head back to the newer entries."}</SocialNotice>}
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
