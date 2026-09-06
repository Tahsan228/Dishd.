"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/types";
import { ACK_VERSION, ACKNOWLEDGMENTS } from "@/lib/market/order-consent";
import { transitionError, type OrderActor } from "@/lib/market/order-lifecycle";
import { paymentMethodError } from "@/lib/market/payments";
import { createCheckoutSession, stripeConfigured } from "@/lib/market/stripe";

import { parseTipCents } from "@/lib/market/money";
import { parseScheduledFor, parsePrepMinutes, readyEstimateAt } from "@/lib/market/order-timing";

export type PlaceOrderState = { error?: string } | null;

/** Prices, availability, consent and reward reservation commit in one transaction. */
export async function placeOrder(_prev: PlaceOrderState, form: FormData): Promise<PlaceOrderState> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/signin?next=%2Fcart');
  for (const ack of ACKNOWLEDGMENTS) {
    if (form.get('ack_' + ack.key) !== 'on') return { error: 'Accept all three food-quality acknowledgments.' };
  }
  const wanted: {id:string;qty:number}[]=[];
  for (const [key,value] of form.entries()) {
    if (!key.startsWith('qty_')) continue;
    const qty=Number(value);
    if (!Number.isInteger(qty) || qty<0 || qty>20) return {error:'Choose between 1 and 20 portions per dish.'};
    if(qty) wanted.push({id:key.slice(4),qty});
  }
  if(!wanted.length) return {error:'Choose at least one dish.'};
  const kitchenId=String(form.get('kitchenId')??'');
  const method=String(form.get('paymentMethod')??'');
  const tipCents=parseTipCents(form.get('tip')??'0');
  if(tipCents===null) return {error:'Enter a tip between $0 and $100, with up to two decimal places.'};
  if(method!=='cash' && method!=='card') return {error:'Choose a payment method.'};
  // A scheduled pickup is re-validated here against the server's clock, and
  // again in SQL: the browser composed this instant from its own wall time.
  const wantsPriority=form.get('priority')==='on';
  const schedule=parseScheduledFor(form.get('scheduledFor'),new Date());
  if(schedule && 'error' in schedule) return {error:schedule.error};
  const scheduledFor=schedule?schedule.at:null;
  const {data:kitchen}=await supabase.from('kitchens').select('accepts_cash,accepts_card,stripe_onboarded').eq('id',kitchenId).maybeSingle();
  if(!kitchen) return {error:'That kitchen is unavailable.'};
  const problem=paymentMethodError(method,kitchen,stripeConfigured());
  if(problem) return {error:problem};
  let destination='';
  try {
    const admin=createServiceClient();
    const h=await headers();
    const core={
      p_buyer:user.id,p_kitchen:kitchenId,p_lines:wanted,p_method:method,p_tip_cents:tipCents,
      p_reward:String(form.get('rewardId')??'')||null,p_ack_version:ACK_VERSION,
      p_acks:ACKNOWLEDGMENTS.map(a=>a.key),p_ip:h.get('x-forwarded-for')?.split(',')[0]?.trim()??null,p_agent:h.get('user-agent')
    };
    // The price of priority is read from the kitchen inside the RPC. Sending
    // only the intent means a crafted form cannot name its own fee.
    let {data,error}=await admin.rpc('dishd_place_order',{...core,
      p_priority:wantsPriority,p_scheduled_for:scheduledFor?scheduledFor.toISOString():null});

    // A database still on 0014 has no such signature. Ordinary orders fall back
    // to the older one rather than failing, so a pending migration costs the
    // features and not the shop. An order that actually asked for priority or a
    // booked slot is refused instead: placing it silently without what the buyer
    // chose would be worse than not placing it.
    const missingSignature=(code?:string)=>Boolean(code && ['PGRST202','42883','42703'].includes(code));
    if(missingSignature(error?.code) && !wantsPriority && !scheduledFor) {
      ({data,error}=await admin.rpc('dishd_place_order',core));
    }
    if(error || !data?.[0]) return {error:missingSignature(error?.code)
      ? (wantsPriority || scheduledFor
        ? 'Scheduled and priority orders are not switched on yet. Order as soon as possible instead, or try again later.'
        : 'Ordering is temporarily unavailable while payments are being updated. Your cart is still here.')
      : error?.message??'Could not place the order. Please try again.'};
    const order=data[0] as {order_id:string;subtotal_cents:number;discount_cents:number;kitchen_name:string;tip_cents:number;priority_fee_cents?:number};
    const priorityCents=Number(order.priority_fee_cents??0);
    destination='/order/'+order.order_id;
    if(method==='card') {
      try {
        const session=await createCheckoutSession({orderId:order.order_id,kitchenName:order.kitchen_name,buyerEmail:user.email??null,
          lines:[{name:'Pickup from '+order.kitchen_name+(order.discount_cents?' (reward applied)':''),unitAmountCents:order.subtotal_cents,qty:1},
            // Itemised rather than folded into the food line, so the card
            // statement shows what the extra charge actually bought.
            ...(priorityCents?[{name:'Priority order',unitAmountCents:priorityCents,qty:1}]:[]),
            ...(order.tip_cents?[{name:'Tip for the kitchen',unitAmountCents:order.tip_cents,qty:1}]:[])]});
        const saved=await admin.from('orders').update({stripe_session_id:session.id}).eq('id',order.order_id);
        if(saved.error || !session.url) throw new Error('Checkout could not be saved.');
        destination=session.url;
      } catch {
        // Release stock and the reserved credit if payment setup failed.
        await admin.from('orders').update({status:'cancelled'}).eq('id',order.order_id).eq('payment_status','unpaid');
        return {error:'Card checkout could not start. Your unpaid order was cancelled; refresh to reuse any reward credit.'};
      }
    }
  } catch {
    return {error:'Ordering is temporarily unavailable. Your cart is still here. Please try again shortly.'};
  }
  revalidatePath('/rewards');
  revalidatePath('/cook');
  redirect(destination);
}

