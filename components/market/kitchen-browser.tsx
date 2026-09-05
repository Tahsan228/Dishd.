"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import type { KitchenPublic } from "@/lib/types";
import { KitchenCard } from "@/components/market/kitchen-card";
import { cn } from "@/lib/utils";

type Sort = "popular" | "rating" | "newest";

const SORTS: { key: Sort; label: string }[] = [
  { key: "popular", label: "Most ordered" },
  { key: "rating", label: "Top rated" },
  { key: "newest", label: "Newest" },
];

/**
 * The browse surface: search, cuisine chips, sort, grid.
 *
 * Filtering happens on the client over a list the server already fetched.
 * There are tens of kitchens in a neighbourhood, not thousands, so a round
 * trip per keystroke would be slower and worse — this stays instant and works
 * with the back button untouched.
 */
export function KitchenBrowser({ kitchens }: { kitchens: KitchenPublic[] }) {
  const [query, setQuery] = useState("");
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("popular");

  const cuisines = useMemo(() => {
    const counts = new Map<string, number>();
    for (const k of kitchens) {
      for (const tag of k.cuisine_tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
  }, [kitchens]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = kitchens.filter((k) => {
      if (cuisine && !k.cuisine_tags.includes(cuisine)) return false;
      if (!q) return true;
      return (
        k.name.toLowerCase().includes(q) ||
        k.neighborhood_label.toLowerCase().includes(q) ||
        k.cuisine_tags.some((t) => t.toLowerCase().includes(q))
      );
    });

    return [...filtered].sort((a, b) => {
      if (sort === "rating") return Number(b.avg_rating_10) - Number(a.avg_rating_10);
      if (sort === "newest") return +new Date(b.created_at) - +new Date(a.created_at);
      return b.orders_completed - a.orders_completed;
    });
  }, [kitchens, query, cuisine, sort]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search kitchens</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search kitchens, cuisines or neighbourhoods"
            className="min-h-11 w-full rounded-full border border-line bg-surface pr-4 pl-9 text-base text-ink outline-none focus:border-forest focus-visible:ring-2 focus-visible:ring-forest/20"
          />
        </label>

        <label className="flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm">
          <SlidersHorizontal className="h-4 w-4 text-ink-muted" aria-hidden />
          <span className="sr-only">Sort by</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="bg-transparent py-2 text-ink outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>

      {cuisines.length > 0 && (
        <ul className="mt-4 flex snap-x gap-2 overflow-x-auto pb-1">
          <li>
            <button
              type="button"
              onClick={() => setCuisine(null)}
              aria-pressed={cuisine === null}
              className={cn(
                "min-h-9 shrink-0 snap-start rounded-full border px-4 text-sm whitespace-nowrap",
                cuisine === null
                  ? "border-forest bg-forest text-cream"
                  : "border-line bg-surface text-ink-muted hover:border-forest/40",
              )}
            >
              All
            </button>
          </li>
          {cuisines.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                onClick={() => setCuisine(cuisine === tag ? null : tag)}
                aria-pressed={cuisine === tag}
                className={cn(
                  "min-h-9 shrink-0 snap-start rounded-full border px-4 text-sm whitespace-nowrap capitalize",
                  cuisine === tag
                    ? "border-forest bg-forest text-cream"
                    : "border-line bg-surface text-ink-muted hover:border-forest/40",
                )}
              >
                {tag}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-ink-muted">
        <span className="tabular">{shown.length}</span>
        {shown.length === 1 ? " kitchen" : " kitchens"}
        {cuisine && <> in <span className="capitalize">{cuisine}</span></>}
      </p>

      {shown.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-line bg-surface-sunk p-12 text-center">
          <p className="text-ink-muted">
            Nothing matches that. Try a different search or clear the filter.
          </p>
        </div>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((k) => (
            <li key={k.id}>
              <KitchenCard kitchen={k} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
