"use client";

import { useActionState } from "react";
import type { DiaryLog } from "@/lib/social/data";
import { saveReview } from "@/lib/social/review-actions";
import { cn } from "@/lib/utils";

const fieldClass = "mt-2 min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-forest/20";

export function ReviewComposer({ log }: { log: DiaryLog }) {
  const [state, action, pending] = useActionState(saveReview.bind(null, log.id), { ok: false, message: "" });
  const prefix = `review-${log.id}`;
  return <section aria-label="Write your review" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
    <p className="text-xs font-semibold uppercase tracking-widest text-brass-ink">Your meal, in your words</p>
    <h2 className="mt-2 font-display text-2xl">How was your first bite?</h2>
    <p className="mt-2 text-sm leading-relaxed text-ink-muted">Your pickup is already verified. Add what you thought to help the next neighbor.</p>
    <form action={action} className="mt-6 space-y-5">
      <div>
        <label htmlFor={`${prefix}-rating`} className="text-sm font-medium">Your rating</label>
        <select id={`${prefix}-rating`} name="rating" required defaultValue={log.rating_10 ?? ""} aria-invalid={!!state.errors?.rating} aria-describedby={state.errors?.rating ? `${prefix}-rating-error` : undefined} className={fieldClass}>
          <option value="" disabled>Choose a rating</option>
          {Array.from({ length: 11 }, (_, rating) => <option key={rating} value={rating}>{(rating / 2).toFixed(1)} out of 5 stars</option>)}
        </select>
        {state.errors?.rating && <p id={`${prefix}-rating-error`} className="mt-1 text-xs text-clay">{state.errors.rating}</p>}
      </div>
      <div>
        <label htmlFor={`${prefix}-body`} className="text-sm font-medium">Tell us about the meal <span className="font-normal text-ink-muted">(optional)</span></label>
        <textarea id={`${prefix}-body`} name="body" defaultValue={log.body ?? ""} maxLength={3000} rows={5} placeholder="The flavors, the welcome, the dish you’d order again…" className={cn(fieldClass, "resize-y")} aria-invalid={!!state.errors?.body} aria-describedby={`${prefix}-body-help`} />
        <p id={`${prefix}-body-help`} className={cn("mt-1 text-xs", state.errors?.body ? "text-clay" : "text-ink-muted")}>{state.errors?.body ?? "Up to 3,000 characters. Keep home addresses and pickup codes private."}</p>
      </div>
      <div>
        <label htmlFor={`${prefix}-photo`} className="text-sm font-medium">Meal photo link <span className="font-normal text-ink-muted">(optional)</span></label>
        <input id={`${prefix}-photo`} name="photo" type="url" maxLength={2048} defaultValue={log.photo_url ?? ""} placeholder="https://…" className={fieldClass} aria-invalid={!!state.errors?.photo} aria-describedby={`${prefix}-photo-help`} />
        <p id={`${prefix}-photo-help`} className={cn("mt-1 text-xs", state.errors?.photo ? "text-clay" : "text-ink-muted")}>{state.errors?.photo ?? "Use a public HTTPS image link. Leave blank to remove a photo."}</p>
      </div>
      <div className="rounded-xl bg-forest-soft p-4">
        <label htmlFor={`${prefix}-sourcing`} className="block text-sm font-medium leading-relaxed text-forest">Did the packaging and quality match the cook’s sourcing claim?</label>
        <select id={`${prefix}-sourcing`} name="sourcing" required defaultValue={log.sourcing_affirmed === null ? "" : log.sourcing_affirmed ? "yes" : "no"} className={fieldClass} aria-invalid={!!state.errors?.sourcing} aria-describedby={`${prefix}-sourcing-help`}>
          <option value="" disabled>Choose an answer</option><option value="yes">Yes, it matched</option><option value="no">No, something didn’t match</option><option value="unsure">Not sure</option>
        </select>
        <p id={`${prefix}-sourcing-help`} className={cn("mt-2 text-xs leading-relaxed", state.errors?.sourcing ? "text-clay" : "text-forest")}>{state.errors?.sourcing ?? "Share what you observed. “Not sure” is always a valid answer."}</p>
      </div>
      <p role="status" aria-live="polite" className={cn("text-sm leading-relaxed", state.ok ? "text-forest" : "text-clay")}>{state.message}</p>
      <button type="submit" disabled={pending} className="min-h-11 w-full rounded-lg bg-forest px-5 py-3 text-sm font-semibold text-cream hover:bg-forest-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:cursor-wait disabled:opacity-60">{pending ? "Saving your review…" : log.rating_10 === null ? "Share your review" : "Save your review"}</button>
    </form>
  </section>;
}
