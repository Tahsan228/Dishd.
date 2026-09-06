"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, UserPlus } from "lucide-react";
import { toggleFollow } from "@/lib/social/profile-actions";
import { cn } from "@/lib/utils";

/**
 * Follow a diary.
 *
 * The count moves with the button rather than waiting for the round trip —
 * following is the kind of small action that feels broken if it pauses. A
 * failure rolls both back together and says why.
 */
export function FollowButton({
  targetId,
  targetHandle,
  initialFollowing,
  initialFollowers,
  signedIn,
}: {
  targetId: string;
  targetHandle: string;
  initialFollowing: boolean;
  initialFollowers: number;
  signedIn: boolean;
}) {
  const [state, setState] = useState({
    following: initialFollowing,
    followers: initialFollowers,
  });
  const [optimistic, setOptimistic] = useOptimistic(state);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!signedIn) {
    return (
      <Link
        href={`/signin?next=${encodeURIComponent(`/u/${targetHandle}`)}`}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-forest px-5 text-sm font-medium text-cream hover:bg-forest-deep"
      >
        <UserPlus className="h-4 w-4" aria-hidden />
        Follow
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        aria-pressed={optimistic.following}
        onClick={() =>
          start(async () => {
            const next = {
              following: !optimistic.following,
              followers: optimistic.followers + (optimistic.following ? -1 : 1),
            };
            setOptimistic(next);
            setError(null);

            const result = await toggleFollow(targetId, targetHandle, optimistic.following);
            if (result.ok) {
              setState(next);
              router.refresh();
            } else {
              setError(result.message);
            }
          })
        }
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-medium transition-colors disabled:opacity-60",
          optimistic.following
            ? "border border-line bg-surface text-ink-muted hover:border-clay hover:text-clay"
            : "bg-forest text-cream hover:bg-forest-deep",
        )}
      >
        {optimistic.following ? (
          <>
            <Check className="h-4 w-4" aria-hidden />
            Following
          </>
        ) : (
          <>
            <UserPlus className="h-4 w-4" aria-hidden />
            Follow
          </>
        )}
      </button>

      <p className="tabular text-sm text-ink-muted">
        <span className="font-medium text-ink">{optimistic.followers}</span>{" "}
        {optimistic.followers === 1 ? "follower" : "followers"}
      </p>

      {error && (
        <p role="status" className="w-full text-xs text-clay">
          {error}
        </p>
      )}
    </div>
  );
}
