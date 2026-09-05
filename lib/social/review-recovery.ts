"use server";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
export async function openOrderReview(orderId: string): Promise<{ error: string } | never> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=" + encodeURIComponent("/order/" + orderId));
  const { data, error } = await supabase.rpc("dishd_ensure_order_review", { p_order_id: orderId });
  if (error || !data) return { error: "Your pickup review could not be opened yet. Refresh and try again. If this continues, contact Dishd with your order number." };
  redirect("/log/" + data);
}
