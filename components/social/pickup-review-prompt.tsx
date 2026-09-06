"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Star, X } from "lucide-react";
import type { PendingReview } from "@/lib/social/pickup-reviews";
const Panel = dynamic(() => import("@/components/social/pickup-review-panel").then(module => module.PickupReviewPanel), { loading: () => <p className="p-6 text-sm text-ink-muted">Opening your review…</p> });

export function PickupReviewPrompt({ initial }: { initial: PendingReview[] }) {
  const [reviews, setReviews] = useState(initial);
  const [selected, setSelected] = useState<PendingReview | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const controller = new AbortController(); let busy = false;
    const check = async () => { if (busy || document.visibilityState !== "visible") return; busy = true;
      try { const response = await fetch("/api/me/pending-reviews", { cache: "no-store", signal: controller.signal }); if (response.ok) { const body = await response.json(); setReviews(body.reviews); } } catch { /* Keep the current prompt during network failures. */ } finally { busy = false; }
    };
    const timer = setInterval(check, 30000); window.addEventListener("focus", check);
    return () => { clearInterval(timer); window.removeEventListener("focus", check); controller.abort(); };
  }, []);
  function open(review: PendingReview) { setSelected(review); dialog.current?.showModal(); }
  const reviewRow = (review: PendingReview) => <li key={review.id} className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-ink-muted">How was your pickup from <strong className="text-forest">{review.kitchen}</strong>?</span><button onClick={() => open(review)} className="min-h-11 rounded-full bg-forest px-5 text-sm font-medium text-cream">Rate this meal</button></li>;
  return <>
    {reviews.length > 0 && <section aria-label="Meals ready to rate" className="mt-6 rounded-2xl border border-brass/40 bg-brass/10 p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-forest"><Star className="h-4 w-4 fill-brass text-brass" aria-hidden />Your last bite deserves a review</p>
      <ul className="mt-3">{reviewRow(reviews[0])}</ul>
      {reviews.length > 1 && <details className="mt-2"><summary className="min-h-10 cursor-pointer py-2 text-xs text-forest">{reviews.length - 1} more meals to rate</summary><ul className="mt-2 space-y-3">{reviews.slice(1).map(reviewRow)}</ul></details>}
    </section>}
    <dialog ref={dialog} onClose={() => setSelected(null)} aria-label="Rate your completed pickup" className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-3xl bg-cream p-3 text-ink backdrop:bg-forest/40 sm:p-5"><div className="mb-3 flex items-center justify-between gap-4 px-2"><p className="text-sm font-medium text-forest">{selected?.kitchen}</p><button onClick={() => dialog.current?.close()} aria-label="Close review" className="grid h-11 w-11 place-items-center rounded-full border border-line"><X className="h-5 w-5" aria-hidden /></button></div>{selected && <Panel key={selected.id} orderId={selected.id} onSaved={() => { setReviews(current => current.filter(r => r.id !== selected.id)); }} />}</dialog>
  </>;
}
