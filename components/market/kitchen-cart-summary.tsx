"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/components/market/use-cart";
import { formatCents } from "@/lib/utils";

/**
 * The kitchen-page cart panel.
 *
 * Only shows this kitchen's cart. If the buyer has a cart from somewhere else
 * it stays hidden here rather than showing a total that has nothing to do with
 * the page they are reading.
 */
export function KitchenCartSummary({
  kitchenId,
  signedIn,
  slug,
}: {
  kitchenId: string;
  signedIn: boolean;
  slug: string;
}) {
  const { cart, ready, subtotal, setQty } = useCart();
  if (!ready || !cart || cart.kitchenId !== kitchenId) return null;

  return (
    <section className="rounded-2xl border border-forest/30 bg-surface p-5">
      <h2 className="flex items-center gap-2 font-display text-xl text-forest">
        <ShoppingBag className="h-5 w-5" aria-hidden />
        Your order
      </h2>

      <ul className="mt-3 space-y-2">
        {cart.lines.map((line) => (
          <li key={line.itemId} className="flex items-start justify-between gap-3 text-sm">
            <span className="min-w-0">
              <span className="text-ink">
                {line.qty} × {line.name}
              </span>
              <button
                type="button"
                onClick={() => setQty(line.itemId, 0)}
                className="mt-0.5 block text-xs text-ink-muted underline-offset-2 hover:text-clay hover:underline"
              >
                Remove
              </button>
            </span>
            <span className="tabular shrink-0 text-ink">
              {formatCents(line.priceCents * line.qty)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <span className="text-sm text-ink-muted">Subtotal</span>
        <span className="tabular font-display text-xl text-forest">{formatCents(subtotal)}</span>
      </div>

      <Link
        href={signedIn ? "/cart" : `/signin?next=${encodeURIComponent(`/k/${slug}`)}`}
        className="mt-4 flex min-h-11 w-full items-center justify-center rounded-full bg-forest px-4 text-sm font-medium text-cream hover:bg-forest-deep"
      >
        {signedIn ? "Review and check out" : "Sign in to order"}
      </Link>
    </section>
  );
}
