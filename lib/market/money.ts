/** All persisted amounts are integer US cents. Tips never enter the fee base. */
export const MAX_TIP_CENTS = 10_000;
export const MIN_CARD_CHARGE_CENTS = 50;

export function parseTipCents(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{1,3}(\.\d{1,2})?$/.test(value)) return null;
  const [dollars, fraction = ""] = value.split(".");
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
  return cents <= MAX_TIP_CENTS ? cents : null;
}

export function cashCommissionCents(foodCents: number): number {
  if (!Number.isSafeInteger(foodCents) || foodCents < 0) throw new Error("Invalid food amount");
  return Math.floor((foodCents + 10) / 20);
}
