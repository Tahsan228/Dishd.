import { describe, expect, it } from "vitest";
import {
  addToCart,
  cartCount,
  cartSubtotal,
  lineQty,
  MAX_QTY_PER_ITEM,
  parseCart,
  removeLine,
  setQty,
  type Cart,
} from "./cart";

const amina = { id: "k1", name: "Amina's Kitchen", slug: "aminas-kitchen" };
const layla = { id: "k2", name: "Layla's Sofra", slug: "laylas-sofra" };
const biryani = { id: "i1", name: "Chicken biryani", priceCents: 1400 };
const samosa = { id: "i2", name: "Samosa", priceCents: 300 };

describe("adding to a cart", () => {
  it("starts a cart from nothing", () => {
    const { cart, replacedKitchen } = addToCart(null, amina, biryani);
    expect(replacedKitchen).toBeNull();
    expect(cart.kitchenId).toBe("k1");
    expect(cart.lines).toEqual([
      { itemId: "i1", name: "Chicken biryani", priceCents: 1400, qty: 1 },
    ]);
  });

  it("accumulates the same dish rather than duplicating the line", () => {
    let cart = addToCart(null, amina, biryani).cart;
    cart = addToCart(cart, amina, biryani, 2).cart;
    expect(cart.lines).toHaveLength(1);
    expect(lineQty(cart, "i1")).toBe(3);
  });

  it("keeps separate dishes on separate lines", () => {
    let cart = addToCart(null, amina, biryani).cart;
    cart = addToCart(cart, amina, samosa).cart;
    expect(cart.lines.map((l) => l.itemId)).toEqual(["i1", "i2"]);
  });

  it("replaces the cart when adding from a different kitchen, and says so", () => {
    // One order is one pickup from one home. A basket spanning two kitchens
    // could never be fulfilled, so it must not be silently allowed.
    const first = addToCart(null, amina, biryani).cart;
    const { cart, replacedKitchen } = addToCart(first, layla, samosa);
    expect(replacedKitchen).toBe("Amina's Kitchen");
    expect(cart.kitchenId).toBe("k2");
    expect(cart.lines).toHaveLength(1);
    expect(lineQty(cart, "i1")).toBe(0);
  });

  it("clamps a line to the per-item ceiling", () => {
    const cart = addToCart(null, amina, biryani, 999).cart;
    expect(lineQty(cart, "i1")).toBe(MAX_QTY_PER_ITEM);
  });

  it("ignores a non-positive or non-finite quantity", () => {
    expect(addToCart(null, amina, biryani, 0).cart.lines).toEqual([]);
    expect(addToCart(null, amina, biryani, -5).cart.lines).toEqual([]);
    expect(addToCart(null, amina, biryani, NaN).cart.lines).toEqual([]);
  });
});

describe("changing quantities", () => {
  const base = addToCart(addToCart(null, amina, biryani, 2).cart, amina, samosa, 1).cart;

  it("sets an exact quantity", () => {
    expect(lineQty(setQty(base, "i1", 5), "i1")).toBe(5);
  });

  it("drops the line at zero", () => {
    const after = setQty(base, "i1", 0);
    expect(after?.lines.map((l) => l.itemId)).toEqual(["i2"]);
  });

  it("becomes null once the last line is removed", () => {
    const emptied = removeLine(removeLine(base, "i1"), "i2");
    expect(emptied).toBeNull();
  });

  it("does nothing to a null cart", () => {
    expect(setQty(null, "i1", 3)).toBeNull();
  });
});

describe("totals", () => {
  it("counts items and money across lines", () => {
    let cart = addToCart(null, amina, biryani, 2).cart;
    cart = addToCart(cart, amina, samosa, 3).cart;
    expect(cartCount(cart)).toBe(5);
    expect(cartSubtotal(cart)).toBe(2 * 1400 + 3 * 300);
  });

  it("treats an empty cart as zero rather than throwing", () => {
    expect(cartCount(null)).toBe(0);
    expect(cartSubtotal(null)).toBe(0);
    expect(lineQty(null, "i1")).toBe(0);
  });
});

describe("parsing stored carts", () => {
  const valid: Cart = {
    kitchenId: "k1",
    kitchenName: "Amina's Kitchen",
    kitchenSlug: "aminas-kitchen",
    lines: [{ itemId: "i1", name: "Chicken biryani", priceCents: 1400, qty: 2 }],
  };

  it("round-trips a cart it wrote", () => {
    expect(parseCart(JSON.stringify(valid))).toEqual(valid);
  });

  it("returns null for anything unusable instead of throwing", () => {
    // A stale or hand-edited localStorage value must never break the page.
    for (const raw of [null, "", "not json", "[]", "42", '{"kitchenId":"k1"}']) {
      expect(parseCart(raw)).toBeNull();
    }
  });

  it("drops malformed lines and keeps the good ones", () => {
    const raw = JSON.stringify({
      ...valid,
      lines: [
        { itemId: "i1", name: "Good", priceCents: 500, qty: 1 },
        { itemId: "i2", name: "No price", qty: 1 },
        { itemId: "i3", name: "Negative", priceCents: -100, qty: 1 },
        { itemId: "i4", name: "Zero qty", priceCents: 100, qty: 0 },
      ],
    });
    expect(parseCart(raw)?.lines.map((l) => l.itemId)).toEqual(["i1"]);
  });

  it("clamps a tampered quantity to the ceiling", () => {
    const raw = JSON.stringify({
      ...valid,
      lines: [{ itemId: "i1", name: "x", priceCents: 100, qty: 10_000 }],
    });
    expect(parseCart(raw)?.lines[0].qty).toBe(MAX_QTY_PER_ITEM);
  });

  it("returns null when every line was malformed", () => {
    const raw = JSON.stringify({ ...valid, lines: [{ itemId: 7 }] });
    expect(parseCart(raw)).toBeNull();
  });
});
