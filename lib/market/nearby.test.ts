import { describe, expect, it } from "vitest";
import { formatMiles, milesBetween, rankByDistance, resolveLocation } from "./nearby";
import { cityCentre, DEFAULT_CENTRE } from "./geo";

describe("resolving a typed location", () => {
  it("matches a Bergen County ZIP to its town", () => {
    const r = resolveLocation("07666");
    expect(r.matched).toBe(true);
    expect(r.label).toContain("Teaneck");
    expect(r.point).toEqual(cityCentre("Teaneck"));
  });

  it("pulls a ZIP out of a longer string", () => {
    expect(resolveLocation("somewhere near 07024").label).toContain("Fort Lee");
  });

  it("matches a town by name, whatever the case", () => {
    expect(resolveLocation("teaneck").point).toEqual(cityCentre("Teaneck"));
    expect(resolveLocation("FORT LEE").point).toEqual(cityCentre("Fort Lee"));
  });

  it("ignores a trailing state", () => {
    expect(resolveLocation("Teaneck, NJ").point).toEqual(cityCentre("Teaneck"));
    expect(resolveLocation("Brooklyn, New York").point).toEqual(cityCentre("Brooklyn"));
  });

  it("titlecases what it echoes back", () => {
    expect(resolveLocation("fort lee").label).toBe("Fort Lee");
  });

  it("says so when it did not understand, rather than pretending", () => {
    // Silently showing Bergen County kitchens for "Chicago" would imply we
    // searched there and found these.
    const r = resolveLocation("Chicago");
    expect(r.matched).toBe(false);
    expect(r.label).toBe("Chicago");
    expect(r.point).toEqual(DEFAULT_CENTRE);
  });

  it("treats empty input as the launch market without claiming a match", () => {
    const r = resolveLocation("   ");
    expect(r.matched).toBe(false);
    expect(r.point).toEqual(DEFAULT_CENTRE);
  });

  it("recognises the launch market itself as a match", () => {
    // Hackensack IS the default point, so a naive "differs from default" check
    // would wrongly report no match for the one town we are surest about.
    expect(resolveLocation("Hackensack").matched).toBe(true);
  });
});

describe("distance", () => {
  it("is zero between a point and itself", () => {
    expect(milesBetween(DEFAULT_CENTRE, DEFAULT_CENTRE)).toBeCloseTo(0, 6);
  });

  it("is symmetric", () => {
    const a = cityCentre("Teaneck");
    const b = cityCentre("Paterson");
    expect(milesBetween(a, b)).toBeCloseTo(milesBetween(b, a), 9);
  });

  it("gets the Hackensack to Teaneck hop about right", () => {
    // Neighbouring towns: a couple of miles, not twenty and not zero.
    const d = milesBetween(cityCentre("Hackensack"), cityCentre("Teaneck"));
    expect(d).toBeGreaterThan(0.5);
    expect(d).toBeLessThan(4);
  });

  it("puts Manhattan further away than Teaneck", () => {
    const home = cityCentre("Hackensack");
    expect(milesBetween(home, cityCentre("Manhattan"))).toBeGreaterThan(
      milesBetween(home, cityCentre("Teaneck")),
    );
  });
});

describe("formatMiles", () => {
  it("reads naturally at each scale", () => {
    expect(formatMiles(0.02)).toBe("right here");
    expect(formatMiles(1.24)).toBe("1.2 mi");
    expect(formatMiles(23.6)).toBe("24 mi");
  });
});

describe("ranking kitchens", () => {
  const home = cityCentre("Hackensack");
  const kitchens = [
    { id: "far", approx_lat: cityCentre("Manhattan").lat, approx_lng: cityCentre("Manhattan").lng },
    { id: "near", approx_lat: home.lat, approx_lng: home.lng },
    { id: "mid", approx_lat: cityCentre("Teaneck").lat, approx_lng: cityCentre("Teaneck").lng },
  ];

  it("puts the nearest first", () => {
    expect(rankByDistance(kitchens, home).map((k) => k.id)).toEqual(["near", "mid", "far"]);
  });

  it("attaches a usable distance to each", () => {
    const ranked = rankByDistance(kitchens, home);
    expect(ranked[0].miles).toBeCloseTo(0, 3);
    expect(ranked[2].miles).toBeGreaterThan(5);
  });

  it("sinks kitchens with an unusable point instead of dropping or hoisting them", () => {
    const withBad = [...kitchens, { id: "broken", approx_lat: NaN, approx_lng: NaN }];
    const ranked = rankByDistance(withBad, home);
    expect(ranked).toHaveLength(4);
    expect(ranked[ranked.length - 1].id).toBe("broken");
  });

  it("does not mutate the input", () => {
    const input = [...kitchens];
    rankByDistance(input, home);
    expect(input.map((k) => k.id)).toEqual(["far", "near", "mid"]);
  });
});
