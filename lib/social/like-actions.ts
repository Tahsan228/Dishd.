"use server";

import { revalidatePath } from "next/cache";
import { socialClient } from "@/lib/social/data";

export type LikeState = { liked: boolean; count: number; message: string };

export async function setReviewLike(logId: string, liked: boolean, previous: LikeState): Promise<LikeState> {
  const supabase = await socialClient();
  if (!supabase) return { ...previous, message: "Appreciations are unavailable right now." };
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { ...previous, message: "Please sign in to appreciate this review." };
  const log = await supabase.from("logs").select("id,buyer_id,kitchen_id").eq("id", logId).maybeSingle();
  if (log.error || !log.data) return { ...previous, message: "This review is unavailable." };
  const result = liked
    ? await supabase.from("log_likes").upsert({ log_id: logId, user_id: user.id }, { onConflict: "log_id,user_id", ignoreDuplicates: true })
    : await supabase.from("log_likes").delete().eq("log_id", logId).eq("user_id", user.id);
  if (result.error) return { ...previous, message: "That couldn’t be saved. Please try again." };
  const [total, profile] = await Promise.all([
    supabase.from("log_likes").select("log_id", { count: "exact", head: true }).eq("log_id", logId),
    supabase.from("profiles").select("handle").eq("id", log.data.buyer_id).maybeSingle(),
  ]);
  revalidatePath(`/log/${logId}`);
  if (profile.data) revalidatePath(`/u/${profile.data.handle}`);
  return { liked, count: total.count ?? previous.count, message: total.error ? "Saved. The total will refresh when you reload." : liked ? "Appreciation added." : "Appreciation removed." };
}
