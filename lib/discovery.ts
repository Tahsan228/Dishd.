import type { Kitchen } from "./demo-data";

export type DiscoveryFilters = { query: string; cuisine: string; city: string; today: boolean; budget: boolean; sort: string; savedOnly: boolean; saved: string[] };

export function discoverKitchens(kitchens: Kitchen[], filters: DiscoveryFilters): Kitchen[] {
  const query = filters.query.trim().toLocaleLowerCase();
  const results = kitchens.filter((kitchen) => {
    const searchable = [kitchen.name, kitchen.cook, kitchen.cuisine, kitchen.neighborhood, kitchen.city, ...kitchen.menu.map((item) => item.name)].join(" ").toLocaleLowerCase();
    return (!query || searchable.includes(query))
      && (filters.cuisine === "All kitchens" || kitchen.cuisine === filters.cuisine)
      && (filters.city === "East Bay" || kitchen.city === filters.city)
      && (!filters.today || kitchen.today)
      && (!filters.budget || kitchen.menu[0].priceCents <= 1500)
      && (!filters.savedOnly || filters.saved.includes(kitchen.id));
  });
  if (filters.sort === "rating") results.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
  if (filters.sort === "distance") results.sort((a, b) => a.distance - b.distance);
  if (filters.sort === "price") results.sort((a, b) => a.menu[0].priceCents - b.menu[0].priceCents);
  return results;
}

export function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
}
