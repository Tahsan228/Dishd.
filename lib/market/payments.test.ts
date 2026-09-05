import { describe, expect, it } from "vitest";
import { CARD_CHECKOUT_IMPLEMENTED, cardAvailability, paymentMethodError } from "./payments";

const onboarded = { accepts_card: true, stripe_onboarded: true, accepts_cash: true };

describe("card availability", () => {
  it("is off while no checkout session is ever created", () => {
    // Guards the invariant that matters: nothing in the app calls Stripe, so
    // offering card would take an order and never charge for it. This flips
    // only together with a real checkout and webhook.
    expect(CARD_CHECKOUT_IMPLEMENTED).toBe(false);
  });

  it("refuses card even for a fully onboarded kitchen", () => {
    const result = cardAvailability(onboarded);
    expect(result.available).toBe(false);
    expect(result.reason).toMatch(/cash at pickup/i);
  });

  it("always explains itself rather than silently hiding the option", () => {
    for (const kitchen of [
      onboarded,
      { accepts_card: false, stripe_onboarded: false },
      { accepts_card: true, stripe_onboarded: false },
    ]) {
      const { available, reason } = cardAvailability(kitchen);
      expect(available).toBe(false);
      expect(reason).toBeTruthy();
    }
  });
});

describe("paymentMethodError", () => {
  it("rejects a posted card order regardless of what the form claimed", () => {
    // The disabled radio is a hint; the post is the attack surface.
    expect(paymentMethodError("card", onboarded)).toBeTruthy();
    expect(paymentMethodError("card", { accepts_card: false, stripe_onboarded: false })).toBeTruthy();
  });

  it("accepts cash, which is the method that actually works", () => {
    expect(paymentMethodError("cash", onboarded)).toBeNull();
  });

  it("rejects cash at a kitchen that does not take it", () => {
    expect(
      paymentMethodError("cash", { ...onboarded, accepts_cash: false }),
    ).toBe("This cook doesn’t take cash.");
  });

  it("treats an unspecified accepts_cash as taking cash", () => {
    expect(paymentMethodError("cash", { accepts_card: false, stripe_onboarded: false })).toBeNull();
  });
});
