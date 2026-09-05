import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/market/site-header";
import { Checkout } from "@/components/market/checkout";
import { currentProfile } from "@/lib/market/auth-actions";
import { cardAvailability } from "@/lib/market/payments";

export const metadata: Metadata = {
  title: "Your cart · Dishd",
};

export default async function CartPage() {
  // Ordering needs an account: the order, the consent record and the resulting
  // review all hang off a buyer id.
  if (!(await currentProfile())) redirect("/signin?next=%2Fcart");

  /**
   * Which kitchen is in the cart is only known in the browser, so this is the
   * platform-level answer: card checkout is not implemented, so the reason is
   * the same for every kitchen. When it ships, the per-kitchen onboarding check
   * still runs in `placeOrder`, which is the boundary that decides.
   */
  const { reason } = cardAvailability({ accepts_card: true, stripe_onboarded: true });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-8 sm:px-6">
        <h1 className="font-display text-3xl text-forest">Your cart</h1>
        <Checkout cardUnavailableReason={reason} />
      </main>
    </>
  );
}
