import Link from "next/link";
import { notFound } from "next/navigation";
import { REVIEW_COLUMNS, socialClient, type ReviewEntry } from "@/lib/social/data";
import { DIARY_PAGE_SIZE, pageNumber } from "@/lib/social/pagination";
import { DiaryPagination } from "@/components/social/diary-pagination";
import { ReviewCard } from "@/components/social/review-card";
import { SocialNotice } from "@/components/social/social-notice";

export default async function KitchenReviewsPage({ params, searchParams }: {
  params: Promise<{ kitchenId: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { kitchenId } = await params;
  const page = pageNumber((await searchParams).page);
  const supabase = await socialClient();
  if (!supabase) return <main className="mx-auto max-w-2xl p-5"><SocialNotice title="Meal diaries">Diaries will appear when Dishd is connected.</SocialNotice></main>;
  const kitchen = await supabase.from("kitchens").select("id,name,slug").eq("id", kitchenId).maybeSingle();
  if (kitchen.error) return <main className="mx-auto max-w-2xl p-5"><SocialNotice title="Meal diaries unavailable">Please try again shortly.</SocialNotice></main>;
  if (!kitchen.data) notFound();
  const start = (page - 1) * DIARY_PAGE_SIZE;
  const { data, error } = await supabase.from("logs").select(REVIEW_COLUMNS).eq("kitchen_id", kitchenId)
    .order("logged_at", { ascending: false }).order("id", { ascending: false }).range(start, start + DIARY_PAGE_SIZE);
  const rows = (data ?? []) as unknown as ReviewEntry[];
  return <main className="mx-auto max-w-2xl space-y-5 px-5 py-8">
    <Link href={`/k/${encodeURIComponent(kitchen.data.slug)}`} className="text-sm text-forest underline underline-offset-4">Back to {kitchen.data.name}</Link>
    <h1 className="font-display text-3xl">Every meal has a story.</h1>
    {error ? <SocialNotice title="Diaries unavailable">Please try again shortly.</SocialNotice> : <>
      {rows.length ? rows.slice(0, DIARY_PAGE_SIZE).map((review) => <ReviewCard key={review.id} review={review} />) : <SocialNotice title="No entries on this page">Try the newer entries or return to the kitchen.</SocialNotice>}
      <DiaryPagination page={page} hasMore={rows.length > DIARY_PAGE_SIZE} path={`/reviews/${encodeURIComponent(kitchenId)}`} />
    </>}
  </main>;
}
