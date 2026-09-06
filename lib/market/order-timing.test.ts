import { describe, expect, it } from "vitest";
import {
  MAX_PRIORITY_FEE_CENTS,
  ceilToStep,
  checkScheduledFor,
  compareQueue,
  formatCountdown,
  isDueNow,
  parsePrepMinutes,
  parsePriorityFeeCents,
  parseScheduledFor,
  readyEstimateAt,
  scheduleBounds,
  startByAt,
  toLocalInputValue,
} from "./order-timing";

/** A fixed instant on a quarter-hour, so every expectation below is exact. */
const NOW = new Date("2026-09-06T12:00:00.000Z");
const at = (iso: string) => new Date(iso);
const err = (result: ReturnType<typeof checkScheduledFor>) =>
  "error" in result ? result.error : null;

describe("quarter-hour slots", () => {
  it.each([
    ["2026-09-06T12:00:00.000Z", "2026-09-06T12:00:00.000Z"],
    ["2026-09-06T12:00:01.000Z", "2026-09-06T12:15:00.000Z"],
    ["2026-09-06T12:14:59.999Z", "2026-09-06T12:15:00.000Z"],
    ["2026-09-06T12:46:00.000Z", "2026-09-06T13:00:00.000Z"],
  ])("rounds %s up to %s", (input, expected) =>
    expect(ceilToStep(at(input)).toISOString()).toBe(expected));

  it("opens the window on the first slot at or after the lead time", () =>
    // 12:00 + 30 minutes is exactly 12:30, which is already a slot.
    expect(scheduleBounds(NOW).earliest.toISOString()).toBe("2026-09-06T12:30:00.000Z"));

  it("rounds an awkward clock forward rather than back", () =>
    expect(scheduleBounds(at("2026-09-06T12:07:00.000Z")).earliest.toISOString()).toBe(
      "2026-09-06T12:45:00.000Z",
    ));

  it("closes the window seven days out", () =>
    expect(scheduleBounds(NOW).latest.toISOString()).toBe("2026-09-13T12:00:00.000Z"));
});

describe("validating a requested pickup time", () => {
  it("accepts the earliest legal slot", () => {
    const result = checkScheduledFor(at("2026-09-06T12:30:00.000Z"), NOW);
    expect("at" in result && result.at.toISOString()).toBe("2026-09-06T12:30:00.000Z");
  });

  it.each(["2026-09-06T12:45:00.000Z", "2026-09-07T18:15:00.000Z", "2026-09-13T11:45:00.000Z"])(
    "accepts %s",
    (iso) => expect(err(checkScheduledFor(at(iso), NOW))).toBeNull(),
  );

  it("refuses a time inside the lead window, naming the lead rule", () =>
    expect(err(checkScheduledFor(at("2026-09-06T12:15:00.000Z"), NOW))).toBe(
      "Choose a pickup time at least 30 minutes from now.",
    ));

  it("refuses a time in the past", () =>
    expect(err(checkScheduledFor(at("2026-09-06T09:00:00.000Z"), NOW))).toBe(
      "Choose a pickup time at least 30 minutes from now.",
    ));

  it("refuses beyond the seven-day horizon", () =>
    expect(err(checkScheduledFor(at("2026-09-13T12:15:00.000Z"), NOW))).toBe(
      "Scheduled pickups can be up to 7 days ahead.",
    ));

  it.each([
    "2026-09-06T12:35:00.000Z",
    "2026-09-06T12:31:00.000Z",
    "2026-09-06T12:30:30.000Z",
    "2026-09-06T12:30:00.500Z",
  ])("refuses %s as off-step", (iso) =>
    expect(err(checkScheduledFor(at(iso), NOW))).toBe("Pickup times run in 15-minute steps."));

  it("refuses a value that is not a date at all", () => {
    expect(err(checkScheduledFor("soon", NOW))).toBe("Choose a pickup date and time.");
    expect(err(checkScheduledFor(new Date("nonsense"), NOW))).toBe(
      "Choose a pickup date and time.",
    );
  });

  it("treats an absent or empty field as as-soon-as-possible", () => {
    expect(parseScheduledFor(null, NOW)).toBeNull();
    expect(parseScheduledFor("", NOW)).toBeNull();
    expect(parseScheduledFor("   ", NOW)).toBeNull();
  });

  it("still validates a field that was filled in", () =>
    expect(err(parseScheduledFor("2026-09-06T12:15:00.000Z", NOW)!)).toBe(
      "Choose a pickup time at least 30 minutes from now.",
    ));

  it("reports the step rule first, since an off-step time cannot reach the form", () =>
    expect(err(parseScheduledFor("2026-09-06T12:05:00.000Z", NOW)!)).toBe(
      "Pickup times run in 15-minute steps.",
    ));
});

