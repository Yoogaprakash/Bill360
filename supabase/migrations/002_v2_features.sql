-- =====================================================================
-- Bill360 — migration 002: brand/HSN/weight-based selling, batches,
-- purchases + purchase credit, sales credit/partial payments.
-- Safe to run once against a database that already has schema.sql applied.
-- =====================================================================

-- ---------------------------------------------------------------------
-- PRODUCTS: brand, HSN code, unit of measure (piece vs weight)
-- ---------------------------------------------------------------------
alter table products add column if not exists brand text;
alter table products add column if not exists hsn_code text;
alter table products add column if not exists unit_type text not null default 'unit' check (unit_type in ('unit', 'weight'));
alter table products add column if not exists weight_unit text check (weight_unit in ('kg', 'g'));

-- ---------------------------------------------------------------------
-- BILL_ITEMS: unit-of-measure label so a receipt can show "0.500 kg" vs "2 pcs"
-- ---------------------------------------------------------------------
alter table bill_items add column if not exists uom text not null default 'pcs';

-- ---------------------------------------------------------------------
-- PRODUCT_BATCHES: batch/expiry tracking -> low-stock-style warnings on cards
-- ---------------------------------------------------------------------
create table if not exists product_batches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  batch_no text not null,
  qty numeric(12,2) not null default 0,
  expiry_date date,
  created_at timestamptz not null default now()
);
create index if not exists idx_product_batches_product on product_batches (product_id);

alter table product_batches enable row level security;

drop policy if exists "product_batches_select" on product_batches;
create policy "product_batches_select" on product_batches for select
  using (is_super_admin() or company_id = my_company_id());
drop policy if exists "product_batches_insert" on product_batches;
create policy "product_batches_insert" on product_batches for insert
  with check (is_super_admin() or (company_id = my_company_id() and my_role() = 'company_admin'));
drop policy if exists "product_batches_update" on product_batches;
create policy "product_batches_update" on product_batches for update
  using (is_super_admin() or (company_id = my_company_id() and my_role() = 'company_admin'));
drop policy if exists "product_batches_delete" on product_batches;
create policy "product_batches_delete" on product_batches for delete
  using (is_super_admin() or (company_id = my_company_id() and my_role() = 'company_admin'));

-- ---------------------------------------------------------------------
-- SUPPLIERS
-- ---------------------------------------------------------------------
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  phone text,
  address text,
  created_at timestamptz not null default now()
);

alter table suppliers enable row level security;

drop policy if exists "suppliers_select" on suppliers;
create policy "suppliers_select" on suppliers for select
  using (is_super_admin() or company_id = my_company_id());
drop policy if exists "suppliers_insert" on suppliers;
create policy "suppliers_insert" on suppliers for insert
  with check (is_super_admin() or (company_id = my_company_id() and my_role() = 'company_admin'));
drop policy if exists "suppliers_update" on suppliers;
create policy "suppliers_update" on suppliers for update
  using (is_super_admin() or (company_id = my_company_id() and my_role() = 'company_admin'));

-- ---------------------------------------------------------------------
-- PURCHASES (goods-in / purchase bills) + PURCHASE_ITEMS — accounts payable
-- ---------------------------------------------------------------------
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  supplier_id uuid references suppliers (id),
  supplier_name text not null,
  supplier_phone text,
  reference_no text,                 -- the supplier's own invoice/bill number
  purchase_date date not null default current_date,
  subtotal numeric(12,2) not null default 0,
  gst_total numeric(12,2) not null default 0,
  grand_total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  payment_status payment_status not null default 'pending',
  source text not null default 'manual' check (source in ('manual', 'scanned')),
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists idx_purchases_company on purchases (company_id);

create table if not exists purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases (id) on delete cascade,
  product_id uuid references products (id) on delete set null,
  name text not null,
  hsn_code text,
  qty numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  gst_rate numeric(5,2) not null default 0,
  line_total numeric(12,2) not null default 0
);
create index if not exists idx_purchase_items_purchase on purchase_items (purchase_id);

-- Recovery payments against a supplier's outstanding purchase credit
create table if not exists purchase_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  purchase_id uuid not null references purchases (id) on delete cascade,
  amount numeric(12,2) not null,
  paid_at timestamptz not null default now(),
  method text default 'Cash',
  note text,
  created_by uuid references profiles (id)
);

alter table purchases enable row level security;
alter table purchase_items enable row level security;
alter table purchase_payments enable row level security;

drop policy if exists "purchases_select" on purchases;
create policy "purchases_select" on purchases for select
  using (is_super_admin() or (company_id = my_company_id() and my_role() = 'company_admin'));
drop policy if exists "purchases_insert" on purchases;
create policy "purchases_insert" on purchases for insert
  with check (is_super_admin() or (company_id = my_company_id() and my_role() = 'company_admin'));
