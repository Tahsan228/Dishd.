import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe, stripeConfigured } from "@/lib/market/stripe";
import { markOrderPaid } from "@/lib/market/payment-settlement";

/**
 * Stripe webhook — the authoritative record that an order was paid.
 *
 * This endpoint is public, so the signature check is the only thing standing
 * between it and anyone who can POST JSON. Without STRIPE_WEBHOOK_SECRET the
 * route refuses every request rather than trusting the body: an unsigned
 * "payment succeeded" would let anyone mark any order paid and collect food.
 *
 * Locally, Stripe cannot reach localhost, so nothing calls this during a demo.
 * The order page confirms the session directly with Stripe on return instead,
 * which covers the same ground for a single buyer. This route is what makes it
 * correct in production, where a buyer who closes the tab before redirecting
 * still gets their order marked paid.
 *
 *   stripe listen --forward-to localhost:3001/api/stripe/webhook
 */
export async function POST(request: NextRequest) {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not set; refusing unsigned events" },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // The raw body is required: the signature is computed over the exact bytes,
  // so parsing to JSON first would break verification.
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(body, signature, secret);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Signature verification failed: ${detail}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId ?? session.client_reference_id;

    // `complete` can still be unpaid for delayed methods; only settle on paid.
    if (orderId && session.payment_status === "paid") {
      await markOrderPaid(orderId, session.id);
    }
  }

  // Anything else is acknowledged so Stripe stops retrying it.
  return NextResponse.json({ received: true });
}