describe("the cook's cooking estimate", () => {
  it.each([["5", 5], ["25", 25], ["240", 240], [" 30 ", 30]])(
    "accepts %s",
    (input, expected) => expect(parsePrepMinutes(input)).toBe(expected),
  );
  it.each(["", "0", "4", "241", "-5", "2.5", "1e2", "abc", "  "])("rejects %s", (input) =>
    expect(parsePrepMinutes(input)).toBeNull());

  it("counts forward from the moment the cook accepted", () =>
    expect(readyEstimateAt(NOW, 25, null).toISOString()).toBe("2026-09-06T12:25:00.000Z"));

  it("leaves a scheduled pickup at the time the buyer booked", () =>
    // The estimate decides when the cook starts, never when the buyer arrives.
    expect(readyEstimateAt(NOW, 25, at("2026-09-06T18:00:00.000Z")).toISOString()).toBe(
      "2026-09-06T18:00:00.000Z",
    ));

  it("works backwards to a start time", () =>
    expect(startByAt(at("2026-09-06T18:00:00.000Z"), 40).toISOString()).toBe(
      "2026-09-06T17:20:00.000Z",
    ));
});

describe("the priority price a kitchen sets", () => {
  it.each([["0", 0], ["2", 200], ["2.50", 250], ["0.75", 75], ["20", 2000], ["20.00", 2000]])(
    "parses %s exactly",
    (input, expected) => expect(parsePriorityFeeCents(input)).toBe(expected),
  );
  it.each(["20.01", "100", "-1", "1.001", "1e2", "", "+2", "2,50", "abc"])("rejects %s", (input) =>
    expect(parsePriorityFeeCents(input)).toBeNull());
  it("trims what a cook types, unlike the tip field on a fixed preset", () =>
    expect(parsePriorityFeeCents("  2.50  ")).toBe(250));
  it("caps at twenty dollars", () => expect(MAX_PRIORITY_FEE_CENTS).toBe(2000));
  it("treats zero as a withdrawn offer, not a free upgrade", () =>
    expect(parsePriorityFeeCents("0")).toBe(0));
});

describe("what the cook has to cook now", () => {
  const asap = { scheduled_for: null, prep_minutes: 25 };

  it("always shows an as-soon-as-possible order", () => expect(isDueNow(asap, NOW, 25)).toBe(true));

  it("holds a booking back until its cooking time begins", () =>
    expect(isDueNow({ scheduled_for: "2026-09-06T18:00:00.000Z", prep_minutes: 30 }, NOW, 25)).toBe(
      false,
    ));

  it("releases it the moment cooking has to start", () =>
    expect(isDueNow({ scheduled_for: "2026-09-06T12:30:00.000Z", prep_minutes: 30 }, NOW, 25)).toBe(
      true,
    ));

  it("falls back to the kitchen default when the order carries no estimate", () => {
    const order = { scheduled_for: "2026-09-06T12:30:00.000Z", prep_minutes: null };
    expect(isDueNow(order, NOW, 45)).toBe(true); // 12:30 - 45m = 11:45, already past
    expect(isDueNow(order, NOW, 10)).toBe(false); // 12:30 - 10m = 12:20, not yet
  });

  it("surfaces an unreadable date rather than hiding the order forever", () =>
    expect(isDueNow({ scheduled_for: "not a date", prep_minutes: 25 }, NOW, 25)).toBe(true));
});

describe("queue order", () => {
  const order = (fee: number | null, created: string) => ({
    priority_fee_cents: fee,
    created_at: created,
  });

  it("puts a paid priority order ahead of an older ordinary one", () => {
    const queue = [order(0, "2026-09-06T10:00:00Z"), order(200, "2026-09-06T11:00:00Z")];
    expect(queue.sort(compareQueue).map((o) => o.priority_fee_cents)).toEqual([200, 0]);
  });

  it("keeps ordinary orders oldest first", () => {
    const queue = [order(0, "2026-09-06T11:00:00Z"), order(0, "2026-09-06T10:00:00Z")];
    expect(queue.sort(compareQueue).map((o) => o.created_at)).toEqual([
      "2026-09-06T10:00:00Z",
      "2026-09-06T11:00:00Z",
    ]);
  });

  it("ranks a larger fee first, since the kitchen sets the price", () => {
    const queue = [order(200, "2026-09-06T10:00:00Z"), order(500, "2026-09-06T11:00:00Z")];
    expect(queue.sort(compareQueue).map((o) => o.priority_fee_cents)).toEqual([500, 200]);
  });

  it("treats a missing fee as no fee", () => {
    const queue = [order(null, "2026-09-06T10:00:00Z"), order(100, "2026-09-06T11:00:00Z")];
    expect(queue.sort(compareQueue).map((o) => o.priority_fee_cents)).toEqual([100, null]);
  });
});

describe("wording", () => {
  it.each([
    ["2026-09-06T12:00:00.000Z", "any moment now"],
    ["2026-09-06T11:00:00.000Z", "any moment now"],
    ["2026-09-06T12:01:00.000Z", "in about a minute"],
    ["2026-09-06T12:25:00.000Z", "in about 25 minutes"],
    ["2026-09-06T14:00:00.000Z", "in about 2 hours"],
    ["2026-09-08T12:00:00.000Z", "in about 2 days"],
  ])("describes %s as %s", (iso, expected) =>
    expect(formatCountdown(at(iso), NOW)).toBe(expected));

  it("writes local wall time for a datetime-local input", () => {
    // Built from local parts, so this holds in whatever zone the suite runs in.
    const local = new Date(2026, 8, 7, 18, 30);
    expect(toLocalInputValue(local)).toBe("2026-09-07T18:30");
  });

  it("pads single-digit months, days, hours and minutes", () =>
    expect(toLocalInputValue(new Date(2026, 0, 2, 3, 4))).toBe("2026-01-02T03:04"));
});
