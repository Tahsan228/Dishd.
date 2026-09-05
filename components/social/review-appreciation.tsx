"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { setReviewLike } from "@/lib/social/like-actions";
import { cn } from "@/lib/utils";

export function ReviewAppreciation({ logId, initialLiked, initialCount, signedIn }: { logId: string; initialLiked: boolean; initialCount: number; signedIn: boolean }) {
  const [state, action, pending] = useActionState(async (previous: { liked: boolean; count: number; message: string }) => setReviewLike(logId, !previous.liked, previous), { liked: initialLiked, count: initialCount, message: "" });
  return <form action={action} className="space-y-2">
    <button disabled={pending || !signedIn} aria-pressed={state.liked} type="submit" className={cn("inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-60", state.liked ? "border-forest bg-forest-soft text-forest" : "border-line bg-surface text-ink-muted hover:border-forest")}>
      <Heart aria-hidden="true" className={cn("size-4", state.liked && "fill-forest")} /><span className="tabular">{state.count}</span> {state.count === 1 ? "appreciation" : "appreciations"}
    </button>
    {!signedIn && <Link href={`/signin?next=${encodeURIComponent(`/log/${logId}`)}`} className="inline-flex min-h-11 items-center text-xs text-forest underline underline-offset-4">Sign in to appreciate this review</Link>}
    <p className="text-xs text-ink-muted" role="status" aria-live="polite">{state.message}</p>
  </form>;
}
