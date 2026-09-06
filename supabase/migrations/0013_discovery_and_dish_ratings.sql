-- Signed-in discovery and transaction-backed dish ratings. Earning rules unchanged.
begin;
create table kitchen_discovery_claims (
  kitchen_id uuid primary key references kitchens(id) on delete cascade,
  zabiha_claimed boolean not null default false,
  no_pork_claimed boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table kitchen_discovery_claims enable row level security;
create policy discovery_claims_read on kitchen_discovery_claims for select using(true);
create policy discovery_claims_write on kitchen_discovery_claims for all to authenticated
  using(dishd_owns_kitchen(kitchen_id)) with check(dishd_owns_kitchen(kitchen_id));

create table menu_discovery (
  menu_item_id uuid primary key references menu_items(id) on delete cascade,
  vegetarian_claimed boolean not null default false,
  serves integer not null default 1 check(serves between 1 and 30),
  meal_tags text[] not null default '{}' check(meal_tags <@ array['family_trays','ramadan','iftar','eid']::text[]),
  offer_title text check(char_length(offer_title) between 1 and 80),
  offer_expires_at timestamptz,
  updated_at timestamptz not null default now(),
  check((offer_title is null)=(offer_expires_at is null))
);
alter table menu_discovery enable row level security;
create policy menu_discovery_read on menu_discovery for select using(true);
create policy menu_discovery_write on menu_discovery for all to authenticated
  using(exists(select 1 from menu_items m where m.id=menu_item_id and dishd_owns_kitchen(m.kitchen_id)))
  with check(exists(select 1 from menu_items m where m.id=menu_item_id and dishd_owns_kitchen(m.kitchen_id)));
grant select on kitchen_discovery_claims,menu_discovery to anon,authenticated;
grant insert,update,delete on kitchen_discovery_claims,menu_discovery to authenticated;
grant all on kitchen_discovery_claims,menu_discovery to service_role;

-- Private purchase references; public readers only see the aggregate below.
create table dish_ratings (
  order_item_id uuid primary key references order_items(id) on delete cascade,
  menu_item_id uuid not null,
  rating_10 integer not null check(rating_10 between 0 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table dish_ratings enable row level security;
create policy dish_ratings_read on dish_ratings for select to authenticated using(
  exists(select 1 from order_items i where i.id=order_item_id and dishd_can_see_order(i.order_id))
);
create policy dish_ratings_write on dish_ratings for all to authenticated using(
  exists(select 1 from order_items i join orders o on o.id=i.order_id where i.id=order_item_id and o.buyer_id=auth.uid() and o.status='completed')
) with check(
  exists(select 1 from order_items i join orders o on o.id=i.order_id where i.id=order_item_id and o.buyer_id=auth.uid() and o.status='completed')
);
grant select,insert,update,delete on dish_ratings to authenticated;
grant all on dish_ratings to service_role;
create table dish_rating_summaries (
  menu_item_id uuid primary key references menu_items(id) on delete cascade,
  rating_count integer not null default 0,
  avg_rating_10 numeric(4,2) not null default 0
);
alter table dish_rating_summaries enable row level security;
create policy dish_summary_read on dish_rating_summaries for select using(true);
grant select on dish_rating_summaries to anon,authenticated;
grant all on dish_rating_summaries to service_role;

create function dishd_guard_dish_rating() returns trigger language plpgsql security definer set search_path=public as $$
declare o orders%rowtype;
begin
  if tg_op='UPDATE' then new.order_item_id:=old.order_item_id; new.created_at:=old.created_at; new.menu_item_id:=old.menu_item_id;
  else select menu_item_id into new.menu_item_id from order_items where id=new.order_item_id; end if;
  select orders.* into o from orders join order_items i on i.order_id=orders.id where i.id=new.order_item_id;
  if not found or o.status<>'completed' or (o.payment_method='card' and o.payment_status<>'paid') then raise exception 'Collect this meal before rating its dishes.'; end if;
  if auth.uid() is not null and auth.uid()<>o.buyer_id then raise exception 'Only the buyer can rate these dishes.'; end if;
  if exists(select 1 from kitchens where id=o.kitchen_id and owner_id=o.buyer_id) then raise exception 'A cook cannot rate their own dishes.'; end if;
  new.updated_at:=now();
  return new;
end;
$$;
create trigger trg_dish_rating_guard before insert or update on dish_ratings for each row execute function dishd_guard_dish_rating();

create function dishd_refresh_dish_rating() returns trigger language plpgsql security definer set search_path=public as $$
declare item_id uuid;
begin
  item_id:=case when tg_op='DELETE' then old.menu_item_id else new.menu_item_id end;
  if item_id is not null then
    -- Serialize ratings for the same dish before reading the aggregate.
    perform 1 from menu_items where id=item_id for update;
    if not found then return null; end if;
    insert into dish_rating_summaries(menu_item_id,rating_count,avg_rating_10)
      select item_id,count(*)::integer,coalesce(avg(r.rating_10),0) from dish_ratings r where r.menu_item_id=item_id
      on conflict(menu_item_id) do update set rating_count=excluded.rating_count,avg_rating_10=excluded.avg_rating_10;
  end if;
  return null;
end;
$$;
create trigger trg_dish_rating_summary after insert or update or delete on dish_ratings for each row execute function dishd_refresh_dish_rating();

-- Review and selected dish ratings commit together, including reward triggers.
create function dishd_save_pickup_review(p_log uuid,p_review jsonb,p_ratings jsonb default '[]') returns void
language plpgsql security definer set search_path=public as $$
declare entry logs%rowtype; dish jsonb; photos text[];
begin
  if auth.uid() is null then raise exception 'Sign in before reviewing.'; end if;
  select * into entry from logs where id=p_log and buyer_id=auth.uid() for update;
  if not found or not entry.is_verified or not exists(select 1 from orders where id=entry.order_id and buyer_id=auth.uid() and status='completed') then raise exception 'A verified completed pickup is required.'; end if;
  if jsonb_typeof(p_review)<>'object' or coalesce(p_review->>'rating_10','') !~ '^(10|[0-9])$' or char_length(coalesce(p_review->>'body',''))>3000 then raise exception 'Check your review.'; end if;
  if jsonb_typeof(p_review->'photo_urls') is distinct from 'array' then raise exception 'Check your photos.'; end if;
  select coalesce(array_agg(value),'{}') into photos from jsonb_array_elements_text(p_review->'photo_urls');
  if cardinality(photos)>3 or exists(select 1 from unnest(photos) url where url !~ '^https://') then raise exception 'Use up to three HTTPS photos.'; end if;
  if p_ratings is null or jsonb_typeof(p_ratings)<>'array' or jsonb_array_length(p_ratings)>30 then raise exception 'Check the dish ratings.'; end if;
  if (select count(distinct value->>'order_item_id') from jsonb_array_elements(p_ratings))<>jsonb_array_length(p_ratings) then raise exception 'Rate each dish once.'; end if;
  for dish in select value from jsonb_array_elements(p_ratings) loop
    if coalesce(dish->>'rating_10','') !~ '^(10|[0-9])$' or not exists(select 1 from order_items where id=(dish->>'order_item_id')::uuid and order_id=entry.order_id and menu_item_id is not null) then raise exception 'Only dishes in this pickup can be rated.'; end if;
    insert into dish_ratings(order_item_id,rating_10) values((dish->>'order_item_id')::uuid,(dish->>'rating_10')::integer)
      on conflict(order_item_id) do update set rating_10=excluded.rating_10;
  end loop;
  update logs set rating_10=(p_review->>'rating_10')::integer,body=nullif(p_review->>'body',''),
    photo_urls=photos,photo_url=photos[1],sourcing_affirmed=(p_review->>'sourcing_affirmed')::boolean,
    flavor_rating_10=(p_review->>'flavor_rating_10')::integer,value_rating_10=(p_review->>'value_rating_10')::integer,quality_rating_10=(p_review->>'quality_rating_10')::integer
    where id=entry.id;
end;
$$;
revoke all on function dishd_save_pickup_review(uuid,jsonb,jsonb) from public;
grant execute on function dishd_save_pickup_review(uuid,jsonb,jsonb) to authenticated;

create function dishd_reward_summary() returns table(balance bigint,earned bigint)
language sql stable security invoker set search_path=public as $$
  select coalesce(sum(points),0),coalesce(sum(greatest(points,0)),0) from reward_events where user_id=auth.uid();
$$;
revoke all on function dishd_reward_summary() from public;
grant execute on function dishd_reward_summary() to authenticated;
commit;
