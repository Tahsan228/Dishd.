"use server";

import { revalidatePath } from "next/cache";
import { socialClient } from "@/lib/social/data";
import {
  photoExtension,
  photoFileError,
  reviewSchema,
  type ReviewActionState,
} from "@/lib/social/review-validation";

export async function saveReview(logId: string, previous: ReviewActionState, form: FormData): Promise<ReviewActionState> {
  void previous;
  const parsed = reviewSchema.safeParse({ rating: form.get("rating"), body: form.get("body") ?? "", photo: form.get("photo") ?? "", sourcing: form.get("sourcing") });
  if (!parsed.success) {
    const errors: ReviewActionState["errors"] = {};
    for (const issue of parsed.error.issues) errors[issue.path[0] as keyof typeof errors] = issue.message;
    return { ok: false, message: "A couple of details need another look.", errors };
  }
  const supabase = await socialClient();
  if (!supabase) return { ok: false, message: "Reviews are unavailable right now. Your draft is still here." };
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, message: "Please sign in again before saving your review." };
  const { data: log, error: logError } = await supabase.from("logs")
    .select("id,buyer_id,kitchen_id,order_id,is_verified").eq("id", logId).eq("buyer_id", user.id).maybeSingle();
  if (logError || !log) return { ok: false, message: "This diary entry isn’t available to edit." };
  if (!log.order_id || !log.is_verified) return { ok: false, message: "Complete a pickup before reviewing it." };
  const { data: order, error: orderError } = await supabase.from("orders").select("id")
    .eq("id", log.order_id).eq("buyer_id", user.id).eq("kitchen_id", log.kitchen_id).eq("status", "completed").maybeSingle();
  if (orderError || !order) return { ok: false, message: "We couldn’t confirm the completed pickup. Please try again." };
  const { rating, body, sourcing } = parsed.data;

  // A phone gives you a file, not a URL. Upload it under the buyer's own
  // account so storage records them as the owner, then keep the public URL.
  // The pasted-link path still works for anything already hosted.
  let photo = parsed.data.photo;
  const upload = form.get("photoFile");
  if (upload instanceof File && upload.size > 0) {
    const fileProblem = photoFileError(upload);
    if (fileProblem) {
      return { ok: false, message: "That photo didn’t work.", errors: { photo: fileProblem } };
    }
    const path = `reviews/${logId}.${photoExtension(upload.type)}`;
    const { error: uploadError } = await supabase.storage
      .from("photos")
      .upload(path, upload, { contentType: upload.type, upsert: true });
    if (uploadError) {
      return {
        ok: false,
        message: "Your review wasn’t saved.",
        errors: { photo: "That photo couldn’t be uploaded. Try again, or leave it out." },
      };
    }
    photo = supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
  }
  // The trigger owns verification, order linkage, authorship and time. Never write them.
  const { data: saved, error } = await supabase.from("logs").update({
    rating_10: Number(rating), body: body || null, photo_url: photo || null,
    sourcing_affirmed: sourcing === "unsure" ? null : sourcing === "yes",
  }).eq("id", logId).eq("buyer_id", user.id).select("id").maybeSingle();
  if (error || !saved) return { ok: false, message: "Your review couldn’t be saved. Your draft is still here; please try again." };
  const [profile, kitchen] = await Promise.all([
    supabase.from("profiles").select("handle").eq("id", user.id).maybeSingle(),
    supabase.from("kitchens").select("slug").eq("id", log.kitchen_id).maybeSingle(),
  ]);
  revalidatePath(`/log/${logId}`);
  revalidatePath(`/reviews/${log.kitchen_id}`);
  if (profile.data) revalidatePath(`/u/${profile.data.handle}`);
  if (kitchen.data) {
    revalidatePath(`/k/${kitchen.data.slug}`);
    revalidatePath(`/k/${kitchen.data.slug}/record`);
  }
  revalidatePath("/");
  return { ok: true, message: "Saved. Thanks for sharing your meal with the neighborhood." };
}
