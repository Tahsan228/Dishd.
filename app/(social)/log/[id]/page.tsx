import Link from "next/link";
import { notFound } from "next/navigation";
import { REVIEW_COLUMNS, socialClient, type ReviewEntry } from "@/lib/social/data";
import { ReviewAppreciation } from "@/components/social/review-appreciation";
import { ReviewCard } from "@/components/social/review-card";
import { ReviewComposer } from "@/components/social/review-composer";
import { SocialNotice } from "@/components/social/social-notice";

export default async function LogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await socialClient();
  if (!supabase) return <main className="mx-auto max-w-2xl p-5"><SocialNotice title="A meal worth remembering">Diary entries will appear when Dishd is connected.</SocialNotice></main>;
  const [result, auth, likes] = await Promise.all([
    supabase.from("logs").select(REVIEW_COLUMNS).eq("id", id).maybeSingle(),
    supabase.auth.getUser(),
    supabase.from("log_likes").select("log_id", { count: "exact", head: true }).eq("log_id", id),
  ]);
  if (result.error) return <main className="mx-auto max-w-2xl p-5"><SocialNotice title="Diary entry unavailable">Please try again shortly.</SocialNotice></main>;
  if (!result.data) notFound();
  const log = result.data as unknown as ReviewEntry;
  const user = auth.data.user;
  const ownReview = user?.id === log.buyer_id;
  const liked = user ? await supabase.from("log_likes").select("log_id").eq("log_id", id).eq("user_id", user.id).maybeSingle() : null;

  return <main className="mx-auto max-w-2xl space-y-6 px-5 py-8 sm:py-12">
    {log.kitchen && <Link href={`/k/${encodeURIComponent(log.kitchen.slug)}`} className="inline-flex min-h-11 items-center text-sm text-forest underline underline-offset-4">Back to {log.kitchen.name}</Link>}
    <div><p className="text-xs font-semibold uppercase tracking-widest text-brass-ink">The meal diary</p><h1 className="mt-2 font-display text-3xl sm:text-4xl">{log.kitchen ? `A meal from ${log.kitchen.name}` : "A meal to remember"}</h1></div>
    <ReviewCard review={log} />
    {!likes.error && !liked?.error ? <ReviewAppreciation logId={id} initialCount={likes.count ?? 0} initialLiked={!!liked?.data} signedIn={!!user} /> : <p className="text-sm text-ink-muted">Appreciations are temporarily unavailable.</p>}
    {ownReview && log.is_verified && log.order_id && <ReviewComposer log={log} />}
    {ownReview && !log.is_verified && <SocialNotice title="A note about this entry">This entry has no verified pickup. Completed orders create a verified entry automatically.</SocialNotice>}
    {log.author && <Link href={`/u/${encodeURIComponent(log.author.handle)}`} className="inline-flex min-h-11 items-center text-sm font-medium text-forest underline underline-offset-4">More from {log.author.display_name}’s diary</Link>}
  </main>;
}
