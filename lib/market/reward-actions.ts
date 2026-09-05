"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";

export type RewardActionState = { ok: boolean; message: string };

/**
 * Spend points on a credit.
 *
 * All of the work is in `dishd_redeem_reward`, which locks the profile row,
 * re-reads the balance and writes the spend as a negative ledger entry in the
 * same transaction. Doing the arithmetic here instead would let two tabs
 * redeem the same points twice.
 */
export async function redeemReward(
  _prev: RewardActionState,
  form: FormData,
): Promise<RewardActionState> {
  const code = String(form.get("code") ?? "").trim();
  if (!code) return { ok: false, message: "Choose a reward first." };

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in to redeem rewards." };

  const { error } = await supabase.rpc("dishd_redeem_reward", { p_code: code });
  if (error) {
    // The function raises readable messages ("You do not have enough points
    // yet."), so pass them through rather than replacing them with a generic.
    return { ok: false, message: error.message };
  }

  revalidatePath("/rewards");
  revalidatePath("/cart");
  return { ok: true, message: "Credit added. Apply it at checkout." };
}

const claimSchema = z.object({
  mission: z.enum(["app_video", "kitchen_video"]),
  proofUrl: z
    .string()
    .trim()
    .min(1, "Paste the link to your video.")
    .refine((value) => {
      try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password;
      } catch {
        return false;
      }
    }, "Use a public https:// link to the post."),
  kitchenId: z.string().trim().optional().default(""),
  notes: z.string().trim().max(500, "Keep the note under 500 characters.").optional().default(""),
});

/**
 * Submit a promotional video for review.
 *
 * Nothing is awarded here. A claim lands as `pending` and a reviewer approves
 * it, which is the only reason this is worth points at all — an unreviewed
 * "post a video" reward is just a link box that prints currency.
 */
export async function submitRewardClaim(
  _prev: RewardActionState,
  form: FormData,
): Promise<RewardActionState> {
  const parsed = claimSchema.safeParse({
    mission: form.get("mission") ?? "",
    proofUrl: form.get("proofUrl") ?? "",
    kitchenId: form.get("kitchenId") ?? "",
    notes: form.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the details." };
  }

  const { mission, proofUrl, kitchenId, notes } = parsed.data;
  if (mission === "kitchen_video" && !kitchenId) {
    return { ok: false, message: "Choose which kitchen the video features." };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in to submit a video." };

  const { error } = await supabase.from("reward_claims").insert({
    user_id: user.id,
    mission,
    kitchen_id: mission === "kitchen_video" ? kitchenId : null,
    proof_url: proofUrl,
    notes,
  });

  if (error) {
    // A unique violation here means the same link, or an outstanding claim for
    // the same mission — both worth saying plainly.
    if (error.code === "23505") {
      return {
        ok: false,
        message: "You already have a submission for this. Wait for it to be reviewed.",
      };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath("/rewards");
  return {
    ok: true,
    message: "Submitted. A reviewer will check it before points are added.",
  };
}
