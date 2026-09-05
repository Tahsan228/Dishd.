"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setItemAvailability } from "@/lib/market/cook-actions";
import { cn } from "@/lib/utils";

/**
 * Sold-out switch.
 *
 * A cook runs out mid-service, and the alternative to this is deleting the dish
 * and losing its history. Availability is the reversible version.
 */
export function MenuAvailabilityToggle({
  itemId,
  name,
  available,
}: {
  itemId: string;
  name: string;
  available: boolean;
}) {
  const [optimistic, setOptimistic] = useState(available);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={optimistic}
      onClick={() => {
        const next = !optimistic;
        setOptimistic(next);
        start(async () => {
          const result = await setItemAvailability(itemId, next);
          if (result && "error" in result && result.error) setOptimistic(!next);
          router.refresh();
        });
      }}
      className={cn(
        "min-h-9 shrink-0 rounded-full border px-3 text-xs font-medium disabled:opacity-60",
        optimistic
          ? "border-forest bg-forest-soft text-forest"
          : "border-line bg-surface-sunk text-ink-muted",
      )}
    >
      <span className="sr-only">{name} is </span>
      {optimistic ? "On sale" : "Sold out"}
    </button>
  );
}
