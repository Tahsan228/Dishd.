-- ============================================================================
-- Dishd — manual receipt review
-- Run AFTER 0002.
--
-- Receipts are no longer machine-read. The cook declares what is on the
-- receipt and uploads the image as evidence; deterministic checks run
-- instantly and for free (duplicate detection, source match, freshness), and
-- only the "does this image match the declaration" judgement goes to a human.
--
-- This keeps the anti-cheat that matters: two kitchens cannot submit the same
-- receipt, and a store the kitchen never registered is rejected on the spot.
-- ============================================================================

-- 'pending' = deterministic checks passed, awaiting a human look.
alter table sourcing_batches
  drop constraint if exists sourcing_batches_match_status_check;

alter table sourcing_batches
  add constraint sourcing_batches_match_status_check
  check (match_status in ('pending','verified','mismatch','unreadable'));

alter table sourcing_batches
  alter column match_status set default 'pending';

-- Review trail. Who cleared this receipt, when, and why.
alter table sourcing_batches
  add column if not exists reviewed_at  timestamptz,
  add column if not exists reviewed_by  uuid references profiles(id) on delete set null,
  add column if not exists review_note  text;

-- What the cook declared is on the receipt. Previously OCR output; now typed
-- by the cook, which is what the human reviewer checks the image against.
alter table sourcing_batches
  add column if not exists declared_meat_types text[] not null default '{}';

comment on column sourcing_batches.ocr_store is
  'Store as declared by the cook (no longer machine-read).';
comment on column sourcing_batches.ocr_total_cents is
  'Receipt total as declared by the cook, integer cents.';
comment on column sourcing_batches.ocr_date is
  'Purchase date as declared by the cook.';

-- ---------------------------------------------------------------------------
-- Trust streak must ignore pending batches.
--
-- The previous version counted leading 'verified' rows, so uploading a new
-- receipt would drop a kitchen's streak to zero the instant it was submitted
-- and only restore it after review. A batch awaiting judgement is not a
-- failure — skip it. Only 'mismatch' and 'unreadable' break a streak.
-- ---------------------------------------------------------------------------
create or replace function dishd_trust_streak(k uuid)
returns integer language sql stable
set search_path = public as $$
  with judged as (
    select match_status, row_number() over (order by created_at desc) as rn
    from sourcing_batches
    where kitchen_id = k
      and match_status <> 'pending'
  ),
  first_bad as (
    select min(rn) as rn from judged where match_status <> 'verified'
  )
  select coalesce(
    (select rn - 1 from first_bad where rn is not null),
    (select count(*) from judged)
  )::integer;
$$;

-- Reviewer queue: oldest pending first.
create index if not exists sourcing_batches_pending_idx
  on sourcing_batches (created_at)
  where match_status = 'pending';
