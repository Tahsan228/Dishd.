-- ============================================================================
-- Dishd — diary customisation and following.
--
-- Run AFTER 0013.
-- ============================================================================
begin;

-- ------------------------------------------------------- diary customisation ---
-- A banner image and an accent, so a diary reads as somebody's rather than as a
-- row in a database.
--
-- The accent is a fixed list of palette tokens rather than a free colour. A
-- colour picker would let anyone put unreadable text on a cream ground and
-- would quietly become a second brand; these four already carry meaning in the
-- design system, so a diary can feel personal without the identity drifting.
alter table profiles
  add column if not exists banner_url text,
  add column if not exists accent text not null default 'forest'
    check (accent in ('forest', 'brass', 'clay', 'amber')),
  add column if not exists tagline text;

alter table profiles drop constraint if exists profiles_tagline_length;
alter table profiles add constraint profiles_tagline_length
  check (tagline is null or char_length(tagline) <= 80);

-- Images are served from the public photos bucket or another https host; the
-- app also re-checks the protocol before rendering, since a stored value can
-- outlive whatever wrote it.
alter table profiles drop constraint if exists profiles_banner_https;
alter table profiles add constraint profiles_banner_https
  check (banner_url is null or banner_url ~ '^https://');

alter table profiles drop constraint if exists profiles_avatar_https;
alter table profiles add constraint profiles_avatar_https
  check (avatar_url is null or avatar_url ~ '^https://');

-- ------------------------------------------------------------------ follows ---
create table if not exists follows (
  follower_id  uuid not null references profiles(id) on delete cascade,
  following_id uuid not null references profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  -- Following yourself would inflate your own count for nothing.
  constraint follows_not_self check (follower_id <> following_id)
);
create index if not exists follows_following on follows (following_id, created_at desc);
create index if not exists follows_follower on follows (follower_id, created_at desc);

alter table follows enable row level security;

-- Counts are public, which is the point of a follower count.
drop policy if exists follows_read on follows;
create policy follows_read on follows for select using (true);

-- You may only ever create or remove your own follow.
drop policy if exists follows_insert on follows;
create policy follows_insert on follows for insert to authenticated
  with check (follower_id = auth.uid());

drop policy if exists follows_delete on follows;
create policy follows_delete on follows for delete to authenticated
  using (follower_id = auth.uid());

-- No update policy: a follow has nothing to change. Unfollowing is a delete.

grant select on follows to anon, authenticated;
grant insert, delete on follows to authenticated;
grant all on follows to service_role;

-- One row per profile, so a page reads counts instead of aggregating.
-- security_invoker keeps the underlying read policies in force.
create or replace view profile_follow_counts with (security_invoker = on) as
select
  p.id as user_id,
  (select count(*) from follows f where f.following_id = p.id)::integer as followers,
  (select count(*) from follows f where f.follower_id  = p.id)::integer as following
from profiles p;

grant select on profile_follow_counts to anon, authenticated;

commit;
