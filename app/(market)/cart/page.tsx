import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/market/site-header";
import { Checkout } from "@/components/market/checkout";
import { currentProfile } from "@/lib/market/auth-actions";
import { cardAvailability } from "@/lib/market/payments";
import { stripeConfigured } from "@/lib/market/stripe";

export const metadata: Metadata = {
  title: "Your cart · Dishd",
};

export default async function CartPage() {
  // Ordering needs an account: the order, the consent record and the resulting
  // review all hang off a buyer id.
  if (!(await currentProfile())) redirect("/signin?next=%2Fcart");

  const supabase=await createServerClient();
  const {data:rewards}=await supabase.from("reward_redemptions").select("id,credit_cents,minimum_order_cents").eq("status","available");

  /**
   * Which kitchen is in the cart is only known in the browser, so this answers
   * the platform-level half: does this deployment have Stripe at all. The
   * per-kitchen onboarding check still runs in `placeOrder`, which is the
   * boundary that decides — so a cook who has not finished setup is refused
   * there with their own message rather than here with a generic one.
   */
  const { reason } = cardAvailability(
    { accepts_card: true, stripe_onboarded: true },
    stripeConfigured(),
  );

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-8 sm:px-6">
        <h1 className="font-display text-3xl text-forest">Your cart</h1>
        <Checkout cardUnavailableReason={reason} rewards={rewards??[]} />
      </main>
    </>
  );
}
