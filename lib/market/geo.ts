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

/**
 * Centres of the cities Dishd operates in.
 *
 * Bergen County NJ is the launch market — a dense, heavily Muslim corridor
 * along Route 4 and Main Street Hackensack — with the nearer New York boroughs
 * alongside it. Note that "Newark" here is Newark NJ, not the California town
 * of the same name that this list used to mean.
 */
const CITY_CENTRES: Record<string, LatLng> = {
  // Bergen County, New Jersey
  hackensack: { lat: 40.8859, lng: -74.0435 },
  paterson: { lat: 40.9168, lng: -74.1718 },
  "fort lee": { lat: 40.8509, lng: -73.9701 },
  teaneck: { lat: 40.8976, lng: -74.016 },
  "palisades park": { lat: 40.8479, lng: -73.9976 },
  englewood: { lat: 40.8929, lng: -73.9726 },
  ridgewood: { lat: 40.9793, lng: -74.1165 },
  paramus: { lat: 40.9445, lng: -74.0754 },
  bergenfield: { lat: 40.9276, lng: -73.9974 },
  lodi: { lat: 40.8823, lng: -74.0832 },
  "cliffside park": { lat: 40.8215, lng: -73.9876 },
  garfield: { lat: 40.8815, lng: -74.1132 },
  // Neighbouring New Jersey
  newark: { lat: 40.7357, lng: -74.1724 },
  "jersey city": { lat: 40.7178, lng: -74.0431 },
  // New York
  "new york": { lat: 40.7128, lng: -74.006 },
  manhattan: { lat: 40.7831, lng: -73.9712 },
  brooklyn: { lat: 40.6782, lng: -73.9442 },
  queens: { lat: 40.7282, lng: -73.7949 },
  bronx: { lat: 40.8448, lng: -73.8648 },
  astoria: { lat: 40.7644, lng: -73.9235 },
  flushing: { lat: 40.7674, lng: -73.833 },
  "bay ridge": { lat: 40.6264, lng: -74.0299 },
};

/** Fallback when the city is not one we know: Hackensack, the launch market. */
export const DEFAULT_CENTRE: LatLng = CITY_CENTRES.hackensack;

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
