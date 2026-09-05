import { describe, expect, it } from "vitest";
import {
  ONBOARDING_STEPS,
  completedCount,
  currentStep,
  kitchenSchema,
  menuItemSchema,
  stepIsDone,
  type OnboardingProgress,
} from "./cook-onboarding";
import { approxLocation, cityCentre, DEFAULT_CENTRE, kitchenSlug } from "./geo";

const nothing: OnboardingProgress = {
  hasKitchen: false,
  hasPermit: false,
  hasSource: false,
  hasBatch: false,
  hasMenuItem: false,
  isLive: false,
};

describe("onboarding order", () => {
  it("walks the steps in the order the rules require", () => {
    // A meat dish cannot exist without a receipt, and a receipt cannot be
    // matched without a registered supplier, so the sequence is not cosmetic.
    const seen: string[] = [];
    let p = { ...nothing };
    seen.push(currentStep(p));
    p = { ...p, hasKitchen: true };
    seen.push(currentStep(p));
    p = { ...p, hasPermit: true };
    seen.push(currentStep(p));
    p = { ...p, hasSource: true };
    seen.push(currentStep(p));
    p = { ...p, hasBatch: true };
    seen.push(currentStep(p));
    p = { ...p, hasMenuItem: true };
    seen.push(currentStep(p));

    expect(seen).toEqual(["kitchen", "permit", "sources", "receipt", "menu", "live"]);
    expect(seen).toEqual(ONBOARDING_STEPS.map((s) => s.key));
  });

  it("counts only what is actually done", () => {
    expect(completedCount(nothing)).toBe(0);
    expect(completedCount({ ...nothing, hasKitchen: true, hasPermit: true })).toBe(2);
    expect(
      completedCount({
        hasKitchen: true,
        hasPermit: true,
        hasSource: true,
        hasBatch: true,
        hasMenuItem: true,
        isLive: true,
      }),
    ).toBe(ONBOARDING_STEPS.length);
  });

  it("does not mark the final step done until the kitchen is actually live", () => {
    const ready = { ...nothing, hasKitchen: true, hasPermit: true, hasSource: true, hasBatch: true, hasMenuItem: true };
    expect(currentStep(ready)).toBe("live");
    expect(stepIsDone(ready, "live")).toBe(false);
  });
});

describe("kitchen details", () => {
  const valid = {
    name: "Sabiha's Kitchen",
    bio: "Home-style Bengali cooking.",
    cuisineTags: "bengali, Halal , home-style",
    line1: "412 Peralta Boulevard",
    line2: "",
    city: "Fremont",
    zip: "94536",
    county: "Alameda",
    stateCode: "CA",
  };

  it("normalises cuisine tags into a lowercase list", () => {
    expect(kitchenSchema.parse(valid).cuisineTags).toEqual(["bengali", "halal", "home-style"]);
  });

  it("caps cuisine tags at six", () => {
    const many = kitchenSchema.parse({ ...valid, cuisineTags: "a,b,c,d,e,f,g,h" });
    expect(many.cuisineTags).toHaveLength(6);
  });

  it("requires a plausible ZIP", () => {
    expect(kitchenSchema.safeParse({ ...valid, zip: "945" }).success).toBe(false);
    expect(kitchenSchema.safeParse({ ...valid, zip: "94536-1234" }).success).toBe(true);
  });
});

describe("menu items", () => {
  const base = {
    name: "Chicken biryani",
    description: "",
    price: "14.00",
    containsMeat: true,
    meatType: "chicken" as const,
    allergens: ["dairy"],
    batchId: "b1",
  };

  it("accepts a priced dish", () => {
    expect(menuItemSchema.parse(base).price).toBe(14);
  });

  it("rejects a free or negative dish", () => {
    expect(menuItemSchema.safeParse({ ...base, price: "0" }).success).toBe(false);
    expect(menuItemSchema.safeParse({ ...base, price: "-3" }).success).toBe(false);
  });
});

describe("the public location", () => {
  it("never starts from the real address", () => {
    // approxLocation takes a city and a seed, and has no parameter for the
    // street address at all — the real point cannot leak because it is never
    // an input.
    expect(approxLocation.length).toBe(2);
  });

  it("is stable for the same kitchen", () => {
    const a = approxLocation("Fremont", "kitchen-1");
    const b = approxLocation("Fremont", "kitchen-1");
    expect(a).toEqual(b);
  });

  it("differs between kitchens in the same city", () => {
    const a = approxLocation("Fremont", "kitchen-1");
    const b = approxLocation("Fremont", "kitchen-2");
    expect(a).not.toEqual(b);
  });

  it("stays within a couple of kilometres of the city centre", () => {
    const centre = cityCentre("Fremont");
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const p = approxLocation("Fremont", seed);
      const dLat = Math.abs(p.lat - centre.lat) * 110.574;
      const dLng = Math.abs(p.lng - centre.lng) * 111.32 * Math.cos((centre.lat * Math.PI) / 180);
      expect(Math.hypot(dLat, dLng)).toBeLessThan(2);
    }
  });

  it("falls back to the launch market for an unknown city", () => {
    expect(cityCentre("Nowhere")).toEqual(DEFAULT_CENTRE);
  });

  it("is case and punctuation tolerant about city names", () => {
    expect(cityCentre("  fremont, CA ")).toEqual(cityCentre("Fremont"));
  });
});

describe("kitchenSlug", () => {
  it("makes a URL-safe slug with a stable suffix", () => {
    const slug = kitchenSlug("Sabiha's Kitchen", "seed");
    expect(slug).toMatch(/^sabihas-kitchen-[a-z0-9]{1,4}$/);
    expect(kitchenSlug("Sabiha's Kitchen", "seed")).toBe(slug);
  });

  it("separates two kitchens that share a name", () => {
    expect(kitchenSlug("Home Kitchen", "one")).not.toBe(kitchenSlug("Home Kitchen", "two"));
  });

  it("survives a name with nothing usable in it", () => {
    expect(kitchenSlug("!!!", "seed")).toMatch(/^kitchen-/);
  });
});
