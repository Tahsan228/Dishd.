import assert from "node:assert/strict";

/**
 * Migration 0015: scheduled pickups, paid priority, the cook's estimate, and
 * the kitchens counter guard.
 *
 * Every check here is a rule the UI also enforces. The point of running them in
 * real PostgreSQL is that the UI is not the boundary — the Supabase REST API is
 * public, so what matters is what a crafted request can do.
 */
export async function testTiming({ db, check, scalar, denied, actor, cook, buyer, stranger, kitchen }) {
  await actor();

  const item = await scalar(
    "insert into menu_items(kitchen_id,name,price_cents,contains_meat,daily_qty,allergens) values($1,'Timing test meal',1000,false,100,'{}') returning id",
    [kitchen],
  );

  // p_tip_cents, p_priority, p_scheduled_for.
  const sql =
    "select * from dishd_place_order($1,$2,$3,$4,null,'2026-09-05.2',$5,null,'timing test',$6,$7,$8)";
  const base = [
    buyer,
    kitchen,
    JSON.stringify([{ id: item, qty: 1 }]),
    "cash",
    JSON.stringify(["quality", "allergens", "halal"]),
    0,
    false,
    null,
  ];
  const withArgs = (patch) => Object.assign([...base], patch);

  /** A quarter-hour instant a whole number of hours out, as SQL sees the clock. */
  const slotIn = (hours) =>
    scalar(`select date_trunc('hour', now() + interval '${hours} hours')`);

  /* ------------------------------------------------------------ scheduling --- */

  await check("A pickup must be a whole quarter hour", async () => {
    const offStep = await scalar("select date_trunc('hour', now() + interval '3 hours') + interval '7 minutes'");
    await denied(sql, withArgs({ 7: offStep }));
    const withSeconds = await scalar("select date_trunc('hour', now() + interval '3 hours') + interval '30 seconds'");
    await denied(sql, withArgs({ 7: withSeconds }));
  });

  await check("A pickup cannot be inside the 30-minute lead time or in the past", async () => {
    await denied(sql, withArgs({ 7: await scalar("select date_trunc('hour', now())") }));
    await denied(sql, withArgs({ 7: await scalar("select date_trunc('hour', now() - interval '2 hours')") }));
  });

  await check("A pickup cannot be past the seven-day horizon", () =>
    denied(sql, withArgs({ 7: scalar("select date_trunc('hour', now() + interval '8 days')") })));

  const booked = (await db.query(sql, withArgs({ 7: await slotIn(3) }))).rows[0];
  await check("A valid slot is stored on the order and returned", async () => {
    assert.ok(booked.scheduled_for, "the RPC returns the booked instant");
    assert.equal(
      await scalar("select scheduled_for = $2 from orders where id=$1", [booked.order_id, booked.scheduled_for]),
      true,
    );
    // The kitchen's default seeds the estimate, so a cook is never asked to
    // invent a number from nothing.
    assert.equal(await scalar("select prep_minutes from orders where id=$1", [booked.order_id]), 25);
  });

  await check("A kitchen that has stopped taking bookings refuses them", async () => {
    await db.query("update kitchens set accepts_scheduled=false where id=$1", [kitchen]);
    await denied(sql, withArgs({ 7: await slotIn(4) }));
    await db.query("update kitchens set accepts_scheduled=true where id=$1", [kitchen]);
  });

  /* -------------------------------------------------------------- priority --- */

  await check("Priority is refused outright by a kitchen that does not sell it", async () => {
    assert.equal(await scalar("select priority_fee_cents from kitchens where id=$1", [kitchen]), 0);
    // Refusing beats charging nothing: a buyer told they bought priority must
    // actually have bought it.
    await denied(sql, withArgs({ 6: true }));
  });

  await db.query("update kitchens set priority_fee_cents=200 where id=$1", [kitchen]);
  const priority = (await db.query(sql, withArgs({ 6: true }))).rows[0];

  await check("The fee comes from the kitchen, not the caller", async () => {
    assert.equal(priority.priority_fee_cents, 200);
    assert.equal(
      await scalar("select priority_fee_cents from orders where id=$1", [priority.order_id]),
      200,
    );
  });

  await check("Priority joins food in the 5% commission base", async () =>
    // (1000 + 200 + 10) / 20 = 60. Tips stay outside it, as 0011 set out.
    assert.equal(await scalar("select cash_fee_cents from orders where id=$1", [priority.order_id]), 60));

  await check("A tip stays outside the base even alongside priority", async () => {
    const tipped = (await db.query(sql, withArgs({ 5: 500, 6: true }))).rows[0];
    assert.equal(tipped.tip_cents, 500);
    assert.equal(await scalar("select cash_fee_cents from orders where id=$1", [tipped.order_id]), 60);
  });

  /* ----------------------------------------------- what a buyer may rewrite --- */

  await actor(buyer);
  await check("Buyers cannot drop the priority fee they agreed to", async () => {
    await db.query("update orders set priority_fee_cents=0 where id=$1", [priority.order_id]);
    assert.equal(
      await scalar("select priority_fee_cents from orders where id=$1", [priority.order_id]),
      200,
    );
  });

  await check("Buyers cannot move a booked pickup", async () => {
    const before = await scalar("select scheduled_for from orders where id=$1", [booked.order_id]);
    await db.query("update orders set scheduled_for=now()+interval '10 minutes' where id=$1", [booked.order_id]);
    assert.equal(
      await scalar("select scheduled_for = $2 from orders where id=$1", [booked.order_id, before]),
      true,
    );
  });

  await check("Buyers cannot write their own cooking estimate", async () => {
    await db.query("update orders set prep_minutes=5, ready_estimate_at=now() where id=$1", [priority.order_id]);
    assert.equal(await scalar("select prep_minutes from orders where id=$1", [priority.order_id]), 25);
    assert.equal(await scalar("select ready_estimate_at is null from orders where id=$1", [priority.order_id]), true);
  });

  await check("A stranger can neither read the order nor change it", async () => {
    await actor(stranger);
    // Not even visible: dishd_can_see_order() stops a third party a step
    // earlier than the column guards do.
    assert.equal(Number(await scalar("select count(*) from orders where id=$1", [priority.order_id])), 0);
    await db.query("update orders set prep_minutes=5 where id=$1", [priority.order_id]);
    await actor();
    assert.equal(await scalar("select prep_minutes from orders where id=$1", [priority.order_id]), 25);
  });

  /* ------------------------------------------------------ what a cook may do --- */

  await actor(cook);
  await check("The cook sets and revises the estimate", async () => {
    await db.query("update orders set status='accepted', prep_minutes=40, ready_estimate_at=now()+interval '40 minutes' where id=$1", [priority.order_id]);
    assert.equal(await scalar("select prep_minutes from orders where id=$1", [priority.order_id]), 40);

    // Running late is the case this exists for, so it moves in both directions.
    await db.query("update orders set prep_minutes=60, ready_estimate_at=now()+interval '60 minutes' where id=$1", [priority.order_id]);
    assert.equal(await scalar("select prep_minutes from orders where id=$1", [priority.order_id]), 60);
  });

  await check("The cook sets their own trading terms", async () => {
    await db.query("update kitchens set default_prep_minutes=45, priority_fee_cents=350, accepts_scheduled=false where id=$1", [kitchen]);
    assert.equal(await scalar("select default_prep_minutes from kitchens where id=$1", [kitchen]), 45);
    assert.equal(await scalar("select priority_fee_cents from kitchens where id=$1", [kitchen]), 350);
    await db.query("update kitchens set accepts_scheduled=true where id=$1", [kitchen]);
  });

  await check("Out-of-range terms are refused by the database, not just the form", async () => {
    await denied("update kitchens set default_prep_minutes=1 where id=$1", [kitchen]);
    await denied("update kitchens set default_prep_minutes=999 where id=$1", [kitchen]);
    await denied("update kitchens set priority_fee_cents=2001 where id=$1", [kitchen]);
    await denied("update kitchens set priority_fee_cents=-1 where id=$1", [kitchen]);
  });

  /* --------------------------------------------- the kitchens counter guard --- */

  await check("A cook cannot buy their own credibility", async () => {
    const before = await db.query(
      "select orders_completed, avg_rating_10, revenue_cents, distinct_customers, trust_streak from kitchens where id=$1",
      [kitchen],
    );
    await db.query(
      `update kitchens set orders_completed=400, avg_rating_10=5, revenue_cents=900000,
              distinct_customers=400, repeat_customers=400, trust_streak=99,
              upheld_flags=0, open_incidents=0, cook_cancellations=0
       where id=$1`,
      [kitchen],
    );
    const after = await db.query(
      "select orders_completed, avg_rating_10, revenue_cents, distinct_customers, trust_streak from kitchens where id=$1",
      [kitchen],
    );
    assert.deepEqual(after.rows[0], before.rows[0]);
  });

  await check("A cook cannot verify their own permit or lift a ban", async () => {
    await db.query("update kitchens set permit_status='verified' where id=$1", [kitchen]);
    assert.notEqual(await scalar("select permit_status from kitchens where id=$1", [kitchen]), "verified");
    await denied("update kitchens set status='banned' where id=$1", [kitchen]);
  });

  await check("A cook cannot re-point their kitchen, move it, or grant itself payouts", async () => {
    const columns = "owner_id, slug, approx_lat, approx_lng, neighborhood_label, stripe_account_id, stripe_onboarded";
    // Compared against whatever the row already held rather than against
    // assumed values: earlier suites trade through this same kitchen.
    const before = (await db.query(`select ${columns} from kitchens where id=$1`, [kitchen])).rows[0];
    await db.query(
      `update kitchens set owner_id=$2, slug='stolen', approx_lat=0, approx_lng=0,
              neighborhood_label='Elsewhere', stripe_account_id='acct_forged',
              stripe_onboarded = not stripe_onboarded
       where id=$1`,
      [kitchen, stranger],
    );
    const after = (await db.query(`select ${columns} from kitchens where id=$1`, [kitchen])).rows[0];
    assert.deepEqual(after, before);
    assert.equal(after.owner_id, cook);
  });

  await check("Completing an order still updates the counters it should", async () => {
    // The guard cannot simply freeze these: dishd_recompute_kitchen() runs from
    // a trigger on orders under the cook's own JWT. Trigger depth is what
    // separates that from a direct PATCH, and this is the check that proves it.
    const before = Number(await scalar("select orders_completed from kitchens where id=$1", [kitchen]));
    await db.query("update orders set status='ready' where id=$1", [priority.order_id]);
    await db.query("update orders set status='completed', completed_at=now() where id=$1", [priority.order_id]);
    assert.equal(
      Number(await scalar("select orders_completed from kitchens where id=$1", [kitchen])),
      before + 1,
    );
  });

  await check("A completed order's priority fee counts as revenue", async () =>
    // It is money the kitchen took, so the Business Record has to show it.
    assert.equal(
      Number(await scalar("select revenue_cents from kitchens where id=$1", [kitchen])),
      Number(await scalar(
        "select coalesce(sum(subtotal_cents + priority_fee_cents),0) from orders where kitchen_id=$1 and status='completed'",
        [kitchen],
      )),
    ));

  await actor();
}
