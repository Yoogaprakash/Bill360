-- =====================================================================
-- Bill360 — migration 005: cache the user's email on `profiles`.
-- auth.users isn't queryable from the client, so the Team/Platform Users
-- pages had no way to show or edit an email without this — kept in sync by
-- the signup trigger and by the admin-create-user edge function.
-- =====================================================================

alter table profiles add column if not exists email text;

-- Backfill existing rows once.
update profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', 'sales_user', new.email);
  return new;
end;
$$;
