import { Star } from "lucide-react";
import { toStars, cn } from "@/lib/utils";

export function StarRating({ rating10 }: { rating10: number | null }) {
  if (rating10 === null) return <span className="text-xs text-ink-muted">Not rated yet</span>;
  const stars = toStars(rating10);
  return (
    <span role="img" aria-label={`${stars} out of 5 stars`} className="inline-flex items-center gap-1">
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className="relative inline-flex size-4">
          <Star aria-hidden="true" className="size-4 fill-line text-line" />
          {rating10 > index * 2 && <span className={cn("absolute inset-y-0 left-0 overflow-hidden", rating10 >= (index + 1) * 2 ? "w-full" : "w-1/2")}><Star aria-hidden="true" className="size-4 fill-brass text-brass" /></span>}
        </span>
      ))}
      <span aria-hidden="true" className="tabular ml-1 text-xs font-medium text-ink">{stars.toFixed(1)}</span>
    </span>
  );
}
