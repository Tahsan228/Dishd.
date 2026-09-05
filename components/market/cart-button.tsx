"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/components/market/use-cart";

/** Header cart affordance. Hidden entirely when there is nothing in it. */
export function CartButton() {
  const { count, ready } = useCart();
  if (!ready || count === 0) return null;

  return (
    <Link
      href="/cart"
      className="relative flex min-h-11 items-center gap-2 rounded-full border border-forest px-3 py-2 text-forest hover:bg-forest-soft"
    >
      <ShoppingBag className="h-4 w-4" aria-hidden />
      <span className="tabular text-sm font-medium">{count}</span>
      <span className="sr-only">
        {count === 1 ? "1 item in your cart" : `${count} items in your cart`}
      </span>
    </Link>
  );
}
