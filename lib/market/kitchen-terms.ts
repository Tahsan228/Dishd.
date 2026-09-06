"use server";

import { createServerClient } from "@/lib/supabase/server";

/**
 * The terms a kitchen currently trades on, for the cart.
 *
 * Fetched at checkout rather than carried in the cart because the cart lives in
 * the browser and can be days old: a kitchen that has since withdrawn priority
 * or stopped taking bookings must not still be offering them. Nothing returned
 * here is trusted either — `dishd_place_order` re-reads the same row and prices
 * the fee itself, so this only decides what the buyer is shown.
 */
export type KitchenTerms = {
  priorityFeeCents: number;
  acceptsScheduled: boolean;
  defaultPrepMinutes: number;
};

export async function loadKitchenTerms(kitchenId: string): Promise<KitchenTerms | null> {
  if (!kitchenId) return null;
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("kitchens")
    .select("priority_fee_cents, accepts_scheduled, default_prep_minutes")
    .eq("id", kitchenId)
    .maybeSingle();

  // A deployment whose database has not run 0015 yet returns "column does not
  // exist". Falling back to the plainest possible terms keeps checkout working
  // instead of taking the cart down over an upsell.
  if (error || !data) return { priorityFeeCents: 0, acceptsScheduled: false, defaultPrepMinutes: 25 };

  return {
    priorityFeeCents: Number(data.priority_fee_cents ?? 0),
    acceptsScheduled: Boolean(data.accepts_scheduled),
    defaultPrepMinutes: Number(data.default_prep_minutes ?? 25),
  };
}
