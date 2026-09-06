-- ============================================================================
-- Dishd — pickup timing, priority orders, and a cook-set cooking estimate.
--
-- Run AFTER 0014.
--
-- Four things a buyer asked for, and one hole found on the way:
--
--   1. The cook sets how long the food takes, so the tracking page can say
--      "ready by about 6:40" instead of "waiting".
--   2. A kitchen may offer a paid priority slot, at a price the kitchen sets.
--   3. A buyer may schedule a pickup for later, on a 15-minute boundary.
--   4. Counters on `kitchens` were writable by the cook they describe.
--
-- Deliberately NOT added: a 'scheduled' order status. A scheduled order really
-- is `pending` — the cook has not accepted it — and inventing a status would
-- mean re-opening the 0005 lifecycle trigger, the autolog trigger and the
-- status check constraint for a distinction the cook's dashboard can draw from
-- `scheduled_for` alone.
-- ============================================================================
begin;

-- ------------------------------------------------------ kitchen offer terms ---
-- These are the cook's public terms of trade, so they are readable by anyone
-- who can read the kitchen: a buyer has to see the priority price before
-- agreeing to pay it.
alter table kitchens
  add column if not exists default_prep_minutes integer not null default 25
    check (default_prep_minutes between 5 and 240),
  add column if not exists priority_fee_cents integer not null default 0
    check (priority_fee_cents between 0 and 2000),
  add column if not exists accepts_scheduled boolean not null default true;

comment on column kitchens.default_prep_minutes is
  'The cook''s own claim about how long their food takes. Dishd never computes or verifies it; it prefills the per-order estimate.';
comment on column kitchens.priority_fee_cents is
  'Zero means this kitchen does not sell priority. The option is then never offered, rather than offered free.';

-- -------------------------------------------------------------- order terms ---
alter table orders
  add column if not exists priority_fee_cents integer not null default 0
    check (priority_fee_cents between 0 and 2000),
  add column if not exists scheduled_for timestamptz,
  add column if not exists prep_minutes integer
    check (prep_minutes is null or prep_minutes between 5 and 240),
  add column if not exists ready_estimate_at timestamptz;

comment on column orders.scheduled_for is
  'Null means as soon as possible. Set once at checkout and frozen thereafter.';
comment on column orders.priority_fee_cents is
  'Copied from the kitchen at checkout, never sent by the client. Kitchen revenue, so it sits inside the cash commission base alongside food.';
comment on column orders.ready_estimate_at is
  'The cook''s estimate, revisable by the cook. Never a promise by Dishd.';

-- The cook's dashboard splits its queue on this, so it is the lookup to index.
create index if not exists orders_scheduled
  on orders (kitchen_id, scheduled_for)
  where scheduled_for is not null;

-- ============================================================================
-- Who may write the new order columns.
--
-- 0011 froze tip_cents and cash_fee_cents against any authenticated caller,
-- for the reason 0005 gives at length: the Supabase REST API is public, so any
-- column an RLS policy leaves writable is writable by a PATCH from a browser.
-- The same reasoning covers all four new columns, but they split two ways:
--
--   priority_fee_cents, scheduled_for  terms agreed at checkout. Neither party
--                                      may edit them afterwards — a buyer must
--                                      not be able to drop a fee they agreed
--                                      to, and a cook must not be able to move
--                                      a pickup the buyer planned around.
--
--   prep_minutes, ready_estimate_at    the cook's claim about their own
--                                      kitchen. The cook revises it, including
--                                      upward when running late; the buyer may
--                                      not touch it, or the estimate stops
--                                      being evidence of anything.
-- ============================================================================
create or replace function dishd_guard_order_money() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null then
    -- Money and agreed terms: frozen for everyone holding an end-user JWT.
    new.tip_cents          := old.tip_cents;
    new.cash_fee_cents     := old.cash_fee_cents;
    new.priority_fee_cents := old.priority_fee_cents;
    new.scheduled_for      := old.scheduled_for;

    -- The estimate belongs to the cook alone.
    if not dishd_owns_kitchen(old.kitchen_id) then
      new.prep_minutes      := old.prep_minutes;
      new.ready_estimate_at := old.ready_estimate_at;
    end if;
  end if;

  -- Unchanged from 0011: card money is confirmed before any food is started,
  -- and a completed cash pickup is paid by definition.
  if new.status is distinct from old.status
     and new.status in ('accepted','ready','completed')
     and new.payment_method = 'card' and new.payment_status <> 'paid' then
    raise exception 'Card payment must be confirmed before preparing this order.';
  end if;
  if new.status = 'completed' and old.status <> 'completed'
     and new.payment_method = 'cash' then
    new.payment_status := 'paid';
  end if;

  return new;
