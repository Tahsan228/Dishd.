"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import type { ProfilePublic } from "@/lib/types";
import {
  normaliseHandle,
  signUpSchema,
  type SignUpFields,
  type SignUpState,
} from "@/lib/market/account";

export async function signIn(_prev: unknown, form: FormData) {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/");

  if (!email || !password) return { error: "Enter an email and password." };

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect(next);
}

/**
 * Open a real account.
 *
 * The profile row is written by the trigger in migration 0006, not here: when
 * email confirmation is enabled signUp() returns no session, so there would be
 * no auth.uid() to satisfy the profiles_insert policy and the profile could
 * never be created from this side. Handle collisions are settled by the same
 * trigger, so a taken handle nudges the name rather than failing the sign-up.
 */
export async function signUp(_prev: SignUpState, form: FormData): Promise<SignUpState> {
  const parsed = signUpSchema.safeParse({
    email: form.get("email") ?? "",
    password: form.get("password") ?? "",
    displayName: form.get("displayName") ?? "",
    handle: form.get("handle") ?? "",
    city: form.get("city") ?? "",
  });

  if (!parsed.success) {
    const errors: SignUpState["errors"] = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as SignUpFields] = issue.message;
    }
    return { ok: false, message: "A couple of details need another look.", errors };
  }

  const { email, password, displayName, handle, city } = parsed.data;
  const wanted = normaliseHandle(handle) ?? handle;

  const supabase = await createServerClient();

  // Claimed handles are worth catching here for a clear message, even though
  // the trigger would resolve the collision silently.
  const { data: taken } = await supabase
    .from("profiles")
    .select("handle")
    .eq("handle", wanted)
    .maybeSingle();
  if (taken) {
    return {
      ok: false,
      message: "That handle is already taken.",
      errors: { handle: "Someone already has this handle. Try another." },
    };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { handle: wanted, display_name: displayName, city } },
  });

  if (error) {
    return { ok: false, message: error.message, errors: { email: error.message } };
  }

  // No session means the project requires email confirmation. The account and
  // its profile both exist; the person just cannot act yet.
  if (!data.session) {
    return {
      ok: true,
      message: `Check ${email} for a confirmation link, then sign in.`,
    };
  }

  revalidatePath("/", "layout");
  redirect(String(form.get("next") ?? "/"));
}

export async function signOut() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

/** The signed-in user's profile, or null. Used by the header and order flow. */
export async function currentProfile() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("profiles")
      .select("id, handle, display_name, avatar_url, bio, city, created_at")
      .eq("id", user.id)
      .maybeSingle();
    return (data as ProfilePublic | null) ?? null;
  } catch {
    return null;
  }
}
