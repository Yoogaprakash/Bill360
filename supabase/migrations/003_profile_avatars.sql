-- =====================================================================
-- Bill360 — migration 003: user profile avatars
-- =====================================================================

alter table profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects for select
  using (bucket_id = 'avatars');
drop policy if exists "avatars_authenticated_write" on storage.objects;
create policy "avatars_authenticated_write" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');
drop policy if exists "avatars_authenticated_update" on storage.objects;
create policy "avatars_authenticated_update" on storage.objects for update
  using (bucket_id = 'avatars' and auth.role() = 'authenticated');
