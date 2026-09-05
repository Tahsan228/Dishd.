-- ============================================================================
-- Dishd — initial schema
-- FROZEN after H2. Ask the host before changing anything here.
--
-- Design notes worth knowing before you read:
--   * Exact addresses live in their own table so RLS can gate them. The
--     `kitchens` table only ever holds the deterministically fuzzed point.
--   * `kitchens` carries denormalised credibility counters maintained by
--     triggers, so the credibility panel is a single-row read.
--   * `agreements` is append-only: it is the consent evidence trail.
--   * order_items.provenance_snapshot freezes sourcing at order time so a meal
--     stays traceable even if the cook later deletes the batch.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- profiles --
create table profiles (
  id            uuid primary key references auth.users on delete cascade,
  handle        text unique not null,
  display_name  text not null,
  avatar_url    text,
  bio           text,
  city          text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------- kitchens --
create table kitchens (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references profiles(id) on delete cascade,
  name                text not null,
  slug                text unique not null,
  bio                 text,
  hero_url            text,
  cuisine_tags        text[] not null default '{}',

  -- jurisdiction gate (US: MEHKO / cottage food)
  state_code          text not null,
  county              text not null,
  mehko_permit_no     text,
  permit_status       text not null default 'none'
                      check (permit_status in ('none','claimed','verified')),

  -- PUBLIC location: fuzzed once at creation, then never recomputed.
  approx_lat          double precision not null,
  approx_lng          double precision not null,
  neighborhood_label  text not null,

  stripe_account_id   text,
  stripe_onboarded    boolean not null default false,
  accepts_cash        boolean not null default true,
  accepts_card        boolean not null default false,

  status              text not null default 'draft'
                      check (status in ('draft','active','suspended','banned')),
  banned_reason       text,
  banned_at           timestamptz,

  -- denormalised credibility counters (trigger-maintained; do not write by hand)
  orders_completed    integer not null default 0,
  avg_rating_10       numeric(4,2) not null default 0,
  distinct_customers  integer not null default 0,
  repeat_customers    integer not null default 0,
  trust_streak        integer not null default 0,
  upheld_flags        integer not null default 0,
  open_incidents      integer not null default 0,
  cook_cancellations  integer not null default 0,

  created_at          timestamptz not null default now()
);
create index on kitchens (status);
create index on kitchens (state_code, county);

-- Exact address, split out purely so RLS can gate it.
create table kitchen_addresses (
  kitchen_id uuid primary key references kitchens(id) on delete cascade,
  line1      text not null,
  line2      text,
  city       text not null,
  zip        text not null,
  lat        double precision not null,
  lng        double precision not null
);

-- ------------------------------------------------------------ halal chain --
create table known_halal_stores (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  address    text,
  city       text,
  state      text,
  cert_body  text
);

create table halal_sources (
  id            uuid primary key default gen_random_uuid(),
  kitchen_id    uuid not null references kitchens(id) on delete cascade,
  store_name    text not null,
  store_address text,
  cert_body     text,
  in_directory  boolean not null default false,
  created_at    timestamptz not null default now()
);
create index on halal_sources (kitchen_id);

create table sourcing_batches (
  id                uuid primary key default gen_random_uuid(),
  kitchen_id        uuid not null references kitchens(id) on delete cascade,
  halal_source_id   uuid references halal_sources(id) on delete set null,
  receipt_path      text not null,
  image_sha256      text not null,
  purchased_on      date,
  ocr_store         text,
  ocr_total_cents   integer,
  ocr_date          date,
  ocr_items         jsonb not null default '[]'::jsonb,
  match_status      text not null
                    check (match_status in ('verified','mismatch','unreadable')),
  mismatch_reasons  text[] not null default '{}',
  backs_items_until date,
  created_at        timestamptz not null default now()
);
create index on sourcing_batches (kitchen_id, created_at desc);

-- The anti-cheat: one receipt cannot back two kitchens.
create unique index sourcing_batches_image_uniq on sourcing_batches (image_sha256);
create unique index sourcing_batches_receipt_uniq
  on sourcing_batches (
    lower(regexp_replace(coalesce(ocr_store, ''), '[^a-zA-Z0-9]', '', 'g')),
    ocr_date,
    ocr_total_cents
  )
  where ocr_store is not null and ocr_date is not null and ocr_total_cents is not null;

-- ------------------------------------------------------------------- menu --
create table menu_items (
  id                uuid primary key default gen_random_uuid(),
  kitchen_id        uuid not null references kitchens(id) on delete cascade,
  name              text not null,
  description       text,
  price_cents       integer not null check (price_cents >= 0),
  photo_url         text,
  contains_meat     boolean not null default false,
  meat_type         text not null default 'none'
                    check (meat_type in ('beef','lamb','chicken','goat','other','none')),
  sourcing_batch_id uuid references sourcing_batches(id) on delete set null,
  allergens         text[] not null,
  is_available      boolean not null default true,
  daily_qty         integer not null default 10,
  created_at        timestamptz not null default now(),

  -- No meat item goes live without a receipt behind it. Enforced here, not in the UI.
  constraint meat_requires_batch
    check (contains_meat = false or sourcing_batch_id is not null),
  -- Allergens are mandatory; {none_declared} is the explicit empty case.
  constraint allergens_required check (array_length(allergens, 1) >= 1)
);
create index on menu_items (kitchen_id);

create table pickup_windows (
  id         uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references kitchens(id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  capacity   integer not null default 10
);
create index on pickup_windows (kitchen_id, starts_at);

-- ----------------------------------------------------------------- orders --
create table orders (
  id                  uuid primary key default gen_random_uuid(),
  buyer_id            uuid not null references profiles(id) on delete cascade,
  kitchen_id          uuid not null references kitchens(id) on delete cascade,
  pickup_window_id    uuid references pickup_windows(id) on delete set null,
  status              text not null default 'pending'
                      check (status in ('pending','accepted','ready','completed','cancelled','declined')),
  payment_method      text not null check (payment_method in ('cash','card')),
  stripe_session_id   text,
  payment_status      text not null default 'unpaid',
  subtotal_cents      integer not null default 0,
  pickup_code         text not null default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6)),
  address_revealed_at timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz not null default now()
);
create index on orders (buyer_id, created_at desc);
create index on orders (kitchen_id, status);

