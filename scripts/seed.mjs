/**
 * Dishd seed data.
 *
 * Run: npm run seed        (idempotent — wipes and rebuilds the demo data)
 *
 * Two deliberate choices worth knowing:
 *
 *  1. Orders are inserted as 'pending' and then UPDATED to 'completed', rather
 *     than inserted completed. That fires dishd_autolog_on_complete(), so the
 *     verified log rows and every credibility counter are produced by the real
 *     triggers. If the seed looks right, the mechanic genuinely works.
 *
 *  2. Kitchens are spread across all four credibility tiers, plus one banned
 *     tombstone, so every visual state has something to render.
 *
 * Location is Bergen County NJ — a dense, heavily Muslim corridor with a large
 * Afghan, Pakistani and Yemeni community, so the premise is plausible.
 */

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

/** Real sha256 so seed hashes cannot collide through padding. */
const sha = (s) => createHash("sha256").update(s).digest("hex");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env. Run with: npm run seed");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const img = (id, w = 800) => `https://images.unsplash.com/photo-${id}?w=${w}&q=70`;
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();
const dateAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

/** Deterministic ~400m offset. Never re-randomised: averaging noise defeats it. */
function fuzz(lat, lng, seed) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const angle = (h % 360) * (Math.PI / 180);
  const dist = 0.0028 + ((h >> 9) % 15) * 0.00009; // ~310-450m
  return [
    +(lat + dist * Math.cos(angle)).toFixed(6),
    +(lng + dist * Math.sin(angle)).toFixed(6),
  ];
}

/** Hackensack, Bergen County NJ — the launch market. */
const BERGEN = [40.8859, -74.0435];

/* ------------------------------------------------------------------ people */

const COOKS = [
  { h: "amina", name: "Amina Yusuf", email: "amina@dishd.test" },
  { h: "hafsa", name: "Hafsa Rahman", email: "hafsa@dishd.test" },
  { h: "omar", name: "Omar Siddiqui", email: "omar@dishd.test" },
  { h: "layla", name: "Layla Haddad", email: "layla@dishd.test" },
  { h: "bilal", name: "Bilal Ahmed", email: "bilal@dishd.test" },
  { h: "nadia", name: "Nadia Karimi", email: "nadia@dishd.test" },
];

const BUYERS = [
  { h: "yusuf", name: "Yusuf Ali", email: "yusuf@dishd.test", city: "Hackensack, NJ" },
  { h: "mariam", name: "Mariam Chen", email: "mariam@dishd.test", city: "Teaneck, NJ" },
  { h: "zaid", name: "Zaid Patel", email: "zaid@dishd.test", city: "Hackensack, NJ" },
  { h: "sana", name: "Sana Iqbal", email: "sana@dishd.test", city: "Fort Lee, NJ" },
  { h: "tariq", name: "Tariq Osman", email: "tariq@dishd.test", city: "Paterson, NJ" },
];

const STORES = [
  { name: "Al-Khayam Halal Meat", address: "195 Main St", city: "Hackensack", state: "NJ", cert_body: "HFSAA" },
  { name: "Madina Halal Market", address: "418 Cedar Ln", city: "Teaneck", state: "NJ", cert_body: "IFANCA" },
  { name: "Zaytuna Meat & Grocery", address: "2140 Lemoine Ave", city: "Fort Lee", state: "NJ", cert_body: "HFSAA" },
  { name: "Kabul Halal Foods", address: "356 Main St", city: "Paterson", state: "NJ", cert_body: "HFSAA" },
  { name: "Sahara Halal Market", address: "742 Anderson Ave", city: "Cliffside Park", state: "NJ", cert_body: "IFANCA" },
  { name: "Bergen Halal Butchers", address: "24-16 Broadway", city: "Fair Lawn", state: "NJ", cert_body: "HFSAA" },
];

/**
 * Counters are trigger-derived, so tiers are produced by real volume rather
 * than written directly. `orders` and `streak` below are what generate them.
 */
