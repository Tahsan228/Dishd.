import { createServerClient } from "@/lib/supabase/server";

export async function getDishRatingSummaries(ids: string[]) {
  if (!ids.length) return new Map<string, { rating_count: number; avg_rating_10: number }>();
  const client = await createServerClient();
  const { data } = await client.from("dish_rating_summaries").select("menu_item_id,rating_count,avg_rating_10").in("menu_item_id", ids);
  return new Map((data ?? []).map(row => [row.menu_item_id as string, { rating_count: Number(row.rating_count), avg_rating_10: Number(row.avg_rating_10) }]));
}
