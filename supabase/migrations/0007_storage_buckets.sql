-- ============================================================================
-- Dishd — storage buckets, in version control.
--
-- Run AFTER 0006.
--
-- The `photos` and `receipts` buckets were created by hand in the Supabase
-- dashboard, so they existed on one machine and nowhere else. A fresh project
-- brought up from these migrations had neither: review photo upload would fail,
-- and the Chain of Trust receipt upload in lib/market/receipt-actions.ts would
-- fail with it. Buckets and their policies are part of the schema.
--
-- photos   public  — review photos, served straight from a public URL stored on
--                    logs.photo_url.
-- receipts private — sourcing receipts are evidence, containing a cook's
--                    purchase history. Only the owning cook and the reviewer
--                    should ever read one, so this bucket is never public.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('photos',   'photos',   true,  8388608,
   array['image/jpeg','image/png','image/webp','image/avif','image/heic']),
  ('receipts', 'receipts', false, 8388608,
   array['image/jpeg','image/png','image/webp','image/avif','image/heic','application/pdf'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ------------------------------------------------------------------ photos --
-- Anyone may look at a review photo; the review itself is public.
drop policy if exists photos_read on storage.objects;
create policy photos_read on storage.objects for select
  using (bucket_id = 'photos');

-- A signed-in buyer may add one, under the reviews/ prefix only.
drop policy if exists photos_insert on storage.objects;
create policy photos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = 'reviews'
  );

-- Replacing or removing a photo is limited to whoever uploaded it. Storage
-- records the uploader, so this does not need a join back to logs.
drop policy if exists photos_update on storage.objects;
create policy photos_update on storage.objects for update to authenticated
  using (bucket_id = 'photos' and owner = auth.uid());

drop policy if exists photos_delete on storage.objects;
create policy photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and owner = auth.uid());

-- ---------------------------------------------------------------- receipts --
-- Private on purpose: a receipt is a cook's purchase record. Reads go through
-- a signed URL issued server-side, never a public path.
drop policy if exists receipts_insert on storage.objects;
create policy receipts_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and owner = auth.uid());

drop policy if exists receipts_read on storage.objects;
create policy receipts_read on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and owner = auth.uid());

drop policy if exists receipts_update on storage.objects;
create policy receipts_update on storage.objects for update to authenticated
  using (bucket_id = 'receipts' and owner = auth.uid());

drop policy if exists receipts_delete on storage.objects;
create policy receipts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and owner = auth.uid());
