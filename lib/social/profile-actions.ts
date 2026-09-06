"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { profileSchema, type ProfileFormState } from "@/lib/social/profile";
import { photoExtension, photoFileError } from "@/lib/social/review-validation";

/** Upload one image to the public photos bucket, or return why it could not be. */
async function uploadImage(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  file: File,
  kind: "avatar" | "banner",
): Promise<{ url?: string; error?: string }> {
  const problem = photoFileError(file);
  if (problem) return { error: problem };

  // A stable path per user and kind, overwritten on change, so an old avatar
  // does not linger in storage forever after every edit.
  const path = `profiles/${userId}/${kind}.${photoExtension(file.type)}`;
  const { error } = await supabase.storage
    .from("photos")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) return { error: "That image could not be uploaded. Try again." };

  // Cache-bust, or the browser keeps showing the previous image at this path.
  const base = supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
  return { url: `${base}?v=${Date.now()}` };
}

/** Save the diary's look and details. */
export async function saveProfile(
  _prev: ProfileFormState,
  form: FormData,
): Promise<ProfileFormState> {
  const parsed = profileSchema.safeParse({
    displayName: form.get("displayName") ?? "",
    tagline: form.get("tagline") ?? "",
    bio: form.get("bio") ?? "",
    city: form.get("city") ?? "",
    accent: form.get("accent") ?? "forest",
    avatarUrl: form.get("avatarUrl") ?? "",
    bannerUrl: form.get("bannerUrl") ?? "",
  });
  if (!parsed.success) {
    const errors: ProfileFormState["errors"] = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as keyof NonNullable<ProfileFormState["errors"]>] = issue.message;
    }
    return { ok: false, message: "A couple of details need another look.", errors };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in to edit your diary." };

  const v = parsed.data;
  let avatar = v.avatarUrl;
  let banner = v.bannerUrl;

  const avatarFile = form.get("avatarFile");
  if (avatarFile instanceof File && avatarFile.size > 0) {
    const result = await uploadImage(supabase, user.id, avatarFile, "avatar");
    if (result.error) return { ok: false, message: result.error, errors: { avatarFile: result.error } };
    avatar = result.url!;
  }

  const bannerFile = form.get("bannerFile");
  if (bannerFile instanceof File && bannerFile.size > 0) {
    const result = await uploadImage(supabase, user.id, bannerFile, "banner");
    if (result.error) return { ok: false, message: result.error, errors: { bannerFile: result.error } };
    banner = result.url!;
  }

  const { data: saved, error } = await supabase
    .from("profiles")
    .update({
      display_name: v.displayName,
      tagline: v.tagline || null,
      bio: v.bio || null,
      city: v.city || null,
      accent: v.accent,
      avatar_url: avatar || null,
      banner_url: banner || null,
    })
    .eq("id", user.id)
    .select("handle")
    .maybeSingle();

  if (error || !saved) {
    return { ok: false, message: error?.message ?? "Your diary could not be saved." };
  }

  revalidatePath(`/u/${saved.handle}`);
  revalidatePath("/");
  return { ok: true, message: "Your diary is updated." };
}

export type FollowState = { ok: boolean; message: string; following: boolean };

/**
 * Follow or unfollow someone.
 *
 * The follower is always the signed-in user; RLS refuses any other value, so a
 * request cannot make somebody else follow anyone.
 */
export async function toggleFollow(
  targetId: string,
  targetHandle: string,
  currentlyFollowing: boolean,
): Promise<FollowState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Sign in to follow diaries.", following: currentlyFollowing };
  }
  if (user.id === targetId) {
    return { ok: false, message: "You cannot follow yourself.", following: false };
  }

  const { error } = currentlyFollowing
    ? await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", targetId)
    : await supabase.from("follows").insert({ follower_id: user.id, following_id: targetId });

  if (error) {
    // A duplicate means two taps raced; the end state is what was wanted.
    if (error.code === "23505") {
      return { ok: true, message: "", following: true };
    }
    return { ok: false, message: "That did not save. Try again.", following: currentlyFollowing };
  }

  revalidatePath(`/u/${targetHandle}`);
  return { ok: true, message: "", following: !currentlyFollowing };
}
