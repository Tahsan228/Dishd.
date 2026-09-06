import { describe, expect, it } from "vitest";
import {
  barPercent,
  buildSeries,
  conversionPercent,
  seriesMax,
  seriesTotal,
  trendPercent,
} from "./analytics";

const TODAY = new Date(2026, 8, 6); // 6 Sep 2026, local

/** Local YYYY-MM-DD, matching what buildSeries produces. */
function day(offset: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("buildSeries", () => {
  it("returns one dense point per day, oldest first", () => {
    const points = buildSeries(7, [], [], TODAY);
    expect(points).toHaveLength(7);
    expect(points[0].day).toBe(day(6));
    expect(points[6].day).toBe(day(0));
  });

  it("keeps quiet days at zero rather than dropping them", () => {
    // A missing Tuesday would make the chart imply continuous trading.
    const points = buildSeries(5, [{ day: day(2), page_views: 9, menu_clicks: 3 }], [], TODAY);
    expect(points).toHaveLength(5);
    expect(points.filter((p) => p.pageViews === 0)).toHaveLength(4);
    expect(points.find((p) => p.day === day(2))?.pageViews).toBe(9);
  });

  it("counts only completed orders as revenue", () => {
    const orders = [
      { created_at: new Date(TODAY).toISOString(), subtotal_cents: 1400, status: "completed" },
      { created_at: new Date(TODAY).toISOString(), subtotal_cents: 9900, status: "pending" },
      { created_at: new Date(TODAY).toISOString(), subtotal_cents: 5000, status: "cancelled" },
    ];
    const points = buildSeries(3, [], orders, TODAY);
    const today = points[points.length - 1];
    expect(today.orders).toBe(1);
    expect(today.revenueCents).toBe(1400);
  });

  it("ignores activity outside the window", () => {
    const points = buildSeries(3, [{ day: day(40), page_views: 100, menu_clicks: 50 }], [], TODAY);
    expect(seriesTotal(points, "pageViews")).toBe(0);
  });

  it("sums several rows landing on the same day", () => {
    const points = buildSeries(
      3,
      [
        { day: day(1), page_views: 4, menu_clicks: 1 },
        { day: day(1), page_views: 6, menu_clicks: 2 },
      ],
      [],
      TODAY,
    );
    expect(points.find((p) => p.day === day(1))?.pageViews).toBe(10);
  });
});

describe("bar geometry", () => {
  it("scales against the tallest bar", () => {
    expect(barPercent(50, 100)).toBe(50);
    expect(barPercent(100, 100)).toBe(100);
  });

  it("keeps a real value visible with a floor", () => {
    expect(barPercent(1, 1000)).toBe(4);
  });

  it("draws nothing for zero, so an empty day is not implied to have activity", () => {
    expect(barPercent(0, 100)).toBe(0);
  });

  it("survives an all-zero series without dividing by zero", () => {
    expect(barPercent(0, 0)).toBe(0);
    expect(Number.isFinite(barPercent(5, 0))).toBe(true);
  });
});

describe("totals and trend", () => {
  const points = buildSeries(
    4,
    [
      { day: day(3), page_views: 10, menu_clicks: 0 },
      { day: day(2), page_views: 10, menu_clicks: 0 },
      { day: day(1), page_views: 30, menu_clicks: 0 },
      { day: day(0), page_views: 30, menu_clicks: 0 },
    ],
    [],
    TODAY,
  );

  it("totals and maxes across the window", () => {
    expect(seriesTotal(points, "pageViews")).toBe(80);
    expect(seriesMax(points, "pageViews")).toBe(30);
  });

  it("compares the two halves", () => {
    // 20 then 60 is a tripling.
    expect(trendPercent(points, "pageViews")).toBe(200);
  });

  it("returns null rather than flattering a zero baseline", () => {
    // "Up 100%" from nothing is not information, and would make a kitchen's
    // first week look like growth.
    const fresh = buildSeries(4, [{ day: day(0), page_views: 5, menu_clicks: 0 }], [], TODAY);
    expect(trendPercent(fresh, "pageViews")).toBeNull();
  });

  it("returns null when there is too little data to halve", () => {
    expect(trendPercent(buildSeries(2, [], [], TODAY), "pageViews")).toBeNull();
  });
});

describe("conversion", () => {
  it("is orders over page views", () => {
    const points = buildSeries(
      2,
      [{ day: day(0), page_views: 10, menu_clicks: 4 }],
      [{ created_at: new Date(TODAY).toISOString(), subtotal_cents: 100, status: "completed" }],
      TODAY,
    );
    expect(conversionPercent(points)).toBe(10);
  });

  it("is null with no views, rather than dividing by zero", () => {
    expect(conversionPercent(buildSeries(3, [], [], TODAY))).toBeNull();
  });
});
