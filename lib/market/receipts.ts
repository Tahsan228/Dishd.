/**
 * Chain of Trust — receipt verification.
 *
 * Receipts are not machine-read. The cook declares what is on the receipt and
 * uploads the image as evidence. Everything in this file is deterministic and
 * costs nothing to run:
 *
 *   - a receipt image cannot be submitted twice, by anyone
 *   - a (store, date, total) triple cannot be submitted twice, by anyone
 *   - the store must be one the kitchen has actually registered
 *   - the purchase must be recent, and cannot be in the future
 *
 * Those are the checks that catch real cheating. What a human reviewer adds is
 * the one judgement a machine was doing before: does the uploaded image
 * actually say what the cook typed. So a failed check here is an immediate,
 * on-screen rejection, and a passed check means "pending review", not
 * "verified".
 *
 * Nothing here calls an external API.
 */

import type { MeatType } from "@/lib/types";

/** A batch stops backing menu items this many days after purchase. */
export const RECEIPT_FRESHNESS_DAYS = 7;

/** How long a cook's declared purchase may predate the upload. */
export const MAX_RECEIPT_AGE_DAYS = 7;

export type ReceiptDeclaration = {
  /** One of the kitchen's registered halal sources. null = "not listed". */
  halalSourceId: string | null;
  storeName: string;
  /** ISO date (YYYY-MM-DD) the cook says the purchase happened. */
  purchaseDate: string;
  totalCents: number;
  meatTypes: MeatType[];
};

export type CheckResult = {
  code: string;
  label: string;
  passed: boolean;
  detail: string;
};

/** Registered source, as far as the checks care. */
export type RegisteredSource = { id: string; store_name: string };

function daysBetween(a: Date, b: Date): number {
  const MS = 24 * 60 * 60 * 1000;
  const da = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const db = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((da - db) / MS);
}

/**
 * Normalise a store name for comparison: case, punctuation and spacing are
 * noise. "Al-Salam Halal Meats" and "al salam halal meats" are the same store.
 */
export function normaliseStore(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * The checks that need no database. Pure — unit-test this directly.
 *
 * `now` is injectable so tests can pin the date.
 */
export function runLocalChecks(
  declaration: ReceiptDeclaration,
  sources: RegisteredSource[],
  now: Date = new Date(),
): CheckResult[] {
  const checks: CheckResult[] = [];

  // 1. The store must be one this kitchen registered as a halal source.
  //    This is the check that rejects a receipt from an unregistered shop.
  const matched = declaration.halalSourceId
    ? sources.find((s) => s.id === declaration.halalSourceId)
    : sources.find(
        (s) => normaliseStore(s.store_name) === normaliseStore(declaration.storeName),
      );

  checks.push({
    code: "source_registered",
    label: "Store is a registered halal source",
    passed: Boolean(matched),
    detail: matched
      ? `Matched "${matched.store_name}"`
      : `"${declaration.storeName}" is not one of this kitchen's registered halal sources`,
  });

  // 2. Freshness. Meat bought three weeks ago cannot back today's menu.
  const purchase = new Date(`${declaration.purchaseDate}T00:00:00`);
  const validDate = !Number.isNaN(purchase.getTime());
  const age = validDate ? daysBetween(now, purchase) : NaN;

  checks.push({
    code: "date_valid",
    label: "Purchase date is usable",
    passed: validDate && age >= 0,
    detail: !validDate
      ? "Not a valid date"
      : age < 0
        ? "Purchase date is in the future"
        : `Purchased ${age === 0 ? "today" : `${age} day${age === 1 ? "" : "s"} ago`}`,
  });

  checks.push({
    code: "freshness",
    label: `Purchased within ${MAX_RECEIPT_AGE_DAYS} days`,
    passed: validDate && age >= 0 && age <= MAX_RECEIPT_AGE_DAYS,
    detail:
      validDate && age > MAX_RECEIPT_AGE_DAYS
        ? `${age} days old — too old to back a menu item`
        : `Within the ${MAX_RECEIPT_AGE_DAYS}-day window`,
  });

  // 3. A sourcing batch exists to back meat. It must name meat.
  checks.push({
    code: "meat_declared",
    label: "Receipt covers meat",
    passed: declaration.meatTypes.length > 0,
    detail:
      declaration.meatTypes.length > 0
        ? declaration.meatTypes.join(", ")
        : "No meat declared on this receipt",
  });

  // 4. A zero total is either a typo or not a purchase.
  checks.push({
    code: "total_present",
    label: "Receipt total recorded",
    passed: declaration.totalCents > 0,
    detail:
      declaration.totalCents > 0
        ? `$${(declaration.totalCents / 100).toFixed(2)}`
        : "No total entered",
  });

  return checks;
}

/**
 * The date after which this batch stops backing menu items.
 * Returns an ISO date string.
 */
export function backsItemsUntil(purchaseDate: string): string {
  const d = new Date(`${purchaseDate}T00:00:00`);
  d.setDate(d.getDate() + RECEIPT_FRESHNESS_DAYS);
  return d.toISOString().slice(0, 10);
}

export function allPassed(checks: CheckResult[]): boolean {
  return checks.every((c) => c.passed);
}

export function failureReasons(checks: CheckResult[]): string[] {
  return checks.filter((c) => !c.passed).map((c) => c.detail);
}
