"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { cashPaymentUrl, type CashBill } from "@/lib/market/cash-billing";
import { stripeConfigured } from "@/lib/market/stripe";

export type CashPaymentState = { error?: string } | null;

export async function payCashCommission(): Promise<CashPaymentState> {
  const client = await createServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/signin?next=%2Fcook%2Fpayments");
  const { data: kitchen } = await client.from("kitchens").select("id").eq("owner_id", user.id).maybeSingle();
  if (!kitchen) return { error: "Only a kitchen owner can pay this balance." };
  if (!stripeConfigured()) return { error: "Card billing is not configured yet. Your balance remains recorded." };
  let url: string;
  try {
    const { data, error } = await createServiceClient().rpc("dishd_prepare_cash_payment", { p_kitchen: kitchen.id });
    if (error || !data) return { error: error?.message ?? "Could not prepare your balance." };
    url = await cashPaymentUrl((Array.isArray(data) ? data[0] : data) as CashBill);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Card checkout could not start. Please try again." };
  }
  revalidatePath("/cook/payments");
  redirect(url);
}
