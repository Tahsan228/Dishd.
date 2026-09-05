"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Minus, Plus, ShoppingBag, TriangleAlert } from "lucide-react";
import { useCart } from "@/components/market/use-cart";
import { placeOrder, type PlaceOrderState } from "@/lib/market/order-actions";
import { ACKNOWLEDGMENTS } from "@/lib/market/order-consent";
import { MAX_QTY_PER_ITEM } from "@/lib/market/cart";
import { formatCents } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Cart review and checkout.
 *
 * The cart lives in the browser, so quantities are posted as the same
 * `qty_<menuItemId>` fields the order action already expects — it re-reads
 * every price and re-checks sourcing server-side, so nothing here is trusted.
 *
 * The cart is deliberately NOT cleared on submit: `placeOrder` redirects on
 * success, and clearing optimistically would lose the buyer's basket on any
 * error. Clearing happens on the order page instead.
 */
export function Checkout({
  cardUnavailableReason,
}: {
  cardUnavailableReason: string | null;
}) {
  const { cart, ready, subtotal, setQty } = useCart();
  const [state, action, pending] = useActionState<PlaceOrderState, FormData>(placeOrder, null);
  // Consent is re-affirmed per kitchen, so it is stored against the kitchen it
  // was given for and derived during render — switching carts drops it without
  // an effect having to reset anything.
  const [ackState, setAckState] = useState<{
    kitchenId: string;
    acks: Record<string, boolean>;
  }>({ kitchenId: "", acks: {} });

  const acks = ackState.kitchenId === cart?.kitchenId ? ackState.acks : {};
  const setAcks = (next: Record<string, boolean>) =>
    setAckState({ kitchenId: cart?.kitchenId ?? "", acks: next });

  if (!ready) {
    return <p className="mt-8 text-sm text-ink-muted">Loading your cart…</p>;
  }

  if (!cart) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-line bg-surface-sunk p-12 text-center">
        <ShoppingBag className="mx-auto h-7 w-7 text-ink-muted" aria-hidden />
        <p className="mt-3 text-ink-muted">Your cart is empty.</p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-full bg-forest px-5 py-2.5 text-sm font-medium text-cream hover:bg-forest-deep"
        >
          Browse kitchens
        </Link>
      </div>
    );
  }

  const allAcked = ACKNOWLEDGMENTS.every((a) => acks[a.key]);

  return (
    <form action={action} className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
      <input type="hidden" name="kitchenId" value={cart.kitchenId} />
      <input type="hidden" name="slug" value={cart.kitchenSlug} />
      {cart.lines.map((line) => (
        <input key={line.itemId} type="hidden" name={`qty_${line.itemId}`} value={line.qty} />
      ))}

      <div>
        <h2 className="font-display text-xl text-forest">
          Pickup from{" "}
          <Link href={`/k/${cart.kitchenSlug}`} className="underline underline-offset-2">
            {cart.kitchenName}
          </Link>
        </h2>

        <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
          {cart.lines.map((line) => (
            <li key={line.itemId} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{line.name}</p>
                <p className="tabular mt-0.5 text-xs text-ink-muted">
                  {formatCents(line.priceCents)} each
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <div className="flex items-center gap-1 rounded-lg border border-line">
                  <button
                    type="button"
                    onClick={() => setQty(line.itemId, line.qty - 1)}
                    aria-label={line.qty === 1 ? `Remove ${line.name}` : `One fewer ${line.name}`}
                    className="grid h-9 w-9 place-items-center rounded-l-lg text-forest hover:bg-forest-soft"
                  >
                    <Minus className="h-4 w-4" aria-hidden />
                  </button>
                  <span className="tabular w-7 text-center text-sm">{line.qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty(line.itemId, line.qty + 1)}
                    disabled={line.qty >= MAX_QTY_PER_ITEM}
                    aria-label={`One more ${line.name}`}
                    className="grid h-9 w-9 place-items-center rounded-r-lg text-forest hover:bg-forest-soft disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <span className="tabular w-16 text-right text-sm text-ink">
                  {formatCents(line.priceCents * line.qty)}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <fieldset className="mt-6 space-y-2 rounded-xl bg-surface-sunk p-4">
          <legend className="px-1 text-xs font-medium text-ink">Before you order</legend>
          {ACKNOWLEDGMENTS.map((a) => (
            <label
              key={a.key}
              className="flex cursor-pointer gap-2.5 text-xs leading-relaxed text-ink-muted"
            >
              <input
                type="checkbox"
                name={`ack_${a.key}`}
                checked={acks[a.key] ?? false}
                onChange={(e) => setAcks({ ...acks, [a.key]: e.target.checked })}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-forest)]"
              />
              <span>{a.text}</span>
            </label>
          ))}
          <p className="px-1 pt-1 text-[11px] text-ink-muted">
            Each acceptance is recorded separately. Read the{" "}
            <Link href="/legal/terms" className="underline underline-offset-2">terms</Link>.
          </p>
        </fieldset>
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-display text-xl text-forest">Payment</h2>

          <fieldset className="mt-3">
            <legend className="sr-only">Pay by</legend>
            <div className="flex gap-2">
              <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line px-3 py-2.5 text-sm has-checked:border-forest has-checked:bg-forest-soft">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cash"
                  defaultChecked
                  className="accent-[var(--color-forest)]"
                />
                Cash at pickup
              </label>
              <label
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg border border-line px-3 py-2.5 text-sm",
                  cardUnavailableReason
                    ? "opacity-40"
                    : "cursor-pointer has-checked:border-forest has-checked:bg-forest-soft",
                )}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="card"
                  disabled={Boolean(cardUnavailableReason)}
                  className="accent-[var(--color-forest)]"
                />
                Card
              </label>
            </div>
            {cardUnavailableReason && (
              <p className="mt-1.5 text-xs text-ink-muted">{cardUnavailableReason}</p>
            )}
          </fieldset>

          <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
            <span className="text-sm text-ink-muted">Total</span>
            <span className="tabular font-display text-2xl text-forest">
              {formatCents(subtotal)}
            </span>
          </div>

          {state?.error && (
            <p className="rise mt-3 flex items-start gap-2 rounded-lg border border-clay/30 bg-clay/10 p-3 text-xs text-clay">
              <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{state.error}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={pending || !allAcked}
            className="mt-4 min-h-11 w-full rounded-full bg-forest px-4 text-sm font-medium text-cream hover:bg-forest-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Placing your order…" : "Place order"}
          </button>

          {!allAcked && (
            <p className="mt-2 text-center text-[11px] text-ink-muted">
              Accept all three statements to continue.
            </p>
          )}

          <p className="mt-3 text-center text-[11px] leading-relaxed text-ink-muted">
            The cook confirms before cooking. The exact address is shared once
            they accept.
          </p>
        </div>
      </aside>
    </form>
  );
}
