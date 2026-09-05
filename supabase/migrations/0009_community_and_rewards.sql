-- Community, spendable rewards, and durable report submission.
-- Rewards do NOT replace the credibility formulas.
begin;
create table reward_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  source_key text not null,
  kind text not null,
  points integer not null check (points <> 0),
  description text not null,
  created_at timestamptz not null default now(),
  unique(user_id, source_key)
);
create index on reward_events(user_id, created_at desc);
alter table reward_events enable row level security;
create policy rewards_read on reward_events for select to authenticated using (user_id = auth.uid());

create table reward_catalog (
  code text primary key, name text not null, points_cost integer not null check(points_cost > 0),
  credit_cents integer not null check(credit_cents > 0),
  minimum_order_cents integer not null check(minimum_order_cents > credit_cents),
  active boolean not null default true
);
insert into reward_catalog values ('neighbor_5', '$5 neighborhood credit', 250, 500, 1500, true),
  ('neighbor_10', '$10 neighborhood credit', 500, 1000, 2500, true);
alter table reward_catalog enable row level security;
create policy catalog_read on reward_catalog for select using (true);

create table reward_redemptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id) on delete cascade,
  reward_code text not null references reward_catalog(code), points_spent integer not null,
  credit_cents integer not null, minimum_order_cents integer not null,
  status text not null default 'available' check(status in ('available','reserved','used')),
  order_id uuid unique references orders(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table reward_redemptions enable row level security;
create policy redemptions_read on reward_redemptions for select to authenticated using(user_id = auth.uid());

create table reward_claims (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id) on delete cascade,
  mission text not null check(mission in ('app_video','kitchen_video')),
  kitchen_id uuid references kitchens(id) on delete cascade,
  proof_url text not null unique check(proof_url ~ '^https://'),
  notes text not null default '', status text not null default 'pending' check(status in ('pending','approved','declined')),
  reviewed_by uuid references profiles(id), resolution_note text, reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((mission = 'kitchen_video' and kitchen_id is not null) or (mission = 'app_video' and kitchen_id is null))
);
create unique index one_active_mission on reward_claims(user_id, mission, coalesce(kitchen_id, '00000000-0000-0000-0000-000000000000'::uuid)) where status in ('pending','approved');
alter table reward_claims enable row level security;
create policy claims_read on reward_claims for select to authenticated using(user_id = auth.uid());
create policy claims_insert on reward_claims for insert to authenticated with check(user_id = auth.uid() and status = 'pending' and reviewed_by is null and reviewed_at is null and resolution_note is null);

