import { Award } from "lucide-react";
import type { BadgeDef } from "@/lib/types";

export function BadgeShelf({ badges, emptyMessage = "Good things take a few meals. Earned badges will live here." }: { badges: BadgeDef[]; emptyMessage?: string }) {
  if (!badges.length) return <p className="rounded-xl border border-dashed border-line p-4 text-sm leading-relaxed text-ink-muted">{emptyMessage}</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {badges.map((badge) => (
        <li key={badge.code} className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brass/15"><Award className="size-5 text-brass" aria-hidden="true" /></span>
          <div className="min-w-0"><p className="text-sm font-semibold text-brass-ink">{badge.label}</p><p className="mt-1 text-xs leading-relaxed text-ink-muted">{badge.description}</p></div>
        </li>
      ))}
    </ul>
  );
}
