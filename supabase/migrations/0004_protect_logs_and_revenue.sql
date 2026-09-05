-- ============================================================================
-- Dishd — protect log verification, and expose the counters the Business
-- Record needs.
--
-- Run AFTER 0003.
--
-- PART 1 closes a real hole found during integration.
--
--   The logs_update policy let an owner update their whole row. Since the
--   Supabase REST API is public, a buyer could PATCH their own log and set
--   is_verified = true on a review that was never backed by an order — or
--   re-point order_id at somebody else's order. That defeats the single claim
--   the product rests on: a verified review means someone actually collected
--   and paid for food.
--
--   RLS alone cannot express "you may change these columns but not those",
--   because a WITH CHECK expression cannot see the OLD row. A BEFORE UPDATE
--   trigger can, so the trigger is the right tool: it silently restores the
--   provenance columns to their previous values on every update.
--
--   Buyers keep full control of what a review SAYS (rating, body, photo,
--   sourcing answer) and no control over whether it COUNTS.
-- ============================================================================

create or replace function dishd_protect_log_provenance()
returns trigger language plpgsql
set search_path = public as $$
begin
  -- Who wrote it, what it is about, and whether it is transaction-backed are
  -- all set by the system and are not editable by the author.
  new.buyer_id    := old.buyer_id;
  new.kitchen_id  := old.kitchen_id;
  new.order_id    := old.order_id;
  new.is_verified := old.is_verified;
  return new;
end;
$$;

drop trigger if exists trg_logs_protect_provenance on logs;
create trigger trg_logs_protect_provenance
  before update on logs
  for each row execute function dishd_protect_log_provenance();

-- ============================================================================
-- PART 2 — counters for the Business Record.
--
-- The Business Record is the cook's exportable trading history, so it must be
-- backed by real figures rather than inferred ones. Two additions:
--
--   revenue_cents      total value of completed orders
--   first_completed_at date of the first completed order
--
-- Operating history is (now - first_completed_at); "clean" is expressed by the
-- existing upheld_flags / open_incidents counters. Nothing here is guessed.
-- ============================================================================

alter table kitchens
  add column if not exists revenue_cents      bigint not null default 0,
  add column if not exists first_completed_at timestamptz;

create or replace function dishd_recompute_kitchen(k uuid)
returns void language plpgsql security definer
set search_path = public as $$
begin
  update kitchens set
    orders_completed = (
      select count(*) from orders where kitchen_id = k and status = 'completed'
    ),
    revenue_cents = coalesce((
      select sum(subtotal_cents) from orders
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

-- Backfill the new columns for every existing kitchen.
do $$
declare r record;
begin
  for r in select id from kitchens loop
    perform dishd_recompute_kitchen(r.id);
  end loop;
end $$;
