"use client";
import { useActionState } from "react";
import { openOrderReview } from "@/lib/social/review-recovery";
export function RecoverReviewButton({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(async () => openOrderReview(orderId), null);
  return <form action={action}><button className="min-h-11 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream disabled:opacity-60" disabled={pending}>{pending ? "Opening your review…" : "Write your pickup review"}</button>{state?.error && <p className="mt-3 text-sm text-clay" role="alert">{state.error}</p>}</form>;
}
