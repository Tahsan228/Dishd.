"use server";
import { revalidatePath } from "next/cache";
import { socialClient } from "@/lib/social/data";
import { photoExtension, reviewSchema, type ReviewActionState } from "@/lib/social/review-validation";
import { galleryError } from "@/lib/market/upload-validation";
import { parseDishRatings } from "@/lib/social/dish-rating-validation";

export async function saveReview(logId: string, previous: ReviewActionState, form: FormData): Promise<ReviewActionState> {
  void previous;
  try { return await saveReviewChecked(logId, form); }
  catch { return { ok: false, message: "The review service could not be reached. Your draft is still here; please try again." }; }
}
async function saveReviewChecked(logId: string, form: FormData): Promise<ReviewActionState> {
  const dishRatings = parseDishRatings(form);
  if (!dishRatings) return { ok: false, message: "Choose a valid rating for each dish." };
  const parsed = reviewSchema.safeParse({ rating: form.get("rating"), body: form.get("body") ?? "", photo: form.get("photo") ?? "", sourcing: form.get("sourcing"), flavor: form.get("flavor") ?? "", value: form.get("value") ?? "", quality: form.get("quality") ?? "" });
  if (!parsed.success) {
    const errors: ReviewActionState["errors"] = {};
    for (const issue of parsed.error.issues) errors[issue.path[0] as keyof typeof errors] = issue.message;
    return { ok: false, message: "A couple of details need another look.", errors };
  }
  const supabase = await socialClient();
  if (!supabase) return { ok: false, message: "Reviews are unavailable right now. Your draft is still here." };
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, message: "Please sign in again before saving your review." };
  const { data: log, error: logError } = await supabase.from("logs").select("id,buyer_id,kitchen_id,order_id,is_verified,photo_url,photo_urls").eq("id", logId).eq("buyer_id", user.id).maybeSingle();
  if (logError || !log) return { ok: false, message: "This diary entry is not available to edit. If you just collected an order, open its pickup review first." };
  if (!log.order_id || !log.is_verified) return { ok: false, message: "Complete a pickup before reviewing it." };
  const { data: order } = await supabase.from("orders").select("id").eq("id", log.order_id).eq("buyer_id", user.id).eq("kitchen_id", log.kitchen_id).eq("status", "completed").maybeSingle();
  if (!order) return { ok: false, message: "We could not confirm the completed pickup." };

  let keep: string[] = [];
  try {
    const requested: unknown = JSON.parse(String(form.get("keepPhotos") ?? "[]"));
    const existing = [...(log.photo_urls ?? []), ...(log.photo_url ? [log.photo_url] : [])];
    if (!Array.isArray(requested) || requested.some(url => typeof url !== "string" || !existing.includes(url))) throw new Error("Invalid gallery");
    keep = [...new Set(requested as string[])];
  } catch { return { ok: false, message: "The retained photo selection is invalid. Refresh and try again." }; }
  if (parsed.data.photo) keep = [...new Set([...keep, parsed.data.photo])];
  const files = [...form.getAll("photoFiles"), ...form.getAll("photoFile")].filter((item): item is File => item instanceof File && item.size > 0);
  const problem = galleryError(files);
  if (problem || files.length + keep.length > 3) return { ok: false, message: "Check your photos.", errors: { photo: problem ?? "Keep up to three photos in this review." } };
  const uploaded: string[] = [];
  const photos = [...keep];
  for (const file of files) {
    const path = `reviews/${user.id}/${logId}/${crypto.randomUUID()}.${photoExtension(file.type)}`;
    const { error } = await supabase.storage.from("photos").upload(path, file, { contentType: file.type.toLowerCase(), upsert: false });
    if (error) {
      if (uploaded.length) await supabase.storage.from("photos").remove(uploaded);
      return { ok: false, message: "Your photos could not be uploaded. Your review draft has been kept.", errors: { photo: "Try again or choose fewer photos." } };
    }
    uploaded.push(path);
    photos.push(supabase.storage.from("photos").getPublicUrl(path).data.publicUrl);
  }
  const { rating, body, sourcing, flavor, value, quality } = parsed.data;
  const payload = {
    rating_10: Number(rating), body: body || null, photo_url: photos[0] ?? null, photo_urls: photos,
    flavor_rating_10: flavor ? Number(flavor) : null, value_rating_10: value ? Number(value) : null,
    quality_rating_10: quality ? Number(quality) : null,
    sourcing_affirmed: sourcing === "unsure" ? null : sourcing === "yes",
  };
  const result = await supabase.rpc("dishd_save_pickup_review", { p_log: logId, p_review: payload, p_ratings: dishRatings });
  let saveError = result.error;
  // Existing kitchen reviews remain usable while the dish-rating migration rolls out.
  if (saveError?.code === "PGRST202" && dishRatings.length === 0) {
    const fallback = await supabase.from("logs").update(payload).eq("id", logId).eq("buyer_id", user.id).select("id").maybeSingle();
    saveError = fallback.error ?? (fallback.data ? null : { message: "No review was saved." } as typeof saveError);
  }
  if (saveError) {
    if (uploaded.length) await supabase.storage.from("photos").remove(uploaded);
    return { ok: false, message: "Your review could not be saved. Your draft is still here; please try again." };
  }
  const [profile, kitchen] = await Promise.all([
    supabase.from("profiles").select("handle").eq("id", user.id).maybeSingle(),
    supabase.from("kitchens").select("slug").eq("id", log.kitchen_id).maybeSingle(),
  ]);
  for (const path of ["/", "/community", "/rewards", `/order/${log.order_id}`, `/log/${logId}`, `/reviews/${log.kitchen_id}`]) revalidatePath(path);
  if (profile.data) revalidatePath("/u/" + profile.data.handle);
  if (kitchen.data) { revalidatePath("/k/" + kitchen.data.slug); revalidatePath("/k/" + kitchen.data.slug + "/record"); }
  return { ok: true, message: "Review shared with the neighborhood. Thank you for supporting a small kitchen.", photos };
}
