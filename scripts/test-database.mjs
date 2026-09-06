/**
 * Isolated real-Postgres checks. No network, credentials, or live database.
 * Supabase auth/storage schemas are stubbed only at the boundary; all app
 * migrations, policies, triggers, and functions execute in PostgreSQL.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite();
let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log("PASS " + name); }
async function scalar(sql, params = []) { return Object.values((await db.query(sql, params)).rows[0] ?? {})[0]; }
async function denied(sql, params = []) { await assert.rejects(() => db.query(sql, params)); }
async function actor(id = null, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? ""]);
  if (id) await db.exec("set role " + role);
}
try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create schema storage;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function public.gen_random_bytes(n integer) returns bytea language sql volatile as $$select substring(decode(md5(random()::text)||md5(random()::text),'hex') from 1 for n)$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid);
    alter table storage.objects enable row level security;
    create function storage.foldername(value text) returns text[] language sql immutable as $$select string_to_array(value,'/')$$;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
  `);
  for (const file of readdirSync("supabase/migrations").filter(f => f.endsWith(".sql")).sort()) {
    const sql = readFileSync("supabase/migrations/" + file, "utf8").replace(/create extension if not exists "pgcrypto";/g, "");
    try { await db.exec(sql); console.log("APPLIED " + file); }
    catch (error) { throw new Error(file + ": " + error.message, { cause: error }); }
  }
  await db.exec("grant all on all tables in schema public to authenticated,service_role; grant select on all tables in schema public to anon; grant all on all tables in schema storage to authenticated,service_role; grant usage on all sequences in schema public to authenticated,service_role;");
  const cook = "00000000-0000-4000-8000-000000000001", buyer = "00000000-0000-4000-8000-000000000002", stranger = "00000000-0000-4000-8000-000000000003";
  for (const [id, handle] of [[cook,"cook"],[buyer,"buyer"],[stranger,"stranger"]]) await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)", [id,handle+"@example.test",JSON.stringify({handle,display_name:handle})]);
  const kitchen = await scalar("insert into kitchens(owner_id,name,slug,state_code,county,neighborhood_label,approx_lat,approx_lng,status) values($1,'Test kitchen','test-kitchen','NJ','Bergen','Teaneck',40.8976,-74.0159,'active') returning id", [cook]);
  const order = await scalar("insert into orders(buyer_id,kitchen_id,payment_method,subtotal_cents) values($1,$2,'cash',2000) returning id",[buyer,kitchen]);
  await actor(buyer);
  await check("Buyer cannot self-complete a pickup", () => denied("update orders set status='completed' where id=$1",[order]));
  await check("Points cannot be minted through REST", () => denied("insert into reward_events(user_id,source_key,kind,points,description) values($1,'fake','purchase',9999,'fake')",[buyer]));
  await actor(cook);
  for (const status of ["accepted","ready","completed"]) await db.query("update orders set status=$1,completed_at=case when $1='completed' then now() else completed_at end where id=$2",[status,order]);
  await actor(buyer);
  const log = await scalar("select id from logs where order_id=$1",[order]);
  await check("Collected order creates a verified editable review", async () => assert.equal(await scalar("select is_verified from logs where id=$1",[log]),true));
  await check("Purchase earns 10 pickup + 25 discovery + 100 spending points", async () => assert.equal(Number(await scalar("select sum(points) from reward_events")),135));
  await db.query("update logs set rating_10=9,body='Good food',photo_url='https://example.test/photo.jpg' where id=$1",[log]);
  await check("Verified review and photo bonuses awarded", async () => assert.equal(Number(await scalar("select sum(points) from reward_events")),165));
  await db.query("update logs set rating_10=10 where id=$1",[log]);
  await check("Editing a review cannot farm points", async () => assert.equal(Number(await scalar("select sum(points) from reward_events")),165));
  await check("Recovery returns the same review", async () => assert.equal(await scalar("select dishd_ensure_order_review($1)",[order]),log));
  await check("Insufficient reward balance cannot be redeemed", () => denied("select dishd_redeem_reward('neighbor_5')"));
  await actor(stranger);
  await check("Other buyers cannot recover this order's review", () => denied("select dishd_ensure_order_review($1)",[order]));
  await check("Another user's points are private", async () => assert.equal(Number(await scalar("select count(*) from reward_events")),0));
  await check("A user cannot impersonate a business", () => denied("insert into community_posts(author_id,kitchen_id,category,body) values($1,$2,'offer','An unauthorized business offer')",[stranger,kitchen]));
  await actor();
  const second = await scalar("insert into orders(buyer_id,kitchen_id,payment_method,subtotal_cents) values($1,$2,'cash',2000) returning id",[buyer,kitchen]);
  await db.query("update orders set status='completed',completed_at=now() where id=$1",[second]);
  await actor(buyer);
  await check("Repeat kitchen visits do not repeat the discovery bonus", async () => assert.equal(Number(await scalar("select sum(points) from reward_events")),275));
  const redemption = await scalar("select dishd_redeem_reward('neighbor_5')");
  await check("Redeeming reserves a real credit and subtracts points once", async () => {
    assert.equal(Number(await scalar("select sum(points) from reward_events")),25);
    assert.equal(await scalar("select status from reward_redemptions where id=$1",[redemption]),"available");
  });
  await check("The same balance cannot be spent twice", () => denied("select dishd_redeem_reward('neighbor_5')"));
  await db.query("insert into flags(reporter_id,target_type,target_id,reason,status,resolution_note) values($1,'kitchen',$2,'halal','upheld','forged')",[buyer,kitchen]);
  await check("A report cannot declare itself upheld", async () => assert.equal(await scalar("select status from flags where reporter_id=$1",[buyer]),"open"));

  await check('Direct client checkout cannot forge prices',()=>denied("insert into orders(buyer_id,kitchen_id,payment_method,subtotal_cents) values($1,$2,'cash',1)",[buyer,kitchen]));
  await actor();
  const item=await scalar("insert into menu_items(kitchen_id,name,price_cents,contains_meat,daily_qty,allergens) values($1,'Vegetable plate',2000,false,4,'{}') returning id",[kitchen]);
  const checkout="select * from dishd_place_order($1,$2,$3,'cash',$4,'2026-09-05.2',$5,null,'test')";
  const args=[buyer,kitchen,JSON.stringify([{id:item,qty:1}]),redemption,JSON.stringify(['quality','allergens','halal'])];
  await actor(buyer);
  await check('Checkout RPC is restricted to the trusted server',()=>denied(checkout,args));
  await actor();
  await check('Missing consent cannot place an order',()=>denied(checkout,[...args.slice(0,4),'[]']));
  const placed=(await db.query(checkout,args)).rows[0];
  await check('Credit, item snapshot and consent save atomically',async()=>{
    assert.equal(placed.subtotal_cents,1500);assert.equal(placed.discount_cents,500);
    assert.equal(Number(await scalar('select count(*) from order_items where order_id=$1',[placed.order_id])),1);
    assert.equal(Number(await scalar('select count(*) from agreements where order_id=$1',[placed.order_id])),3);
    assert.equal(await scalar('select status from reward_redemptions where id=$1',[redemption]),'reserved');
  });
  await check('Reserved credit cannot be applied twice',()=>denied(checkout,args));
  await db.query("update orders set status='cancelled' where id=$1",[placed.order_id]);
  await check('Cancelling returns the unused credit',async()=>assert.equal(await scalar('select status from reward_redemptions where id=$1',[redemption]),'available'));
  const reused=(await db.query(checkout,args)).rows[0];
  await db.query("update orders set status='completed',completed_at=now() where id=$1",[reused.order_id]);
  await check('Collected credit becomes permanently used',async()=>assert.equal(await scalar('select status from reward_redemptions where id=$1',[redemption]),'used'));
  await check('Stock limits are enforced in checkout',()=>denied(checkout,[buyer,kitchen,JSON.stringify([{id:item,qty:4}]),null,args[4]]));
  await actor(buyer);
  const claim=await scalar("insert into reward_claims(user_id,mission,proof_url) values($1,'app_video','https://youtube.com/watch?v=example') returning id",[buyer]);
  await check('Buyers cannot approve promotional claims',()=>denied("select dishd_review_reward_claim($1,true,$2,'approved')",[claim,buyer]));
  await actor();
  await db.query("select dishd_review_reward_claim($1,true,$2,'reviewed original video')",[claim,cook]);
  await check('Approved app video earns 200 points once',async()=>assert.equal(Number(await scalar("select points from reward_events where user_id=$1 and source_key='mission:app_video:app'",[buyer])),200));
  await check('A promotion cannot be approved twice',()=>denied("select dishd_review_reward_claim($1,true,$2,'duplicate')",[claim,cook]));
  const { testMoney } = await import("./test-money-database.mjs");
  await testMoney({ db, check, scalar, denied, actor, cook, buyer, stranger, kitchen });
  const { testTiming } = await import("./test-timing-database.mjs");
  await testTiming({ db, check, scalar, denied, actor, cook, buyer, stranger, kitchen });
  console.log("Database checks passed: " + checks);
} catch(error) { console.error("DATABASE FAILURE:",error.message,error.where??""); process.exitCode=1; } finally { await db.close(); }
