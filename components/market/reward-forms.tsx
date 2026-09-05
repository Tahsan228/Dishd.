"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Sparkles, TriangleAlert, Video } from "lucide-react";
import { redeemReward, submitRewardClaim, type RewardActionState } from "@/lib/market/reward-actions";
import type { RewardCatalogItem } from "@/lib/market/rewards";
import { formatCents } from "@/lib/utils";
import { cn } from "@/lib/utils";

const initial: RewardActionState = { ok: false, message: "" };

const field =
  "mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-ink outline-none focus:border-forest focus-visible:ring-2 focus-visible:ring-forest/20";

function Feedback({ state }: { state: RewardActionState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={cn(
        "rise mt-3 flex items-start gap-2 rounded-lg p-3 text-xs",
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
  );
}

/** Spend points on a credit. One button per catalogue entry. */
export function RedeemPanel({
  catalog,
  balance,
}: {
  catalog: RewardCatalogItem[];
  balance: number;
}) {
  const [state, action, pending] = useActionState(redeemReward, initial);

  return (
    <form action={action}>
      <ul className="grid gap-3 sm:grid-cols-2">
        {catalog.map((item) => {
          const affordable = balance >= item.points_cost;
          return (
            <li
              key={item.code}
              className={cn(
                "rounded-xl border p-4 transition-colors",
                affordable ? "border-brass/50 bg-brass/5" : "border-line bg-surface",
              )}
            >
              <p className="flex items-center gap-2 font-display text-xl text-forest">
                <Sparkles
                  className={cn("h-4 w-4", affordable ? "text-brass" : "text-ink-muted")}
                  aria-hidden
                />
                {formatCents(item.credit_cents)} off
              </p>
              <p className="tabular mt-1 text-xs text-ink-muted">
                {item.points_cost} points · minimum order{" "}
                {formatCents(item.minimum_order_cents)}
              </p>
              <button
                type="submit"
                name="code"
                value={item.code}
                disabled={pending || !affordable}
                className="mt-3 min-h-11 w-full rounded-full bg-forest px-4 text-sm font-medium text-cream hover:bg-forest-deep disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pending
                  ? "Redeeming…"
                  : affordable
                    ? "Redeem"
                    : `${item.points_cost - balance} points to go`}
              </button>
            </li>
          );
        })}
      </ul>
      <Feedback state={state} />
    </form>
  );
}

/**
 * Promotional video missions.
 *
 * The copy is explicit that a reviewer approves before points land — a reward
 * that paid out on a pasted link would be trivially farmable.
 */
export function MissionForm({
  kitchens,
}: {
  kitchens: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(submitRewardClaim, initial);
  const [mission, setMission] = useState<"app_video" | "kitchen_video">("app_video");

  return (
    <form action={action} className="space-y-4">
      <fieldset>
        <legend className="text-xs font-medium text-ink">Which video?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(
            [
              { key: "app_video", label: "About Dishd", points: 200, hint: "Gets people to install the app." },
              { key: "kitchen_video", label: "About a kitchen", points: 150, hint: "Features one cook you have ordered from." },
            ] as const
          ).map((option) => (
            <label
              key={option.key}
              className={cn(
                "cursor-pointer rounded-xl border p-3 text-xs",
                mission === option.key
                  ? "border-forest bg-forest-soft"
                  : "border-line bg-surface hover:border-forest/40",
              )}
            >
              <input
                type="radio"
                name="mission"
                value={option.key}
                checked={mission === option.key}
                onChange={() => setMission(option.key)}
                className="sr-only"
              />
              <span className="flex items-center gap-1.5 font-medium text-ink">
                <Video className="h-3.5 w-3.5" aria-hidden />
                {option.label}
              </span>
              <span className="tabular mt-1 block text-brass-ink">+{option.points} points</span>
              <span className="mt-0.5 block text-ink-muted">{option.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {mission === "kitchen_video" && (
        <label className="block">
          <span className="text-xs font-medium text-ink">Which kitchen?</span>
          <select name="kitchenId" required className={field}>
            <option value="">Choose a kitchen</option>
            {kitchens.map((k) => (
              <option key={k.id} value={k.id}>{k.name}</option>
            ))}
          </select>
          {kitchens.length === 0 && (
            <span className="mt-1 block text-xs text-ink-muted">
              Order from a kitchen first, then you can feature it.
            </span>
          )}
        </label>
      )}

      <label className="block">
        <span className="text-xs font-medium text-ink">Link to your post</span>
        <input
          name="proofUrl"
          type="url"
          required
          placeholder="https://…"
          className={field}
        />
        <span className="mt-1 block text-xs text-ink-muted">
          Must be public so a reviewer can open it.
        </span>
      </label>

      <label className="block">
        <span className="text-xs font-medium text-ink">
          Anything to add <span className="font-normal text-ink-muted">(optional)</span>
        </span>
        <textarea name="notes" rows={2} className={cn(field, "resize-y")} />
      </label>

      <Feedback state={state} />

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-full bg-forest px-5 text-sm font-medium text-cream hover:bg-forest-deep disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit for review"}
      </button>
    </form>
  );
}
