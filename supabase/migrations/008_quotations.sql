-- =====================================================================
-- Bill360 — migration 008: Quotations
-- A quotation is a draft/proposal with no stock or financial impact until
-- it's explicitly converted to a bill (one-click, going through the same
-- checkout payment step — including partial/credit — as a normal sale).
-- =====================================================================

alter table companies add column if not exists quotation_series text not null default 'QUO';
alter table companies add column if not exists quotation_seq integer not null default 0;

create table if not exists quotations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  created_by uuid not null references profiles (id),
  quotation_number text not null,
  customer_name text not null,
  customer_phone text not null,
  customer_gst text,
  customer_address text,
  subtotal numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  gst_total numeric(12,2) not null default 0,
  grand_total numeric(12,2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'sent', 'converted', 'expired')),
  converted_bill_id uuid references bills (id),
  valid_until date,
  notes text,
  created_at timestamptz not null default now(),
  unique (company_id, quotation_number)
);
create index if not exists idx_quotations_company on quotations (company_id);

create table if not exists quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references quotations (id) on delete cascade,
  product_id uuid references products (id) on delete set null,
  name text not null,
  qty numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  discount_pct numeric(5,2) not null default 0,
  gst_rate numeric(5,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  is_custom boolean not null default false,
  uom text not null default 'pcs'
);
create index if not exists idx_quotation_items_quotation on quotation_items (quotation_id);

create or replace function next_quotation_number(p_company_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_series text;
  v_seq integer;
begin
  update companies
    set quotation_seq = quotation_seq + 1
    where id = p_company_id
    returning quotation_series, quotation_seq into v_series, v_seq;

  if v_series is null then
    raise exception 'Company % not found', p_company_id;
  end if;

  return v_series || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

alter table quotations enable row level security;
alter table quotation_items enable row level security;

-- Same visibility pattern as bills: company_admin/manager see all company
-- quotations, sales_user sees only ones they created.
create policy "quotations_select" on quotations for select
  using (
    is_super_admin()
    or (company_id = my_company_id() and my_role() in ('company_admin', 'manager'))
    or (company_id = my_company_id() and my_role() = 'sales_user' and created_by = auth.uid())
  );
create policy "quotations_insert" on quotations for insert
  with check (is_super_admin() or (company_id = my_company_id() and created_by = auth.uid()));
create policy "quotations_update" on quotations for update
  using (
    is_super_admin()
    or (company_id = my_company_id() and my_role() in ('company_admin', 'manager'))
    or (company_id = my_company_id() and created_by = auth.uid())
  );
create policy "quotations_delete" on quotations for delete
  using (is_super_admin() or (company_id = my_company_id() and my_role() = 'company_admin'));

create policy "quotation_items_select" on quotation_items for select
  using (exists (
    select 1 from quotations q where q.id = quotation_items.quotation_id
    and (
      is_super_admin()
      or (q.company_id = my_company_id() and my_role() in ('company_admin', 'manager'))
      or (q.company_id = my_company_id() and q.created_by = auth.uid())
    )
  ));
create policy "quotation_items_insert" on quotation_items for insert
  with check (exists (
    select 1 from quotations q where q.id = quotation_items.quotation_id
    and q.company_id = my_company_id() and (is_super_admin() or q.created_by = auth.uid() or my_role() in ('company_admin','manager'))
  ));
create policy "quotation_items_delete" on quotation_items for delete
  using (exists (
    select 1 from quotations q where q.id = quotation_items.quotation_id
    and (
      is_super_admin()
      or (q.company_id = my_company_id() and my_role() in ('company_admin', 'manager'))
      or (q.company_id = my_company_id() and q.created_by = auth.uid())
    )
  ));