const KITCHENS = [
  {
    slug: "aminas-kitchen", owner: "amina", name: "Amina's Kitchen",
    bio: "Slow-cooked Afghan and Pakistani home food. Everything made the morning you collect it, in a kitchen my grandmother taught me to run.",
    tags: ["Afghan", "Pakistani", "Biryani"], hero: img("1563379091339-03b21ab4a4f8"),
    hood: "Fairmount, Hackensack", addr: "212 Union St", zip: "07601",
    permit: "verified", permitNo: "NJ-CFO-BER-2024-0187",
    orders: 40, streak: 12, rating: [9, 10, 9, 10, 8, 10, 9, 10],
    age: 150, card: true,
    items: [
      { n: "Kabuli Pulao", d: "Lamb shank slow-cooked under saffron rice, carrot and raisin.", p: 1650, meat: "lamb", a: ["tree_nuts"], img: img("1563379091339-03b21ab4a4f8", 600) },
      { n: "Chicken Biryani", d: "Long-grain sella rice, bone-in chicken, fried onion, kewra.", p: 1450, meat: "chicken", a: ["dairy"], img: img("1631452180519-c014fe946bc7", 600) },
      { n: "Mantu Dumplings", d: "Hand-folded beef dumplings, split pea sauce, dried mint.", p: 1200, meat: "beef", a: ["gluten", "dairy"], img: img("1585937421612-70a008356fbe", 600) },
      { n: "Bolani (Vegetarian)", d: "Flatbread stuffed with leek and potato. No meat.", p: 800, meat: null, a: ["gluten"], img: img("1601050690597-df0568f70950", 600) },
    ],
  },
  {
    slug: "hafsas-table", owner: "hafsa", name: "Hafsa's Table",
    bio: "Bengali fish and rice, cooked for my neighbours since 2023.",
    tags: ["Bengali", "Fish"], hero: img("1567620905732-2d1ec7ab7445"),
    hood: "Cedar Lane, Teaneck", addr: "1421 Palisade Ave", zip: "07666",
    permit: "verified", permitNo: "NJ-CFO-BER-2024-0203",
    orders: 25, streak: 5, rating: [9, 8, 9, 9, 8, 9], age: 96, card: true,
    items: [
      { n: "Beef Tehari", d: "Short-grain rice cooked with mustard oil and green chilli.", p: 1400, meat: "beef", a: ["mustard"], img: img("1546833999-b9f581a1996d", 600) },
      { n: "Chicken Rezala", d: "White curry with cashew, yoghurt and ghee.", p: 1350, meat: "chicken", a: ["dairy", "tree_nuts"], img: img("1606491956689-2ea866880c84", 600) },
      { n: "Dal & Rice", d: "Everyday red lentil with rice. Vegetarian.", p: 700, meat: null, a: ["none_declared"], img: img("1512058564366-18510be2db19", 600) },
    ],
  },
  {
    slug: "omars-grill", owner: "omar", name: "Omar's Grill",
    bio: "Charcoal kebabs on weekends. Small batches, collect while hot.",
    tags: ["Turkish", "Kebab"], hero: img("1601050690597-df0568f70950"),
    hood: "Main Street, Fort Lee", addr: "1590 Center Ave", zip: "07024",
    permit: "claimed", permitNo: "NJ-CFO-BER-2025-0411",
    orders: 12, streak: 2, rating: [8, 8, 9, 7, 8], age: 58, card: true,
    items: [
      { n: "Adana Kebab", d: "Hand-minced lamb on flat skewers, sumac onion.", p: 1500, meat: "lamb", a: ["none_declared"], img: img("1517248135467-4c7edcad34c4", 600) },
      { n: "Chicken Shish", d: "Yoghurt-marinated thigh, charcoal grilled.", p: 1300, meat: "chicken", a: ["dairy"], img: img("1565557623262-b51c2513a641", 600) },
    ],
  },
  {
    slug: "laylas-sofra", owner: "layla", name: "Layla's Sofra",
    bio: "Levantine mezze and slow-roast lamb. Fridays and Saturdays only.",
    tags: ["Levantine", "Mezze"], hero: img("1596797038530-2c107229654b"),
    hood: "South Paterson, Paterson", addr: "920 Main St", zip: "07503",
    permit: "claimed", permitNo: "NJ-CFO-PAS-2025-0455",
    orders: 8, streak: 1, rating: [9, 9, 10, 8], age: 44, card: false,
    items: [
      { n: "Lamb Ouzi", d: "Slow-roast shoulder over spiced rice and pine nut.", p: 1800, meat: "lamb", a: ["tree_nuts"], img: img("1596797038530-2c107229654b", 600) },
      { n: "Mezze Plate", d: "Hummus, mutabal, tabbouleh, warm bread. Vegetarian.", p: 1100, meat: null, a: ["gluten", "sesame"], img: img("1633945274405-b6c8069047b0", 600) },
    ],
  },
  {
    slug: "bilals-breakfast", owner: "bilal", name: "Bilal's Breakfast",
    bio: "Just started. Weekend halwa puri and chana, the way my mum makes it.",
    tags: ["Pakistani", "Breakfast"], hero: img("1512058564366-18510be2db19"),
    hood: "Bergenfield centre, Bergenfield", addr: "88 Washington Ave", zip: "07621",
    permit: "none", permitNo: null,
    orders: 2, streak: 0, rating: [8, 9], age: 16, card: false,
    items: [
      { n: "Halwa Puri", d: "Semolina halwa, fried puri, chana. Vegetarian.", p: 900, meat: null, a: ["gluten", "dairy"], img: img("1512058564366-18510be2db19", 600) },
    ],
  },
];

