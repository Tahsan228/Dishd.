"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  CART_STORAGE_KEY,
  addToCart as addToCartPure,
  cartCount,
  cartSubtotal,
  parseCart,
  setQty as setQtyPure,
  type Cart,
} from "@/lib/market/cart";

/* -------------------------------------------------------------------------- */
/* The store                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * localStorage IS the cart's source of truth, so the cart is read through
 * `useSyncExternalStore` rather than mirrored into component state. That keeps
 * two tabs consistent for free and avoids the cascading render that a
 * setState-inside-an-effect hydration would cause.
 *
 * `getSnapshot` must return a stable reference for unchanged data or React
 * re-renders forever, so the last parsed value is cached against the raw string
 * it came from.
 */
let cachedRaw: string | null = null;
let cachedCart: Cart | null = null;
let hydrated = false;

const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(CART_STORAGE_KEY);
  } catch {
    // Private windows and blocked site data throw on access. A cart is never
    // worth a crash.
    return null;
  }
}

function getSnapshot(): Cart | null {
  const raw = readRaw();
  if (!hydrated || raw !== cachedRaw) {
    cachedRaw = raw;
    cachedCart = parseCart(raw);
    hydrated = true;
  }
  return cachedCart;
}

/** The server has no storage, and must render the same thing every time. */
function getServerSnapshot(): Cart | null {
  return null;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== CART_STORAGE_KEY) return;
  emit();
}

function emit() {
  for (const listener of listeners) listener();
}

function write(next: Cart | null) {
  try {
    if (next) window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    // Storage unavailable. Keep the value in memory so this page view still
    // works; it simply will not survive a reload.
    cachedRaw = next ? JSON.stringify(next) : null;
    cachedCart = next;
    hydrated = true;
  }
  emit();
}

/* -------------------------------------------------------------------------- */
/* The hook                                                                   */
/* -------------------------------------------------------------------------- */

type CartContextValue = {
  cart: Cart | null;
  /** False during SSR and the first paint, so the badge never flashes a wrong count. */
  ready: boolean;
  count: number;
  subtotal: number;
  add: (
    kitchen: { id: string; name: string; slug: string },
    item: { id: string; name: string; priceCents: number },
    qty?: number,
  ) => { replacedKitchen: string | null };
  setQty: (itemId: string, qty: number) => void;
  clear: () => void;
};

/**
 * No provider, deliberately.
 *
 * The cart already has a single source of truth outside React — localStorage —
 * so a context would only be a second place for it to live, and it would have
 * to be mounted in every route group's layout (the shared header carries the
 * cart badge, and that header renders on marketplace, social and legal pages
 * alike). Reading the store directly means the hook works anywhere.
 */
export function useCart(): CartContextValue {
  const cart = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // On the server and during hydration this is false, which is exactly when the
  // cart contents are not yet knowable.
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const add = useCallback<CartContextValue["add"]>((kitchen, item, qty = 1) => {
    const { cart: next, replacedKitchen } = addToCartPure(getSnapshot(), kitchen, item, qty);
    write(next);
    return { replacedKitchen };
  }, []);

  const setQty = useCallback((itemId: string, qty: number) => {
    write(setQtyPure(getSnapshot(), itemId, qty));
  }, []);

  const clear = useCallback(() => write(null), []);

  return useMemo<CartContextValue>(
    () => ({
      cart,
      ready,
      count: cartCount(cart),
      subtotal: cartSubtotal(cart),
      add,
      setQty,
      clear,
    }),
    [cart, ready, add, setQty, clear],
  );
}
