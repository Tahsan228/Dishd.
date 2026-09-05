-- Atomic checkout: trusted prices, stock, consent, and a single-use reward credit.
begin;
alter table orders add column discount_cents integer not null default 0 check(discount_cents>=0);
alter table agreements add column order_id uuid references orders(id) on delete set null;

-- The server authenticates the buyer before calling the service-only checkout RPC.
-- Direct inserts cannot invent a price, line item, or a reward discount.
drop policy if exists orders_insert on orders;
drop policy if exists order_items_insert on order_items;

create function dishd_place_order(
  p_buyer uuid,p_kitchen uuid,p_lines jsonb,p_method text,p_reward uuid,
  p_ack_version text,p_acks jsonb,p_ip text,p_agent text
) returns table(order_id uuid,subtotal_cents integer,discount_cents integer,kitchen_name text)
language plpgsql security definer set search_path=public as $$
declare k kitchens%rowtype; item menu_items%rowtype; line jsonb; qty integer; sold integer;
  total integer:=0; discount integer:=0; oid uuid:=gen_random_uuid(); voucher reward_redemptions%rowtype;
  snapshot jsonb; frozen jsonb:='[]'::jsonb;
begin
  if not exists(select 1 from profiles where id=p_buyer) then raise exception 'Please sign in again.'; end if;
  if p_ack_version<>'2026-09-05.2' or not (p_acks @> '["quality","allergens","halal"]'::jsonb) then raise exception 'Accept all food-quality acknowledgments.'; end if;
  if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 30 then raise exception 'Choose at least one available dish.'; end if;
  if (select count(distinct value->>'id') from jsonb_array_elements(p_lines))<>jsonb_array_length(p_lines) then raise exception 'Each dish must appear only once.'; end if;
  select * into k from kitchens where id=p_kitchen and status='active' for update;
  if not found then raise exception 'This kitchen is not taking orders.'; end if;
  if (p_method='cash' and not k.accepts_cash) or (p_method='card' and (not k.accepts_card or not k.stripe_onboarded)) or p_method not in ('cash','card') then raise exception 'Choose an available payment method.'; end if;
  for line in select value from jsonb_array_elements(p_lines) loop
    if coalesce(line->>'qty','') !~ '^[1-9][0-9]?$' then raise exception 'Invalid quantity.'; end if;
    qty:=(line->>'qty')::integer;
    if qty>20 then raise exception 'Choose at most 20 of one dish.'; end if;
    select * into item from menu_items where id=(line->>'id')::uuid and kitchen_id=k.id and is_available for update;
    if not found then raise exception 'A dish in your cart is no longer available.'; end if;
    select coalesce(sum(oi.qty),0) into sold from order_items oi join orders o on o.id=oi.order_id
      where oi.menu_item_id=item.id and o.status not in ('cancelled','declined')
      and (o.created_at at time zone 'America/New_York')::date=(now() at time zone 'America/New_York')::date;
    if qty+sold>item.daily_qty then raise exception 'Not enough portions of % remain today.',item.name; end if;
    snapshot:=null;
    if item.contains_meat then
      select jsonb_build_object('store',coalesce(h.store_name,b.ocr_store),'cert_body',h.cert_body,
        'receipt_date',b.ocr_date,'status_at_order',b.match_status) into snapshot
      from sourcing_batches b left join halal_sources h on h.id=b.halal_source_id
      where b.id=item.sourcing_batch_id and b.kitchen_id=k.id and b.match_status='verified'
        and b.backs_items_until>=(now() at time zone 'America/New_York')::date;
      if snapshot is null then raise exception 'The sourcing evidence for % needs review or renewal before it can be ordered.',item.name; end if;
    end if;
    total:=total+item.price_cents*qty;
    frozen:=frozen||jsonb_build_array(jsonb_build_object('id',item.id,'name',item.name,'qty',qty,'price',item.price_cents,'meat',item.meat_type,'provenance',snapshot));
  end loop;
  if p_reward is not null then
    select * into voucher from reward_redemptions where id=p_reward and user_id=p_buyer for update;
    if not found or voucher.status<>'available' then raise exception 'That reward credit has already been used or is unavailable.'; end if;
    if total<voucher.minimum_order_cents then raise exception 'Your cart does not meet this reward''s minimum order.'; end if;
    discount:=voucher.credit_cents;
  end if;
  insert into orders(id,buyer_id,kitchen_id,payment_method,subtotal_cents,discount_cents)
    values(oid,p_buyer,k.id,p_method,total-discount,discount);
  for line in select value from jsonb_array_elements(frozen) loop
    insert into order_items(order_id,menu_item_id,qty,unit_price_cents,name_snapshot,meat_snapshot,provenance_snapshot)
    values(oid,(line->>'id')::uuid,(line->>'qty')::integer,(line->>'price')::integer,line->>'name',line->>'meat',nullif(line->'provenance','null'::jsonb));
  end loop;
  insert into agreements(user_id,order_id,doc_type,doc_version,ip,user_agent)
    select p_buyer,oid,'order_ack:'||ack,p_ack_version,p_ip,left(p_agent,1000) from jsonb_array_elements_text(p_acks) as ack;
  if p_reward is not null then update reward_redemptions set status='reserved',order_id=oid where id=p_reward; end if;
  return query select oid,total-discount,discount,k.name;
end;
$$;
revoke all on function dishd_place_order(uuid,uuid,jsonb,text,uuid,text,jsonb,text,text) from public;
grant execute on function dishd_place_order(uuid,uuid,jsonb,text,uuid,text,jsonb,text,text) to service_role;

create function dishd_guard_order_discount() returns trigger language plpgsql set search_path=public as $$
begin
  if auth.uid() is not null then new.discount_cents:=old.discount_cents; end if;
  return new;
end;
$$;
create trigger trg_orders_01_discount before update on orders for each row execute function dishd_guard_order_discount();

create function dishd_reward_credit_status() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='completed' then update reward_redemptions set status='used' where order_id=new.id and status='reserved';
  elsif new.status in ('cancelled','declined') then update reward_redemptions set status='available',order_id=null where order_id=new.id and status='reserved';
  end if;
  return new;
end;
$$;
create trigger trg_orders_reward_credit after update on orders for each row execute function dishd_reward_credit_status();
commit;
