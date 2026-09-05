-- Completed pickups must always have an editable, transaction-backed review.
-- Apply after 0007. No rows are deleted.
begin;
alter table logs add column if not exists photo_urls text[] not null default '{}';
alter table logs add column if not exists flavor_rating_10 integer check (flavor_rating_10 between 0 and 10);
alter table logs add column if not exists value_rating_10 integer check (value_rating_10 between 0 and 10);
alter table logs add column if not exists quality_rating_10 integer check (quality_rating_10 between 0 and 10);
alter table logs add constraint logs_gallery_limit check (cardinality(photo_urls) <= 3);

create or replace function dishd_protect_log_provenance()
returns trigger language plpgsql set search_path = public as $$
begin
  new.buyer_id := old.buyer_id;
  new.kitchen_id := old.kitchen_id;
  new.order_id := old.order_id;
  new.logged_at := old.logged_at;
  new.is_verified := old.is_verified or exists (
    select 1 from orders o where o.id = old.order_id and o.buyer_id = old.buyer_id
      and o.kitchen_id = old.kitchen_id and o.status = 'completed'
  );
  return new;
end;
$$;

-- Even an INSERT over REST cannot invent verification.
create or replace function dishd_validate_new_log()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.is_verified := exists (
    select 1 from orders o where o.id = new.order_id and o.buyer_id = new.buyer_id
      and o.kitchen_id = new.kitchen_id and o.status = 'completed'
  );
  if new.is_verified then
    select coalesce(completed_at, created_at) into new.logged_at from orders where id = new.order_id;
  else
    new.logged_at := now();
  end if;
  return new;
end;
$$;
create trigger trg_logs_validate_insert before insert on logs for each row execute function dishd_validate_new_log();

-- AFTER sees the committed new status; the old BEFORE trigger inserted too early
-- for provenance validation and for counters that inspect the order row.
drop trigger if exists trg_orders_autolog on orders;
create trigger trg_orders_autolog after update on orders for each row execute function dishd_autolog_on_complete();

create or replace function dishd_ensure_order_review(p_order_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; review_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in before reviewing.'; end if;
  select * into o from orders where id = p_order_id and buyer_id = auth.uid() for update;
  if not found or o.status <> 'completed' then raise exception 'A completed pickup is required.'; end if;
  insert into logs (buyer_id, kitchen_id, order_id, is_verified, logged_at)
    values (o.buyer_id, o.kitchen_id, o.id, true, coalesce(o.completed_at, o.created_at))
    on conflict (order_id) do update set is_verified = true
    returning id into review_id;
  return review_id;
end;
$$;
revoke all on function dishd_ensure_order_review(uuid) from public;
grant execute on function dishd_ensure_order_review(uuid) to authenticated;

-- Repair historical completed orders that never received their diary row.
insert into logs (buyer_id, kitchen_id, order_id, is_verified, logged_at)
select buyer_id, kitchen_id, id, true, coalesce(completed_at, created_at)
from orders where status = 'completed'
on conflict (order_id) do update set is_verified = true;
commit;
