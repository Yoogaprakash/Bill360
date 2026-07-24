-- =====================================================================
-- Bill360 — migration 006:
--  * auto-numbered purchase bills (mirrors bills.bill_number)
--  * manager can edit any company bill/purchase (not just create)
--  * manager can self-service sales_user profiles (active toggle etc.)
--    without going through the edge function, scoped to sales_user only
-- =====================================================================

-- ---------------------------------------------------------------------
-- PURCHASE NUMBERING
-- ---------------------------------------------------------------------
alter table companies add column if not exists purchase_series text not null default 'PUR';
alter table companies add column if not exists purchase_seq integer not null default 0;
alter table purchases add column if not exists purchase_number text;

create or replace function next_purchase_number(p_company_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_series text;
  v_seq integer;
begin
  update companies
    set purchase_seq = purchase_seq + 1
    where id = p_company_id
    returning purchase_series, purchase_seq into v_series, v_seq;

  if v_series is null then
    raise exception 'Company % not found', p_company_id;
  end if;

  return v_series || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- ---------------------------------------------------------------------
-- BILLS — manager can now edit any company bill (not just view)
-- ---------------------------------------------------------------------
drop policy if exists "bills_update" on bills;
create policy "bills_update" on bills for update
  using (
    is_super_admin()
    or (company_id = my_company_id() and my_role() in ('company_admin', 'manager'))
    or (company_id = my_company_id() and created_by = auth.uid())
  );

drop policy if exists "bill_items_delete" on bill_items;
create policy "bill_items_delete" on bill_items for delete
  using (exists (
    select 1 from bills b where b.id = bill_items.bill_id
    and (is_super_admin() or (b.company_id = my_company_id() and my_role() in ('company_admin', 'manager')))
  ));

-- ---------------------------------------------------------------------
-- PURCHASES — manager can now edit any company purchase (not just create)
-- ---------------------------------------------------------------------
drop policy if exists "purchases_update" on purchases;
create policy "purchases_update" on purchases for update
  using (is_super_admin() or (company_id = my_company_id() and my_role() in ('company_admin', 'manager')));

drop policy if exists "purchase_items_delete" on purchase_items;
create policy "purchase_items_delete" on purchase_items for delete
  using (exists (
    select 1 from purchases p where p.id = purchase_items.purchase_id
    and (is_super_admin() or (p.company_id = my_company_id() and my_role() in ('company_admin', 'manager')))
  ));

-- ---------------------------------------------------------------------
-- PROFILES TRIGGER — let a manager directly toggle/update a sales_user's
-- profile (e.g. the Active switch) within their own company, same spirit
-- as the existing company_admin branch but capped to sales_user targets
-- and unable to change role/company_id. Role/email/password changes for
-- a manager still go through the admin-create-user edge function.
-- ---------------------------------------------------------------------
create or replace function protect_profile_privileges() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if is_super_admin() then
    return new;
  end if;

  if my_role() = 'company_admin' and old.company_id = my_company_id() then
    if new.company_id is distinct from old.company_id then
      raise exception 'Company admins cannot move a user to a different company';
    end if;
    if new.role = 'super_admin' then
      raise exception 'Company admins cannot grant super_admin';
    end if;
    return new;
  end if;

  if my_role() = 'manager' and old.company_id = my_company_id() and old.role = 'sales_user' then
    if new.company_id is distinct from old.company_id then
      raise exception 'Managers cannot move a user to a different company';
    end if;
    if new.role is distinct from old.role then
      raise exception 'Managers cannot change a user''s role';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role
     or new.company_id is distinct from old.company_id
     or new.is_active is distinct from old.is_active then
    raise exception 'Not authorized to change role, company_id, or is_active';
  end if;

  return new;
end;
$$;
