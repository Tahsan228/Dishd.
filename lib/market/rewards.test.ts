import { describe, expect, it } from "vitest";
import {
  EARN_RULES,
  creditBlockedReason,
  creditUsable,
  nextRewardProgress,
  pointsBalance,
  pointsEarned,
} from "./rewards";

const ledger = [
  { points: 10 },
  { points: 25 },
  { points: 60 },
  { points: -250 }, // a redemption
  { points: 20 },
];

describe("points arithmetic", () => {
  it("nets spends against earnings for the balance", () => {
    expect(pointsBalance(ledger)).toBe(-135);
  });

  it("ignores spends when reporting lifetime earnings", () => {
    // "Earned all time" must not fall when someone spends, or redeeming looks
    // like losing progress.
    expect(pointsEarned(ledger)).toBe(115);
  });

  it("treats an empty ledger as zero rather than NaN", () => {
    expect(pointsBalance([])).toBe(0);
    expect(pointsEarned([])).toBe(0);
  });
});

describe("credit usability", () => {
  const credit = { status: "available" as const, minimum_order_cents: 1500, credit_cents: 500 };

  it("allows a credit once the basket clears the minimum", () => {
    expect(creditUsable(credit, 1500)).toBe(true);
    expect(creditUsable(credit, 2000)).toBe(true);
  });

  it("blocks a credit below the minimum", () => {
    // The minimum is what stops a $10 credit on an $8 order becoming cash back.
    expect(creditUsable(credit, 1499)).toBe(false);
  });

  it("blocks a credit already spent or held", () => {
    expect(creditUsable({ ...credit, status: "used" }, 5000)).toBe(false);
    expect(creditUsable({ ...credit, status: "reserved" }, 5000)).toBe(false);
  });

  it("says how much more is needed rather than just refusing", () => {
    expect(creditBlockedReason(credit, 1200)).toBe("Spend $3.00 more to use this.");
    expect(creditBlockedReason(credit, 1500)).toBeNull();
  });

  it("explains a used or held credit in its own words", () => {
    expect(creditBlockedReason({ ...credit, status: "used" }, 5000)).toBe("Already used.");
    expect(creditBlockedReason({ ...credit, status: "reserved" }, 5000)).toMatch(/still open/i);
  });
});

describe("progress to the next reward", () => {
  const catalog = [
    { name: "$5 credit", points_cost: 250 },
    { name: "$10 credit", points_cost: 500 },
  ];

  it("targets the cheapest reward still out of reach", () => {
    expect(nextRewardProgress(100, catalog)).toEqual({
      name: "$5 credit",
      needed: 150,
      percent: 40,
    });
  });

  it("moves to the next tier once the first is affordable", () => {
    expect(nextRewardProgress(250, catalog)?.name).toBe("$10 credit");
  });

  it("returns null when everything is affordable", () => {
    expect(nextRewardProgress(9000, catalog)).toBeNull();
  });

  it("never reports more than 100 percent", () => {
    expect(nextRewardProgress(499, catalog)?.percent).toBeLessThanOrEqual(100);
  });
});

describe("the earning rules shown to buyers", () => {
  it("marks promotional missions as reviewed", () => {
    // An unreviewed "post a video" reward is a link box that prints currency,
    // so the UI must never imply points land automatically.
    const promos = EARN_RULES.filter((r) => r.kind === "promotion");
    expect(promos.length).toBeGreaterThan(0);
    for (const rule of promos) expect(rule.moderated).toBe(true);
  });

  it("does not mark automatic awards as reviewed", () => {
    for (const rule of EARN_RULES.filter((r) => r.kind !== "promotion")) {
      expect(rule.moderated).toBeUndefined();
    }
  });

  it("gives every rule something to display", () => {
    for (const rule of EARN_RULES) {
      expect(rule.label.length).toBeGreaterThan(0);
      expect(rule.points.length).toBeGreaterThan(0);
      expect(rule.detail.length).toBeGreaterThan(0);
    }
  });
});