/* A banned kitchen so the accountability tombstone has something to show. */
const BANNED = {
  slug: "golden-pot", owner: "nadia", name: "The Golden Pot",
  bio: "Formerly listed on Dishd.",
  tags: ["Mixed"], hero: img("1546833999-b9f581a1996d"),
  hood: "Palisade Ave, Cliffside Park", addr: "640 Anderson Ave", zip: "07010",
  reason:
    "Sourcing misrepresentation: receipts submitted for meat that was not purchased from the declared halal supplier. Permanently removed 12 August 2026.",
};

/* -------------------------------------------------------------------- run */

async function wipe() {
  // Children first; most have ON DELETE CASCADE but be explicit.
  for (const t of ["log_likes", "logs", "order_items", "orders", "pickup_windows",
    "menu_items", "sourcing_batches", "halal_sources", "kitchen_badges",
    "kitchen_addresses", "kitchens", "user_badges", "agreements",
    "known_halal_stores"]) {
    await db.from(t).delete().neq("id", "00000000-0000-0000-0000-000000000000")
      .then(() => {}, () => {});
  }
  // Composite-key tables have no `id`; clear them by a always-true predicate.
  await db.from("kitchen_badges").delete().gte("earned_at", "1970-01-01");
  await db.from("user_badges").delete().gte("earned_at", "1970-01-01");
  await db.from("log_likes").delete().gte("log_id", "00000000-0000-0000-0000-000000000000");

  const { data } = await db.auth.admin.listUsers({ perPage: 200 });
  for (const u of data?.users ?? []) {
    if (u.email?.endsWith("@dishd.test")) await db.auth.admin.deleteUser(u.id);
  }
}

async function makeUser({ email, name, h, city }) {
  // Migration 0006 puts a trigger on auth.users that creates the profile from
  // this metadata, so the row already exists by the time createUser returns.
  // Upsert rather than insert, and pin the handle we want here rather than
  // letting the trigger derive one from the email.
  const { data, error } = await db.auth.admin.createUser({
    email, password: "dishd-demo-1234", email_confirm: true,
    user_metadata: { handle: h, display_name: name, city: city ?? "Hackensack, NJ" },
  });
  if (error) throw new Error(`${email}: ${error.message}`);
  const id = data.user.id;
  const { error: pe } = await db.from("profiles").upsert({
    id, handle: h, display_name: name, city: city ?? "Hackensack, NJ",
    bio: null, avatar_url: null,
  }, { onConflict: "id" });
  if (pe) throw new Error(`profile ${h}: ${pe.message}`);
  return id;
}

