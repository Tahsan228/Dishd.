import Link from "next/link";
import { REVIEW_COLUMNS, socialClient, type ReviewEntry } from "@/lib/social/data";
import { ReviewCard } from "@/components/social/review-card";
import { SocialNotice } from "@/components/social/social-notice";

export async function ReviewFeed({ kitchenId }: { kitchenId: string }) {
  const supabase = await socialClient();
  if (!supabase) return <SocialNotice title="From the neighbors">Meal diaries will appear when Dishd is connected.</SocialNotice>;
  const { data, error, count } = await supabase.from("logs")
    .select(REVIEW_COLUMNS, { count: "exact" }).eq("kitchen_id", kitchenId)
    .order("logged_at", { ascending: false }).order("id", { ascending: false }).limit(12);
  if (error) return <SocialNotice title="From the neighbors">We couldn’t load the meal diaries. Please try again shortly.</SocialNotice>;
  const reviews = (data ?? []) as unknown as ReviewEntry[];
  return (
    <section aria-label="Kitchen reviews" className="space-y-4">
      <div><h2 className="font-display text-2xl">From the neighbors</h2><p className="mt-1 text-sm text-ink-muted">Real pickups. Their own words.</p></div>
      {reviews.length ? reviews.map((review) => <ReviewCard key={review.id} review={review} />) : <SocialNotice title="A place for the first story">Completed pickups appear here automatically. A verified mark means the buyer collected an order.</SocialNotice>}
      {(count ?? 0) > reviews.length && <Link href={`/reviews/${encodeURIComponent(kitchenId)}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-forest underline underline-offset-4">Read all {count} diary entries</Link>}
    </section>
  );
}
