"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useCart } from "@/components/market/use-cart";
import { lineQty, MAX_QTY_PER_ITEM } from "@/lib/market/cart";

/**
 * Per-dish quantity control.
 *
 * Collapses to a single "Add" button until there is something in the cart, then
 * becomes a stepper — the Uber Eats pattern, and it keeps the menu quiet until
 * the buyer has actually chosen.
 */
export function AddToCart({
  kitchen,
  item,
  disabled,
  disabledReason,
}: {
  kitchen: { id: string; name: string; slug: string };
  item: { id: string; name: string; priceCents: number };
  disabled?: boolean;
  disabledReason?: string;
}) {
  const { cart, ready, add, setQty } = useCart();
  const [replaced, setReplaced] = useState<string | null>(null);
  const qty = lineQty(cart, item.id);

  if (disabled) {
    return (
      <p className="mt-3 text-xs text-ink-muted">{disabledReason ?? "Not available today."}</p>
    );
  }

  // Until storage has been read the true quantity is unknown; render the
  // neutral state rather than briefly claiming the cart is empty.
  if (!ready) {
    return (
      <div className="mt-3 h-11" aria-hidden />
    );
  }

  if (qty === 0) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={() => {
            const { replacedKitchen } = add(kitchen, item, 1);
            setReplaced(replacedKitchen);
          }}
          className="min-h-11 w-full rounded-lg border border-forest bg-forest px-4 text-sm font-semibold text-cream hover:bg-forest-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          Add to cart
        </button>
        {replaced && (
          <p role="status" className="mt-2 text-xs text-amber">
            Your cart from {replaced} was replaced — an order is one pickup from
            one kitchen.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-forest bg-forest-soft px-2 py-1.5">
      <button
        type="button"
        onClick={() => setQty(item.id, qty - 1)}
        aria-label={qty === 1 ? `Remove ${item.name}` : `One fewer ${item.name}`}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface text-forest hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        <Minus className="h-4 w-4" aria-hidden />
      </button>

      <span className="tabular text-sm font-semibold text-forest" aria-live="polite">
        {qty} in cart
      </span>

      <button
        type="button"
        onClick={() => setQty(item.id, qty + 1)}
        disabled={qty >= MAX_QTY_PER_ITEM}
        aria-label={`One more ${item.name}`}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface text-forest hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-40"
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
