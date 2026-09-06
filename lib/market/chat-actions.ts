"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { MESSAGE_MAX, type ChatMessage, type SendMessageState } from "@/lib/market/chat";

/**
 * Send a message on an order thread.
 *
 * Both sides of the thread are decided by `dishd_can_see_order()` in the RLS
 * policy, so the check here is for a readable refusal rather than for safety —
 * a caller who is neither the buyer nor the cook is stopped by the database
 * whatever this function does.
 */
export async function sendOrderMessage(
  orderId: string,
  _prev: SendMessageState,
  form: FormData,
): Promise<SendMessageState> {
  const body = String(form.get("body") ?? "").trim();
  if (!body) return { ok: false, message: "Type a message first." };
  if (body.length > MESSAGE_MAX) {
    return { ok: false, message: `Keep it under ${MESSAGE_MAX} characters.` };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in to send a message." };

  const { error } = await supabase
    .from("order_messages")
    .insert({ order_id: orderId, sender_id: user.id, body });

  if (error) {
    return {
      ok: false,
      message:
        error.code === "42501"
          ? "You can only message about your own order."
          : "That message could not be sent. Try again.",
    };
  }

  revalidatePath(`/order/${orderId}`);
  revalidatePath("/cook");
  return { ok: true, message: "" };
}

/** The thread for one order, oldest first. RLS decides who may read it. */
export async function loadOrderMessages(orderId: string): Promise<ChatMessage[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("order_messages")
    .select("id, order_id, sender_id, body, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true })
    .limit(200);
  return (data ?? []) as ChatMessage[];
}
