export type SubmittedDishRating = { order_item_id: string; rating_10: number };
export function parseDishRatings(form: FormData): SubmittedDishRating[] | null {
  const ratings: SubmittedDishRating[] = [], seen = new Set<string>();
  for (const [key,value] of form.entries()) {
    if (!key.startsWith("dish_rating_")) continue;
    const id = key.slice("dish_rating_".length);
    if (value === "") continue;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || typeof value !== "string" || !/^(10|[0-9])$/.test(value) || seen.has(id)) return null;
    seen.add(id); ratings.push({ order_item_id: id, rating_10: Number(value) });
  }
  return ratings.length <= 30 ? ratings : null;
}
