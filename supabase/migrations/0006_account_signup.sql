-- ============================================================================
-- Dishd — let real people open an account.
--
-- Run AFTER 0005.
--
-- Until now the only way into the app was one of three seeded accounts sharing
-- a password compiled into the client bundle. There was no sign-up path at all,
-- and `profiles` has no trigger behind it, so a user created through
-- supabase.auth.signUp() would exist in auth.users with no profile row. Every
-- read in the app goes through profiles (the header, the order flow, the whole
-- social workstream keys off profiles.handle), so that account would be signed
-- in and simultaneously invisible.
--
-- Creating the profile from the client is not good enough either: when email
-- confirmation is switched on, signUp() returns no session, so there is no
-- auth.uid() to satisfy the `profiles_insert` policy and the profile could
-- never be written. A SECURITY DEFINER trigger on auth.users runs regardless of
-- confirmation settings and cannot be skipped by a client that simply stops
-- after step one.
--
-- Handles are public identity (/u/<handle>) and unique, so the trigger owns
-- collision handling rather than making the UI guess.
-- ============================================================================

-- Normalise anything a human types into a legal handle: lowercase, a-z 0-9 and
-- underscore, 3-20 characters. Returns null when nothing usable survives.
create or replace function dishd_normalise_handle(raw text)
returns text language plpgsql immutable
set search_path = public as $$
declare
  cleaned text;
begin
  if raw is null then return null; end if;
  cleaned := lower(trim(raw));
  cleaned := regexp_replace(cleaned, '[^a-z0-9_]+', '_', 'g');
  cleaned := regexp_replace(cleaned, '_+', '_', 'g');
  cleaned := trim(both '_' from cleaned);
  if length(cleaned) < 3 then return null; end if;
  return left(cleaned, 20);
end;
$$;

-- First free handle at or after `base`, trying base, base2, base3 ...
create or replace function dishd_available_handle(base text)
returns text language plpgsql
set search_path = public as $$
declare
  candidate text := coalesce(dishd_normalise_handle(base), 'cook');
  stem      text := candidate;
  n         integer := 1;
begin
  while exists (select 1 from profiles where handle = candidate) loop
    n := n + 1;
    -- Keep room for the suffix so the result still fits the 20-char budget.
    candidate := left(stem, 20 - length(n::text)) || n::text;
    if n > 10000 then
      candidate := 'cook_' || replace(gen_random_uuid()::text, '-', '');
      candidate := left(candidate, 20);
      exit;
    end if;
  end loop;
  return candidate;
end;
$$;

-- Every auth user gets exactly one profile, built from the metadata the sign-up
-- form supplies, falling back to the email local part.
create or replace function dishd_handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  meta_handle text := nullif(trim(new.raw_user_meta_data ->> 'handle'), '');
  meta_name   text := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
  base        text;
begin
  base := coalesce(
    dishd_normalise_handle(meta_handle),
    dishd_normalise_handle(split_part(new.email, '@', 1)),
    'cook'
  );

  insert into profiles (id, handle, display_name, city)
  values (
    new.id,
    dishd_available_handle(base),
    coalesce(meta_name, split_part(new.email, '@', 1), 'Dishd member'),
    nullif(trim(new.raw_user_meta_data ->> 'city'), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function dishd_handle_new_user();

-- Backfill any auth user that predates the trigger, so no one is left signed in
-- but invisible.
insert into profiles (id, handle, display_name)
select u.id,
       dishd_available_handle(split_part(u.email, '@', 1)),
       coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
                split_part(u.email, '@', 1),
                'Dishd member')
from auth.users u
left join profiles p on p.id = u.id
where p.id is null;

-- A handle is a public URL, so pin the shape in the database too rather than
-- trusting whichever code path wrote the row.
alter table profiles drop constraint if exists profiles_handle_shape;
alter table profiles add constraint profiles_handle_shape
  check (handle ~ '^[a-z0-9_]{3,20}$');
