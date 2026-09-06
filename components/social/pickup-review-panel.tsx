"use client";
import { useEffect, useState, useTransition } from "react";
import { preparePickupReview } from "@/lib/social/prepare-pickup-review";
import type { PickupReview } from "@/lib/social/pickup-reviews";
import { ReviewComposer } from "@/components/social/review-composer";

export function PickupReviewPanel({ orderId, initialReview, onSaved }: { orderId: string; initialReview?: PickupReview | null; onSaved?: () => void }) {
  const [review, setReview] = useState(initialReview ?? null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  function prepare() { start(async () => {
    try { const result = await preparePickupReview(orderId); if (result.review) setReview(result.review); else setError(result.error ?? "Please try again."); }
    catch { setError("Your review could not load. Check your connection and try again."); }
  }); }
  useEffect(() => {
    if (initialReview) return;
    let cancelled = false;
    preparePickupReview(orderId).then(result => { if (cancelled) return; if (result.review) setReview(result.review); else setError(result.error ?? "Please try again."); }).catch(() => { if (!cancelled) setError("Your review could not load. Check your connection and try again."); });
    return () => { cancelled = true; };
  }, [orderId, initialReview]);
  if (review) return <ReviewComposer log={review.log} kitchen={review.kitchen} dishes={review.dishRatingsAvailable ? review.dishes : []} onSaved={onSaved} />;
  return <div role="status" className="rounded-2xl border border-line bg-surface p-6 text-sm text-ink-muted">{error || "Opening your pickup review…"}{error && <button disabled={pending} onClick={prepare} className="mt-3 block min-h-11 rounded-full bg-forest px-5 text-sm text-cream">{pending ? "Opening…" : "Try again"}</button>}</div>;
}
