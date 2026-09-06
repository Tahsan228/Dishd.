import assert from "node:assert/strict";

export async function testDiscovery({ db, check, scalar, denied, actor, cook, buyer, stranger, kitchen }) {
  await actor();
  const dish = await scalar("insert into menu_items(kitchen_id,name,price_cents,contains_meat,daily_qty,allergens) values($1,'Discovery test tray',1600,false,100,'{}') returning id", [kitchen]);
  async function pickup(who = buyer, completed = true) {
    await actor();
    const id = await scalar("insert into orders(buyer_id,kitchen_id,payment_method,subtotal_cents) values($1,$2,'cash',1600) returning id", [who,kitchen]);
    const line = await scalar("insert into order_items(order_id,menu_item_id,name_snapshot,unit_price_cents,qty) values($1,$2,'Discovery test tray',1600,1) returning id", [id,dish]);
    if (completed) await db.query("update orders set status='completed',completed_at=now() where id=$1", [id]);
    return { id, line, log: await scalar("select id from logs where order_id=$1",[id]) };
  }
  const one = await pickup(), two = await pickup(stranger), pending = await pickup(buyer,false), self = await pickup(cook);
  await actor(cook);
  await check("Only owners publish their kitchen declarations",async()=>{
    await db.query("insert into kitchen_discovery_claims(kitchen_id,zabiha_claimed) values($1,true)",[kitchen]);
    await db.query("insert into menu_discovery(menu_item_id,serves,meal_tags) values($1,4,array['family_trays','iftar'])",[dish]);
    await actor(stranger);
    await db.query("update kitchen_discovery_claims set zabiha_claimed=false where kitchen_id=$1",[kitchen]);
    assert.equal(await scalar("select zabiha_claimed from kitchen_discovery_claims where kitchen_id=$1",[kitchen]),true);
    await denied("insert into menu_discovery(menu_item_id,serves) values($1,9) on conflict(menu_item_id) do update set serves=9",[dish]);
  });
  await actor(cook);
  await check("Offer expiry, serving counts and tags are validated in PostgreSQL",async()=>{
    await denied("update menu_discovery set serves=0 where menu_item_id=$1",[dish]);
    await denied("update menu_discovery set meal_tags=array['certified'] where menu_item_id=$1",[dish]);
    await denied("update menu_discovery set offer_title='Special' where menu_item_id=$1",[dish]);
  });
  await check("Cooks cannot rate their own completed purchases",()=>denied("insert into dish_ratings(order_item_id,rating_10) values($1,10)",[self.line]));
  await actor(buyer);
  await check("Ratings require a completed pickup belonging to the buyer",async()=>{
    await denied("insert into dish_ratings(order_item_id,rating_10) values($1,10)",[pending.line]);
    await denied("insert into dish_ratings(order_item_id,rating_10) values($1,10)",[two.line]);
    await denied("insert into dish_ratings(order_item_id,rating_10) values($1,11)",[one.line]);
  });
  const save = "select dishd_save_pickup_review($1,$2,$3)";
  const review = { rating_10: 8, body: "A good pickup", photo_urls: [], sourcing_affirmed: null, flavor_rating_10: 8, value_rating_10: 7, quality_rating_10: 9 };
  const prior = Number(await scalar("select sum(points) from reward_events"));
  await check("One save records the pickup review and its independent dish rating",async()=>{
    await db.query(save,[one.log,JSON.stringify(review),JSON.stringify([{order_item_id:one.line,rating_10:6}])]);
    assert.equal(await scalar("select rating_10 from logs where id=$1",[one.log]),8);
    assert.equal(Number(await scalar("select avg_rating_10 from dish_rating_summaries where menu_item_id=$1",[dish])),6);
    assert.equal(Number(await scalar("select sum(points) from reward_events")),prior+20);
  });
  await check("Editing a dish rating changes its average without duplicate ratings or rewards",async()=>{
    await db.query(save,[one.log,JSON.stringify(review),JSON.stringify([{order_item_id:one.line,rating_10:10}])]);
    assert.equal(await scalar("select rating_count from dish_rating_summaries where menu_item_id=$1",[dish]),1);
    assert.equal(Number(await scalar("select sum(points) from reward_events")),prior+20);
  });
  await check("Foreign dishes roll back the whole review and rating save",async()=>{
    await denied(save,[one.log,JSON.stringify({...review,rating_10:2}),JSON.stringify([{order_item_id:one.line,rating_10:1},{order_item_id:two.line,rating_10:1}])]);
    assert.equal(await scalar("select rating_10 from logs where id=$1",[one.log]),8);
    assert.equal(await scalar("select rating_10 from dish_ratings where order_item_id=$1",[one.line]),10);
  });
  await check("A rating cannot be moved to a forged purchase or menu item",async()=>{
    await db.query("update dish_ratings set order_item_id=$1,menu_item_id=$2 where order_item_id=$3",[two.line,crypto.randomUUID(),one.line]);
    assert.equal(await scalar("select menu_item_id from dish_ratings where order_item_id=$1",[one.line]),dish);
  });
  await actor(stranger);
  await check("Another buyer cannot open or edit private dish rating records",async()=>{
    assert.equal(Number(await scalar("select count(*) from dish_ratings")),0);
    await denied(save,[one.log,JSON.stringify(review),'[]']);
  });
  await db.query("insert into dish_ratings(order_item_id,rating_10) values($1,6)",[two.line]);
  await check("Public dish averages combine separate completed purchases",async()=>{
    await actor(); await db.exec("set role anon");
    assert.equal(Number(await scalar("select count(*) from dish_ratings")),0);
    const summary=(await db.query("select rating_count,avg_rating_10 from dish_rating_summaries where menu_item_id=$1",[dish])).rows[0];
    assert.equal(summary.rating_count,2);assert.equal(Number(summary.avg_rating_10),8);
  });
  await actor();
  await check("Deleting a purchase line removes its contribution from public averages",async()=>{
    await db.query("delete from order_items where id=$1",[two.line]);
    assert.equal(await scalar("select rating_count from dish_rating_summaries where menu_item_id=$1",[dish]),1);
    assert.equal(Number(await scalar("select avg_rating_10 from dish_rating_summaries where menu_item_id=$1",[dish])),10);
  });
  await actor(buyer);
  await check("Clients cannot forge dish rating aggregates",()=>denied("insert into dish_rating_summaries(menu_item_id,rating_count,avg_rating_10) values($1,9999,10) on conflict(menu_item_id) do update set rating_count=9999",[dish]));
  await check("Reward summary includes the whole private ledger and preserves redemption deductions",async()=>{
    const expected = (await db.query("select sum(points) balance,sum(greatest(points,0)) earned from reward_events")).rows[0];
    const actual = (await db.query("select * from dishd_reward_summary()")).rows[0];
    assert.deepEqual(actual,expected);
    await actor(stranger);
    assert.equal(Number(await scalar("select balance from dishd_reward_summary()")),Number(await scalar("select sum(points) from reward_events where user_id=$1",[stranger])));
  });
  await actor();
}
