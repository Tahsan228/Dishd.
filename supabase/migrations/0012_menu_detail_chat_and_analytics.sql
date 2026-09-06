-- ============================================================================
-- Dishd — dish detail, order chat, kitchen analytics, and kitchen deletion.
--
-- Run AFTER 0011.
-- ============================================================================
begin;

-- ------------------------------------------------------------ dish detail ---
-- Calories and ingredients are shown to buyers, so they are the cook's claim in
-- the cook's words. Dishd does not compute or verify either, and the menu says
-- so — a wrong number here is an allergy risk, not a cosmetic error.
alter table menu_items
  add column if not exists calories     integer check (calories is null or (calories >= 0 and calories <= 5000)),
  add column if not exists ingredients  text,
  add column if not exists portion_size text;

comment on column menu_items.calories is
  'Cook-declared, per portion. Never computed by Dishd.';
comment on column menu_items.ingredients is
  'Cook-declared free text. Allergens stay in the allergens[] column, which is the structured field the UI filters on.';

-- ----------------------------------------------------------- order messages ---
-- A thread per order, between the buyer and the cook. Scoped to the order so
-- neither party gets a general inbox into the other's life: when the order is
-- gone, so is the thread.
create table if not exists order_messages (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  sender_id  uuid not null references profiles(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists order_messages_thread on order_messages (order_id, created_at);

alter table order_messages enable row level security;

-- dishd_can_see_order() already encodes "buyer, or the cook who owns it".
drop policy if exists order_messages_read on order_messages;
create policy order_messages_read on order_messages for select to authenticated
  using (dishd_can_see_order(order_id));

drop policy if exists order_messages_send on order_messages;
create policy order_messages_send on order_messages for insert to authenticated
  with check (sender_id = auth.uid() and dishd_can_see_order(order_id));

-- No update or delete policy on purpose. A pickup conversation is a record of
-- what was agreed about food; being able to quietly rewrite it afterwards is
-- worse than being stuck with a typo.

-- -------------------------------------------------------------- analytics ---
-- Page views and menu interest, so a cook can see demand rather than guess.
create table if not exists kitchen_views (
  id         uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references kitchens(id) on delete cascade,
  viewer_id  uuid references profiles(id) on delete set null,
  kind       text not null check (kind in ('page_view', 'menu_click')),
  created_at timestamptz not null default now()
);
create index if not exists kitchen_views_by_day on kitchen_views (kitchen_id, created_at desc);

alter table kitchen_views enable row level security;

-- Anyone browsing may record that they looked, including signed-out visitors,
-- but only the cook may read their own numbers. This is deliberately
-- append-only and unauthenticated on write, which means the counts are
-- inflatable by anyone willing to script it. They inform a cook's own decisions
-- and are never used for credibility, ranking or money — the moment they feed
-- any of those, this needs a real rate limit.
drop policy if exists kitchen_views_insert on kitchen_views;
create policy kitchen_views_insert on kitchen_views for insert
  with check (true);

drop policy if exists kitchen_views_read on kitchen_views;
create policy kitchen_views_read on kitchen_views for select to authenticated
  using (dishd_owns_kitchen(kitchen_id));

-- Daily rollup for the dashboard chart. security_invoker so the read policy
-- above still decides who sees which kitchen.
create or replace view kitchen_daily_stats with (security_invoker = on) as
select
  v.kitchen_id,
  (v.created_at at time zone 'America/New_York')::date as day,
  count(*) filter (where v.kind = 'page_view')::integer  as page_views,
  count(*) filter (where v.kind = 'menu_click')::integer as menu_clicks
from kitchen_views v
group by v.kitchen_id, (v.created_at at time zone 'America/New_York')::date;

grant select on kitchen_daily_stats to authenticated;

-- --------------------------------------------------------- closing a kitchen ---
-- A cook may close their kitchen. This is a soft close, not a row delete:
-- orders and logs reference the kitchen, and a buyer's diary and a completed
-- order are their record too, not only the cook's. Deleting the row would take
-- somebody else's history with it.
--
-- Closing is kept separate from banning. Reusing banned_reason would put a
-- voluntary retirement in the same field as an enforcement tombstone, and the
-- two must never be confused on a public page.
alter table kitchens
  add column if not exists closed_at     timestamptz,
  add column if not exists closed_reason text;

-- A closed kitchen must stay publicly readable. Its status becomes 'suspended',
-- and the old read policy only exposed 'active' and 'banned' — so every past
-- order page would have lost the kitchen it points at, and the join returning
-- null would take those pages down.
drop policy if exists kitchens_read on kitchens;
create policy kitchens_read on kitchens for select
  using (status in ('active', 'suspended', 'banned') or owner_id = auth.uid());

create or replace function dishd_close_kitchen(p_kitchen uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare k_owner uuid;
begin
  select k.owner_id into k_owner from kitchens k where k.id = p_kitchen;
  if k_owner is null or k_owner <> auth.uid() then
    raise exception 'That is not your kitchen.' using errcode = 'check_violation';
  end if;

  -- Closing with food promised to someone would strand a paid-for order.
  if exists (
    select 1 from orders o
    where o.kitchen_id = p_kitchen and o.status in ('pending', 'accepted', 'ready')
  ) then
    raise exception 'Finish or decline your open orders before closing the kitchen.'
      using errcode = 'check_violation';
  end if;

  update menu_items set is_available = false where kitchen_id = p_kitchen;
  update kitchens
     set status        = 'suspended',
         closed_at     = now(),
         closed_reason = nullif(btrim(coalesce(p_reason, '')), '')
   where id = p_kitchen;
end;
$$;

revoke all on function dishd_close_kitchen(uuid, text) from public;
grant execute on function dishd_close_kitchen(uuid, text) to authenticated;

-- Reopening, so closing is not a one-way door.
create or replace function dishd_reopen_kitchen(p_kitchen uuid)
returns void language plpgsql security definer set search_path = public as $$
declare k_owner uuid; k_status text;
begin
  select k.owner_id, k.status into k_owner, k_status from kitchens k where k.id = p_kitchen;
  if k_owner is null or k_owner <> auth.uid() then
    raise exception 'That is not your kitchen.' using errcode = 'check_violation';
  end if;
  -- A banned kitchen is an enforcement decision and is not the cook's to undo.
  if k_status <> 'suspended' then
    raise exception 'Only a kitchen you closed yourself can be reopened.'
      using errcode = 'check_violation';
  end if;
  update kitchens set status = 'active', closed_at = null, closed_reason = null
   where id = p_kitchen;
end;
$$;

revoke all on function dishd_reopen_kitchen(uuid) from public;
grant execute on function dishd_reopen_kitchen(uuid) to authenticated;

commit;
