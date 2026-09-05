/**
 * Cart state, as pure functions over a plain object.
 *
 * One kitchen per cart. A Dishd order is a pickup from one person's home at one
 * time, so a basket spanning three kitchens could never be fulfilled as a
 * single order — adding from a different kitchen replaces the cart rather than
 * silently creating something undeliverable.
 *
 * Prices are carried for display only. `placeOrder` re-reads every price from
 * the database before writing an order, so a tampered cart cannot change what
 * anything costs.
 */

export type CartLine = {
  itemId: string;
  name: string;
  priceCents: number;
  qty: number;
};

export type Cart = {
  kitchenId: string;
  kitchenName: string;
  kitchenSlug: string;
  lines: CartLine[];
};

export const CART_STORAGE_KEY = "dishd.cart.v1";

/** Hard ceiling per line, matching the quantity a home cook can realistically prep. */
export const MAX_QTY_PER_ITEM = 20;

export function emptyCart(): Cart | null {
  return null;
}

export function cartCount(cart: Cart | null): number {
  return cart ? cart.lines.reduce((n, l) => n + l.qty, 0) : 0;
}

export function cartSubtotal(cart: Cart | null): number {
  return cart ? cart.lines.reduce((n, l) => n + l.priceCents * l.qty, 0) : 0;
}

export function lineQty(cart: Cart | null, itemId: string): number {
  return cart?.lines.find((l) => l.itemId === itemId)?.qty ?? 0;
}

function clampQty(qty: number): number {
  if (!Number.isFinite(qty)) return 0;
  return Math.max(0, Math.min(MAX_QTY_PER_ITEM, Math.floor(qty)));
}

/**
 * Add to the cart. Returns the new cart, and whether adding replaced a cart
 * belonging to a different kitchen so the UI can say so.
 */
export function addToCart(
  cart: Cart | null,
  kitchen: { id: string; name: string; slug: string },
  item: { id: string; name: string; priceCents: number },
  qty = 1,
): { cart: Cart; replacedKitchen: string | null } {
  const wanted = clampQty(qty);
  if (wanted === 0) return { cart: cart ?? blank(kitchen), replacedKitchen: null };

  if (cart && cart.kitchenId !== kitchen.id) {
    return {
      cart: {
        ...blank(kitchen),
        lines: [{ itemId: item.id, name: item.name, priceCents: item.priceCents, qty: wanted }],
      },
      replacedKitchen: cart.kitchenName,
    };
  }

  const base = cart ?? blank(kitchen);
  const existing = base.lines.find((l) => l.itemId === item.id);
  const lines = existing
    ? base.lines.map((l) =>
        l.itemId === item.id ? { ...l, qty: clampQty(l.qty + wanted) } : l,
      )
    : [
        ...base.lines,
        { itemId: item.id, name: item.name, priceCents: item.priceCents, qty: wanted },
      ];

  return { cart: { ...base, lines }, replacedKitchen: null };
}

/** Set an exact quantity. Zero removes the line; an empty cart becomes null. */
export function setQty(cart: Cart | null, itemId: string, qty: number): Cart | null {
  if (!cart) return null;
  const wanted = clampQty(qty);
  const lines = cart.lines
    .map((l) => (l.itemId === itemId ? { ...l, qty: wanted } : l))
    .filter((l) => l.qty > 0);
  return lines.length > 0 ? { ...cart, lines } : null;
}

export function removeLine(cart: Cart | null, itemId: string): Cart | null {
  return setQty(cart, itemId, 0);
}

function blank(kitchen: { id: string; name: string; slug: string }): Cart {
  return {
    kitchenId: kitchen.id,
    kitchenName: kitchen.name,
    kitchenSlug: kitchen.slug,
    lines: [],
  };
}

/**
 * Parse a cart out of storage. Anything malformed becomes an empty cart rather
 * than throwing — a stale or hand-edited localStorage value must never be able
 * to break the page it is read on.
 */
export function parseCart(raw: string | null): Cart | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object") return null;
    const c = value as Partial<Cart>;
    if (
      typeof c.kitchenId !== "string" ||
      typeof c.kitchenName !== "string" ||
      typeof c.kitchenSlug !== "string" ||
      !Array.isArray(c.lines)
    ) {
      return null;
    }
    const lines: CartLine[] = [];
    for (const l of c.lines) {
      if (
        !l ||
        typeof l.itemId !== "string" ||
        typeof l.name !== "string" ||
        typeof l.priceCents !== "number" ||
        !Number.isFinite(l.priceCents) ||
        l.priceCents < 0
      ) {
        continue;
      }
      const qty = clampQty(l.qty);
      if (qty > 0) lines.push({ itemId: l.itemId, name: l.name, priceCents: l.priceCents, qty });
    }
    if (lines.length === 0) return null;
    return { kitchenId: c.kitchenId, kitchenName: c.kitchenName, kitchenSlug: c.kitchenSlug, lines };
  } catch {
    return null;
  }
}
