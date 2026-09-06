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
  /** Cook-declared, per portion. Null means not stated, which the menu shows. */
  calories: number | null;
  ingredients: string | null;
  portion_size: string | null;
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
         allergens, is_available, calories, ingredients, portion_size,
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

export type PlatformStats = {
  kitchens: number;
  mealsServed: number;
  verifiedBatches: number;
  neighbourhoods: number;
};

/** Headline numbers for the discovery page. All real, none rounded up. */
export async function getPlatformStats(): Promise<PlatformStats | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    const supabase = await createServerClient();
    const [kitchens, batches, hoods] = await Promise.all([
      supabase.from("kitchens").select("orders_completed, neighborhood_label").eq("status", "active"),
      supabase.from("sourcing_batches").select("id", { count: "exact", head: true }).eq("match_status", "verified"),
      Promise.resolve(null),
    ]);
    const rows = kitchens.data ?? [];
    if (rows.length === 0) return null;
    return {
      kitchens: rows.length,
      mealsServed: rows.reduce((s, k) => s + (k.orders_completed ?? 0), 0),
      verifiedBatches: batches.count ?? 0,
      neighbourhoods: new Set(rows.map((k) => k.neighborhood_label)).size,
    };
  } catch {
    return null;
  }
}

export type ActivityEntry = {
  id: string;
  rating_10: number | null;
  body: string | null;
  logged_at: string;
  kitchen: { name: string; slug: string } | null;
  author: { display_name: string; handle: string } | null;
};

/**
 * Recent verified meals across the whole platform — the Letterboxd "activity"
 * idea applied to the marketplace. Only verified logs appear, so this doubles
 * as proof that the ratings on the site are transaction-backed.
 */
export async function getRecentActivity(limit = 8): Promise<ActivityEntry[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return [];
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("logs")
      .select(
        `id, rating_10, body, logged_at,
         kitchens ( name, slug ),
         profiles ( display_name, handle )`,
      )
      .eq("is_verified", true)
      .not("rating_10", "is", null)
      .order("logged_at", { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data ?? []).map((r) => ({
      id: r.id,
      rating_10: r.rating_10,
      body: r.body,
      logged_at: r.logged_at,
      kitchen: (r.kitchens as unknown as { name: string; slug: string }) ?? null,
      author: (r.profiles as unknown as { display_name: string; handle: string }) ?? null,
    }));
  } catch {
    return [];
  }
}
