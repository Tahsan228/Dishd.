"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Flag, TriangleAlert } from "lucide-react";
import { reportKitchen, type CommunityActionState } from "@/lib/social/community-actions";
// Plain module: a "use server" file may only export async functions, so shared
// constants imported from one arrive as undefined in the client bundle.
import { REPORT_REASONS } from "@/lib/social/community";
import { cn } from "@/lib/utils";

const initial: CommunityActionState = { ok: false, message: "" };

/**
 * Report a kitchen for a halal, safety or quality failure.
 *
 * Deliberately understated until opened. A permanently visible red report
 * button on every kitchen invites idle use, and an upheld flag costs a cook 40
 * credibility points — the weight of the outcome should be reflected in how
 * deliberately the thing is reached.
 */
export function ReportDialog({
  kitchenId,
  kitchenName,
  orderId,
}: {
  kitchenId: string;
  kitchenName: string;
  /** Present when reporting a specific pickup, which strengthens the report. */
  orderId?: string;
}) {
  const [state, action, pending] = useActionState(reportKitchen, initial);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0].key);
  const [detail, setDetail] = useState("");

  if (state.ok) {
    return (
      <p
        role="status"
        className="rise mt-4 flex items-start gap-2 rounded-xl border border-forest/30 bg-forest-soft p-4 text-xs leading-relaxed text-forest"
      >
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>{state.message}</span>
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex items-center gap-1.5 text-xs text-ink-muted underline-offset-2 hover:text-clay hover:underline"
      >
        <Flag className="h-3.5 w-3.5" aria-hidden />
        Report a problem with this order
      </button>
    );
  }

  const chosen = REPORT_REASONS.find((r) => r.key === reason);

  return (
    <form action={action} className="expand mt-4 rounded-2xl border border-clay/35 bg-clay/5 p-5">
      <h3 className="flex items-center gap-2 font-display text-lg text-clay">
        <Flag className="h-4 w-4" aria-hidden />
        Report {kitchenName}
      </h3>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
        A reviewer reads every report. Nothing changes on this kitchen&rsquo;s
        page unless the report is upheld — so say what happened as precisely as
        you can.
      </p>

      <input type="hidden" name="targetId" value={kitchenId} />
      <input type="hidden" name="targetType" value="kitchen" />
      {orderId && <input type="hidden" name="orderId" value={orderId} />}

      <fieldset className="mt-4">
        <legend className="text-xs font-medium text-ink">What went wrong?</legend>
        <div className="mt-2 space-y-1.5">
          {REPORT_REASONS.map((r) => (
            <label
              key={r.key}
              className={cn(
                "flex cursor-pointer gap-2.5 rounded-lg border p-3 text-xs",
                reason === r.key
                  ? "border-clay bg-clay/10"
                  : "border-line bg-surface hover:border-clay/40",
              )}
            >
              <input
                type="radio"
                name="reason"
                value={r.key}
                checked={reason === r.key}
                onChange={() => setReason(r.key)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--color-clay)]"
              />
              <span>
                <span className="block font-medium text-ink">{r.label}</span>
                <span className="mt-0.5 block text-ink-muted">{r.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-4 block">
        <span className="text-xs font-medium text-ink">What happened?</span>
        <textarea
          name="detail"
          required
          rows={4}
          minLength={20}
          maxLength={2000}
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder={
            chosen?.key === "haram_sourcing"
              ? "What did you see that made you doubt the sourcing?"
              : "Dates, what you ordered, and what was wrong."
          }
          className="mt-1 w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-ink outline-none focus:border-clay focus-visible:ring-2 focus-visible:ring-clay/20"
        />
        <span className="tabular mt-1 block text-right text-[11px] text-ink-muted">
          {detail.trim().length}/2000 · at least 20
        </span>
      </label>

      {!state.ok && state.message && (
        <p
          role="status"
          className="rise mt-2 flex items-start gap-2 rounded-lg border border-clay/30 bg-clay/10 p-3 text-xs text-clay"
        >
          <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{state.message}</span>
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-11 rounded-full border border-line px-4 text-sm text-ink-muted hover:border-forest hover:text-forest"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || detail.trim().length < 20}
          className="min-h-11 flex-1 rounded-full bg-clay px-5 text-sm font-medium text-cream hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send report"}
        </button>
      </div>
    </form>
  );
}