async function main() {
  console.log("wiping…");
  await wipe();

  console.log("stores…");
  await db.from("known_halal_stores").insert(STORES);

  console.log("people…");
  const ids = {};
  for (const p of [...COOKS, ...BUYERS]) ids[p.h] = await makeUser(p);
  const buyerIds = BUYERS.map((b) => ids[b.h]);

  console.log("kitchens…");
  for (const k of KITCHENS) {
    const [alat, alng] = fuzz(BERGEN[0], BERGEN[1], k.slug);
    const { data: kitchen, error } = await db.from("kitchens").insert({
      owner_id: ids[k.owner], name: k.name, slug: k.slug, bio: k.bio,
      hero_url: k.hero, cuisine_tags: k.tags,
      state_code: "NJ", county: "Bergen",
      mehko_permit_no: k.permitNo, permit_status: k.permit,
      approx_lat: alat, approx_lng: alng, neighborhood_label: k.hood,
      accepts_cash: true, accepts_card: k.card, stripe_onboarded: k.card,
      status: "active", created_at: daysAgo(k.age),
    }).select("id").single();
    if (error) throw new Error(`kitchen ${k.slug}: ${error.message}`);
    const kid = kitchen.id;

    await db.from("kitchen_addresses").insert({
      kitchen_id: kid, line1: k.addr, city: k.hood.split(", ").pop(), zip: k.zip,
      lat: BERGEN[0] + 0.004, lng: BERGEN[1] - 0.003,
    });

    // Halal sources: two per kitchen, drawn from the real directory.
    const picks = [STORES[0], STORES[1 + (k.slug.length % 4)]];
    const { data: sources } = await db.from("halal_sources").insert(
      picks.map((s) => ({
        kitchen_id: kid, store_name: s.name, store_address: `${s.address}, ${s.city}`,
        cert_body: s.cert_body, in_directory: true,
      })),
    ).select("id");

    // Verified batches produce the trust streak. One pending, to show the state.
    // Totals are salted per kitchen: the cross-kitchen (store,date,total) unique
    // index is real, and identical seed receipts would (correctly) collide.
    const salt = [...k.slug].reduce((a, c) => a + c.charCodeAt(0), 0) % 900;
    const batches = [];
    for (let i = 0; i < k.streak; i++) {
      batches.push({
        kitchen_id: kid, halal_source_id: sources[i % sources.length].id,
        receipt_path: `seed/${k.slug}-${i}.jpg`,
        image_sha256: sha(`${k.slug}:batch:${i}`),
        purchased_on: dateAgo(i * 5 + 1), ocr_store: picks[i % picks.length].name,
        ocr_total_cents: 4200 + salt * 7 + i * 315, ocr_date: dateAgo(i * 5 + 1),
        declared_meat_types: ["chicken", "lamb"],
        match_status: "verified", backs_items_until: dateAgo(i * 5 - 6),
        reviewed_at: daysAgo(i * 5), created_at: daysAgo(i * 5 + 1),
      });
    }
    if (k.streak > 0) {
      batches.push({
        kitchen_id: kid, halal_source_id: sources[0].id,
        receipt_path: `seed/${k.slug}-pending.jpg`,
        image_sha256: sha(`${k.slug}:pending`),
        purchased_on: dateAgo(0), ocr_store: picks[0].name,
        ocr_total_cents: 5310 + salt * 3, ocr_date: dateAgo(0),
        declared_meat_types: ["chicken"], match_status: "pending",
        backs_items_until: dateAgo(-7), created_at: daysAgo(0),
      });
    }
    const { data: madeBatches, error: be } = batches.length
      ? await db.from("sourcing_batches").insert(batches).select("id, match_status")
      : { data: [], error: null };
    if (be) throw new Error(`batches ${k.slug}: ${be.message}`);
    const verifiedBatch = (madeBatches ?? []).find((b) => b.match_status === "verified");

    const { data: items, error: ie } = await db.from("menu_items").insert(
      k.items.map((it) => ({
        kitchen_id: kid, name: it.n, description: it.d, price_cents: it.p,
        photo_url: it.img, contains_meat: Boolean(it.meat),
        meat_type: it.meat ?? "none",
        sourcing_batch_id: it.meat ? verifiedBatch?.id ?? null : null,
        allergens: it.a, is_available: true, daily_qty: 12,
      })).filter((it) => !it.contains_meat || it.sourcing_batch_id),
    ).select("id, name, price_cents, meat_type");
    if (ie) throw new Error(`menu ${k.slug}: ${ie.message}`);
    if (!items?.length) throw new Error(`no menu items created for ${k.slug}`);

    const start = new Date(Date.now() + 864e5);
    start.setHours(17, 30, 0, 0);
    const end = new Date(start); end.setHours(19, 30, 0, 0);
    await db.from("pickup_windows").insert({
      kitchen_id: kid, starts_at: start.toISOString(), ends_at: end.toISOString(), capacity: 12,
    });

    // Orders: insert pending, then update to completed so the REAL trigger runs.
    const orders = [];
    for (let i = 0; i < k.orders; i++) {
      orders.push({
        buyer_id: buyerIds[i % buyerIds.length], kitchen_id: kid,
        status: "pending", payment_method: i % 3 === 0 ? "card" : "cash",
        payment_status: i % 3 === 0 ? "paid" : "unpaid",
        subtotal_cents: items?.[i % items.length]?.price_cents ?? 1200,
        created_at: daysAgo(k.age - 4 - Math.floor((i / k.orders) * (k.age - 8))),
      });
    }
    const { data: madeOrders, error: oe } = await db.from("orders").insert(orders).select("id, buyer_id");
    if (oe) throw new Error(`orders ${k.slug}: ${oe.message}`);

    const oi = [];
    for (const [i, o] of (madeOrders ?? []).entries()) {
      const it = items[i % items.length];
      oi.push({
        order_id: o.id, menu_item_id: it.id, qty: 1, unit_price_cents: it.price_cents,
        name_snapshot: it.name, meat_snapshot: it.meat_type,
        provenance_snapshot: it.meat_type === "none" ? null : {
          store: picks[0].name, cert_body: picks[0].cert_body,
          verified_on: dateAgo(3), note: "Frozen at order time.",
        },
      });
    }
    if (oi.length) await db.from("order_items").insert(oi);

    // THE MECHANIC: this update fires dishd_autolog_on_complete().
    await db.from("orders")
      .update({ status: "completed", completed_at: daysAgo(2) })
      .in("id", (madeOrders ?? []).map((o) => o.id));

    // Trigger created a log per order with a null rating. Fill some in.
    const { data: logs } = await db.from("logs")
      .select("id").eq("kitchen_id", kid).order("logged_at", { ascending: false });

    const BODIES = [
      "Collected at six, still steaming when I got home. The rice had that proper layered smell you only get when someone actually stood over it.",
      "Third time ordering. Consistent every single time, which honestly is rarer than good.",
      "Portion was bigger than I expected and the meat fell off the bone. Will be back on Friday.",
      "Really good. Slightly heavy on the salt for me but my family disagreed loudly.",
      "You can tell this is someone's actual home cooking rather than a restaurant pretending.",
      "Picked up in five minutes, no fuss. Food was excellent and the sourcing was all listed up front which I appreciated.",
      "Ordered for four people and there was still some left. Good value, and the packaging held the heat properly on the drive back.",
      "Better than the restaurant version I usually get on this side of town, and about half the price.",
      "Kids ate all of it without complaint, which is the only review that matters in my house.",
    ];
    // Spread every log across the kitchen's trading history. The trigger stamps
    // each auto-log with now(), so without this the unrated check-ins all sort
    // above the written reviews and the feed looks empty.
    const all = logs ?? [];
    const span = Math.max(k.age - 6, 4);
    const updates = all.map((l, i) => {
      const rated = i % 5 !== 4;               // ~80% get a rating
      const writes = rated && i % 2 === 0;     // ~40% also write something
      return {
        id: l.id,
        rating_10: rated ? k.rating[i % k.rating.length] : null,
        body: writes ? BODIES[i % BODIES.length] : null,
        photo_url: writes && i % 3 === 0 ? k.items[i % k.items.length].img : null,
        sourcing_affirmed: rated ? true : null,
        logged_at: daysAgo(3 + Math.floor((i / Math.max(all.length, 1)) * span)),
      };
    });
    for (const u of updates) {
      await db.from("logs").update(u).eq("id", u.id);
    }

    const badges = [];
    if (k.streak >= 10) badges.push("chain_of_trust");
    if (k.permit === "verified") badges.push("permit_verified");
    if (k.orders >= 100) badges.push("hundred_meals");
    badges.push("founding_kitchen");
    await db.from("kitchen_badges").insert(
      badges.map((b) => ({ kitchen_id: kid, badge_code: b })),
    );

    console.log(`  ${k.name} — ${k.orders} orders, streak ${k.streak}`);
  }

  console.log("banned kitchen…");
  const [blat, blng] = fuzz(BERGEN[0], BERGEN[1], BANNED.slug);
  await db.from("kitchens").insert({
    owner_id: ids[BANNED.owner], name: BANNED.name, slug: BANNED.slug,
    bio: BANNED.bio, hero_url: BANNED.hero, cuisine_tags: BANNED.tags,
    state_code: "NJ", county: "Bergen", permit_status: "none",
    approx_lat: blat, approx_lng: blng, neighborhood_label: BANNED.hood,
    status: "banned", banned_reason: BANNED.reason, banned_at: daysAgo(24),
    created_at: daysAgo(200),
  });

  await db.from("user_badges").insert(
    BUYERS.map((b) => ({ user_id: ids[b.h], badge_code: "founding_taster" })),
  );

  const { data: check } = await db.from("kitchens")
    .select("name, slug, orders_completed, avg_rating_10, trust_streak, repeat_customers, status")
    .order("orders_completed", { ascending: false });

  console.log("\n  trigger-derived counters:");
  for (const k of check ?? []) {
    console.log(
      `    ${k.slug.padEnd(20)} orders ${String(k.orders_completed).padStart(3)}` +
      `  rating ${String(k.avg_rating_10).padStart(5)}  streak ${String(k.trust_streak).padStart(2)}` +
      `  repeat ${String(k.repeat_customers).padStart(2)}  ${k.status}`,
    );
  }
  console.log("\n  login for any seeded account: password 'dishd-demo-1234'\n");
}

main().catch((e) => { console.error("\nSEED FAILED:", e.message); process.exit(1); });
