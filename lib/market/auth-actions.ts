"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";

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
      .select("id, handle, display_name, avatar_url, city")
      .eq("id", user.id)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}
