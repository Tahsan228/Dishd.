"use client";

import { useActionState, useState } from "react";
import { Minus, Plus, ShoppingBag, TriangleAlert } from "lucide-react";
import { placeOrder, type PlaceOrderState } from "@/lib/market/order-actions";
import { ACKNOWLEDGMENTS } from "@/lib/market/order-consent";
import { formatCents } from "@/lib/utils";

export type OrderableItem = {
  id: string;
  name: string;
  price_cents: number;
  contains_meat: boolean;
};

export function OrderPanel({
  kitchenId,
  slug,
  items,
  acceptsCard,
  signedIn,
}: {
  kitchenId: string;
  slug: string;
  items: OrderableItem[];
  acceptsCard: boolean;
  signedIn: boolean;
}) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [state, action, pending] = useActionState<PlaceOrderState, FormData>(placeOrder, null);

  const bump = (id: string, by: number) =>
    setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(6, (q[id] ?? 0) + by)) }));

  const subtotal = items.reduce((s, i) => s + (qty[i.id] ?? 0) * i.price_cents, 0);
  const count = Object.values(qty).reduce((a, b) => a + b, 0);

  return (
    <form id="order" action={action} className="rounded-xl border border-line bg-surface p-4 scroll-mt-24">
      <input type="hidden" name="kitchenId" value={kitchenId} />
      <input type="hidden" name="slug" value={slug} />

      <h3 className="flex items-center gap-2 font-display text-lg text-forest">
        <ShoppingBag className="h-4 w-4" aria-hidden />
        Your order
      </h3>

      <ul className="mt-3 space-y-2">
        {items.map((it) => (
          <li key={it.id} className="flex items-center justify-between gap-3">
            <input type="hidden" name={`qty_${it.id}`} value={qty[it.id] ?? 0} />
            <span className="min-w-0 flex-1 truncate text-sm text-ink">{it.name}</span>
            <span className="tabular shrink-0 text-xs text-ink-muted">
              {formatCents(it.price_cents)}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => bump(it.id, -1)}
                aria-label={`One fewer ${it.name}`}
                disabled={(qty[it.id] ?? 0) === 0}
                className="grid h-7 w-7 place-items-center rounded-full border border-line text-ink hover:bg-forest-soft disabled:opacity-30"
              >
                <Minus className="h-3.5 w-3.5" aria-hidden />
              </button>
              <span className="tabular w-4 text-center text-sm font-medium">
                {qty[it.id] ?? 0}
              </span>
              <button
                type="button"
                onClick={() => bump(it.id, 1)}
                aria-label={`One more ${it.name}`}
                className="grid h-7 w-7 place-items-center rounded-full border border-line text-ink hover:bg-forest-soft"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <span className="text-sm text-ink-muted">Subtotal</span>
        <span className="tabular font-display text-xl text-forest">{formatCents(subtotal)}</span>
      </div>

      {count > 0 && (
        <div className="rise mt-4 space-y-3">
          <fieldset>
            <legend className="text-xs font-medium text-ink">Pay by</legend>
            <div className="mt-1.5 flex gap-2">
              <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm has-checked:border-forest has-checked:bg-forest-soft">
                <input type="radio" name="paymentMethod" value="cash" defaultChecked className="accent-[var(--color-forest)]" />
                Cash at pickup
              </label>
              <label
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm ${
                  acceptsCard ? "cursor-pointer has-checked:border-forest has-checked:bg-forest-soft" : "opacity-40"
                }`}
              >
                <input type="radio" name="paymentMethod" value="card" disabled={!acceptsCard} className="accent-[var(--color-forest)]" />
                Card
              </label>
            </div>
            {!acceptsCard && (
              <p className="mt-1 text-xs text-ink-muted">
                This cook hasn&apos;t set up card payments yet.
              </p>
            )}
          </fieldset>

          {/* Per-order consent. Recorded individually in the agreements ledger. */}
          <fieldset className="space-y-2 rounded-lg bg-surface-sunk p-3">
            <legend className="px-1 text-xs font-medium text-ink">Before you order</legend>
            {ACKNOWLEDGMENTS.map((a) => (
              <label key={a.key} className="flex cursor-pointer gap-2.5 text-xs leading-relaxed text-ink-muted">
                <input
                  type="checkbox"
                  name={`ack_${a.key}`}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-forest)]"
                />
                <span>{a.text}</span>
              </label>
            ))}
          </fieldset>

          {state?.error && (
            <p className="rise flex items-start gap-2 rounded-lg border border-clay/30 bg-clay/10 p-2.5 text-xs text-clay">
              <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full bg-forest px-4 py-3 text-sm font-medium text-cream hover:bg-forest-deep disabled:opacity-60"
          >
            {pending
              ? "Placing…"
              : signedIn
                ? `Request ${count} item${count === 1 ? "" : "s"} · ${formatCents(subtotal)}`
                : "Sign in to order"}
          </button>

          <p className="text-center text-[11px] leading-relaxed text-ink-muted">
            The cook confirms before you pay. The exact pickup address is shared
            once your order is accepted.
          </p>
        </div>
      )}
    </form>
  );
}
