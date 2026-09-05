import { describe, expect, it } from "vitest";
import { kitchens } from "./demo-data";
import {
  discoverKitchens,
  mealPrice,
  money,
  type DiscoveryFilters,
} from "./discovery";

const defaults: DiscoveryFilters = {
  query: "",
  cuisine: "All kitchens",
  city: "East Bay",
  today: false,
  budget: false,
  sort: "recommended",
  savedOnly: false,
  saved: [],
};
const find = (filters: Partial<DiscoveryFilters>) =>
  discoverKitchens(kitchens, { ...defaults, ...filters });

describe("kitchen discovery", () => {
  it("finds a dish across cuisines, ignoring whitespace and case", () => {
    expect(find({ query: "  BIRYANI  " }).map((k) => k.id)).toEqual([
      "aminas-kitchen",
      "rafis-rannaghor",
    ]);
  });
  it("combines location, cuisine, and pickup availability", () => {
    expect(
      find({ city: "Oakland", cuisine: "Middle Eastern", today: true }).map(
        (k) => k.id,
      ),
    ).toEqual(["nouras-table"]);
    expect(
      find({ city: "Berkeley", cuisine: "Middle Eastern", today: true }),
    ).toEqual([]);
  });
  it("returns an empty result for a missing dish and all kitchens after clearing", () => {
    expect(find({ query: "xyz nonexistent" })).toEqual([]);
    expect(find({ query: " " })).toHaveLength(6);
  });
  it("counts a cheaper main, but never a cheap drink or sauce, toward the budget", () => {
    expect(mealPrice(kitchens.find((k) => k.id === "meeras-spicebox")!)).toBe(
      1300,
    );
    expect(find({ budget: true }).map((k) => k.id)).toContain(
      "meeras-spicebox",
    );
    expect(find({ budget: true }).map((k) => k.id)).not.toContain(
      "samirs-grill",
    );
    expect(mealPrice(kitchens[0])).toBe(1400);
  });
  it("filters saved kitchens and ignores stale identifiers", () => {
    expect(
      find({ savedOnly: true, saved: ["nouras-table", "deleted-kitchen"] }).map(
        (k) => k.id,
      ),
    ).toEqual(["nouras-table"]);
    expect(find({ savedOnly: true })).toEqual([]);
  });
  it("sorts rating ties by review count and preserves source order", () => {
    const before = kitchens.map((k) => k.id);
    expect(
      find({ sort: "rating" })
        .slice(0, 3)
        .map((k) => k.id),
    ).toEqual(["maryams-oven", "aminas-kitchen", "rafis-rannaghor"]);
    expect(kitchens.map((k) => k.id)).toEqual(before);
  });
  it("sorts by cheapest meal and distance", () => {
    expect(find({ sort: "price" })[0].id).toBe("maryams-oven");
    expect(find({ sort: "distance" })[0].id).toBe("aminas-kitchen");
    expect(find({ sort: "distance" }).at(-1)?.id).toBe("samirs-grill");
  });
  it("formats integer cents without rounding away fractional dollars", () => {
    expect(money(1400)).toBe("$14");
    expect(money(1250)).toBe("$12.50");
    expect(money(1099)).toBe("$10.99");
  });
});
