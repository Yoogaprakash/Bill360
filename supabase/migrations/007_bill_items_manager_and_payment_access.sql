-- =====================================================================
-- Bill360 — migration 007:
--  * fix: bill_items_select was never updated to include 'manager' when
--    bills_select was broadened (migration 004b) — managers could see a
--    bill row but not its line items, which is the "product details not
--    loading" bug on All Bills / Edit Bill / PDF reprint for managers.
--  * sales_user and manager can now record credit-recovery payments
--    (receiving from a customer, paying a supplier), each with an
--    explicit payment date — previously company_admin only.
-- =====================================================================

drop policy if exists "bill_items_select" on bill_items;
create policy "bill_items_select" on bill_items for select
  using (exists (
    select 1 from bills b where b.id = bill_items.bill_id
    and (
      is_super_admin()
      or (b.company_id = my_company_id() and my_role() in ('company_admin', 'manager'))
      or (b.company_id = my_company_id() and b.created_by = auth.uid())
    )
  ));

-- SALES credit recovery (payments against a customer's bill): company_admin
-- and manager can record against any company bill; sales_user only against
-- bills they personally created (mirrors bills_select's own scoping).
drop policy if exists "payments_insert" on payments;
create policy "payments_insert" on payments for insert
  with check (
    is_super_admin()
    or (company_id = my_company_id() and my_role() in ('company_admin', 'manager'))
    or (
      company_id = my_company_id() and my_role() = 'sales_user'
      and exists (select 1 from bills b where b.id = payments.bill_id and b.created_by = auth.uid())
    )
  );

-- PURCHASE credit recovery (paying a supplier): purchases are already
-- visible company-wide to every role, so any company member may record
-- a payment against one.
drop policy if exists "purchase_payments_insert" on purchase_payments;
create policy "purchase_payments_insert" on purchase_payments for insert
  with check (is_super_admin() or company_id = my_company_id());
