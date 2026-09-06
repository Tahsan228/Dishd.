import { createServerClient } from "@/lib/supabase/server";
import type { KitchenPublic } from "@/lib/types";
import type { DiscoveryDish, DiscoveryKitchen } from "@/lib/market/discovery";

export async function getDiscoveryData(kitchens: KitchenPublic[], buyerId: string) {
  const client = await createServerClient();
  const ids = kitchens.map(k => k.id);
  if (!ids.length) return { kitchens: [] as DiscoveryKitchen[], dishes: [] as DiscoveryDish[], visited: [] as string[], unavailable: false };
  const [menu, claims, details, ratings, history] = await Promise.all([
    client.from("menu_items").select("id,kitchen_id,name,description,price_cents,photo_url,contains_meat,allergens,is_available,sourcing_batches(match_status,backs_items_until)").in("kitchen_id", ids).eq("is_available", true).order("name").limit(500),
    client.from("kitchen_discovery_claims").select("kitchen_id,zabiha_claimed,no_pork_claimed").in("kitchen_id", ids),
    client.from("menu_discovery").select("*,menu_items!inner(kitchen_id)").in("menu_items.kitchen_id", ids).limit(1000),
    client.from("dish_rating_summaries").select("*,menu_items!inner(kitchen_id)").in("menu_items.kitchen_id", ids).limit(1000),
    client.from("orders").select("kitchen_id").eq("buyer_id", buyerId).eq("status", "completed").order("created_at", { ascending: false }).limit(100),
  ]);
  const claimMap = new Map((claims.data ?? []).map(row => [row.kitchen_id, row]));
  const detailMap = new Map((details.data ?? []).map(row => [row.menu_item_id, row]));
  const ratingMap = new Map((ratings.data ?? []).map(row => [row.menu_item_id, row]));
  const dishes: DiscoveryDish[] = (menu.data ?? []).map(row => {
    const info = detailMap.get(row.id), rating = ratingMap.get(row.id);
    const source = row.sourcing_batches as unknown as { match_status: string; backs_items_until: string | null } | null;
    return { id: row.id, kitchen_id: row.kitchen_id, name: row.name, description: row.description,
      price_cents: row.price_cents, photo_url: row.photo_url, contains_meat: row.contains_meat,
      allergens: row.allergens ?? [], is_available: row.is_available,
      sourcing_status: source?.match_status ?? null, sourcing_until: source?.backs_items_until ?? null,
      vegetarian_claimed: info?.vegetarian_claimed === true, serves: info?.serves ?? 1, meal_tags: info?.meal_tags ?? [],
      offer_title: info?.offer_title ?? null, offer_expires_at: info?.offer_expires_at ?? null,
      rating_count: rating?.rating_count ?? 0, avg_rating_10: Number(rating?.avg_rating_10 ?? 0) };
  });
  return { kitchens: kitchens.map(k => ({ ...k, zabiha_claimed: claimMap.get(k.id)?.zabiha_claimed === true, no_pork_claimed: claimMap.get(k.id)?.no_pork_claimed === true })),
    dishes, visited: [...new Set((history.data ?? []).map(row => row.kitchen_id as string))], unavailable: Boolean(menu.error) };
}
