/**
 * End-to-end verification of the order lifecycle, run as REAL users against
 * the anon key so RLS applies exactly as it would in the browser.
 *
 * Proves the four claims the demo rests on:
 *   1. a stranger cannot read a kitchen's exact address
 *   2. accepting an order reveals it to that buyer, and only that buyer
 *   3. completing an order auto-creates a verified log (the check-in)
 *   4. the credibility counters move as a result
 *
 * Run: npm run verify
 */

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PW = "dishd-demo-1234";

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
let failures = 0;

function check(label, ok, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function asUser(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PW });
  if (error) throw new Error(`sign in ${email}: ${error.message}`);
  return c;
}

const { data: kitchen } = await admin
  .from("kitchens")
  .select("id, name, slug, owner_id, orders_completed, avg_rating_10")
  .eq("slug", "aminas-kitchen")
  .single();

const { data: item } = await admin
  .from("menu_items")
  .select("id, name, price_cents, meat_type, contains_meat")
  .eq("kitchen_id", kitchen.id)
  .eq("contains_meat", true)
  .limit(1)
  .single();

console.log(`\nVerifying against ${kitchen.name} / ${item.name}\n`);

const buyer = await asUser("tariq@dishd.test");
const cook = await asUser("amina@dishd.test");

// A genuinely unrelated user. Seeded buyers all have completed orders at every
// kitchen, so they can legitimately see addresses — using one here would test
// nothing. This account is created fresh and deleted at the end.
const strangerEmail = `stranger-${Date.now()}@dishd.test`;
const { data: madeStranger } = await admin.auth.admin.createUser({
  email: strangerEmail, password: PW, email_confirm: true,
});
await admin.from("profiles").insert({
  id: madeStranger.user.id, handle: `stranger${Date.now()}`,
  display_name: "Unrelated User", city: "Fremont, CA",
});
const other = await asUser(strangerEmail);

const { data: buyerUser } = await buyer.auth.getUser();
const buyerId = buyerUser.user.id;

/* 1 ------------------------------------------------- address hidden first */
// Clear any prior orders so this buyer starts with no claim on the address.
await admin.from("orders").delete().eq("buyer_id", buyerId).eq("kitchen_id", kitchen.id);

const before = await buyer.from("kitchen_addresses").select("line1").eq("kitchen_id", kitchen.id);
check("exact address hidden from a buyer with no accepted order",
  (before.data ?? []).length === 0, `${(before.data ?? []).length} rows`);

const anon = createClient(URL, ANON, { auth: { persistSession: false } });
const anonRead = await anon.from("kitchen_addresses").select("line1").eq("kitchen_id", kitchen.id);
check("exact address hidden from a signed-out visitor",
  (anonRead.data ?? []).length === 0, `${(anonRead.data ?? []).length} rows`);

/* 2 ------------------------------------------------------- place an order */
const { data: order, error: orderErr } = await buyer
  .from("orders")
  .insert({
    buyer_id: buyerId, kitchen_id: kitchen.id, status: "pending",
    payment_method: "cash", subtotal_cents: item.price_cents,
  })
  .select("id, pickup_code, status")
  .single();
check("buyer can place an order", !orderErr && Boolean(order), orderErr?.message ?? "");
if (!order) { console.log("\ncannot continue\n"); process.exit(1); }

await buyer.from("order_items").insert({
  order_id: order.id, menu_item_id: item.id, qty: 1,
  unit_price_cents: item.price_cents, name_snapshot: item.name,
  meat_snapshot: item.meat_type,
  provenance_snapshot: { store: "Al-Salam Halal Meats", frozen_at_order: true },
});

const pendingRead = await buyer.from("kitchen_addresses").select("line1").eq("kitchen_id", kitchen.id);
check("address still hidden while the order is only pending",
  (pendingRead.data ?? []).length === 0, `${(pendingRead.data ?? []).length} rows`);

/* 3 ---------------------------------------------------------- cook accepts */
const { error: acceptErr } = await cook
  .from("orders")
  .update({ status: "accepted", address_revealed_at: new Date().toISOString() })
  .eq("id", order.id);
check("cook can accept the order", !acceptErr, acceptErr?.message ?? "");

const afterAccept = await buyer.from("kitchen_addresses").select("line1, city, zip").eq("kitchen_id", kitchen.id);
check("address revealed to the buyer after acceptance",
  (afterAccept.data ?? []).length === 1,
  afterAccept.data?.[0]?.line1 ?? "no rows");

const otherRead = await other.from("kitchen_addresses").select("line1").eq("kitchen_id", kitchen.id);
check("address STILL hidden from an unrelated signed-in user",
  (otherRead.data ?? []).length === 0,
  (otherRead.data ?? []).length ? "LEAKED" : "0 rows");

/* 4 ------------------------------------------------- complete -> auto-log */
const before2 = await admin.from("kitchens")
  .select("orders_completed").eq("id", kitchen.id).single();

await cook.from("orders").update({ status: "ready" }).eq("id", order.id);
const { error: completeErr } = await cook
  .from("orders").update({ status: "completed" }).eq("id", order.id);
check("cook can complete the order", !completeErr, completeErr?.message ?? "");

const { data: log } = await admin
  .from("logs").select("id, is_verified, rating_10, buyer_id")
  .eq("order_id", order.id).maybeSingle();

check("completing auto-created a log (the order IS the check-in)", Boolean(log));
check("that log is marked verified", log?.is_verified === true);
check("it starts unrated, awaiting the buyer's review", log?.rating_10 === null);
check("it belongs to the buyer", log?.buyer_id === buyerId);

const after2 = await admin.from("kitchens")
  .select("orders_completed").eq("id", kitchen.id).single();
check("orders_completed counter incremented",
  after2.data.orders_completed === before2.data.orders_completed + 1,
  `${before2.data.orders_completed} -> ${after2.data.orders_completed}`);

/* 5 ------------------------------------------- buyer cannot forge a review */
const { error: forgeErr } = await other.from("logs").insert({
  buyer_id: buyerId, kitchen_id: kitchen.id, rating_10: 10, is_verified: true,
});
check("a user cannot write a log as somebody else", Boolean(forgeErr),
  forgeErr ? "blocked by RLS" : "NOT BLOCKED");

/* 6 ------------------------------- verification cannot be forged (0004) */
// A buyer owns what their review SAYS, never whether it COUNTS. Without the
// trigger from migration 0004 this passes and the whole "transaction-backed"
// claim collapses.
const { data: unver } = await admin
  .from("logs")
  .insert({ buyer_id: buyerId, kitchen_id: kitchen.id, rating_10: 2, is_verified: false })
  .select("id")
  .single();

await buyer.from("logs")
  .update({ is_verified: true, rating_10: 10, body: "edited" })
  .eq("id", unver.id);

const { data: forged } = await admin
  .from("logs").select("is_verified, rating_10, body").eq("id", unver.id).single();

check("a buyer cannot promote their own log to verified",
  forged.is_verified === false,
  forged.is_verified ? "FORGED — apply migration 0004" : "provenance frozen");
check("but they can still edit what the review says",
  forged.rating_10 === 10 && forged.body === "edited",
  `rating ${forged.rating_10}`);

await admin.from("logs").delete().eq("id", unver.id);

/* cleanup */
await admin.from("orders").delete().eq("id", order.id);
await admin.auth.admin.deleteUser(madeStranger.user.id);

console.log(
  failures === 0
    ? "\n  all checks passed\n"
    : `\n  ${failures} check(s) failed\n`,
);
process.exit(failures === 0 ? 0 : 1);