create function dishd_redeem_reward(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare who uuid := auth.uid(); reward reward_catalog%rowtype; balance bigint; redemption uuid := gen_random_uuid();
begin
  if who is null then raise exception 'Sign in to redeem rewards.'; end if;
  perform 1 from profiles where id = who for update;
  select * into reward from reward_catalog where code = p_code and active;
  if not found then raise exception 'That reward is unavailable.'; end if;
  select coalesce(sum(points),0) into balance from reward_events where user_id = who;
  if balance < reward.points_cost then raise exception 'You do not have enough points yet.'; end if;
  insert into reward_redemptions(id,user_id,reward_code,points_spent,credit_cents,minimum_order_cents)
    values(redemption,who,reward.code,reward.points_cost,reward.credit_cents,reward.minimum_order_cents);
  insert into reward_events(user_id,source_key,kind,points,description)
    values(who,'redeem:'||redemption,'redemption',-reward.points_cost,reward.name);
  return redemption;
end;
$$;
revoke all on function dishd_redeem_reward(text) from public;
grant execute on function dishd_redeem_reward(text) to authenticated;

create function dishd_reward_order() returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  if new.status = 'completed' and (new.payment_method = 'cash' or new.payment_status = 'paid') then
    select owner_id into owner from kitchens where id = new.kitchen_id;
    if owner = new.buyer_id then return new; end if;
    insert into reward_events(user_id,source_key,kind,points,description) values
      (new.buyer_id,'pickup:'||new.id,'pickup',10,'Collected a neighborhood meal'),
      (new.buyer_id,'first-kitchen:'||new.kitchen_id,'discovery',25,'First pickup from a new small kitchen')
      on conflict(user_id,source_key) do nothing;
    if new.subtotal_cents >= 100 then
      insert into reward_events(user_id,source_key,kind,points,description)
      values(new.buyer_id,'purchase:'||new.id,'purchase',floor(new.subtotal_cents/100.0)::integer*5,'Five points per dollar spent')
      on conflict(user_id,source_key) do nothing;
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_orders_rewards after update on orders for each row execute function dishd_reward_order();

create function dishd_reward_review() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_verified and new.rating_10 is not null and exists (
    select 1 from orders o join kitchens k on k.id=o.kitchen_id
    where o.id=new.order_id and o.status='completed' and o.buyer_id=new.buyer_id
      and k.owner_id<>new.buyer_id and (o.payment_method='cash' or o.payment_status='paid')
  ) then
    insert into reward_events(user_id,source_key,kind,points,description)
      values(new.buyer_id,'review:'||new.order_id,'review',20,'Shared a verified pickup review')
      on conflict(user_id,source_key) do nothing;
    if new.photo_url is not null then
      insert into reward_events(user_id,source_key,kind,points,description)
        values(new.buyer_id,'photo:'||new.order_id,'photo',10,'Added a photo to a verified review')
        on conflict(user_id,source_key) do nothing;
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_logs_rewards after insert or update on logs for each row execute function dishd_reward_review();

create function dishd_review_reward_claim(p_id uuid,p_approve boolean,p_reviewer uuid,p_note text) returns void
language plpgsql security definer set search_path=public as $$
declare claim reward_claims%rowtype; award integer;
begin
  select * into claim from reward_claims where id=p_id for update;
  if not found or claim.status<>'pending' then raise exception 'This submission has already been reviewed.'; end if;
  award := case when claim.mission='app_video' then 200 else 150 end;
  update reward_claims set status=case when p_approve then 'approved' else 'declined' end,
    reviewed_by=p_reviewer,reviewed_at=now(),resolution_note=left(p_note,1000) where id=p_id;
  if p_approve then
    insert into reward_events(user_id,source_key,kind,points,description)
    values(claim.user_id,'mission:'||claim.mission||':'||coalesce(claim.kitchen_id::text,'app'),'promotion',award,'Promotional video approved by a reviewer')
    on conflict(user_id,source_key) do nothing;
  end if;
end;
$$;
revoke all on function dishd_review_reward_claim(uuid,boolean,uuid,text) from public;
grant execute on function dishd_review_reward_claim(uuid,boolean,uuid,text) to service_role;

create table community_posts (
  id uuid primary key default gen_random_uuid(), author_id uuid not null references profiles(id) on delete cascade,
  kitchen_id uuid references kitchens(id) on delete cascade,
  category text not null check(category in ('story','announcement','behind_the_scenes','offer')),
  body text not null check(char_length(body) between 10 and 3000),
  photo_urls text[] not null default '{}' check(cardinality(photo_urls)<=3),
  created_at timestamptz not null default now()
);
create index on community_posts(created_at desc);
alter table community_posts enable row level security;
create policy posts_read on community_posts for select using(true);
create policy posts_insert on community_posts for insert to authenticated with check(
  author_id=auth.uid() and (
    (kitchen_id is null and category='story') or exists (
      select 1 from kitchens k where k.id=kitchen_id and k.owner_id=auth.uid() and k.status='active'
    )
  )
);
create policy posts_delete on community_posts for delete to authenticated using(author_id=auth.uid());

alter table flags add column if not exists order_id uuid references orders(id);
alter table flags add column if not exists evidence_urls text[] not null default '{}' check(cardinality(evidence_urls)<=3);
drop policy if exists flags_insert on flags;
create policy flags_insert on flags for insert to authenticated with check(
  reporter_id=auth.uid() and status='open' and resolution_note is null and (
    order_id is null or exists (select 1 from orders o where o.id=order_id and o.buyer_id=auth.uid())
  )
);
-- A new report is an allegation. Only trusted moderation changes its disposition.
create function dishd_guard_flag_insert() returns trigger language plpgsql set search_path=public as $$
begin
  if auth.uid() is not null then new.status:='open'; new.resolution_note:=null; new.created_at:=now(); end if;
  return new;
end;
$$;
create trigger trg_flags_initial_status before insert on flags for each row execute function dishd_guard_flag_insert();

create or replace view community_kitchen_stats with(security_invoker=true) as
select k.id,k.name,k.slug,k.status,k.neighborhood_label,k.cuisine_tags,k.hero_url,k.avg_rating_10,k.upheld_flags,k.banned_reason,
  count(l.id) filter(where l.is_verified and l.rating_10 is not null and l.logged_at>=now()-interval '7 days')::integer as weekly_reviews,
  avg(l.rating_10) filter(where l.is_verified and l.rating_10 is not null and l.logged_at>=now()-interval '7 days') as weekly_rating_10,
  count(l.id) filter(where l.is_verified and l.rating_10 is not null and l.logged_at>=now()-interval '30 days')::integer as monthly_reviews
from kitchens k left join logs l on l.kitchen_id=k.id
where k.status in ('active','suspended','banned') group by k.id;
grant select on community_kitchen_stats to anon,authenticated;
commit;
