import { describe, it, expect } from "vitest";
import {
  runLocalChecks,
  allPassed,
  failureReasons,
  normaliseStore,
  backsItemsUntil,
} from "./receipts";

const NOW = new Date("2026-09-05T12:00:00Z");
const SOURCES = [
  { id: "src-1", store_name: "Al-Salam Halal Meats" },
  { id: "src-2", store_name: "Madina Grocers" },
];

const good = {
  halalSourceId: "src-1",
  storeName: "Al-Salam Halal Meats",
  purchaseDate: "2026-09-03",
  totalCents: 8450,
  meatTypes: ["chicken" as const],
};

describe("normaliseStore", () => {
  it("ignores case, spacing and punctuation", () => {
    expect(normaliseStore("Al-Salam Halal Meats")).toBe(
      normaliseStore("al salam  halal, meats"),
    );
  });
});

describe("runLocalChecks", () => {
  it("passes a clean, recent receipt from a registered source", () => {
    const checks = runLocalChecks(good, SOURCES, NOW);
    expect(allPassed(checks)).toBe(true);
  });

  // The demo closer: a receipt from a shop the kitchen never registered.
  it("rejects a store that is not a registered halal source", () => {
    const checks = runLocalChecks(
      { ...good, halalSourceId: null, storeName: "Costco Wholesale" },
      SOURCES,
      NOW,
    );
    expect(allPassed(checks)).toBe(false);
    expect(checks.find((c) => c.code === "source_registered")?.passed).toBe(false);
    expect(failureReasons(checks).join(" ")).toContain("Costco Wholesale");
  });

  it("matches a registered source by name when no id is given", () => {
    const checks = runLocalChecks(
      { ...good, halalSourceId: null, storeName: "al-salam halal meats" },
      SOURCES,
      NOW,
    );
    expect(checks.find((c) => c.code === "source_registered")?.passed).toBe(true);
  });

  it("rejects a receipt older than the freshness window", () => {
    const checks = runLocalChecks({ ...good, purchaseDate: "2026-08-01" }, SOURCES, NOW);
    expect(checks.find((c) => c.code === "freshness")?.passed).toBe(false);
  });

  it("rejects a future-dated receipt", () => {
    const checks = runLocalChecks({ ...good, purchaseDate: "2026-09-20" }, SOURCES, NOW);
    expect(checks.find((c) => c.code === "date_valid")?.passed).toBe(false);
  });

  it("accepts a receipt bought exactly on the window boundary", () => {
    const checks = runLocalChecks({ ...good, purchaseDate: "2026-08-29" }, SOURCES, NOW);
    expect(checks.find((c) => c.code === "freshness")?.passed).toBe(true);
  });

  it("rejects a receipt that names no meat", () => {
    const checks = runLocalChecks({ ...good, meatTypes: [] }, SOURCES, NOW);
    expect(checks.find((c) => c.code === "meat_declared")?.passed).toBe(false);
  });

  it("rejects a zero total", () => {
    const checks = runLocalChecks({ ...good, totalCents: 0 }, SOURCES, NOW);
    expect(checks.find((c) => c.code === "total_present")?.passed).toBe(false);
  });
});

describe("backsItemsUntil", () => {
  it("expires seven days after purchase", () => {
    expect(backsItemsUntil("2026-09-03")).toBe("2026-09-10");
  });
});