end;
$$;

-- ============================================================================
-- Placing an order, with priority and scheduling.
--
-- Same wrapping pattern 0011 used: the previous entry point is renamed and
-- revoked so it cannot be reached with the new arguments missing, and the new
-- one owns validation. A SECURITY DEFINER function keeps execute rights on a
-- function it owns, so the wrapper can still call the inner one.
-- ============================================================================
alter function dishd_place_order(uuid,uuid,jsonb,text,uuid,text,jsonb,text,text,integer)
  rename to dishd_place_order_before_priority;
revoke all on function dishd_place_order_before_priority(uuid,uuid,jsonb,text,uuid,text,jsonb,text,text,integer)
  from public, anon, authenticated, service_role;

create function dishd_place_order(
  p_buyer uuid, p_kitchen uuid, p_lines jsonb, p_method text, p_reward uuid,
  p_ack_version text, p_acks jsonb, p_ip text, p_agent text,
  p_tip_cents integer default 0,
  p_priority boolean default false,
  p_scheduled_for timestamptz default null
) returns table(
  order_id uuid, subtotal_cents integer, discount_cents integer,
  kitchen_name text, tip_cents integer,
  priority_fee_cents integer, scheduled_for timestamptz, prep_minutes integer
)
language plpgsql security definer set search_path = public as $$
declare
  placed record;
  terms  record;
  fee    integer := 0;
begin
  select k.priority_fee_cents, k.accepts_scheduled, k.default_prep_minutes
    into terms
    from kitchens k where k.id = p_kitchen;
  if not found then raise exception 'That kitchen is unavailable.'; end if;

  -- Priority is a real purchase, so refuse rather than charge nothing. A buyer
  -- told they bought priority must actually have bought it.
  if p_priority then
    if terms.priority_fee_cents <= 0 then
      raise exception 'This kitchen does not offer priority orders.';
    end if;
    fee := terms.priority_fee_cents;
  end if;

  if p_scheduled_for is not null then
    if not terms.accepts_scheduled then
      raise exception 'This kitchen is not taking scheduled orders right now.';
    end if;
    -- Re-checked here rather than trusted: the client sends a wall-clock time
    -- it composed itself, in whatever timezone the browser happens to be in.
    if p_scheduled_for < now() + interval '30 minutes' then
      raise exception 'Choose a pickup time at least 30 minutes from now.';
    end if;
    if p_scheduled_for > now() + interval '7 days' then
      raise exception 'Scheduled pickups can be up to seven days ahead.';
    end if;
    if date_trunc('minute', p_scheduled_for) <> p_scheduled_for
       or (extract(minute from p_scheduled_for)::integer % 15) <> 0 then
      raise exception 'Pickup times run in 15-minute steps.';
    end if;
  end if;

  select * into placed from dishd_place_order_before_priority(
    p_buyer, p_kitchen, p_lines, p_method, p_reward,
    p_ack_version, p_acks, p_ip, p_agent, p_tip_cents);

  -- The commission base is discounted food plus the priority fee, both of them
  -- the kitchen's sale. Tips stay outside it, exactly as 0011 set out.
  update orders o set
    priority_fee_cents = fee,
    scheduled_for      = p_scheduled_for,
    prep_minutes       = terms.default_prep_minutes,
    cash_fee_cents     = case when p_method = 'cash'
                              then (placed.subtotal_cents::bigint + fee + 10) / 20
                              else 0 end
  where o.id = placed.order_id;

  return query select
    placed.order_id, placed.subtotal_cents, placed.discount_cents,
    placed.kitchen_name, placed.tip_cents,
    fee, p_scheduled_for, terms.default_prep_minutes;
end;
$$;
revoke all on function dishd_place_order(uuid,uuid,jsonb,text,uuid,text,jsonb,text,text,integer,boolean,timestamptz) from public;
grant execute on function dishd_place_order(uuid,uuid,jsonb,text,uuid,text,jsonb,text,text,integer,boolean,timestamptz) to service_role;

