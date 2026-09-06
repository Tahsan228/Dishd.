"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LocateFixed, MapPin, Search } from "lucide-react";

const SUGGESTIONS = ["Hackensack", "Teaneck", "Fort Lee", "Paterson", "Paramus"];

/**
 * "Find kitchens near me."
 *
 * Submits to the same page as a `?near=` query rather than filtering in place,
 * so a result is linkable, survives a refresh and the back button, and works
 * with JavaScript off — the input is a real form.
 *
 * There is no browser geolocation prompt here on purpose: asking a first-time
 * visitor for their precise location before they know what the site is buys a
 * refusal. Typing a town is enough to rank a neighbourhood.
 */
export function LocationSearch({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);

  const go = (next: string) => {
    const trimmed = next.trim();
    router.push(trimmed ? `/?near=${encodeURIComponent(trimmed)}#kitchens` : "/#kitchens");
  };

  return (
    <div>
      <form
        action="/"
        onSubmit={(e) => {
          e.preventDefault();
          go(value);
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <label className="relative flex-1">
          <span className="sr-only">Your town or ZIP code</span>
          <MapPin
            className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-forest"
            aria-hidden
          />
          <input
            name="near"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter your town or ZIP — Teaneck, 07601…"
            autoComplete="postal-code"
            className="min-h-13 w-full rounded-full border border-line bg-surface py-3.5 pr-4 pl-11 text-base text-ink shadow-sm outline-none transition-colors focus:border-forest focus-visible:ring-2 focus-visible:ring-forest/20"
          />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-forest px-7 py-3.5 text-sm font-semibold text-cream transition-colors hover:bg-forest-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          <Search className="h-4 w-4" aria-hidden />
          Find kitchens
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs text-ink-muted">
          <LocateFixed className="h-3.5 w-3.5" aria-hidden />
          Popular:
        </span>
        {SUGGESTIONS.map((town) => (
          <button
            key={town}
            type="button"
            onClick={() => {
              setValue(town);
              go(town);
            }}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-muted transition-colors hover:border-forest/50 hover:text-forest"
          >
            {town}
          </button>
        ))}
      </div>
    </div>
  );
}