/**
 * Move an order one step along.
 *
 * `prepMinutes` is the cook's cooking estimate, offered when they accept. It is
 * the cook's claim about their own kitchen, so it is only ever read from a cook
 * — the buyer's copy of this action ignores it, and migration 0015 freezes the
 * column against anyone who does not own the kitchen regardless of what this
 * function does.
 */
export async function advanceOrder(orderId: string, to: OrderStatus, prepMinutes?: number) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, buyer_id, kitchen_id, scheduled_for, prep_minutes")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { error: "That order is no longer available." };

  const { data: owned } = await supabase
    .from("kitchens")
    .select("id")
    .eq("id", order.kitchen_id)
    .eq("owner_id", user.id)
    .maybeSingle();

  const actor: OrderActor | null = owned
    ? "cook"
    : order.buyer_id === user.id
      ? "buyer"
      : null;
  if (!actor) return { error: "You are not a party to this order." };

  const problem = transitionError(order.status as OrderStatus, to, actor);
  if (problem) return { error: problem };

  const patch: Record<string, unknown> = { status: to };
  if (to === "completed") patch.completed_at = new Date().toISOString();
  if (to === "accepted") {
    patch.address_revealed_at = new Date().toISOString();

    // Accepting is when the estimate becomes a real promise to a waiting
    // person, so it is written here rather than left to a second round trip
    // the cook might never make.
    const minutes = actor === "cook" ? parsePrepMinutes(prepMinutes) : null;
    const effective = minutes ?? order.prep_minutes;
    if (effective) {
      patch.prep_minutes = effective;
      patch.ready_estimate_at = readyEstimateAt(
        new Date(),
        effective,
        order.scheduled_for ? new Date(order.scheduled_for) : null,
      ).toISOString();
    }
  }

  // Re-assert the starting status so two taps in flight cannot double-advance.
  const { data: updated, error } = await supabase
    .from("orders")
    .update(patch)
    .eq("id", orderId)
    .eq("status", order.status)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!updated) return { error: "That order just changed. Refresh and try again." };

  revalidatePath("/cook");
  revalidatePath("/cook/payments");
  revalidatePath(`/order/${orderId}`);
  return { ok: true };
}

/**
 * Revise the cooking estimate on an order already accepted.
 *
 * The case this exists for is a cook running late. Telling somebody standing in
 * a doorway that their food needs another fifteen minutes is worth more than an
 * estimate that quietly stays wrong, so this is deliberately allowed to move the
 * time in either direction — and the buyer is notified when it does.
 *
 * A scheduled pickup is not moved by it: the buyer booked a time, and the
 * estimate only decides when the cook has to start.
 */
export async function setReadyEstimate(orderId: string, prepMinutes: number) {
  const minutes = parsePrepMinutes(prepMinutes);
  if (minutes === null) return { error: "Enter a whole number of minutes, 5 to 240." };

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, kitchen_id, scheduled_for")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { error: "That order is no longer available." };

  const { data: owned } = await supabase
    .from("kitchens")
    .select("id")
    .eq("id", order.kitchen_id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!owned) return { error: "Only the kitchen can change the cooking time." };

  if (order.status !== "accepted" && order.status !== "pending") {
    return { error: "The cooking time can only change while the food is still being made." };
  }

  const { error } = await supabase
    .from("orders")
    .update({
      prep_minutes: minutes,
      ready_estimate_at: readyEstimateAt(
        new Date(),
        minutes,
        order.scheduled_for ? new Date(order.scheduled_for) : null,
      ).toISOString(),
    })
    .eq("id", orderId);
  if (error) return { error: error.message };

  revalidatePath("/cook");
  revalidatePath(`/order/${orderId}`);
  return { ok: true };
}