drop policy if exists "purchases_update" on purchases;
create policy "purchases_update" on purchases for update
  using (is_super_admin() or (company_id = my_company_id() and my_role() = 'company_admin'));

drop policy if exists "purchase_items_select" on purchase_items;
create policy "purchase_items_select" on purchase_items for select
  using (exists (select 1 from purchases p where p.id = purchase_items.purchase_id
    and (is_super_admin() or (p.company_id = my_company_id() and my_role() = 'company_admin'))));
drop policy if exists "purchase_items_insert" on purchase_items;
create policy "purchase_items_insert" on purchase_items for insert
  with check (exists (select 1 from purchases p where p.id = purchase_items.purchase_id
    and (is_super_admin() or (p.company_id = my_company_id() and my_role() = 'company_admin'))));

drop policy if exists "purchase_payments_select" on purchase_payments;
create policy "purchase_payments_select" on purchase_payments for select
  using (is_super_admin() or (company_id = my_company_id() and my_role() = 'company_admin'));
drop policy if exists "purchase_payments_insert" on purchase_payments;
create policy "purchase_payments_insert" on purchase_payments for insert
  with check (is_super_admin() or (company_id = my_company_id() and my_role() = 'company_admin'));

-- ---------------------------------------------------------------------
-- PAYMENTS: recovery payments against a customer's outstanding sales credit
-- (bills.amount_received is the amount collected AT BILLING TIME; a credit
-- sale is paid off over time via rows here — total paid = bills.amount_received
-- + sum(payments.amount for that bill)).
-- ---------------------------------------------------------------------
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  bill_id uuid not null references bills (id) on delete cascade,
  amount numeric(12,2) not null,
  paid_at timestamptz not null default now(),
  method text default 'Cash',
  note text,
  created_by uuid references profiles (id)
);
create index if not exists idx_payments_bill on payments (bill_id);

alter table payments enable row level security;

drop policy if exists "payments_select" on payments;
create policy "payments_select" on payments for select
  using (
    is_super_admin()
    or (company_id = my_company_id() and my_role() = 'company_admin')
    or (company_id = my_company_id() and exists (select 1 from bills b where b.id = payments.bill_id and b.created_by = auth.uid()))
  );
drop policy if exists "payments_insert" on payments;
create policy "payments_insert" on payments for insert
  with check (is_super_admin() or company_id = my_company_id());

-- ---------------------------------------------------------------------
-- Recompute a bill's payment_status whenever a recovery payment is recorded
-- ---------------------------------------------------------------------
create or replace function recompute_bill_payment_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_bill bills%rowtype;
  v_total_paid numeric;
begin
  select * into v_bill from bills where id = new.bill_id;
  select coalesce(v_bill.amount_received, 0) + coalesce(sum(amount), 0) into v_total_paid
    from payments where bill_id = new.bill_id;

  update bills set payment_status = case
    when v_total_paid >= v_bill.grand_total then 'paid'
    when v_total_paid > 0 then 'partial'
    else 'pending'
  end
  where id = new.bill_id;

  return new;
end;
$$;

drop trigger if exists trg_recompute_bill_payment_status on payments;
create trigger trg_recompute_bill_payment_status
  after insert on payments
  for each row execute function recompute_bill_payment_status();

-- Same idea for supplier-side purchase credit
create or replace function recompute_purchase_payment_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_purchase purchases%rowtype;
  v_total_paid numeric;
begin
  select * into v_purchase from purchases where id = new.purchase_id;
  select coalesce(v_purchase.amount_paid, 0) + coalesce(sum(amount), 0) into v_total_paid
    from purchase_payments where purchase_id = new.purchase_id;

  update purchases set payment_status = case
    when v_total_paid >= v_purchase.grand_total then 'paid'
    when v_total_paid > 0 then 'partial'
    else 'pending'
  end
  where id = new.purchase_id;

  return new;
end;
$$;

drop trigger if exists trg_recompute_purchase_payment_status on purchase_payments;
create trigger trg_recompute_purchase_payment_status
  after insert on purchase_payments
  for each row execute function recompute_purchase_payment_status();

-- ---------------------------------------------------------------------
-- STORAGE: company logos (separate from product-images, still public-read)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('company-logos', 'company-logos', true)
  on conflict (id) do nothing;

drop policy if exists "company_logos_public_read" on storage.objects;
create policy "company_logos_public_read" on storage.objects for select
  using (bucket_id = 'company-logos');
drop policy if exists "company_logos_authenticated_write" on storage.objects;
create policy "company_logos_authenticated_write" on storage.objects for insert
  with check (bucket_id = 'company-logos' and auth.role() = 'authenticated');
