"use client";

import { useActionState } from "react";
import { payCashCommission } from "@/lib/market/cash-billing-actions";
import { formatCents } from "@/lib/utils";

export function CashPaymentButton({ amount, enabled }: { amount: number; enabled: boolean }) {
  const [state, action, pending] = useActionState(payCashCommission, null);
  return <form action={action} className="mt-5">
    <button disabled={!enabled || pending || amount < 50} className="min-h-12 w-full rounded-full bg-forest px-5 py-3 text-sm font-medium text-cream hover:bg-forest-deep disabled:opacity-50 sm:w-auto">
      {pending ? "Opening secure checkout..." : "Pay " + formatCents(amount) + " by card"}
    </button>
    {state?.error && <p role="alert" className="mt-3 text-sm text-clay">{state.error}</p>}
  </form>;
}