create table order_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references orders(id) on delete cascade,
  menu_item_id        uuid references menu_items(id) on delete set null,
  qty                 integer not null check (qty > 0),
  unit_price_cents    integer not null,
  name_snapshot       text not null,
  meat_snapshot       text not null default 'none',
  -- Frozen provenance: survives the cook deleting the batch later.
  provenance_snapshot jsonb
);
create index on order_items (order_id);

-- ----------------------------------------------------- logs (the "diary") --
create table logs (
  id                uuid primary key default gen_random_uuid(),
  buyer_id          uuid not null references profiles(id) on delete cascade,
  kitchen_id        uuid not null references kitchens(id) on delete cascade,
  order_id          uuid unique references orders(id) on delete set null,
  rating_10         integer check (rating_10 between 0 and 10), -- null = checked in, not yet rated
  body              text,
  photo_url         text,
  is_verified       boolean not null default false,
  sourcing_affirmed boolean,
  logged_at         timestamptz not null default now()
);
create index on logs (kitchen_id, logged_at desc);
create index on logs (buyer_id, logged_at desc);

create table log_likes (
  log_id  uuid not null references logs(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  primary key (log_id, user_id)
);

-- ----------------------------------------------------------------- badges --
create table kitchen_badges (
  kitchen_id uuid not null references kitchens(id) on delete cascade,
  badge_code text not null,
  earned_at  timestamptz not null default now(),
  primary key (kitchen_id, badge_code)
);

create table user_badges (
  user_id    uuid not null references profiles(id) on delete cascade,
  badge_code text not null,
  earned_at  timestamptz not null default now(),
  primary key (user_id, badge_code)
);

-- --------------------------------------------------- trust & safety rails --
create table flags (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid references profiles(id) on delete set null,
  target_type     text not null check (target_type in ('kitchen','log','menu_item','batch')),
  target_id       uuid not null,
  reason          text not null,
  details         text,
  status          text not null default 'open' check (status in ('open','upheld','dismissed')),
  resolution_note text,
  created_at      timestamptz not null default now()
);
create index on flags (target_type, target_id, status);

create table incidents (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  reporter_id uuid references profiles(id) on delete set null,
  symptoms    text,
  onset_at    timestamptz,
  status      text not null default 'open' check (status in ('open','reviewing','closed')),
  created_at  timestamptz not null default now()
);

-- Append-only consent ledger. The single most important liability artifact.
create table agreements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  doc_type    text not null,
  doc_version text not null,
  accepted_at timestamptz not null default now(),
  ip          text,
  user_agent  text
);
create index on agreements (user_id, doc_type);
