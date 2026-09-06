"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { advanceOrder, setReadyEstimate } from "@/lib/market/order-actions";
import { PREP_MAX_MINUTES, PREP_MIN_MINUTES } from "@/lib/market/order-timing";
import type { OrderStatus } from "@/lib/types";

/**
 * Cook-side state machine buttons.
 * Completing fires dishd_autolog_on_complete(), so it is worded as final.
 *
 * Accepting also carries the cooking time, because that is the moment the
 * estimate becomes a real promise to somebody who is now waiting. Asking for it
 * in a second step would mean most orders never get one.
 */
export function OrderActions({
  orderId,
  status,
  prepMinutes,
  defaultPrepMinutes,
  scheduled = false,
}: {
  orderId: string;
  status: OrderStatus;
  /** Minutes already on this order, if any. */
  prepMinutes: number | null;
  /** The kitchen's own default, used to prefill. */
  defaultPrepMinutes: number;
  /** A booked pickup: these minutes decide when to start, not when to hand over. */
  scheduled?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(String(prepMinutes ?? defaultPrepMinutes));
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const run = (work: () => Promise<{ error?: string } | { ok: boolean } | undefined>) =>
    start(async () => {
      setError(null);
      const res = await work();
      if (res && "error" in res && res.error) setError(res.error);
      else router.refresh();
    });

  const go = (to: OrderStatus) =>
    run(() => advanceOrder(orderId, to, to === "accepted" ? Number(minutes) : undefined));

  const revise = () =>
    run(async () => {
      const res = await setReadyEstimate(orderId, Number(minutes));
      if (res && "ok" in res) setSaved(true);
      return res;
    });

  const primary =
    status === "pending" ? { to: "accepted" as const, label: "Accept order" }
    : status === "accepted" ? { to: "ready" as const, label: "Mark ready" }
    : status === "ready" ? { to: "completed" as const, label: "Collected" }
    : null;

  const asksForTime = status === "pending" || status === "accepted";

  return (
    <div className="mt-3 w-full">
      {asksForTime && (
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <div>
            <label
              htmlFor={`prep-${orderId}`}
              className="flex items-center gap-1.5 text-xs text-ink-muted"
            >
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {scheduled ? "Minutes you need before their slot" : "Ready in (minutes)"}
            </label>
            <input
              id={`prep-${orderId}`}
              type="number"
              inputMode="numeric"
              min={PREP_MIN_MINUTES}
              max={PREP_MAX_MINUTES}
              value={minutes}
              onChange={(e) => {
                setMinutes(e.target.value);
                setSaved(false);
              }}
              className="mt-1 min-h-11 w-28 rounded-xl border border-line bg-cream px-3 text-base"
            />
          </div>

          {/* Only offered once the order is accepted: before that, accepting is
              what writes the time, so a second button would be noise. */}
          {status === "accepted" && (
            <button
              type="button"
              onClick={revise}
              disabled={pending}
              className="min-h-11 rounded-full border border-line px-4 text-sm text-forest hover:border-forest disabled:opacity-60"
            >
              {saved ? "Time updated" : "Update the buyer"}
            </button>
          )}
        </div>
      )}

      {asksForTime && (
        <p className="mb-3 text-[11px] leading-relaxed text-ink-muted">
          {scheduled
            ? "They collect at the time they booked. This only sets when you have to start."
            : "The buyer sees this as your estimate, and is told if you change it."}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {primary && (
          <button
            onClick={() => go(primary.to)}
            disabled={pending}
            className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-cream hover:bg-forest-deep disabled:opacity-60"
          >
            {pending ? "Saving…" : primary.label}
          </button>
        )}
        {status === "pending" && (
          <button
            onClick={() => go("declined")}
            disabled={pending}
            className="rounded-full border border-line px-4 py-2 text-sm text-ink-muted hover:border-clay hover:text-clay disabled:opacity-60"
          >
            Decline
          </button>
        )}
        {error && <span className="text-xs text-clay">{error}</span>}
      </div>
    </div>
  );
}
