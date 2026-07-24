-- =====================================================================
-- Bill360 — migration 004b: RLS updates for the new 'manager' role, plus
-- delete policies needed for bill/purchase editing and bulk-clear tools.
-- Run 004a_manager_role_enum.sql first (separate transaction requirement).
-- =====================================================================

-- ---------------------------------------------------------------------
-- PRODUCTS — manager can create/update (stock maintenance) but not delete
-- ---------------------------------------------------------------------
drop policy if exists "products_insert" on products;
create policy "products_insert" on products for insert
  with check (is_super_admin() or (company_id = my_company_id() and my_role() in ('company_admin', 'manager')));

drop policy if exists "products_update" on products;
create policy "products_update" on products for update
  using (is_super_admin() or (company_id = my_company_id() and my_role() in ('company_admin', 'manager', 'sales_user')));
-- products_delete stays company_admin-only (unchanged from schema.sql)

-- ---------------------------------------------------------------------
-- BILLS — company_admin and manager see all company bills (oversight /
-- credit visibility); sales_user still sees only bills they created.
-- Adds a delete policy (company_admin only) for the "clear all bills" tool.
-- ---------------------------------------------------------------------
drop policy if exists "bills_select" on bills;
create policy "bills_select" on bills for select
  using (
    is_super_admin()
    or (company_id = my_company_id() and my_role() in ('company_admin', 'manager'))
    or (company_id = my_company_id() and my_role() = 'sales_user' and created_by = auth.uid())
  );

drop policy if exists "bills_delete" on bills;
create policy "bills_delete" on bills for delete
  using (is_super_admin() or (company_id = my_company_id() and my_role() = 'company_admin'));

-- bill_items had no update/delete policy at all — needed so a company_admin
-- editing a bill can replace its line items (delete-then-reinsert).
drop policy if exists "bill_items_delete" on bill_items;
create policy "bill_items_delete" on bill_items for delete
  using (exists (
    select 1 from bills b where b.id = bill_items.bill_id
    and (is_super_admin() or (b.company_id = my_company_id() and my_role() = 'company_admin'))
  ));

-- ---------------------------------------------------------------------
-- PURCHASES — any company member can view (sales_user/manager included);
-- only company_admin and manager can create; only company_admin can edit
-- or delete an existing purchase.
-- ---------------------------------------------------------------------
drop policy if exists "purchases_select" on purchases;
create policy "purchases_select" on purchases for select
  using (is_super_admin() or company_id = my_company_id());

drop policy if exists "purchases_insert" on purchases;
create policy "purchases_insert" on purchases for insert
  with check (is_super_admin() or (company_id = my_company_id() and my_role() in ('company_admin', 'manager')));

drop policy if exists "purchases_delete" on purchases;
create policy "purchases_delete" on purchases for delete
  using (is_super_admin() or (company_id = my_company_id() and my_role() = 'company_admin'));
-- purchases_update stays company_admin-only (unchanged from migration 002)

drop policy if exists "purchase_items_select" on purchase_items;
create policy "purchase_items_select" on purchase_items for select
  using (exists (
    select 1 from purchases p where p.id = purchase_items.purchase_id
    and (is_super_admin() or p.company_id = my_company_id())
  ));

drop policy if exists "purchase_items_insert" on purchase_items;
create policy "purchase_items_insert" on purchase_items for insert
  with check (exists (
    select 1 from purchases p where p.id = purchase_items.purchase_id
    and (is_super_admin() or (p.company_id = my_company_id() and my_role() in ('company_admin', 'manager')))
  ));

drop policy if exists "purchase_items_delete" on purchase_items;
create policy "purchase_items_delete" on purchase_items for delete
  using (exists (
    select 1 from purchases p where p.id = purchase_items.purchase_id
    and (is_super_admin() or (p.company_id = my_company_id() and my_role() = 'company_admin'))
  ));

drop policy if exists "purchase_payments_select" on purchase_payments;
create policy "purchase_payments_select" on purchase_payments for select
  using (is_super_admin() or company_id = my_company_id());

-- ---------------------------------------------------------------------
-- CREDIT/PAYMENT RECORDING — tightened to company_admin only. Previously
-- any company member could insert a payment; "view only" for sales_user
-- and manager needs to be enforced server-side, not just hidden in the UI.
-- ---------------------------------------------------------------------
drop policy if exists "payments_insert" on payments;
create policy "payments_insert" on payments for insert
  with check (is_super_admin() or (company_id = my_company_id() and my_role() = 'company_admin'));

drop policy if exists "purchase_payments_insert" on purchase_payments;
create policy "purchase_payments_insert" on purchase_payments for insert
  with check (is_super_admin() or (company_id = my_company_id() and my_role() = 'company_admin'));
