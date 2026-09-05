"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { goLive } from "@/lib/market/cook-actions";

/** The last step: flips the kitchen from draft to active. */
export function GoLiveButton({ kitchenName }: { kitchenName: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div>
      <p className="text-xs leading-relaxed text-ink-muted">
        Opening publishes {kitchenName} to the marketplace. Your credibility
        record starts at zero and is built from real orders — the score on your
        page is computed from what you actually do, so there is nothing to fill
        in here.
      </p>

      {error && (
        <p className="rise mt-3 flex items-start gap-2 rounded-lg border border-clay/30 bg-clay/10 p-3 text-xs text-clay">
          <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await goLive();
            if (result.ok) router.push("/cook");
            else setError(result.message);
          })
        }
        className="mt-4 min-h-11 w-full rounded-full bg-forest px-5 text-sm font-medium text-cream hover:bg-forest-deep disabled:opacity-60"
      >
        {pending ? "Opening…" : "Open for orders"}
      </button>
    </div>
  );
}
