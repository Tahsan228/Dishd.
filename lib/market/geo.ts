/**
 * The public, approximate location of a kitchen.
 *
 * `kitchens.approx_lat/lng` is what the discovery map shows, and it must never
 * be derivable back to where someone lives. So it is NOT the real address
 * geocoded and nudged — it starts from the centre of the stated city and adds a
 * deterministic offset. Two things follow:
 *
 *   - Even with the algorithm and the row, the real home cannot be recovered:
 *     the real address was never an input.
 *   - The offset is deterministic in the kitchen's own key, so the pin does not
 *     wander between renders, which would itself leak a real point by averaging.
 *
 * The exact address lives in `kitchen_addresses`, gated by RLS to the owner and
 * to buyers with an accepted order.
 */

export type LatLng = { lat: number; lng: number };

/** Centres of the cities Dishd currently operates in. */
const CITY_CENTRES: Record<string, LatLng> = {
  fremont: { lat: 37.5485, lng: -121.9886 },
  newark: { lat: 37.5297, lng: -122.0402 },
  "union city": { lat: 37.5934, lng: -122.0438 },
  hayward: { lat: 37.6688, lng: -122.0808 },
  "san leandro": { lat: 37.7249, lng: -122.1561 },
  milpitas: { lat: 37.4323, lng: -121.8996 },
  "san jose": { lat: 37.3382, lng: -121.8863 },
  oakland: { lat: 37.8044, lng: -122.2712 },
};

/** Fallback when the city is not one we know: Fremont, the launch market. */
export const DEFAULT_CENTRE: LatLng = CITY_CENTRES.fremont;

export function cityCentre(city: string): LatLng {
  const key = city.trim().toLowerCase().replace(/,.*$/, "").trim();
  return CITY_CENTRES[key] ?? DEFAULT_CENTRE;
}

/** Stable 32-bit hash, so the same seed always yields the same offset. */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * A point near the centre of `city`, offset deterministically by `seed`.
 *
 * The offset is spread over roughly a 1.5 km radius — wide enough that the pin
 * describes a neighbourhood rather than a house, and it is measured from the
 * city centre, so it says nothing about the real address at all.
 */
export function approxLocation(city: string, seed: string): LatLng {
  const centre = cityCentre(city);
  const h = hash(seed);

  // Two independent values out of one hash: angle, and distance.
  const angle = ((h % 3600) / 3600) * 2 * Math.PI;
  const radiusKm = 0.4 + (((h >>> 12) % 1100) / 1000); // 0.4 km – 1.5 km

  const kmPerDegreeLat = 110.574;
  const kmPerDegreeLng = 111.32 * Math.cos((centre.lat * Math.PI) / 180);

  return {
    lat: round6(centre.lat + (radiusKm * Math.sin(angle)) / kmPerDegreeLat),
    lng: round6(centre.lng + (radiusKm * Math.cos(angle)) / kmPerDegreeLng),
  };
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/** URL-safe slug from a kitchen name, with a short suffix for uniqueness. */
export function kitchenSlug(name: string, seed: string): string {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "kitchen";
  return `${base}-${hash(seed).toString(36).slice(0, 4)}`;
}
