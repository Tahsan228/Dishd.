import Stripe from "stripe";

/**
 * Stripe, server-side only.
 *
 * NEVER import this from a client component. STRIPE_SECRET_KEY is a
 * full-access credential; it has no NEXT_PUBLIC_ prefix, so it would arrive as
 * undefined in the browser rather than leaking, but the import would still pull
 * the SDK into the client bundle and every call would throw. Server Components,
 * server actions and route handlers only.
 *
 * The client is created lazily so the whole app still boots without a Stripe
 * key — card is simply unavailable, which is what `cardAvailability` reports.
 */
let client: Stripe | null = null;

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!client) client = new Stripe(key);
  return client;
}

/**
 * Absolute base for Stripe's return URLs; Stripe will not accept a relative one.
 *
 * NEXT_PUBLIC_APP_URL wins where it is set, because a deployment that knows its
 * own address should say so. The Vercel fallbacks exist so that forgetting it
 * does not silently send a paying buyer to localhost: VERCEL_URL is the address
 * of the deployment actually serving the request, which is also what makes a
 * preview deployment return to itself rather than to production.
 *
 * Note for whoever changes it: NEXT_PUBLIC_ variables are inlined at build
 * time, so editing that one in the dashboard does nothing until a redeploy.
 * The VERCEL_ ones are read at runtime.
 */
export function appUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const host =
    process.env.VERCEL_ENV === "production"
      ? (process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL)
      : process.env.VERCEL_URL;
  if (host) return `https://${host.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;

  return "http://localhost:3000";
}

export type CheckoutLine = { name: string; unitAmountCents: number; qty: number };

/**
 * A Checkout Session for one order.
 *
 * The order id travels in `metadata` and in `client_reference_id` so both the
 * webhook and the return path can tie a payment back to a row without trusting
 * anything the browser hands us.
 *
 * Payment lands in the platform account. Paying the cook out is Stripe Connect
 * work that does not exist yet — `kitchens.stripe_account_id` is still unused —
 * so a card order today is money Dishd holds and owes the cook, not a
 * settled transfer. Cash remains the only path that fully settles.
 */
export async function createCheckoutSession(params: {
  orderId: string;
  kitchenName: string;
  buyerEmail: string | null;
  lines: CheckoutLine[];
}): Promise<{ id: string; url: string | null }> {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    // Pickup only: there is nothing to ship, so no address is collected.
    line_items: params.lines.map((line) => ({
      quantity: line.qty,
      price_data: {
        currency: "usd",
        unit_amount: line.unitAmountCents,
        product_data: { name: line.name },
      },
    })),
    client_reference_id: params.orderId,
    metadata: { kind: "order", orderId: params.orderId },
    payment_intent_data: {
      metadata: { orderId: params.orderId },
      description: `Dishd pickup from ${params.kitchenName}`,
    },
    customer_email: params.buyerEmail ?? undefined,
    success_url: `${appUrl()}/order/${params.orderId}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/cart?cancelled=1`,
  });

  return { id: session.id, url: session.url };
}
