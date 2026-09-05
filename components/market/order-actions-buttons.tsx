"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { advanceOrder } from "@/lib/market/order-actions";
import type { OrderStatus } from "@/lib/types";

/**
 * Cook-side state machine buttons.
 * Completing fires dishd_autolog_on_complete(), so it is worded as final.
 */
export function OrderActions({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const go = (to: OrderStatus) =>
    start(async () => {
      const res = await advanceOrder(orderId, to);
      if (res && "error" in res && res.error) setError(res.error);
      else router.refresh();
    });

  const primary =
    status === "pending" ? { to: "accepted" as const, label: "Accept order" }
    : status === "accepted" ? { to: "ready" as const, label: "Mark ready" }
    : status === "ready" ? { to: "completed" as const, label: "Collected" }
    : null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {primary && (
        <button
          onClick={() => go(primary.to)}
          disabled={pending}
          className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-cream hover:bg-forest-deep disabled:opacity-60"
        >
          {pending ? "Saving…" : primary.label}
        </button>
      )}
      {status === "pending" && (
        <button
          onClick={() => go("declined")}
          disabled={pending}
          className="rounded-full border border-line px-4 py-2 text-sm text-ink-muted hover:border-clay hover:text-clay disabled:opacity-60"
        >
          Decline
        </button>
      )}
      {error && <span className="text-xs text-clay">{error}</span>}
    </div>
  );
}
