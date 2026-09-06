import type { KitchenPublic } from "@/lib/types";
import type { LatLng } from "@/lib/market/geo";
import { milesBetween } from "./nearby";

export const DISCOVERY_FILTERS = [
  { key: "sourcing", label: "Halal sourcing info" },
  { key: "zabiha", label: "Zabiha / hand-slaughtered claim" },
  { key: "no_pork", label: "No pork handled claim" },
  { key: "vegetarian", label: "Vegetarian" },
  { key: "allergens", label: "Allergen information" },
  { key: "family_trays", label: "Family trays" },
  { key: "ramadan", label: "Ramadan meals" },
  { key: "iftar", label: "Iftar packages" },
  { key: "eid", label: "Eid catering" },
] as const;
export type DiscoveryFilter = typeof DISCOVERY_FILTERS[number]["key"];
export type DiscoveryKitchen = KitchenPublic & { zabiha_claimed?: boolean; no_pork_claimed?: boolean };
export type DiscoveryDish = {
  id: string; kitchen_id: string; name: string; description: string | null;
  price_cents: number; photo_url: string | null; contains_meat: boolean;
  allergens: string[]; is_available: boolean;
  sourcing_status: string | null; sourcing_until: string | null;
  vegetarian_claimed: boolean; serves: number; meal_tags: string[];
  offer_title: string | null; offer_expires_at: string | null;
  rating_count: number; avg_rating_10: number;
};

export function validPoint(point: LatLng): boolean {
  return Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
}
export function kitchenDistance(kitchen: KitchenPublic, origin: LatLng): number | null {
  const destination = { lat: kitchen.approx_lat, lng: kitchen.approx_lng };
  return validPoint(origin) && validPoint(destination) ? milesBetween(origin, destination) : null;
}
/** Rough area estimate only: straight-line miles with a detour factor, no routing or traffic. */
export function travelEstimate(miles: number | null): string | null {
  if (miles === null || !Number.isFinite(miles) || miles < 0) return null;
  const low = Math.max(3, Math.ceil(miles * 1.3 / 20 * 60));
  return `${low}–${low + 5} min est. drive`;
}
export function receiptCurrent(dish: DiscoveryDish, today: string): boolean {
  return dish.sourcing_status === "verified" && Boolean(dish.sourcing_until && dish.sourcing_until >= today);
}
export function dishAvailable(dish: DiscoveryDish, today: string): boolean {
  return dish.is_available && (!dish.contains_meat || receiptCurrent(dish, today));
}
export function hasOffer(dish: DiscoveryDish, now: number): boolean {
  return Boolean(dish.offer_title && dish.offer_expires_at && Date.parse(dish.offer_expires_at) > now);
}
export function matchesDiscovery(dish: DiscoveryDish, kitchen: DiscoveryKitchen, filters: DiscoveryFilter[], query: string, today: string): boolean {
  const text = [dish.name, dish.description, kitchen.name, kitchen.neighborhood_label, ...kitchen.cuisine_tags, ...dish.meal_tags].join(" ").toLowerCase();
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.every(term => text.includes(term))) return false;
  return filters.every(filter => {
    if (filter === "sourcing") return dish.contains_meat && receiptCurrent(dish, today);
    if (filter === "zabiha") return kitchen.zabiha_claimed === true;
    if (filter === "no_pork") return kitchen.no_pork_claimed === true;
    if (filter === "vegetarian") return dish.vegetarian_claimed && !dish.contains_meat;
    if (filter === "allergens") return dish.allergens.length > 0;
    if (filter === "family_trays") return dish.serves >= 3 || dish.meal_tags.includes("family_trays");
    return dish.meal_tags.includes(filter);
  });
}
/** Personal suggestions use collected cuisines, then proximity and recorded repeat business. */
export function recommendationScore(kitchen: DiscoveryKitchen, preferredCuisines: Set<string>, origin: LatLng): number {
  const affinity = kitchen.cuisine_tags.filter(tag => preferredCuisines.has(tag)).length * 30;
  const distance = kitchenDistance(kitchen, origin);
  return affinity + Math.min(kitchen.repeat_customers, 20) + Number(kitchen.avg_rating_10) - Math.min(distance ?? 100, 100);
}

export function newYorkDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
