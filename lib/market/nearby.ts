import { cityCentre, DEFAULT_CENTRE, type LatLng } from "./geo";

/**
 * "Kitchens near you" — resolving what someone types into a point, and ranking
 * kitchens by distance from it.
 *
 * There is no geocoding service here on purpose. A typed ZIP or town resolves
 * against a local table, so the feature works offline, costs nothing per
 * keystroke, and cannot leak a visitor's address to a third party before they
 * have even made an account.
 *
 * Distances are measured to the kitchen's *fuzzed* public point, which is all
 * the app ever stores publicly, so "1.2 miles away" is honest about being
 * approximate rather than implying we know where the cook lives.
 */

/** ZIPs across the Bergen County corridor and the nearer boroughs. */
const ZIP_TO_CITY: Record<string, string> = {
  "07601": "Hackensack", "07602": "Hackensack",
  "07603": "Bogota", "07604": "Hasbrouck Heights",
  "07605": "Leonia", "07606": "South Hackensack",
  "07607": "Maywood", "07608": "Teterboro",
  "07621": "Bergenfield", "07624": "Closter",
  "07626": "Cresskill", "07627": "Demarest",
  "07628": "Dumont", "07630": "Emerson",
  "07631": "Englewood", "07632": "Englewood Cliffs",
  "07640": "Harrington Park", "07641": "Haworth",
  "07642": "Hillsdale", "07643": "Little Ferry",
  "07644": "Lodi", "07645": "Montvale",
  "07646": "New Milford", "07647": "Northvale",
  "07648": "Norwood", "07649": "Oradell",
  "07650": "Palisades Park", "07652": "Paramus",
  "07656": "Park Ridge", "07657": "Ridgefield",
  "07660": "Ridgefield Park", "07661": "River Edge",
  "07662": "Rochelle Park", "07663": "Saddle Brook",
  "07666": "Teaneck", "07670": "Tenafly",
  "07675": "Westwood", "07676": "Township of Washington",
  "07024": "Fort Lee", "07010": "Cliffside Park",
  "07020": "Edgewater", "07022": "Fairview",
  "07026": "Garfield", "07031": "North Arlington",
  "07070": "Rutherford", "07410": "Fair Lawn",
  "07450": "Ridgewood", "07452": "Glen Rock",
  "07501": "Paterson", "07502": "Paterson",
  "07503": "Paterson", "07504": "Paterson",
  "07505": "Paterson", "07513": "Paterson",
  "07514": "Paterson", "07522": "Paterson",
  "07524": "Paterson",
  "10001": "Manhattan", "10002": "Manhattan", "10003": "Manhattan",
  "10011": "Manhattan", "10016": "Manhattan", "10019": "Manhattan",
  "10025": "Manhattan", "10027": "Manhattan",
  "11101": "Queens", "11106": "Astoria", "11354": "Flushing",
  "11201": "Brooklyn", "11215": "Brooklyn", "11220": "Bay Ridge",
  "11230": "Brooklyn", "10451": "Bronx", "10453": "Bronx",
};

export type ResolvedLocation = {
  /** What to show back to the visitor: "Hackensack, NJ" or the raw text. */
  label: string;
  point: LatLng;
  /** False when nothing matched and the launch market was assumed. */
  matched: boolean;
};

/**
 * Turn free text into a point.
 *
 * Accepts a ZIP ("07601"), a town ("Teaneck"), or a town with noise
 * ("teaneck, nj"). Anything unrecognised falls back to the launch market and
 * says so, rather than silently pretending it understood.
 */
export function resolveLocation(input: string): ResolvedLocation {
  const raw = input.trim();
  if (!raw) return { label: "Bergen County, NJ", point: DEFAULT_CENTRE, matched: false };

  const zip = raw.match(/\b(\d{5})\b/)?.[1];
  if (zip && ZIP_TO_CITY[zip]) {
    const city = ZIP_TO_CITY[zip];
    return { label: `${city} · ${zip}`, point: cityCentre(city), matched: true };
  }

  // Strip a trailing state so "Teaneck, NJ" matches the same as "Teaneck".
  const city = raw.replace(/,?\s*(nj|ny|new jersey|new york)\s*$/i, "").trim();
  const centre = cityCentre(city);
  const known = centre !== DEFAULT_CENTRE || /hackensack/i.test(city);

  return known
    ? { label: titleCase(city), point: centre, matched: true }
    : { label: raw, point: DEFAULT_CENTRE, matched: false };
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Great-circle distance in miles. */
export function milesBetween(a: LatLng, b: LatLng): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatMiles(miles: number): string {
  if (miles < 0.1) return "right here";
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export type WithDistance<T> = T & { miles: number };

/** Nearest first. Kitchens with no usable point sink to the bottom. */
export function rankByDistance<T extends { approx_lat: number; approx_lng: number }>(
  kitchens: T[],
  from: LatLng,
): WithDistance<T>[] {
  return kitchens
    .map((k) => ({
      ...k,
      miles:
        Number.isFinite(k.approx_lat) && Number.isFinite(k.approx_lng)
          ? milesBetween(from, { lat: k.approx_lat, lng: k.approx_lng })
          : Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => a.miles - b.miles);
}
