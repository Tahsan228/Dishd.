import Link from "next/link";
import { BadgeCheck, CircleHelp } from "lucide-react";
import { formatDate, safeImageUrl, type ReviewEntry } from "@/lib/social/data";
import { cn } from "@/lib/utils";
import { StarRating } from "@/components/social/star-rating";

export function ReviewCard({ review, showKitchen = false }: { review: ReviewEntry; showKitchen?: boolean }) {
  const photo = safeImageUrl(review.photo_url);
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
      {review.body ? <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{review.body}</p> : <p className="mt-3 text-sm text-ink-muted">{review.is_verified ? "A meal collected. The story is still to come." : "No written review yet."}</p>}
      {photo && (
        // User-provided HTTPS images cannot use a frozen Next image allowlist.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="Meal photo shared with this diary entry" loading="lazy" referrerPolicy="no-referrer" className="mt-4 max-h-80 w-full rounded-xl bg-surface-sunk object-contain" />
      )}
      {review.sourcing_affirmed !== null && <p className={cn("mt-4 border-t border-line pt-3 text-xs leading-relaxed", review.sourcing_affirmed ? "text-forest" : "text-clay")}>
        {review.sourcing_affirmed ? "Buyer says the packaging and quality matched the cook’s sourcing claim." : "Buyer says the packaging or quality did not match the cook’s sourcing claim."}
      </p>}
    </article>
  );
}
