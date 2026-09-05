import { createServerClient } from "@/lib/supabase/server";
import type { KitchenPublic } from "@/lib/types";

/**
 * Kitchens for the discovery surface.
 *
 * Returns the fuzzed location only — `kitchens` has no exact address column by
 * design, so there is nothing here to leak.
 *
 * Degrades to an empty list rather than throwing when Supabase is not yet
 * configured, so the app still runs before the project exists.
 */
export async function listActiveKitchens(): Promise<KitchenPublic[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return [];

  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("kitchens")
      .select("*")
      .eq("status", "active")
      .order("orders_completed", { ascending: false });

    if (error) return [];
    return (data ?? []) as KitchenPublic[];
  } catch {
    return [];
  }
}

export async function getKitchenBySlug(slug: string): Promise<KitchenPublic | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;

  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("kitchens")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !data) return null;
    return data as KitchenPublic;
  } catch {
    return null;
  }
}
