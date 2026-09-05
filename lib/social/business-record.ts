import { differenceInMonths } from "date-fns";
import type { KitchenCounters } from "@/lib/types";

/** Migration 0004 adds these counters; keep the frozen shared type untouched. */
export type BusinessRecordCounters = KitchenCounters & {
  revenue_cents: number;
  first_completed_at: string | null;
};

export function businessRecordMetrics(c: BusinessRecordCounters, now = new Date()) {
  const operatingMonths = c.first_completed_at
    ? Math.max(0, differenceInMonths(now, new Date(c.first_completed_at)))
    : null;
  const cleanStanding = c.upheld_flags === 0 && c.open_incidents === 0;
  return {
    revenueCents: c.revenue_cents,
    repeatRate: c.distinct_customers > 0 ? c.repeat_customers / c.distinct_customers * 100 : null,
    operatingMonths,
    cleanStanding,
    // Host contract: operating history from the first sale, with no current flags
    // or incidents. This is not a reconstructed month-by-month safety history.
    cleanOperatingMonths: cleanStanding ? operatingMonths : null,
  };
}
