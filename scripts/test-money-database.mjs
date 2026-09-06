import assert from "node:assert/strict";

export async function testMoney({ db, check, scalar, denied, actor, cook, buyer, stranger, kitchen }) {
  await actor();
  const item = await scalar("insert into menu_items(kitchen_id,name,price_cents,contains_meat,daily_qty,allergens) values($1,'Tip test meal',1990,false,100,'{}') returning id",[kitchen]);
  const sql = "select * from dishd_place_order($1,$2,$3,$4,null,'2026-09-05.2',$5,null,'money test',$6)";
  const args = [buyer,kitchen,JSON.stringify([{id:item,qty:1}]),"cash",JSON.stringify(["quality","allergens","halal"]),350];
  await check("Invalid tips roll back checkout", async () => {
    for(const tip of [-1,10001,null]) await denied(sql,[...args.slice(0,5),tip]);
  });
  const placed = (await db.query(sql,args)).rows[0];
  await check("Tip is separate; 5% food commission rounds half up", async () => {
    assert.equal(placed.subtotal_cents,1990); assert.equal(placed.tip_cents,350);
    assert.equal(await scalar("select cash_fee_cents from orders where id=$1",[placed.order_id]),100);
    assert.equal(Number(await scalar("select count(*) from cash_commissions where order_id=$1",[placed.order_id])),0);
  });
  await actor(buyer);
  await db.query("update orders set tip_cents=0,cash_fee_cents=0 where id=$1",[placed.order_id]);
  await check("Buyers cannot rewrite tips or fees", async () => {
    assert.equal(await scalar("select tip_cents from orders where id=$1",[placed.order_id]),350);
    assert.equal(await scalar("select cash_fee_cents from orders where id=$1",[placed.order_id]),100);
  });
  await actor(cook);
  await check("Kitchen cannot forge or delete its fee ledger",async()=>{
    await denied("insert into cash_commissions(order_id,kitchen_id,food_cents,amount_cents) values($1,$2,1,1)",[placed.order_id,kitchen]);
    await denied("select dishd_prepare_cash_payment($1)",[kitchen]);
    await denied("select dishd_settle_cash_payment(gen_random_uuid(),gen_random_uuid(),'fake',100)");
  });
  for(const status of ["accepted","ready","completed"]) await db.query("update orders set status=$1 where id=$2",[status,placed.order_id]);
  await check("Collected cash is paid and accrues one immutable fee",async()=>{
    assert.equal(await scalar("select payment_status from orders where id=$1",[placed.order_id]),"paid");
    assert.equal(await scalar("select amount_cents from cash_commissions where order_id=$1",[placed.order_id]),100);
    await db.query("update cash_commissions set amount_cents=1,paid_at=now() where order_id=$1",[placed.order_id]);
    assert.equal(await scalar("select amount_cents from cash_commissions where order_id=$1",[placed.order_id]),100);
    assert.equal(await scalar("select paid_at from cash_commissions where order_id=$1",[placed.order_id]),null);
  });
  await actor(stranger);
  await check("Cash balances are private to their kitchen",async()=>{
    assert.equal(Number(await scalar("select count(*) from cash_commissions")),0);
    assert.equal(Number(await scalar("select count(*) from cash_fee_payments")),0);
  });
  await actor();
  await check("Legacy cash orders are not charged retroactively",async()=>{
    assert.equal(Number(await scalar("select count(*) from cash_commissions c join orders o on o.id=c.order_id where o.cash_fee_cents=0")),0);
  });
  const cancelled = (await db.query(sql,args)).rows[0];
  await db.query("update orders set status='cancelled' where id=$1",[cancelled.order_id]);
  await check("Cancelled pickups accrue no fee",async()=>assert.equal(Number(await scalar("select count(*) from cash_commissions where order_id=$1",[cancelled.order_id])),0));
  const total = Number(await scalar("select sum(amount_cents) from cash_commissions where kitchen_id=$1 and paid_at is null",[kitchen]));
  const bill = (await db.query("select * from dishd_prepare_cash_payment($1)",[kitchen])).rows[0];
  await check("Repeated payment preparation reserves the same exact balance",async()=>{
    const again = (await db.query("select * from dishd_prepare_cash_payment($1)",[kitchen])).rows[0];
    assert.equal(again.id,bill.id); assert.equal(bill.amount_cents,total);
  });
  const newer = (await db.query(sql,args)).rows[0];
  await db.query("update orders set status='completed' where id=$1",[newer.order_id]);
  await check("New sales do not alter a checkout already in progress",async()=>assert.equal(await scalar("select payment_id from cash_commissions where order_id=$1",[newer.order_id]),null));
  const settle = "select dishd_settle_cash_payment($1,$2,$3,$4)";
  await check("Wrong amounts, attempts and sessions cannot settle a bill",async()=>{
    assert.equal(await scalar(settle,[bill.id,bill.attempt_id,"cs_test_cash",total+1]),false);
    assert.equal(await scalar(settle,[bill.id,crypto.randomUUID(),"cs_test_cash",total]),false);
    await db.query("update cash_fee_payments set stripe_session_id='cs_test_cash' where id=$1",[bill.id]);
    assert.equal(await scalar(settle,[bill.id,bill.attempt_id,"cs_test_wrong",total]),false);
  });
  await db.query("update cash_commissions set due_at=now()-interval '1 day' where kitchen_id=$1 and paid_at is null",[kitchen]);
  await check("Overdue payable fees pause new cash orders",()=>denied(sql,args));
  await check("Confirmed card settlement is atomic and idempotent",async()=>{
    assert.equal(await scalar(settle,[bill.id,bill.attempt_id,"cs_test_cash",total]),true);
    assert.equal(await scalar(settle,[bill.id,bill.attempt_id,"cs_test_cash",total]),true);
    assert.equal(Number(await scalar("select count(*) from cash_commissions where payment_id=$1 and paid_at is null",[bill.id])),0);
    assert.equal(await scalar("select paid_at from cash_commissions where order_id=$1",[newer.order_id]),null);
  });
  const nextBill=(await db.query("select * from dishd_prepare_cash_payment($1)",[kitchen])).rows[0];
  await scalar(settle,[nextBill.id,nextBill.attempt_id,"cs_test_newer",nextBill.amount_cents]);
  await check("Paying all overdue fees reopens cash ordering",async()=>assert.ok((await db.query(sql,args)).rows[0].order_id));
  await actor(cook);
  await check("Owners cannot mark their own card settlement paid",async()=>{
    const before=await scalar("select status from cash_fee_payments where id=$1",[bill.id]);
    await db.query("update cash_fee_payments set status='pending' where id=$1",[bill.id]);
    assert.equal(await scalar("select status from cash_fee_payments where id=$1",[bill.id]),before);
  });
  await actor();
  await db.query("update kitchens set accepts_card=true,stripe_onboarded=true where id=$1",[kitchen]);
  const card=(await db.query(sql,[...args.slice(0,3),"card",...args.slice(4)])).rows[0];
  await check("Card orders carry tips but no cash fee",async()=>assert.equal(await scalar("select cash_fee_cents from orders where id=$1",[card.order_id]),0));
  await actor(cook);
  await check("Unpaid card orders cannot be accepted or collected",()=>denied("update orders set status='accepted' where id=$1",[card.order_id]));
  await actor();
  await db.query("update orders set payment_status='paid' where id=$1",[card.order_id]);
  await actor(cook);
  for(const status of ["accepted","ready","completed"]) await db.query("update orders set status=$1 where id=$2",[status,card.order_id]);
  await actor();
  await check("Paid card pickups create no cash commission",async()=>assert.equal(Number(await scalar("select count(*) from cash_commissions where order_id=$1",[card.order_id])),0));
  await db.query("update menu_items set price_cents=30 where id=$1",[item]);
  const tiny=(await db.query(sql,[...args.slice(0,5),0])).rows[0];
  await db.query("update orders set status='completed' where id=$1",[tiny.order_id]);
  await db.query("update cash_commissions set due_at=now()-interval '1 day' where order_id=$1",[tiny.order_id]);
  await check("Sub-minimum fees carry forward without blocking cash checkout",async()=>{
    assert.ok((await db.query(sql,[...args.slice(0,5),0])).rows[0].order_id);
    await denied("select dishd_prepare_cash_payment($1)",[kitchen]);
  });
  await check("Card totals below 50 cents are rejected atomically",()=>denied(sql,[...args.slice(0,3),"card",args[4],0]));
}
