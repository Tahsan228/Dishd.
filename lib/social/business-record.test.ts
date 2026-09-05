import { describe, expect, it } from "vitest";
import { businessRecordMetrics, type BusinessRecordCounters } from "./business-record";

const counters: BusinessRecordCounters = {
  orders_completed: 30, avg_rating_10: 9, distinct_customers: 20, repeat_customers: 5,
  trust_streak: 10, permit_status: "verified", upheld_flags: 0, open_incidents: 0,
  cook_cancellations: 0, created_at: "2020-01-01T12:00:00Z", revenue_cents: 43210,
  first_completed_at: "2026-06-05T12:00:00Z",
};
const now = new Date("2026-09-05T12:00:00Z");

describe("Business Record contract from migration 0004", () => {
  it("uses supplied revenue in cents and returning customers, not order count", () => {
    expect(businessRecordMetrics(counters, now)).toMatchObject({ revenueCents: 43210, repeatRate: 25 });
  });
  it("starts trading history at the first completed order, never account creation", () => {
    expect(businessRecordMetrics(counters, now)).toMatchObject({ operatingMonths: 3, cleanOperatingMonths: 3, cleanStanding: true });
  });
  it("counts full months at the boundary", () => {
    expect(businessRecordMetrics(counters, new Date(now.getTime() - 1)).operatingMonths).toBe(2);
  });
  it("does not invent an operating history or repeat rate for a kitchen with no sales", () => {
    expect(businessRecordMetrics({ ...counters, first_completed_at: null, distinct_customers: 0 }, now)).toMatchObject({ operatingMonths: null, cleanOperatingMonths: null, repeatRate: null });
  });
  it.each(["upheld_flags", "open_incidents"] as const)("does not claim clean standing with %s", (field) => {
    expect(businessRecordMetrics({ ...counters, [field]: 1 }, now)).toMatchObject({ operatingMonths: 3, cleanOperatingMonths: null, cleanStanding: false });
  });
});
