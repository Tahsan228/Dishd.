/**
 * Pickup timing: scheduled slots, the cook's cooking estimate, and priority.
 *
 * Pure functions only, so the rules can be unit-tested and so the browser and
 * the server agree on them without either one being the authority. The real
 * boundary is migration 0015 — `dishd_place_order` revalidates every rule here
 * in SQL, because a server action is reachable from a client with arbitrary
 * arguments. Keep the two in step: if a bound moves here, move it there too.
 */

/** A kitchen's own claim about its cooking time, in minutes. */
export const PREP_MIN_MINUTES = 5;
export const PREP_MAX_MINUTES = 240;

/** Scheduled pickups run in quarter hours. */
export const SCHEDULE_STEP_MINUTES = 15;
/** The soonest a pickup may be scheduled, so a cook has warning. */
export const SCHEDULE_LEAD_MINUTES = 30;
/** How far ahead a kitchen will take a booking. */
export const SCHEDULE_HORIZON_DAYS = 7;

/** A kitchen may charge up to $20 to jump the queue. Zero means it does not. */
export const MAX_PRIORITY_FEE_CENTS = 2_000;

const MINUTE = 60_000;

/** Round up to the next quarter hour, dropping seconds. */
export function ceilToStep(at: Date, stepMinutes = SCHEDULE_STEP_MINUTES): Date {
  const step = stepMinutes * MINUTE;
  return new Date(Math.ceil(at.getTime() / step) * step);
}

/** The window a buyer may book inside, given the clock right now. */
export function scheduleBounds(now: Date): { earliest: Date; latest: Date } {
  return {
    earliest: ceilToStep(new Date(now.getTime() + SCHEDULE_LEAD_MINUTES * MINUTE)),
    latest: new Date(now.getTime() + SCHEDULE_HORIZON_DAYS * 24 * 60 * MINUTE),
  };
}

export type ScheduleCheck = { at: Date } | { error: string };

/**
 * Validate a requested pickup instant.
 *
 * Every real IANA offset is a whole number of quarter hours, so checking the
 * step against UTC is the same check as against the buyer's wall clock — which
 * is what lets the browser send a plain instant and the database agree.
 */
export function checkScheduledFor(value: unknown, now: Date): ScheduleCheck {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return { error: "Choose a pickup date and time." };
  }
  if (value.getUTCSeconds() !== 0 || value.getUTCMilliseconds() !== 0) {
    return { error: "Pickup times run in 15-minute steps." };
  }
  if (value.getUTCMinutes() % SCHEDULE_STEP_MINUTES !== 0) {
    return { error: "Pickup times run in 15-minute steps." };
  }

  // Compared against the raw lead time rather than the rounded `earliest`, so
  // the message names the rule the buyer actually broke. A value already proven
  // to sit on a step boundary and at or after now+lead is at or after
  // `earliest` by construction, so there is nothing further to check.
  if (value.getTime() < now.getTime() + SCHEDULE_LEAD_MINUTES * MINUTE) {
    return { error: `Choose a pickup time at least ${SCHEDULE_LEAD_MINUTES} minutes from now.` };
  }
  if (value.getTime() > scheduleBounds(now).latest.getTime()) {
    return { error: `Scheduled pickups can be up to ${SCHEDULE_HORIZON_DAYS} days ahead.` };
  }
  return { at: value };
}

/** Parse the value a `datetime-local` input posts. Empty means "as soon as possible". */
export function parseScheduledFor(raw: unknown, now: Date): ScheduleCheck | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text) return null;
  return checkScheduledFor(new Date(text), now);
}

/** Minutes a cook typed, or null when it is not a usable number. */
export function parsePrepMinutes(raw: unknown): number | null {
  const text = String(raw ?? "").trim();
  if (!/^\d{1,3}$/.test(text)) return null;
  const minutes = Number(text);
  if (minutes < PREP_MIN_MINUTES || minutes > PREP_MAX_MINUTES) return null;
  return minutes;
}

/**
 * A dollars-and-cents priority price, in cents. Zero is valid and means the
 * kitchen has withdrawn the offer.
 */
export function parsePriorityFeeCents(raw: unknown): number | null {
  const text = String(raw ?? "").trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) return null;
  const [dollars, fraction = ""] = text.split(".");
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
  return cents <= MAX_PRIORITY_FEE_CENTS ? cents : null;
}

/**
 * When the food should be ready.
 *
 * A scheduled order is ready at the time the buyer booked — the cook works
 * backwards from it — so the cooking estimate does not move that time, it only
 * decides when the cook has to start.
 */
export function readyEstimateAt(
  from: Date,
  prepMinutes: number,
  scheduledFor: Date | null,
): Date {
  if (scheduledFor) return scheduledFor;
  return new Date(from.getTime() + prepMinutes * MINUTE);
}

/** When a cook has to start cooking to make a scheduled pickup. */
export function startByAt(scheduledFor: Date, prepMinutes: number): Date {
  return new Date(scheduledFor.getTime() - prepMinutes * MINUTE);
}

/**
 * Is this order the cook's problem right now?
 *
 * A scheduled order sits out of the live queue until its cooking time begins,
 * which is the whole point of scheduling: a 6pm booking in a 10am queue is
 * indistinguishable from something to cook immediately.
 */
export function isDueNow(
  order: { scheduled_for: string | null; prep_minutes: number | null },
  now: Date,
  fallbackPrepMinutes: number,
): boolean {
  if (!order.scheduled_for) return true;
  const at = new Date(order.scheduled_for);
  if (Number.isNaN(at.getTime())) return true;
  const prep = order.prep_minutes ?? fallbackPrepMinutes;
  return startByAt(at, prep).getTime() <= now.getTime();
}

/**
 * Queue order for the cook: paid priority first, then oldest first.
 *
 * This is the entire thing a priority fee buys, and it is why the buyer-facing
 * copy says the cook sees it first rather than promising a time — Dishd does
 * not control anybody's oven.
 */
export function compareQueue(
  a: { priority_fee_cents: number | null; created_at: string },
  b: { priority_fee_cents: number | null; created_at: string },
): number {
  const priority = Number(b.priority_fee_cents ?? 0) - Number(a.priority_fee_cents ?? 0);
  if (priority !== 0) return priority;
  return a.created_at.localeCompare(b.created_at);
}

/** "6:40 PM" */
export function formatClock(at: Date): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(at);
}

/** "6:40 PM" today, "Sat 6:40 PM" otherwise. */
export function formatPickupMoment(at: Date, now: Date): string {
  const sameDay =
    at.getFullYear() === now.getFullYear() &&
    at.getMonth() === now.getMonth() &&
    at.getDate() === now.getDate();
  if (sameDay) return formatClock(at);
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(at);
  return `${weekday} ${formatClock(at)}`;
}

/** "in 25 minutes", "in about 2 hours", "any moment now". */
export function formatCountdown(at: Date, now: Date): string {
  const minutes = Math.round((at.getTime() - now.getTime()) / MINUTE);
  if (minutes <= 0) return "any moment now";
  if (minutes === 1) return "in about a minute";
  if (minutes < 60) return `in about ${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in about ${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.round(hours / 24);
  return `in about ${days} ${days === 1 ? "day" : "days"}`;
}

/**
 * The value a `datetime-local` input expects: local wall time, no timezone.
 * Built by hand because toISOString() would shift it into UTC.
 */
export function toLocalInputValue(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}` +
    `T${pad(at.getHours())}:${pad(at.getMinutes())}`
  );
}
