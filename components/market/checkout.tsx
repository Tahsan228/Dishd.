"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { CalendarClock, Minus, Plus, ShoppingBag, TriangleAlert, Zap } from "lucide-react";
import { useCart } from "@/components/market/use-cart";
import { placeOrder, type PlaceOrderState } from "@/lib/market/order-actions";
import { ACKNOWLEDGMENTS } from "@/lib/market/order-consent";
import { MAX_QTY_PER_ITEM } from "@/lib/market/cart";
import { formatCents } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { parseTipCents } from "@/lib/market/money";
import { loadKitchenTerms, type KitchenTerms } from "@/lib/market/kitchen-terms";
import {
  SCHEDULE_STEP_MINUTES,
  checkScheduledFor,
  scheduleBounds,
  toLocalInputValue,
} from "@/lib/market/order-timing";

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
  cardUnavailableReason, rewards = [],
}: {
  cardUnavailableReason: string | null;
  rewards?: {id:string;credit_cents:number;minimum_order_cents:number}[];
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

  const [rewardId,setRewardId]=useState('');
  const [tip, setTip] = useState('0');
  const tipCents = parseTipCents(tip);

  // What this kitchen currently offers. Read from the server rather than from
  // the cart, which may have been sitting in this browser for days.
  const [terms, setTerms] = useState<KitchenTerms | null>(null);
  const [when, setWhen] = useState<'asap' | 'later'>('asap');
  const [slot, setSlot] = useState('');
  const [priority, setPriority] = useState(false);

  const kitchenId = cart?.kitchenId ?? '';
  useEffect(() => {
    if (!kitchenId) { setTerms(null); return; }
    let current = true;
    // Switching kitchens must not leave the previous kitchen's offer on screen,
    // so every choice that depends on the terms resets with them.
    setTerms(null); setWhen('asap'); setSlot(''); setPriority(false);
    loadKitchenTerms(kitchenId).then((next) => { if (current) setTerms(next); });
    return () => { current = false; };
  }, [kitchenId]);

  const scheduling = when === 'later';
  const bounds = scheduleBounds(new Date());
  const slotAt = scheduling && slot ? new Date(slot) : null;
  const slotCheck = slotAt ? checkScheduledFor(slotAt, new Date()) : null;
  const slotError = scheduling
    ? slot
      ? (slotCheck && 'error' in slotCheck ? slotCheck.error : null)
      : 'Choose a pickup date and time.'
    : null;

  const priorityCents = priority ? (terms?.priorityFeeCents ?? 0) : 0;
  const reward=rewards.find(r=>r.id===rewardId && subtotal>=r.minimum_order_cents);
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
      <input type="hidden" name="rewardId" value={reward?.id??""} />
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

        {terms && (
          <fieldset className="mt-8 rounded-2xl border border-line bg-surface p-5">
            <legend className="flex items-center gap-2 px-1 text-sm font-medium text-ink">
              <CalendarClock className="h-4 w-4 text-forest" aria-hidden />
              When do you want this?
            </legend>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 text-sm has-checked:border-forest has-checked:bg-forest-soft">
                <input
                  type="radio"
                  name="pickupWhen"
                  value="asap"
                  checked={!scheduling}
                  onChange={() => setWhen("asap")}
                  className="mt-0.5 accent-[var(--color-forest)]"
                />
                <span>
                  <span className="block font-medium text-ink">As soon as possible</span>
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    The cook starts once they accept.
                  </span>
                </span>
              </label>

              {terms.acceptsScheduled && (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 text-sm has-checked:border-forest has-checked:bg-forest-soft">
                  <input
                    type="radio"
                    name="pickupWhen"
                    value="later"
                    checked={scheduling}
                    onChange={() => setWhen("later")}
                    className="mt-0.5 accent-[var(--color-forest)]"
                  />
                  <span>
                    <span className="block font-medium text-ink">Schedule for later</span>
                    <span className="mt-0.5 block text-xs text-ink-muted">
                      Up to seven days ahead, in 15-minute steps.
                    </span>
                  </span>
                </label>
              )}
            </div>

            {scheduling && (
              <div className="mt-4">
                <label htmlFor="pickup-slot" className="block text-sm text-ink-muted">
                  Pickup time
                </label>
                <input
                  id="pickup-slot"
                  type="datetime-local"
                  value={slot}
                  onChange={(e) => setSlot(e.target.value)}
                  min={toLocalInputValue(bounds.earliest)}
                  max={toLocalInputValue(bounds.latest)}
                  step={SCHEDULE_STEP_MINUTES * 60}
                  aria-describedby="pickup-slot-error pickup-slot-note"
                  aria-invalid={Boolean(slotError)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-line bg-cream px-3 text-base"
                />
                <p id="pickup-slot-error" aria-live="polite" className="mt-1 text-sm text-clay">
                  {slotError ?? ""}
                </p>
                <p id="pickup-slot-note" className="mt-1 text-xs leading-relaxed text-ink-muted">
                  Booking a time does not confirm the order. The cook still has to
                  accept it, and you will see when they do.
                </p>
              </div>
            )}

            {!terms.acceptsScheduled && (
              <p className="mt-3 text-xs text-ink-muted">
                This kitchen is not taking scheduled pickups at the moment.
              </p>
            )}

            {/* The visible control holds local wall time; this carries the exact
                instant, so the server never has to guess the buyer's timezone. */}
            <input
              type="hidden"
              name="scheduledFor"
              value={slotAt && !slotError ? slotAt.toISOString() : ""}
            />
          </fieldset>
        )}

        <fieldset className="mt-8 space-y-4 rounded-2xl bg-surface-sunk p-6">
          <legend className="px-1 text-xs font-medium text-ink">Before you order</legend>
          {ACKNOWLEDGMENTS.map((a) => (
            <label
              key={a.key}
              className="flex cursor-pointer gap-3 text-sm leading-relaxed text-ink-muted"
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
            <Link href="/legal/standards" className="underline underline-offset-2">food-quality standards</Link>.
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

          <div className="mt-6">
            <label htmlFor="reward-credit" className="text-sm font-medium">Use a reward credit</label>
            <select id="reward-credit" value={reward?.id??''} onChange={e=>setRewardId(e.target.value)} className="mt-2 w-full rounded-xl border border-line bg-cream p-3 text-sm">
              <option value="">Save my credits for later</option>
              {rewards.map(r=><option key={r.id} value={r.id} disabled={subtotal<r.minimum_order_cents}>{formatCents(r.credit_cents)} credit &middot; {formatCents(r.minimum_order_cents)} minimum</option>)}
            </select>
            <Link href="/rewards" className="mt-2 inline-block text-sm text-forest underline">Earn and redeem points</Link>
            {reward && <p className="mt-3 text-sm text-forest">Reward applied: &minus;{formatCents(reward.credit_cents)}</p>}
          </div>
          <fieldset className="mt-6">
            <legend className="text-sm font-medium text-ink">A little thanks for your cook</legend>
            <p id="tip-help" className="mt-1 text-sm text-ink-muted">Optional. Tips go to the kitchen and are excluded from Dishd&apos;s cash commission. Pay your tip with your meal.</p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {['0', '2', '3', '5'].map(value => <button key={value} type="button" aria-pressed={tip === value} onClick={() => setTip(value)} className={cn('min-h-11 rounded-xl border text-sm', tip === value ? 'border-forest bg-forest-soft text-forest' : 'border-line text-ink')}>{value === '0' ? 'No tip' : '$' + value}</button>)}
            </div>
            <label htmlFor="tip" className="mt-3 block text-sm text-ink-muted">Custom tip ($)</label>
            <input id="tip" name="tip" type="text" inputMode="decimal" value={tip} onChange={event => setTip(event.target.value)} aria-describedby="tip-help tip-error" aria-invalid={tipCents === null} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-cream px-3 text-base" />
            <p id="tip-error" className="mt-1 text-sm text-clay" aria-live="polite">{tipCents === null ? 'Enter $0 to $100, with up to two decimal places.' : ''}</p>
          </fieldset>
          {terms && terms.priorityFeeCents > 0 && (
            <fieldset className="mt-6">
              <legend className="text-sm font-medium text-ink">Jump the queue</legend>
              <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 text-sm has-checked:border-brass has-checked:bg-brass/10">
                <input
                  type="checkbox"
                  name="priority"
                  checked={priority}
                  onChange={(e) => setPriority(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-forest)]"
                />
                <span>
                  <span className="flex items-center gap-1.5 font-medium text-ink">
                    <Zap className="h-3.5 w-3.5 shrink-0 text-brass-ink" aria-hidden />
                    Priority &middot; {formatCents(terms.priorityFeeCents)}
                  </span>
                  {/* Says what the money buys and nothing more. The cook sees this
                      order first; nobody here controls how fast they cook. */}
                  <span className="mt-1 block text-xs leading-relaxed text-ink-muted">
                    {cart.kitchenName} sets this price and keeps it. It puts your
                    order at the top of their list. It is not a promised time, and
                    Dishd does not guarantee one.
                  </span>
                </span>
              </label>
            </fieldset>
          )}

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt>Food after rewards</dt><dd className="tabular">{formatCents(subtotal-(reward?.credit_cents??0))}</dd></div>
            {priorityCents > 0 && <div className="flex justify-between gap-3"><dt>Priority</dt><dd className="tabular">{formatCents(priorityCents)}</dd></div>}
            <div className="flex justify-between gap-3"><dt>Tip</dt><dd className="tabular">{formatCents(tipCents??0)}</dd></div>
          </dl>
          <div aria-live="polite" className="mt-4 flex items-center justify-between border-t border-line pt-3">
            <span className="text-sm text-ink-muted">Total</span>
            <span className="tabular font-display text-2xl text-forest">
              {formatCents(subtotal-(reward?.credit_cents??0)+priorityCents+(tipCents??0))}
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
            disabled={pending || !allAcked || tipCents === null || Boolean(slotError)}
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
            they accept, and they set the cooking time you will see then.
          </p>
        </div>
      </aside>
    </form>
  );
}