-- The priority fee is money the kitchen took, so it belongs in the figure the
-- Business Record reports. Every historic order carries a zero fee, so the
-- recompute below cannot move any existing number.
create or replace function dishd_recompute_kitchen(k uuid)
returns void language plpgsql security definer
set search_path = public as $$
begin
  update kitchens set
    orders_completed = (
      select count(*) from orders where kitchen_id = k and status = 'completed'
    ),
    revenue_cents = coalesce((
      select sum(subtotal_cents + coalesce(priority_fee_cents, 0)) from orders
      where kitchen_id = k and status = 'completed'
    ), 0),
    first_completed_at = (
      select min(coalesce(completed_at, created_at)) from orders
      where kitchen_id = k and status = 'completed'
    ),
    -- only rated logs count; a check-in with no rating must not drag the average
    avg_rating_10 = coalesce((
      select round(avg(rating_10)::numeric, 2) from logs
      where kitchen_id = k and rating_10 is not null
    ), 0),
    distinct_customers = (
      select count(distinct buyer_id) from orders
      where kitchen_id = k and status = 'completed'
    ),
    repeat_customers = (
      select count(*) from (
        select buyer_id from orders
        where kitchen_id = k and status = 'completed'
        group by buyer_id having count(*) > 1
      ) t
    ),
    cook_cancellations = (
      select count(*) from orders where kitchen_id = k and status = 'declined'
    ),
    upheld_flags = (
      select count(*) from flags
      where target_type = 'kitchen' and target_id = k and status = 'upheld'
    ),
    open_incidents = (
      select count(*) from incidents i
      join orders o on o.id = i.order_id
      where o.kitchen_id = k and i.status = 'open'
    ),
    trust_streak = dishd_trust_streak(k)
  where id = k;
end;
$$;

-- ============================================================================
-- The hole found on the way: `kitchens` had no update guard.
--
-- kitchens_update is `using (owner_id = auth.uid())` with no WITH CHECK, and
-- every credibility counter lives on that row. So a cook could send:
--
--   PATCH /rest/v1/kitchens?id=eq.<own kitchen>
--     {"avg_rating_10": 5, "orders_completed": 400, "revenue_cents": 900000}
--
-- and buy themselves the top tier, a five-star average and a trading history,
-- with one request and no food. That is the same class of hole 0004 closed on
-- `logs` and 0005 closed on `orders`, left open on the table that actually
-- stores the score. It is closed here because this migration adds the first
-- kitchens columns a cook is *supposed* to write, which makes the question of
-- what else they may write unavoidable.
--
-- The discriminator cannot be auth.uid() alone: dishd_recompute_kitchen() runs
-- from a trigger on `orders` fired by the buyer's or the cook's own statement,
-- so a real user JWT is present when the legitimate write happens. Trigger
-- depth separates them — a direct PATCH reaches this trigger at depth 1, a
-- recompute nested inside the orders trigger at depth 2 or more.
-- ============================================================================
create or replace function dishd_guard_kitchen_counters() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is null or pg_trigger_depth() > 1 then
    return new;
  end if;

  -- Trigger-maintained. Every one of these is an input to the credibility
  -- score or to the Business Record.
  new.orders_completed   := old.orders_completed;
  new.avg_rating_10      := old.avg_rating_10;
  new.distinct_customers := old.distinct_customers;
  new.repeat_customers   := old.repeat_customers;
  new.trust_streak       := old.trust_streak;
  new.upheld_flags       := old.upheld_flags;
  new.open_incidents     := old.open_incidents;
  new.cook_cancellations := old.cook_cancellations;
  new.revenue_cents      := old.revenue_cents;
  new.first_completed_at := old.first_completed_at;

  -- Identity: a kitchen may not be re-pointed at another owner, and its slug
  -- is the permanent address of its public record.
  new.id         := old.id;
  new.owner_id   := old.owner_id;
  new.slug       := old.slug;
  new.created_at := old.created_at;

  -- The public point is fuzzed once at creation and never recomputed, which is
  -- part of what makes the promise about the exact address hold.
  new.approx_lat         := old.approx_lat;
  new.approx_lng         := old.approx_lng;
  new.neighborhood_label := old.neighborhood_label;

  -- Enforcement and payment identity are Dishd's to write, not the cook's.
  new.banned_reason     := old.banned_reason;
  new.banned_at         := old.banned_at;
  new.stripe_account_id := old.stripe_account_id;
  new.stripe_onboarded  := old.stripe_onboarded;

  -- A cook claims a permit; only Dishd verifies one. Claiming stays allowed.
  if new.permit_status = 'verified' and old.permit_status <> 'verified' then
    new.permit_status := old.permit_status;
  end if;

  -- A banned kitchen cannot reopen itself, and none can ban itself into a
  -- tombstone it did not earn.
  if old.status = 'banned' then
    new.status := old.status;
  elsif new.status = 'banned' then
    raise exception 'A kitchen cannot ban itself.' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_kitchens_00_guard on kitchens;
create trigger trg_kitchens_00_guard
  before update on kitchens
  for each row execute function dishd_guard_kitchen_counters();

commit;
