"use server";
import { createServerClient } from "@/lib/supabase/server";
import { readPickupReview } from "@/lib/social/pickup-reviews";

export async function preparePickupReview(orderId: string) {
  try {
    const client = await createServerClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return { error: "Sign in again to rate your pickup." };
    // First read handles the normal case without a write or an unnecessary RPC.
    const existing = await readPickupReview(orderId, user.id);
    if (existing) return { review: existing };
    const { error } = await client.rpc("dishd_ensure_order_review", { p_order_id: orderId });
    if (error) return { error: "Your completed pickup review could not be opened yet. Please try again shortly." };
    const review = await readPickupReview(orderId, user.id);
    return review ? { review } : { error: "Your review is being prepared. Try again shortly." };
  } catch { return { error: "Reviews are temporarily unavailable. Please try again shortly." }; }
}
