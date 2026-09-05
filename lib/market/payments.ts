import type { PaymentMethod } from "@/lib/types";

/**
 * What Dishd can actually take money with.
 *
 * Card checkout is implemented (see lib/market/stripe.ts), but three things
 * still have to be true before the option is offered, and each has a different
 * cause, so each gets its own sentence:
 *
 *   1. The deployment has a Stripe key at all.
 *   2. The cook has switched card on.
 *   3. The cook has finished payment setup.
 *
 * Offering a payment method that cannot take payment is worse than not offering
 * one, so any of these failing hides card rather than letting an order be
 * placed that nothing will ever charge.
 *
 * `stripeConfigured` is a parameter rather than an env read so this stays a
 * pure function: the server passes what it knows, and the tests pass both.
 */

export type CardAvailability = {
  /** Whether the buyer may choose card for this kitchen right now. */
  available: boolean;
  /** Why not, in words a buyer can read. Null when available. */
  reason: string | null;
};

export function cardAvailability(
  kitchen: { accepts_card: boolean; stripe_onboarded: boolean },
  stripeConfigured: boolean,
): CardAvailability {
  if (!stripeConfigured) {
    return { available: false, reason: "Card payment isn’t set up here — pay cash at pickup." };
  }
  if (!kitchen.accepts_card) {
    return { available: false, reason: "This cook hasn’t set up card payments yet." };
  }
  if (!kitchen.stripe_onboarded) {
    return { available: false, reason: "This cook is still finishing payment setup." };
  }
  return { available: true, reason: null };
}

/**
 * Server-side gate for a posted payment method. The radio being disabled in the
 * UI is a hint, not a control — a form post can name any method it likes.
 */
export function paymentMethodError(
  method: PaymentMethod,
  kitchen: { accepts_card: boolean; stripe_onboarded: boolean; accepts_cash?: boolean },
  stripeConfigured: boolean,
): string | null {
  if (method === "card") return cardAvailability(kitchen, stripeConfigured).reason;
  if (kitchen.accepts_cash === false) return "This cook doesn’t take cash.";
  return null;
}
