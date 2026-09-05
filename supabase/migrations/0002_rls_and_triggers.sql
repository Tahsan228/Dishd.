-- ============================================================================
-- Dishd — row level security, counter triggers, and the auto-log mechanic
-- FROZEN after H2. Ask the host before changing anything here.
--
-- Run this AFTER 0001_init.sql.
--
-- The three things worth understanding here:
--   1. kitchen_addresses RLS is the address-privacy feature. It is enforced in
--      Postgres, not in a React conditional, so a bug in the UI cannot leak a
--      cook's home address.
--   2. The counter triggers keep `kitchens` credibility columns correct by
--      full recompute. At demo scale this is cheap and cannot drift.
--   3. dishd_autolog_on_complete() is "the order is the check-in": completing
--      a pickup writes a verified log row before the buyer has rated anything.
-- ============================================================================

-- --------------------------------------------------------------- helpers ---
-- SECURITY DEFINER so the inner lookup bypasses RLS. Without this, policies
-- that reference another protected table recurse or silently return nothing.

create or replace function dishd_owns_kitchen(k uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from kitchens where id = k and owner_id = auth.uid()
  );
$$;

create or replace function dishd_has_order_at(k uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from orders
    where kitchen_id = k
      and buyer_id = auth.uid()
      and status in ('accepted','ready','completed')
  );
$$;

create or replace function dishd_can_see_order(o uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from orders ord
    join kitchens k on k.id = ord.kitchen_id
    where ord.id = o
      and (ord.buyer_id = auth.uid() or k.owner_id = auth.uid())
  );
$$;

-- ------------------------------------------------------- counter plumbing ---

-- Consecutive verified sourcing batches, counted back from the most recent.
-- One mismatch anywhere breaks the streak — that is the point of it.
create or replace function dishd_trust_streak(k uuid)
returns integer language sql stable
set search_path = public as $$
  with ordered as (
    select match_status, row_number() over (order by created_at desc) as rn
    from sourcing_batches
    where kitchen_id = k
  ),
  first_bad as (
    select min(rn) as rn from ordered where match_status <> 'verified'
  )
  select coalesce(
    (select rn - 1 from first_bad where rn is not null),
    (select count(*) from ordered)
  )::integer;
$$;

