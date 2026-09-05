import Link from "next/link";
import { BadgeCheck, CircleHelp } from "lucide-react";
import { formatDate, safeImageUrl, type ReviewEntry } from "@/lib/social/data";
import { cn } from "@/lib/utils";
import { StarRating } from "@/components/social/star-rating";
import { ReviewText } from "@/components/social/review-text";

export function ReviewCard({ review, showKitchen = false }: { review: ReviewEntry; showKitchen?: boolean }) {
  const photos = [...new Set([...(review.photo_urls ?? []), ...(review.photo_url ? [review.photo_url] : [])])].map(safeImageUrl).filter((url): url is string => !!url).slice(0, 3);
  return (
    <article className={cn("min-w-0 rounded-2xl border p-4 sm:p-5", review.is_verified ? "border-line bg-surface" : "border-dashed border-line bg-surface-sunk")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {showKitchen && <p className="mb-2 font-display text-xl">{review.kitchen ? <Link className="hover:underline" href={`/k/${encodeURIComponent(review.kitchen.slug)}`}>{review.kitchen.name}</Link> : "Kitchen unavailable"}</p>}
          {review.author ? <Link href={`/u/${encodeURIComponent(review.author.handle)}`} className="break-words text-sm font-semibold text-ink hover:underline">{review.author.display_name}</Link> : <span className="text-sm text-ink-muted">Dishd neighbor</span>}
          <Link href={`/log/${review.id}`} className="mt-1 block text-xs text-ink-muted hover:underline"><time dateTime={review.logged_at}>{formatDate(review.logged_at)}</time></Link>
        </div>
        <StarRating rating10={review.rating_10} />
      </div>
      <p className={cn("mt-3 flex items-center gap-1.5 text-xs font-medium", review.is_verified ? "text-forest" : "text-ink-muted")}>
        {review.is_verified ? <BadgeCheck aria-hidden="true" className="size-4 shrink-0" /> : <CircleHelp aria-hidden="true" className="size-4 shrink-0" />}
        {review.is_verified ? "Verified pickup" : "Unverified diary entry"}
      </p>
      {review.body ? <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-ink"><ReviewText text={review.body} /></p> : <p className="mt-3 text-sm text-ink-muted">{review.is_verified ? "A meal collected. The story is still to come." : "No written review yet."}</p>}
      {photos.length > 0 && <div className={cn("mt-5 grid gap-3", photos.length > 1 && "grid-cols-2")}>
        {photos.map((photo, index) => <a key={photo} href={photo} target="_blank" rel="noopener noreferrer" aria-label={`Open meal photo ${index + 1}`} className={cn("overflow-hidden rounded-xl bg-surface-sunk", photos.length === 3 && index === 0 && "row-span-2")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}<img src={photo} alt={`Meal photo ${index + 1}`} loading="lazy" referrerPolicy="no-referrer" className="h-full max-h-96 min-h-28 w-full object-cover" />
        </a>)}
      </div>}
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-ink-muted">{[["Food", review.flavor_rating_10], ["Value", review.value_rating_10], ["Packaging", review.quality_rating_10]].map(([label, value]) => value != null && <span key={label} className="rounded-full bg-cream px-3 py-2">{label} <strong className="ml-1 text-forest">{Number(value) / 2}/5</strong></span>)}</div>
      {review.sourcing_affirmed !== null && <p className={cn("mt-4 border-t border-line pt-3 text-xs leading-relaxed", review.sourcing_affirmed ? "text-forest" : "text-clay")}>
        {review.sourcing_affirmed ? "Buyer says the packaging and quality matched the cook’s sourcing claim." : "Buyer says the packaging or quality did not match the cook’s sourcing claim."}
      </p>}
    </article>
  );
}
