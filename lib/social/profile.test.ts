import { describe, expect, it } from "vitest";
import { ACCENTS, accentClasses, isAccent, profileSchema } from "./profile";

describe("accents", () => {
  it("accepts only the palette tokens", () => {
    for (const a of ACCENTS) expect(isAccent(a.key)).toBe(true);
  });

  it("rejects a free colour", () => {
    // A colour picker would let anyone put unreadable text on the cream ground
    // and would quietly become a second brand.
    for (const value of ["#ff0000", "rebeccapurple", "", null, undefined, 7]) {
      expect(isAccent(value)).toBe(false);
    }
  });

  it("gives every accent a band and a chip class", () => {
    for (const a of ACCENTS) {
      const classes = accentClasses(a.key);
      expect(classes.band.length).toBeGreaterThan(0);
      expect(classes.chip.length).toBeGreaterThan(0);
    }
  });

  it("falls back to forest for anything unknown", () => {
    expect(accentClasses("chartreuse")).toEqual(accentClasses("forest"));
  });
});

describe("profileSchema", () => {
  const valid = {
    displayName: "Yusuf Ali",
    tagline: "Always hunting the best biryani",
    bio: "I eat a lot.",
    city: "Hackensack, NJ",
    accent: "brass",
    avatarUrl: "",
    bannerUrl: "",
  };

  it("accepts a complete profile", () => {
    expect(profileSchema.parse(valid).accent).toBe("brass");
  });

  it("requires a usable display name", () => {
    expect(profileSchema.safeParse({ ...valid, displayName: "A" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...valid, displayName: "  " }).success).toBe(false);
  });

  it("caps the tagline so it cannot break the header", () => {
    expect(profileSchema.safeParse({ ...valid, tagline: "x".repeat(81) }).success).toBe(false);
    expect(profileSchema.safeParse({ ...valid, tagline: "x".repeat(80) }).success).toBe(true);
  });

  it("rejects an accent outside the palette", () => {
    expect(profileSchema.safeParse({ ...valid, accent: "#123456" }).success).toBe(false);
  });

  it("accepts https images and blanks", () => {
    expect(
      profileSchema.safeParse({ ...valid, avatarUrl: "https://example.com/a.jpg" }).success,
    ).toBe(true);
    expect(profileSchema.safeParse({ ...valid, avatarUrl: "" }).success).toBe(true);
  });

  it("rejects insecure or credential-bearing image links", () => {
    for (const bad of [
      "http://example.com/a.jpg",
      "javascript:alert(1)",
      "https://user:pw@example.com/a.jpg",
      "not a url",
    ]) {
      expect(profileSchema.safeParse({ ...valid, bannerUrl: bad }).success).toBe(false);
    }
  });

  it("treats optional text as empty rather than undefined", () => {
    const parsed = profileSchema.parse({
      displayName: "Yusuf Ali",
      accent: "forest",
    });
    expect(parsed.bio).toBe("");
    expect(parsed.tagline).toBe("");
    expect(parsed.city).toBe("");
  });
});