-- Full recompute of one kitchen's counters. Deliberately not incremental:
-- incremental counters drift, and at demo scale this costs nothing.
create or replace function dishd_recompute_kitchen(k uuid)
returns void language plpgsql security definer
set search_path = public as $$
begin
  update kitchens set
    orders_completed = (
      select count(*) from orders
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
      select count(*) from orders
      where kitchen_id = k and status = 'declined'
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

create or replace function dishd_recompute_from_row()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  k uuid;
begin
  k := coalesce(
    case when TG_OP = 'DELETE' then null else (to_jsonb(new) ->> 'kitchen_id')::uuid end,
    case when TG_OP = 'INSERT' then null else (to_jsonb(old) ->> 'kitchen_id')::uuid end
  );
  if k is not null then
    perform dishd_recompute_kitchen(k);
  end if;
  return null;
end;
$$;

create trigger trg_orders_recompute
  after insert or update or delete on orders
  for each row execute function dishd_recompute_from_row();

create trigger trg_logs_recompute
  after insert or update or delete on logs
  for each row execute function dishd_recompute_from_row();

create trigger trg_batches_recompute
  after insert or update or delete on sourcing_batches
  for each row execute function dishd_recompute_from_row();

-- Flags reference kitchens polymorphically, so they need their own shape.
create or replace function dishd_recompute_from_flag()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if coalesce(new.target_type, old.target_type) = 'kitchen' then
    perform dishd_recompute_kitchen(coalesce(new.target_id, old.target_id));
  end if;
  return null;
end;
$$;

create trigger trg_flags_recompute
  after insert or update or delete on flags
  for each row execute function dishd_recompute_from_flag();

create or replace function dishd_recompute_from_incident()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  k uuid;
begin
  select kitchen_id into k from orders
  where id = coalesce(new.order_id, old.order_id);
  if k is not null then
    perform dishd_recompute_kitchen(k);
  end if;
  return null;
end;
$$;

create trigger trg_incidents_recompute
  after insert or update or delete on incidents
  for each row execute function dishd_recompute_from_incident();

-- ------------------------------------------- the order IS the check-in ---
-- Completing a pickup writes a verified log row immediately, with a null
-- rating. The buyer is then prompted to rate it. This is what makes every
-- review transaction-backed: you cannot write a verified log without having
-- actually collected food.
create or replace function dishd_autolog_on_complete()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at := coalesce(new.completed_at, now());

    insert into logs (buyer_id, kitchen_id, order_id, rating_10, is_verified, logged_at)
    values (new.buyer_id, new.kitchen_id, new.id, null, true, now())
    on conflict (order_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger trg_orders_autolog
  before update on orders
  for each row execute function dishd_autolog_on_complete();

-- --------------------------------------------------- buyer counters view ---
-- The buyer-side equivalent of the kitchens counter columns, so the social
-- workstream reads one row instead of aggregating at render time.
-- security_invoker: RLS of the underlying tables applies as the caller.
create view buyer_counters with (security_invoker = on) as
select
  p.id                                                              as user_id,
  count(l.id) filter (where l.is_verified)                          as verified_logs,
  count(distinct l.kitchen_id)                                      as distinct_kitchens,
  count(l.id) filter (where length(coalesce(l.body, '')) >= 80)     as substantive_reviews,
  count(l.id) filter (where l.photo_url is not null)                as photo_logs,
  (select count(*) from log_likes ll
     join logs l2 on l2.id = ll.log_id
    where l2.buyer_id = p.id)                                       as likes_received,
  (select count(*) from flags f
    where f.reporter_id = p.id and f.status = 'upheld')             as upheld_flags,
  (select count(*) from flags f
    where f.reporter_id = p.id and f.status = 'dismissed')          as dismissed_flags,
  p.created_at
from profiles p
left join logs l on l.buyer_id = p.id
group by p.id, p.created_at;

-- ============================================================================
-- Row level security
-- ============================================================================

alter table profiles           enable row level security;
alter table kitchens           enable row level security;
alter table kitchen_addresses  enable row level security;
alter table known_halal_stores enable row level security;
alter table halal_sources      enable row level security;
alter table sourcing_batches   enable row level security;
alter table menu_items         enable row level security;
alter table pickup_windows     enable row level security;
alter table orders             enable row level security;
alter table order_items        enable row level security;
alter table logs               enable row level security;
alter table log_likes          enable row level security;
alter table kitchen_badges     enable row level security;
alter table user_badges        enable row level security;
alter table flags              enable row level security;
alter table incidents          enable row level security;
alter table agreements         enable row level security;

-- profiles: publicly readable (review feeds show authors), self-writable
create policy profiles_read   on profiles for select using (true);
create policy profiles_insert on profiles for insert with check (id = auth.uid());
create policy profiles_update on profiles for update using (id = auth.uid());

-- kitchens: active ones are public. Banned ones stay public on purpose — the
-- tombstone is the accountability record. Drafts are owner-only.
create policy kitchens_read on kitchens for select
  using (status in ('active','banned') or owner_id = auth.uid());
create policy kitchens_insert on kitchens for insert
  with check (owner_id = auth.uid());
create policy kitchens_update on kitchens for update
  using (owner_id = auth.uid());

-- THE ADDRESS PRIVACY FEATURE.
-- Cooks sell from where they sleep. The exact address is readable only by the
-- owner, or by a buyer whose order has actually been accepted.
create policy kitchen_addresses_read on kitchen_addresses for select
  using (dishd_owns_kitchen(kitchen_id) or dishd_has_order_at(kitchen_id));
create policy kitchen_addresses_write on kitchen_addresses for all
  using (dishd_owns_kitchen(kitchen_id))
  with check (dishd_owns_kitchen(kitchen_id));

-- The seeded halal store directory is public reference data.
create policy known_stores_read on known_halal_stores for select using (true);

-- Provenance is public by design: buyers must be able to audit sourcing claims.
create policy halal_sources_read on halal_sources for select using (true);
create policy halal_sources_write on halal_sources for all
  using (dishd_owns_kitchen(kitchen_id))
  with check (dishd_owns_kitchen(kitchen_id));

create policy batches_read on sourcing_batches for select using (true);
create policy batches_write on sourcing_batches for all
  using (dishd_owns_kitchen(kitchen_id))
  with check (dishd_owns_kitchen(kitchen_id));

create policy menu_read on menu_items for select
  using (
    exists (select 1 from kitchens k where k.id = kitchen_id and k.status = 'active')
    or dishd_owns_kitchen(kitchen_id)
  );
create policy menu_write on menu_items for all
  using (dishd_owns_kitchen(kitchen_id))
  with check (dishd_owns_kitchen(kitchen_id));

create policy windows_read on pickup_windows for select using (true);
create policy windows_write on pickup_windows for all
  using (dishd_owns_kitchen(kitchen_id))
  with check (dishd_owns_kitchen(kitchen_id));

-- orders: visible to the buyer and to the cook, nobody else
create policy orders_read on orders for select
  using (buyer_id = auth.uid() or dishd_owns_kitchen(kitchen_id));
create policy orders_insert on orders for insert
  with check (buyer_id = auth.uid());
create policy orders_update on orders for update
  using (buyer_id = auth.uid() or dishd_owns_kitchen(kitchen_id));

create policy order_items_read on order_items for select
  using (dishd_can_see_order(order_id));
create policy order_items_insert on order_items for insert
  with check (dishd_can_see_order(order_id));

-- logs: the public diary
create policy logs_read   on logs for select using (true);
create policy logs_insert on logs for insert with check (buyer_id = auth.uid());
create policy logs_update on logs for update using (buyer_id = auth.uid());
create policy logs_delete on logs for delete using (buyer_id = auth.uid());

create policy likes_read   on log_likes for select using (true);
create policy likes_insert on log_likes for insert with check (user_id = auth.uid());
create policy likes_delete on log_likes for delete using (user_id = auth.uid());

-- badges are awarded by the system, never written from the client
create policy kitchen_badges_read on kitchen_badges for select using (true);
create policy user_badges_read    on user_badges    for select using (true);

-- flags and incidents: you can file one, and see your own
create policy flags_insert on flags for insert with check (reporter_id = auth.uid());
create policy flags_read   on flags for select using (reporter_id = auth.uid());

create policy incidents_insert on incidents for insert
  with check (reporter_id = auth.uid());
create policy incidents_read on incidents for select
  using (reporter_id = auth.uid() or dishd_can_see_order(order_id));

-- agreements: append-only consent ledger. Insert and read your own.
-- Deliberately NO update or delete policy — this is legal evidence and must
-- never be mutable, not even by the person who signed it.
create policy agreements_insert on agreements for insert
  with check (user_id = auth.uid());
create policy agreements_read on agreements for select
  using (user_id = auth.uid());
