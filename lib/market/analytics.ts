/**
 * Chart maths for the kitchen dashboard.
 *
 * Drawn as inline SVG rather than with a charting library: adding a dependency
 * is off the table here, and a bar chart over fourteen points does not need
 * one. Keeping the geometry as pure functions means the numbers can be tested
 * without rendering anything.
 */

export type DayPoint = {
  /** ISO date, YYYY-MM-DD. */
  day: string;
  pageViews: number;
  menuClicks: number;
  orders: number;
  revenueCents: number;
};

/** Local YYYY-MM-DD, avoiding the UTC shift toISOString() would introduce. */
function isoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * A dense series of the last `days` days, ending today.
 *
 * Days with no activity must still appear, or a quiet Tuesday silently
 * disappears and the chart implies continuous trading.
 */
export function buildSeries(
  days: number,
  views: { day: string; page_views: number; menu_clicks: number }[],
  orders: { created_at: string; subtotal_cents: number; status: string }[],
  today = new Date(),
): DayPoint[] {
  const byDay = new Map<string, DayPoint>();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = isoDay(d);
    byDay.set(key, { day: key, pageViews: 0, menuClicks: 0, orders: 0, revenueCents: 0 });
  }

  for (const row of views) {
    const point = byDay.get(row.day);
    if (!point) continue;
    point.pageViews += row.page_views ?? 0;
    point.menuClicks += row.menu_clicks ?? 0;
  }

  for (const order of orders) {
    // Only money that actually completed counts as revenue.
    if (order.status !== "completed") continue;
    const key = isoDay(new Date(order.created_at));
    const point = byDay.get(key);
    if (!point) continue;
    point.orders += 1;
    point.revenueCents += order.subtotal_cents ?? 0;
  }

  return [...byDay.values()];
}

export type SeriesKey = "pageViews" | "menuClicks" | "orders" | "revenueCents";

export function seriesMax(points: DayPoint[], key: SeriesKey): number {
  return points.reduce((max, p) => Math.max(max, p[key]), 0);
}

export function seriesTotal(points: DayPoint[], key: SeriesKey): number {
  return points.reduce((sum, p) => sum + p[key], 0);
}

/**
 * Bar height as a percentage of the tallest bar.
 *
 * A zero stays zero rather than becoming a stub: a visible bar for a day with
 * no views would misrepresent the one thing the chart is for. When every day is
 * zero the scale is meaningless, so everything reads zero.
 */
export function barPercent(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.max(4, Math.round((value / max) * 100));
}

/** Short weekday label for the axis. */
export function dayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "narrow" });
}

/**
 * Percentage change between the two halves of the series.
 *
 * Null when the earlier half is empty: "up 100%" from a base of nothing is not
 * information, and showing it would flatter a kitchen's first week.
 */
export function trendPercent(points: DayPoint[], key: SeriesKey): number | null {
  if (points.length < 4) return null;
  const half = Math.floor(points.length / 2);
  const earlier = points.slice(0, half).reduce((s, p) => s + p[key], 0);
  const later = points.slice(half).reduce((s, p) => s + p[key], 0);
  if (earlier === 0) return null;
  return Math.round(((later - earlier) / earlier) * 100);
}

/** Conversion from a menu view to a completed order, as a percentage. */
export function conversionPercent(points: DayPoint[]): number | null {
  const views = seriesTotal(points, "pageViews");
  if (views === 0) return null;
  return Math.round((seriesTotal(points, "orders") / views) * 100);
}
