import type { ReviewEntry } from "@/lib/social/data";

export function RatingHistogram({ entries }: { entries: ReviewEntry[] }) {
  // A visualization of the loaded diary page, never a replacement for buyer_counters.
  const buckets = Array.from({ length: 6 }, () => 0);
  for (const entry of entries) {
    if (entry.rating_10 !== null) buckets[Math.ceil(entry.rating_10 / 2)] += 1;
  }
  const max = Math.max(1, ...buckets);
  return <section className="rounded-2xl border border-line bg-surface p-5" aria-label="Ratings on this diary page">
    <h2 className="font-display text-xl">A taste of their taste</h2>
    <p className="mt-1 text-xs text-ink-muted">Ratings on this diary page. Unrated pickups are excluded.</p>
    <ul className="mt-4 space-y-2">
      {buckets.map((count, stars) => <li key={stars} className="flex items-center gap-3 text-xs">
        <span className="tabular w-16 shrink-0 text-ink-muted">{stars === 0 ? "0 stars" : `${stars - 0.5}–${stars} ★`}</span>
        <meter min={0} max={max} value={count} aria-label={`${stars === 0 ? "Zero" : `${stars - 0.5} to ${stars}`} stars: ${count} entries`} className="h-3 min-w-0 flex-1 [&::-webkit-meter-bar]:border-0 [&::-webkit-meter-bar]:bg-surface-sunk [&::-webkit-meter-optimum-value]:bg-brass [&::-moz-meter-bar]:bg-brass" />
        <span className="tabular w-6 text-right text-ink">{count}</span>
      </li>)}
    </ul>
  </section>;
}
