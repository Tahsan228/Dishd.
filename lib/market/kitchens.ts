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

export type MenuItemWithProvenance = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  photo_url: string | null;
  contains_meat: boolean;
  meat_type: string;
  allergens: string[];
  is_available: boolean;
  sourcing_batches: {
    match_status: string;
    ocr_store: string | null;
    ocr_date: string | null;
    reviewed_at: string | null;
    mismatch_reasons: string[];
    halal_sources: { store_name: string; cert_body: string | null } | null;
  } | null;
};

/** Menu with the sourcing batch behind each meat item, for the provenance sheet. */
export async function getKitchenMenu(kitchenId: string): Promise<MenuItemWithProvenance[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return [];
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("menu_items")
      .select(
        `id, name, description, price_cents, photo_url, contains_meat, meat_type,
         allergens, is_available,
         sourcing_batches ( match_status, ocr_store, ocr_date, reviewed_at,
                            mismatch_reasons,
                            halal_sources ( store_name, cert_body ) )`,
      )
      .eq("kitchen_id", kitchenId)
      .order("contains_meat", { ascending: false });
    if (error) return [];
    return (data ?? []) as unknown as MenuItemWithProvenance[];
  } catch {
    return [];
  }
}
