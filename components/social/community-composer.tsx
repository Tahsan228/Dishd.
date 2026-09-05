"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, PenLine, TriangleAlert } from "lucide-react";
import {
  createCommunityPost,
  type CommunityActionState,
} from "@/lib/social/community-actions";
import { POST_CATEGORIES, type PostCategory } from "@/lib/social/community";
import { cn } from "@/lib/utils";

const initial: CommunityActionState = { ok: false, message: "" };

/**
 * Post composer.
 *
 * The three business categories only appear for someone who owns an open
 * kitchen. Showing them to everyone and failing on submit would be a worse way
 * to say the same thing.
 */
export function CommunityComposer({
  hasKitchen,
  kitchenName,
}: {
  hasKitchen: boolean;
  kitchenName: string | null;
}) {
  const [state, action, pending] = useActionState(createCommunityPost, initial);
  const [category, setCategory] = useState<PostCategory>("story");
  const [body, setBody] = useState("");
  const [open, setOpen] = useState(false);

  const available = POST_CATEGORIES.filter((c) => !c.byKitchen || hasKitchen);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="lift flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left hover:border-forest/40"
      >
        <PenLine className="h-5 w-5 shrink-0 text-forest" aria-hidden />
        <span className="text-sm text-ink-muted">
          {hasKitchen
            ? `Share a story, or post as ${kitchenName ?? "your kitchen"}…`
            : "Share a meal you loved…"}
        </span>
      </button>
    );
  }

  return (
    <form action={action} className="expand rounded-2xl border border-forest/30 bg-surface p-5">
      <fieldset>
        <legend className="text-xs font-medium text-ink">Posting as</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {available.map((c) => (
            <label
              key={c.key}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1.5 text-xs",
                category === c.key
                  ? "border-forest bg-forest text-cream"
                  : "border-line bg-surface text-ink-muted hover:border-forest/40",
              )}
            >
              <input
                type="radio"
                name="category"
                value={c.key}
                checked={category === c.key}
                onChange={() => setCategory(c.key)}
                className="sr-only"
              />
              {c.label}
            </label>
          ))}
        </div>
        {!hasKitchen && (
          <p className="mt-2 text-[11px] text-ink-muted">
            Announcements and offers are for kitchen owners.
          </p>
        )}
      </fieldset>

      <label className="mt-4 block">
        <span className="sr-only">Your post</span>
        <textarea
          name="body"
          required
          rows={4}
          minLength={10}
          maxLength={3000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            category === "story"
              ? "What did you eat, and who cooked it?"
              : "Tell your neighbours what's happening at the kitchen."
          }
          className="min-h-11 w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-ink outline-none focus:border-forest focus-visible:ring-2 focus-visible:ring-forest/20"
        />
        <span className="tabular mt-1 block text-right text-[11px] text-ink-muted">
          {body.trim().length}/3000
        </span>
      </label>

      {state.message && (
        <p
          role="status"
          className={cn(
            "rise mt-2 flex items-start gap-2 rounded-lg p-3 text-xs",
            state.ok
              ? "border border-forest/30 bg-forest-soft text-forest"
              : "border border-clay/30 bg-clay/10 text-clay",
          )}
        >
          {state.ok ? (
            <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
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
          disabled={pending || body.trim().length < 10}
          className="min-h-11 flex-1 rounded-full bg-forest px-5 text-sm font-medium text-cream hover:bg-forest-deep disabled:opacity-50"
        >
          {pending ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
