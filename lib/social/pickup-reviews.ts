import { createServerClient } from "@/lib/supabase/server";
import { LOG_COLUMNS, type DiaryLog } from "@/lib/social/data";

export type ReviewDish = { order_item_id: string; menu_item_id: string; name: string; rating_10: number | null };
export type PickupReview = { log: DiaryLog; kitchen: { name: string; slug: string } | null; dishes: ReviewDish[]; dishRatingsAvailable: boolean };

/** Reads only this buyer's completed pickup; exact addresses are never selected. */
export async function readPickupReview(orderId: string, buyerId: string): Promise<PickupReview | null> {
  const client = await createServerClient();
  const { data: order } = await client.from("orders").select("id,kitchens(name,slug),order_items(id,menu_item_id,name_snapshot)")
    .eq("id", orderId).eq("buyer_id", buyerId).eq("status", "completed").maybeSingle();
  if (!order) return null;
  const { data: log } = await client.from("logs").select(LOG_COLUMNS).eq("order_id", orderId).eq("buyer_id", buyerId).eq("is_verified", true).maybeSingle();
  if (!log) return null;
  const lines = order.order_items as unknown as { id: string; menu_item_id: string | null; name_snapshot: string }[];
  const ratings = lines.length ? await client.from("dish_ratings").select("order_item_id,rating_10").in("order_item_id", lines.map(line => line.id)) : { data: [], error: null };
  const byItem = new Map((ratings.data ?? []).map(row => [row.order_item_id, row.rating_10]));
  return { log: log as unknown as DiaryLog, kitchen: order.kitchens as unknown as { name: string; slug: string } | null,
    dishes: lines.filter(line => line.menu_item_id).map(line => ({ order_item_id: line.id, menu_item_id: line.menu_item_id!, name: line.name_snapshot, rating_10: byItem.get(line.id) ?? null })),
    dishRatingsAvailable: !ratings.error };
}

export type PendingReview = { id: string; kitchen: string };
export async function pendingPickupReviews(buyerId: string): Promise<PendingReview[]> {
  const client = await createServerClient();
  const { data, error } = await client.from("orders").select("id,kitchens(name),logs(id,rating_10)")
    .eq("buyer_id", buyerId).eq("status", "completed").order("completed_at", { ascending: false }).limit(25);
  if (error) return [];
  return (data ?? []).filter(row => {
    const log = row.logs as unknown as { rating_10: number | null } | null;
    return !log || log.rating_10 === null;
  }).slice(0,3).map(row => ({ id: row.id, kitchen: (row.kitchens as unknown as { name: string } | null)?.name ?? "your kitchen" }));
}
