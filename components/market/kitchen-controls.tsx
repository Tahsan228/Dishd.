"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DoorClosed, DoorOpen, Trash2, TriangleAlert } from "lucide-react";
import { deleteMenuItem, setKitchenOpen } from "@/lib/market/cook-actions";
import { cn } from "@/lib/utils";

/** Remove one dish, behind a confirm so a mis-tap cannot wipe a listing. */
export function DeleteDishButton({ itemId, name }: { itemId: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Remove ${name}`}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-ink-muted hover:border-clay hover:text-clay"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    );
  }

  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await deleteMenuItem(itemId);
            if (result.ok) router.refresh();
            else setError(result.message);
          })
        }
        className="min-h-9 rounded-full bg-clay px-3 text-xs font-medium text-cream disabled:opacity-60"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="min-h-9 rounded-full border border-line px-3 text-xs text-ink-muted"
      >
        Keep
      </button>
      {error && <span className="text-xs text-clay">{error}</span>}
    </span>
  );
}

/**
 * Close or reopen the kitchen.
 *
 * Closing is a soft close, and the copy says so: orders and reviews already
 * made stay, because they are the buyer's record too. Deleting the row outright
 * would take somebody else's diary with it.
 */
export function KitchenOpenControl({
  isOpen,
  kitchenName,
}: {
  isOpen: boolean;
  kitchenName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const run = (open: boolean) =>
    start(async () => {
      const result = await setKitchenOpen(open, reason);
      if (result.ok) {
        setConfirming(false);
        setError(null);
        router.refresh();
      } else {
        setError(result.message);
      }
    });

  if (!isOpen) {
    return (
      <div className="rounded-2xl border border-amber/40 bg-amber/10 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg text-ink">
          <DoorClosed className="h-4 w-4" aria-hidden />
          {kitchenName} is closed
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
          It is off the marketplace and nothing on your menu is for sale. Your
          orders, reviews and credibility record are untouched.
        </p>
        {error && <p className="mt-3 text-xs text-clay">{error}</p>}
        <button
          type="button"
          disabled={pending}
          onClick={() => run(true)}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-forest px-5 text-sm font-medium text-cream hover:bg-forest-deep disabled:opacity-60"
        >
          <DoorOpen className="h-4 w-4" aria-hidden />
          {pending ? "Reopening…" : "Reopen my kitchen"}
        </button>
      </div>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs text-ink-muted underline-offset-2 hover:text-clay hover:underline"
      >
        Close my kitchen
      </button>
    );
  }

  return (
    <div className="expand rounded-2xl border border-clay/35 bg-clay/5 p-5">
      <h2 className="flex items-center gap-2 font-display text-lg text-clay">
        <TriangleAlert className="h-4 w-4" aria-hidden />
        Close {kitchenName}?
      </h2>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
        Your kitchen comes off the marketplace and every dish stops selling. This
        is reversible — you can reopen whenever you like.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-ink-muted">
        Nothing is erased. Completed orders and the reviews buyers wrote stay
        exactly as they are, because those are their record as much as yours, and
        your credibility score is waiting if you come back.
      </p>

      <label className="mt-4 block">
        <span className="text-xs font-medium text-ink">
          Why are you closing? <span className="font-normal text-ink-muted">(optional)</span>
        </span>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
          placeholder="Taking a break for Ramadan…"
          className="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-ink outline-none focus:border-clay"
        />
      </label>

      {error && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-clay/30 bg-clay/10 p-3 text-xs text-clay">
          <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}

      <div className={cn("mt-4 flex gap-2")}>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="min-h-11 rounded-full border border-line px-4 text-sm text-ink-muted hover:border-forest hover:text-forest"
        >
          Keep it open
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(false)}
          className="min-h-11 flex-1 rounded-full bg-clay px-5 text-sm font-medium text-cream hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Closing…" : "Close my kitchen"}
        </button>
      </div>
    </div>
  );
}
