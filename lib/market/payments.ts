import type { PaymentMethod } from "@/lib/types";

/**
 * What Dishd can actually take money with today.
 *
 * The `stripe` package is installed, STRIPE_SECRET_KEY is checked by
 * `npm run check:env`, and `kitchens` carries accepts_card / stripe_onboarded —
 * but no checkout session is ever created and no webhook is handled. Until that
 * exists, a card order would be placed with payment_status 'unpaid', the buyer
 * would be shown "Total · card" and would reasonably believe they had paid, and
 * the cook would hand over food expecting to have been paid. Nothing in the
 * system would ever charge anyone.
 *
 * Offering a payment method that does not take payment is worse than not
 * offering it, so card is switched off at the source rather than left looking
 * available. Cash at pickup is a complete payment method for a pickup
 * marketplace; this is a smaller product, not a broken one.
 *
 * To turn card on: implement checkout + the webhook that moves payment_status
 * to 'paid', then flip this to true. `cardAvailability` already carries the
 * per-kitchen onboarding check that will still apply.
 */
export const CARD_CHECKOUT_IMPLEMENTED = false;

export type CardAvailability = {
  /** Whether the buyer may choose card for this kitchen right now. */
  available: boolean;
  /** Why not, in words a buyer can read. Null when available. */
  reason: string | null;
};

export function cardAvailability(kitchen: {
  accepts_card: boolean;
  stripe_onboarded: boolean;
}): CardAvailability {
  if (!CARD_CHECKOUT_IMPLEMENTED) {
    return { available: false, reason: "Card payment isn’t available yet — pay cash at pickup." };
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
): string | null {
  if (method === "card") return cardAvailability(kitchen).reason;
  if (kitchen.accepts_cash === false) return "This cook doesn’t take cash.";
  return null;
}
