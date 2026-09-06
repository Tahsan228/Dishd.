"use client";

import { useActionState, useState } from "react";
import { CalendarClock, Clock, Zap } from "lucide-react";
import { updateOrderSettings } from "@/lib/market/cook-actions";
import { PREP_MAX_MINUTES, PREP_MIN_MINUTES } from "@/lib/market/order-timing";
import type { CookActionState } from "@/lib/market/cook-onboarding";

const initial: CookActionState = { ok: false, message: "" };

/**
 * The terms this kitchen trades on.
 *
 * Separate from onboarding because these change while trading: a kitchen three
 * hours deep raises its cooking time, and one that cannot keep up withdraws
 * priority by pricing it at zero. Each one is the cook's own claim about their
 * own kitchen, and the labels say so rather than dressing them as guarantees.
 */
export function OrderSettings({
  defaultPrepMinutes,
  priorityFeeCents,
  acceptsScheduled,
}: {
  defaultPrepMinutes: number;
  priorityFeeCents: number;
  acceptsScheduled: boolean;
}) {
  const [state, action, pending] = useActionState(updateOrderSettings, initial);
  const [open, setOpen] = useState(false);

  return (
    <section className="mt-6 rounded-2xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex min-h-11 w-full flex-wrap items-center justify-between gap-3 p-5 text-left"
      >
        <span>
          <span className="block text-sm font-medium text-ink">How you take orders</span>
          <span className="mt-1 block text-sm text-ink-muted">
            About {defaultPrepMinutes} minutes to cook &middot;{" "}
            {priorityFeeCents > 0
              ? `priority at $${(priorityFeeCents / 100).toFixed(2)}`
              : "no priority option"}{" "}
            &middot; {acceptsScheduled ? "taking bookings" : "no bookings"}
          </span>
        </span>
        <span className="shrink-0 text-sm text-forest underline-offset-4 hover:underline">
          {open ? "Close" : "Change"}
        </span>
      </button>

      {open && (
        <form action={action} className="border-t border-line p-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="defaultPrepMinutes"
                className="flex items-center gap-1.5 text-sm font-medium text-ink"
              >
                <Clock className="h-4 w-4 shrink-0 text-forest" aria-hidden />
                Usual cooking time
              </label>
              <input
                id="defaultPrepMinutes"
                name="defaultPrepMinutes"
                type="number"
                inputMode="numeric"
                min={PREP_MIN_MINUTES}
                max={PREP_MAX_MINUTES}
                defaultValue={defaultPrepMinutes}
                aria-describedby="prep-help prep-error"
                aria-invalid={Boolean(state.errors?.defaultPrepMinutes)}
                className="mt-2 min-h-11 w-full rounded-xl border border-line bg-cream px-3 text-base"
              />
              <p id="prep-help" className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                Minutes, {PREP_MIN_MINUTES} to {PREP_MAX_MINUTES}. This is your own estimate and
                only fills in the time on a new order — you set the real one when you accept it.
              </p>
              <p id="prep-error" aria-live="polite" className="mt-1 text-sm text-clay">
                {state.errors?.defaultPrepMinutes ?? ""}
              </p>
            </div>

            <div>
              <label
                htmlFor="priorityFee"
                className="flex items-center gap-1.5 text-sm font-medium text-ink"
              >
                <Zap className="h-4 w-4 shrink-0 text-brass-ink" aria-hidden />
                Priority price
              </label>
              <input
                id="priorityFee"
                name="priorityFee"
                type="text"
                inputMode="decimal"
                defaultValue={priorityFeeCents > 0 ? (priorityFeeCents / 100).toFixed(2) : ""}
                placeholder="0.00"
                aria-describedby="priority-help priority-error"
                aria-invalid={Boolean(state.errors?.priorityFee)}
                className="mt-2 min-h-11 w-full rounded-xl border border-line bg-cream px-3 text-base"
              />
              <p id="priority-help" className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                Dollars, up to $20. You keep all of it, and it counts as a sale, so the 5% cash
                fee applies to it like food. Leave it empty and buyers are never offered priority.
              </p>
              <p id="priority-error" aria-live="polite" className="mt-1 text-sm text-clay">
                {state.errors?.priorityFee ?? ""}
              </p>
            </div>
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 text-sm has-checked:border-forest has-checked:bg-forest-soft">
            <input
              type="checkbox"
              name="acceptsScheduled"
              defaultChecked={acceptsScheduled}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-forest)]"
            />
            <span>
              <span className="flex items-center gap-1.5 font-medium text-ink">
                <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Take orders booked for later
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-ink-muted">
                Up to seven days ahead, in 15-minute steps. A booking still waits for you to
                accept it, and stays out of your live list until it is time to start cooking.
              </span>
            </span>
          </label>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="min-h-11 rounded-full bg-forest px-5 text-sm font-medium text-cream hover:bg-forest-deep disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <p aria-live="polite" className={state.ok ? "text-sm text-forest" : "text-sm text-clay"}>
              {state.message}
            </p>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
            Changes apply to new orders. Anything already placed keeps the terms it was placed on.
          </p>
        </form>
      )}
    </section>
  );
}
