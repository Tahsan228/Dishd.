import { describe, expect, it } from "vitest";
import { cardAvailability, paymentMethodError } from "./payments";

const onboarded = { accepts_card: true, stripe_onboarded: true, accepts_cash: true };

describe("card availability", () => {
  it("offers card only when Stripe is configured and the cook is ready", () => {
    const { available, reason } = cardAvailability(onboarded, true);
    expect(available).toBe(true);
    expect(reason).toBeNull();
  });

  it("refuses card on a deployment with no Stripe key", () => {
    // Otherwise an order would be taken that nothing could ever charge.
    const { available, reason } = cardAvailability(onboarded, false);
    expect(available).toBe(false);
    expect(reason).toMatch(/cash at pickup/i);
  });

  it("refuses card for a cook who has not switched it on", () => {
    const { available, reason } = cardAvailability(
      { accepts_card: false, stripe_onboarded: true },
      true,
    );
    expect(available).toBe(false);
    expect(reason).toMatch(/hasn’t set up card/i);
  });

  it("refuses card for a cook mid-setup", () => {
    const { available, reason } = cardAvailability(
      { accepts_card: true, stripe_onboarded: false },
      true,
    );
    expect(available).toBe(false);
    expect(reason).toMatch(/finishing payment setup/i);
  });

  it("always explains itself rather than silently hiding the option", () => {
    const cases = [
      [onboarded, false],
      [{ accepts_card: false, stripe_onboarded: false }, true],
      [{ accepts_card: true, stripe_onboarded: false }, true],
    ] as const;
    for (const [kitchen, configured] of cases) {
      const { available, reason } = cardAvailability(kitchen, configured);
      expect(available).toBe(false);
      expect(reason).toBeTruthy();
    }
  });
});

describe("paymentMethodError", () => {
  it("rejects a posted card order whenever card is not actually available", () => {
    // The disabled radio is a hint; the post is the attack surface.
    expect(paymentMethodError("card", onboarded, false)).toBeTruthy();
    expect(
      paymentMethodError("card", { accepts_card: false, stripe_onboarded: false }, true),
    ).toBeTruthy();
  });

  it("allows a card order once everything is in place", () => {
    expect(paymentMethodError("card", onboarded, true)).toBeNull();
  });

  it("accepts cash regardless of Stripe", () => {
    expect(paymentMethodError("cash", onboarded, false)).toBeNull();
    expect(paymentMethodError("cash", onboarded, true)).toBeNull();
  });

  it("rejects cash at a kitchen that does not take it", () => {
    expect(paymentMethodError("cash", { ...onboarded, accepts_cash: false }, true)).toBe(
      "This cook doesn’t take cash.",
    );
  });

  it("treats an unspecified accepts_cash as taking cash", () => {
    expect(
      paymentMethodError("cash", { accepts_card: false, stripe_onboarded: false }, true),
    ).toBeNull();
  });
});
