-- New orders only: 5% of discounted food, rounded half up; tips remain separate.
begin;
alter table orders add column tip_cents integer not null default 0 check(tip_cents between 0 and 10000);
alter table orders add column cash_fee_cents integer not null default 0 check(cash_fee_cents>=0);

create table cash_fee_payments (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references kitchens(id),
  amount_cents integer not null check(amount_cents>=50),
  status text not null default 'pending' check(status in ('pending','paid')),
  stripe_session_id text unique,
  attempt_id uuid not null default gen_random_uuid(),
  attempt_started_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '1 hour',
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create unique index cash_fee_one_pending on cash_fee_payments(kitchen_id) where status='pending';
create table cash_commissions (
  order_id uuid primary key references orders(id),
  kitchen_id uuid not null references kitchens(id),
  food_cents integer not null check(food_cents>=0),
  amount_cents integer not null check(amount_cents>0),
  payment_id uuid references cash_fee_payments(id),
  created_at timestamptz not null default now(),
  due_at timestamptz not null default now()+interval '7 days',
  paid_at timestamptz
);
create index cash_commissions_balance on cash_commissions(kitchen_id,due_at) where paid_at is null;
alter table cash_commissions enable row level security;
alter table cash_fee_payments enable row level security;
create policy cash_commissions_owner_read on cash_commissions for select using(dishd_owns_kitchen(kitchen_id));
create policy cash_fee_payments_owner_read on cash_fee_payments for select using(dishd_owns_kitchen(kitchen_id));
grant select on cash_commissions,cash_fee_payments to authenticated;
grant all on cash_commissions,cash_fee_payments to service_role;

-- Keep the atomic inventory/reward/provenance implementation private and wrap it.
alter function dishd_place_order(uuid,uuid,jsonb,text,uuid,text,jsonb,text,text) rename to dishd_place_order_before_tips;
revoke all on function dishd_place_order_before_tips(uuid,uuid,jsonb,text,uuid,text,jsonb,text,text) from public,anon,authenticated,service_role;
create function dishd_place_order(
  p_buyer uuid,p_kitchen uuid,p_lines jsonb,p_method text,p_reward uuid,
  p_ack_version text,p_acks jsonb,p_ip text,p_agent text,p_tip_cents integer default 0
) returns table(order_id uuid,subtotal_cents integer,discount_cents integer,kitchen_name text,tip_cents integer)
language plpgsql security definer set search_path=public as $$
declare placed record; balance bigint;
begin
  if p_tip_cents is null or p_tip_cents not between 0 and 10000 then raise exception 'Choose a tip between $0 and $100.'; end if;
  -- Serialize checkout and billing for this kitchen, including balance enforcement.
  perform 1 from kitchens where id=p_kitchen for update;
  select coalesce(sum(c.amount_cents),0) into balance from cash_commissions c where c.kitchen_id=p_kitchen and c.paid_at is null;
  if p_method='cash' and balance>=50 and exists(select 1 from cash_commissions c where c.kitchen_id=p_kitchen and c.paid_at is null and c.due_at<=now()) then
    raise exception 'Cash orders are paused while this kitchen settles its Dishd balance. Choose card if available.';
  end if;
  select * into placed from dishd_place_order_before_tips(p_buyer,p_kitchen,p_lines,p_method,p_reward,p_ack_version,p_acks,p_ip,p_agent);
  if p_method='card' and placed.subtotal_cents+p_tip_cents<50 then raise exception 'Card orders need a total of at least $0.50.'; end if;
  update orders set tip_cents=p_tip_cents,cash_fee_cents=case when p_method='cash' then (placed.subtotal_cents+10)/20 else 0 end where id=placed.order_id;
  return query select placed.order_id,placed.subtotal_cents,placed.discount_cents,placed.kitchen_name,p_tip_cents;
end;
$$;
revoke all on function dishd_place_order(uuid,uuid,jsonb,text,uuid,text,jsonb,text,text,integer) from public;
grant execute on function dishd_place_order(uuid,uuid,jsonb,text,uuid,text,jsonb,text,text,integer) to service_role;

create function dishd_guard_order_money() returns trigger language plpgsql set search_path=public as $$
begin
  if auth.uid() is not null then
    new.tip_cents:=old.tip_cents;
    new.cash_fee_cents:=old.cash_fee_cents;
  end if;
  if new.status is distinct from old.status and new.status in ('accepted','ready','completed') and new.payment_method='card' and new.payment_status<>'paid' then
    raise exception 'Card payment must be confirmed before preparing this order.';
  end if;
  if new.status='completed' and old.status<>'completed' and new.payment_method='cash' then new.payment_status:='paid'; end if;
  return new;
end;
$$;
create trigger trg_orders_02_money before update on orders for each row execute function dishd_guard_order_money();

create function dishd_record_cash_commission() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='completed' and old.status<>'completed' and new.payment_method='cash' and new.cash_fee_cents>0 then
    insert into cash_commissions(order_id,kitchen_id,food_cents,amount_cents) values(new.id,new.kitchen_id,new.subtotal_cents,new.cash_fee_cents) on conflict(order_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger trg_orders_cash_commission after update on orders for each row execute function dishd_record_cash_commission();

create function dishd_prepare_cash_payment(p_kitchen uuid) returns cash_fee_payments
language plpgsql security definer set search_path=public as $$
declare bill cash_fee_payments%rowtype; amount bigint; selected_orders uuid[];
begin
  perform 1 from kitchens where id=p_kitchen for update;
  if not found then raise exception 'Kitchen unavailable.'; end if;
  select * into bill from cash_fee_payments where kitchen_id=p_kitchen and status='pending';
  if found then return bill; end if;
  select coalesce(sum(amount_cents),0),array_agg(order_id) into amount,selected_orders from cash_commissions where kitchen_id=p_kitchen and paid_at is null and payment_id is null;
  if amount<50 then raise exception 'Your balance carries forward until it reaches $0.50.'; end if;
  insert into cash_fee_payments(kitchen_id,amount_cents) values(p_kitchen,amount) returning * into bill;
  update cash_commissions set payment_id=bill.id where order_id=any(selected_orders);
  return bill;
end;
$$;
revoke all on function dishd_prepare_cash_payment(uuid) from public;
grant execute on function dishd_prepare_cash_payment(uuid) to service_role;

create function dishd_settle_cash_payment(p_payment uuid,p_attempt uuid,p_session text,p_amount integer) returns boolean
language plpgsql security definer set search_path=public as $$
declare bill cash_fee_payments%rowtype;
begin
  select * into bill from cash_fee_payments where id=p_payment for update;
  if not found or bill.attempt_id<>p_attempt or bill.amount_cents<>p_amount or (bill.stripe_session_id is not null and bill.stripe_session_id<>p_session) then return false; end if;
  if bill.status='paid' then return true; end if;
  update cash_fee_payments set status='paid',stripe_session_id=p_session,paid_at=now() where id=bill.id;
  update cash_commissions set paid_at=now() where payment_id=bill.id and paid_at is null;
  return true;
end;
$$;
revoke all on function dishd_settle_cash_payment(uuid,uuid,text,integer) from public;
grant execute on function dishd_settle_cash_payment(uuid,uuid,text,integer) to service_role;
commit;
