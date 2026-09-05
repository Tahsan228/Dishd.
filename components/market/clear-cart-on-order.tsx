"use client";

import { useEffect } from "react";
import { useCart } from "@/components/market/use-cart";

const CLEARED_KEY = "dishd.cart.cleared-for";

/**
 * Empties the cart once the order it produced exists.
 *
 * Clearing on submit instead would throw away the basket whenever the order
 * failed, so it happens here — the order page is only reached after the row is
 * written. The order id is recorded so that revisiting an old order later
 * cannot wipe a fresh cart the buyer has since built for the same kitchen.
 */
export function ClearCartOnOrder({
  orderId,
  kitchenId,
}: {
  orderId: string;
  kitchenId: string;
}) {
  const { cart, ready, clear } = useCart();

  useEffect(() => {
    if (!ready || !cart || cart.kitchenId !== kitchenId) return;

    let alreadyCleared = false;
    try {
      alreadyCleared = window.localStorage.getItem(CLEARED_KEY) === orderId;
    } catch {
      // Storage unavailable; clearing once for this page view is still right.
    }
    if (alreadyCleared) return;

    try {
      window.localStorage.setItem(CLEARED_KEY, orderId);
    } catch {
      // Non-fatal.
    }
    clear();
  }, [ready, cart, kitchenId, orderId, clear]);

  return null;
}
