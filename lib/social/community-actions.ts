"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";

export type CommunityActionState = { ok: boolean; message: string };

const postSchema = z.object({
  category: z.enum(["story", "announcement", "behind_the_scenes", "offer"]),
  body: z
    .string()
    .trim()
    .min(10, "Say a little more — at least 10 characters.")
    .max(3000, "Keep it under 3,000 characters."),
  kitchenId: z.string().trim().optional().default(""),
});

/**
 * Post to the community feed.
 *
 * A buyer may only post a `story`. The three business categories require a
 * kitchen the poster actually owns, and the RLS policy on `community_posts`
 * re-checks ownership — this layer exists to explain the refusal, not to be
 * the one enforcing it.
 */
export async function createCommunityPost(
  _prev: CommunityActionState,
  form: FormData,
): Promise<CommunityActionState> {
  const parsed = postSchema.safeParse({
    category: form.get("category") ?? "story",
    body: form.get("body") ?? "",
    kitchenId: form.get("kitchenId") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check your post." };
  }

  const { category, body, kitchenId } = parsed.data;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in to post." };

  // A business post has to name the kitchen it speaks for.
  let owned: string | null = null;
  if (category !== "story") {
    const { data: kitchen } = await supabase
      .from("kitchens")
      .select("id, status")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!kitchen) {
      return { ok: false, message: "Only a kitchen owner can post that. Share a diner story instead." };
    }
    if (kitchen.status !== "active") {
      return { ok: false, message: "Open your kitchen before posting as a business." };
    }
    if (kitchenId && kitchenId !== kitchen.id) {
      return { ok: false, message: "You can only post as your own kitchen." };
    }
    owned = kitchen.id;
  }

  const { error } = await supabase.from("community_posts").insert({
    author_id: user.id,
    kitchen_id: owned,
    category,
    body,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/community");
  return { ok: true, message: "Posted to the community." };
}

export async function deleteCommunityPost(postId: string): Promise<CommunityActionState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in first." };

  // RLS restricts deletion to the author; the author_id filter makes the
  // refusal explicit rather than a silent zero-row delete.
  const { error } = await supabase
    .from("community_posts")
    .delete()
    .eq("id", postId)
    .eq("author_id", user.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/community");
  return { ok: true, message: "Post removed." };
}

const reportSchema = z.object({
  targetId: z.string().uuid("Choose what you are reporting."),
  targetType: z.enum(["kitchen", "log", "menu_item", "batch"]),
  reason: z.enum([
    "haram_sourcing",
    "quality",
    "allergen",
    "hygiene",
    "misrepresentation",
    "other",
  ]),
  detail: z
    .string()
    .trim()
    .min(20, "Give enough detail for someone to act on it — at least 20 characters.")
    .max(2000, "Keep it under 2,000 characters."),
  orderId: z.string().trim().optional().default(""),
});

/**
 * Report a kitchen.
 *
 * A report is an allegation, not a verdict. Migration 0009 forces every new row
 * to `status = 'open'` with no resolution note, so a reporter cannot file
 * something pre-marked as upheld — which matters because upheld flags subtract
 * 40 points from a kitchen's credibility and appear publicly.
 */
export async function reportKitchen(
  _prev: CommunityActionState,
  form: FormData,
): Promise<CommunityActionState> {
  const parsed = reportSchema.safeParse({
    targetId: form.get("targetId") ?? "",
    targetType: form.get("targetType") ?? "kitchen",
    reason: form.get("reason") ?? "other",
    detail: form.get("detail") ?? "",
    orderId: form.get("orderId") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the report." };
  }

  const { targetId, targetType, reason, detail, orderId } = parsed.data;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in to report." };

  const { error } = await supabase.from("flags").insert({
    reporter_id: user.id,
    target_type: targetType,
    target_id: targetId,
    order_id: orderId || null,
    reason,
    details: detail,
    status: "open",
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "You have already reported this. It is with a reviewer." };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath("/community");
  return {
    ok: true,
    message:
      "Report received. A reviewer looks at every one; nothing changes on the kitchen's page until it is upheld.",
  };
}
