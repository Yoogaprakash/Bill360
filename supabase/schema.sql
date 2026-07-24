-- =====================================================================
-- Bill360 — Supabase schema (Postgres)
-- Multi-tenant billing/POS: super_admin | company_admin | sales_user
-- Run this once in the Supabase SQL editor on a fresh project.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
create type user_role as enum ('super_admin', 'company_admin', 'sales_user');
create type subscription_status as enum ('trialing', 'active', 'past_due', 'cancelled');
create type payment_status as enum ('paid', 'pending', 'partial');

-- ---------------------------------------------------------------------
-- COMPANIES  (the tenant)
-- ---------------------------------------------------------------------
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  address text,
  phone text,
  email text,
  gst_number text,
  gst_enabled boolean not null default true,
  default_gst_rate numeric(5,2) not null default 18.00,
  bill_series text not null default 'INV',      -- e.g. "INV" -> INV-0001
  bill_seq integer not null default 0,           -- last used invoice sequence
  upi_id text,                                    -- e.g. "shop@okhdfcbank" for QR
  footer_note text default 'Thank you for your business!',
  logo_url text,
  low_stock_threshold integer not null default 5, -- default alert threshold
  subscription_plan text not null default 'free',
  subscription_status subscription_status not null default 'trialing',
  subscription_expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PROFILES  (1:1 with auth.users, adds role + tenant + display info)
-- ---------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  company_id uuid references companies (id) on delete cascade, -- null for super_admin
  role user_role not null default 'sales_user',
  full_name text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- CATEGORIES
-- ---------------------------------------------------------------------
create table categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

-- ---------------------------------------------------------------------
-- PRODUCTS
-- ---------------------------------------------------------------------
create table products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  category_id uuid references categories (id) on delete set null,
  name text not null,
  sku text,
  image_url text,
  unit_price numeric(12,2) not null default 0,
  gst_rate numeric(5,2) not null default 0,       -- overrides company default if set
  stock_qty numeric(12,2) not null default 0,
  low_stock_threshold integer,                     -- overrides company default if set
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, sku)
);

create index idx_products_company on products (company_id);
create index idx_products_category on products (category_id);

-- ---------------------------------------------------------------------
-- CUSTOMERS  (lightweight repeat-customer directory; bills also snapshot)
-- ---------------------------------------------------------------------
create table customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  phone text not null,
  gst_number text,
  address text,
  created_at timestamptz not null default now(),
  unique (company_id, phone)
);

-- ---------------------------------------------------------------------
-- BILLS  (invoice header) — customer fields are snapshotted at bill time
-- ---------------------------------------------------------------------
create table bills (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  created_by uuid not null references profiles (id),
  customer_id uuid references customers (id),
  bill_number text not null,                        -- e.g. INV-0001
  customer_name text not null,
  customer_phone text not null,
  customer_gst text,
  customer_address text,
  subtotal numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  gst_total numeric(12,2) not null default 0,
  grand_total numeric(12,2) not null default 0,
  amount_received numeric(12,2) not null default 0,
  payment_status payment_status not null default 'pending',
  payment_method text default 'UPI',
  notes text,
  created_at timestamptz not null default now(),
  unique (company_id, bill_number)
);

create index idx_bills_company on bills (company_id);
create index idx_bills_created_by on bills (created_by);
create index idx_bills_created_at on bills (created_at);

-- ---------------------------------------------------------------------
-- BILL ITEMS  (line items; product_id null => custom/ad-hoc item)
-- ---------------------------------------------------------------------
create table bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references bills (id) on delete cascade,
  product_id uuid references products (id) on delete set null,
  name text not null,
  qty numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  discount_pct numeric(5,2) not null default 0,
  gst_rate numeric(5,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  is_custom boolean not null default false
);

create index idx_bill_items_bill on bill_items (bill_id);

-- ---------------------------------------------------------------------
-- STOCK MOVEMENTS  (audit trail for stock changes)
-- ---------------------------------------------------------------------
create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  change_qty numeric(12,2) not null,      -- negative for sales, positive for restock
  reason text not null,                   -- 'sale' | 'restock' | 'adjustment' | 'import'
  ref_bill_id uuid references bills (id),
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index idx_stock_movements_product on stock_movements (product_id);

-- =====================================================================
-- HELPER FUNCTIONS (used by RLS policies)
-- =====================================================================
create or replace function my_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function my_company_id() returns uuid
language sql stable security definer set search_path = public as $$
  select company_id from profiles where id = auth.uid();
$$;

create or replace function is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'super_admin' from profiles where id = auth.uid()), false);
$$;

-- Atomically issue the next bill number for a company, e.g. "INV-0007"
create or replace function next_bill_number(p_company_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_series text;
  v_seq integer;
begin
  update companies
    set bill_seq = bill_seq + 1
    where id = p_company_id
    returning bill_series, bill_seq into v_series, v_seq;

  if v_series is null then
    raise exception 'Company % not found', p_company_id;
  end if;

  return v_series || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- Decrement stock + log a movement in one call (used when a bill is finalized)
create or replace function apply_stock_sale(p_product_id uuid, p_qty numeric, p_bill_id uuid, p_company_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update products set stock_qty = stock_qty - p_qty, updated_at = now() where id = p_product_id;
  insert into stock_movements (company_id, product_id, change_qty, reason, ref_bill_id, created_by)
    values (p_company_id, p_product_id, -p_qty, 'sale', p_bill_id, p_user_id);
end;
$$;

-- Auto-create a profile row whenever a new auth user signs up.
-- Role/company are set to sensible defaults and should be finalized by an admin.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data ->> 'full_name', 'sales_user');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table companies enable row level security;
alter table profiles enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table customers enable row level security;
alter table bills enable row level security;
alter table bill_items enable row level security;
alter table stock_movements enable row level security;

-- COMPANIES: super admins manage all; company members can read their own company
create policy "companies_select" on companies for select
  using (is_super_admin() or id = my_company_id());
create policy "companies_insert" on companies for insert
  with check (is_super_admin());
create policy "companies_update" on companies for update
  using (is_super_admin() or (id = my_company_id() and my_role() = 'company_admin'));
create policy "companies_delete" on companies for delete
  using (is_super_admin());

-- PROFILES: super admins see all; users see profiles within their own company; a user always sees themself
create policy "profiles_select" on profiles for select
  using (is_super_admin() or id = auth.uid() or company_id = my_company_id());
create policy "profiles_insert" on profiles for insert
  with check (is_super_admin() or (company_id = my_company_id() and my_role() = 'company_admin'));
create policy "profiles_update" on profiles for update
  using (is_super_admin() or id = auth.uid() or (company_id = my_company_id() and my_role() = 'company_admin'));
create policy "profiles_delete" on profiles for delete
  using (is_super_admin() or (company_id = my_company_id() and my_role() = 'company_admin'));

-- The USING clause above lets a user target their own row (id = auth.uid()),
-- which is needed for self-service edits to full_name/phone. RLS alone can't
-- restrict *which columns* change on that row, so a trigger locks down the
-- privileged columns (role, company_id, is_active) to admins only — without
-- it, any authenticated user could self-promote via
-- `update profiles set role = 'super_admin' where id = auth.uid()`.
create or replace function protect_profile_privileges() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Server-side privileged operations (e.g. the admin-create-user edge
  -- function, running with the service_role key) bypass this check.
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

  if new.role is distinct from old.role
     or new.company_id is distinct from old.company_id
     or new.is_active is distinct from old.is_active then
    raise exception 'Not authorized to change role, company_id, or is_active';
  end if;

  return new;
end;
$$;

create trigger trg_protect_profile_privileges
  before update on profiles
  for each row execute function protect_profile_privileges();

-- Generic tenant-scoped policy shape, applied to each tenant table below:
--   SELECT/INSERT/UPDATE/DELETE allowed to super_admin, or to any user whose
--   profile.company_id matches the row's company_id (role-specific write
--   restrictions are enforced in the application layer + narrower policies
--   where noted, e.g. sales_user can INSERT bills but not manage products).

-- CATEGORIES: admins manage, all company members read
create policy "categories_select" on categories for select
  using (is_super_admin() or company_id = my_company_id());
create policy "categories_write" on categories for insert
  with check (is_super_admin() or (company_id = my_company_id() and my_role() = 'company_admin'));
create policy "categories_update" on categories for update
  using (is_super_admin() or (company_id = my_company_id() and my_role() = 'company_admin'));
create policy "categories_delete" on categories for delete
  using (is_super_admin() or (company_id = my_company_id() and my_role() = 'company_admin'));

-- PRODUCTS: admins manage, all company members (incl. sales_user) read for POS
create policy "products_select" on products for select
  using (is_super_admin() or company_id = my_company_id());
create policy "products_insert" on products for insert
  with check (is_super_admin() or (company_id = my_company_id() and my_role() = 'company_admin'));
create policy "products_update" on products for update
  using (is_super_admin() or (company_id = my_company_id() and my_role() in ('company_admin', 'sales_user')));
create policy "products_delete" on products for delete
  using (is_super_admin() or (company_id = my_company_id() and my_role() = 'company_admin'));

-- CUSTOMERS: any company member can read/create (needed at checkout)
create policy "customers_select" on customers for select
  using (is_super_admin() or company_id = my_company_id());
create policy "customers_insert" on customers for insert
  with check (is_super_admin() or company_id = my_company_id());
create policy "customers_update" on customers for update
  using (is_super_admin() or company_id = my_company_id());

-- BILLS: company_admin sees all company bills; sales_user sees only their own
create policy "bills_select" on bills for select
  using (
    is_super_admin()
    or (company_id = my_company_id() and my_role() = 'company_admin')
    or (company_id = my_company_id() and my_role() = 'sales_user' and created_by = auth.uid())
  );
create policy "bills_insert" on bills for insert
  with check (is_super_admin() or (company_id = my_company_id() and created_by = auth.uid()));
create policy "bills_update" on bills for update
  using (
    is_super_admin()
    or (company_id = my_company_id() and my_role() = 'company_admin')
    or (company_id = my_company_id() and created_by = auth.uid())
  );

-- BILL_ITEMS: inherit visibility through parent bill
create policy "bill_items_select" on bill_items for select
  using (exists (
    select 1 from bills b where b.id = bill_items.bill_id
    and (
      is_super_admin()
      or (b.company_id = my_company_id() and my_role() = 'company_admin')
      or (b.company_id = my_company_id() and b.created_by = auth.uid())
    )
  ));
create policy "bill_items_insert" on bill_items for insert
  with check (exists (
    select 1 from bills b where b.id = bill_items.bill_id
    and b.company_id = my_company_id() and b.created_by = auth.uid()
  ));

-- STOCK_MOVEMENTS: admins read/write, sales_user can insert (via apply_stock_sale RPC)
create policy "stock_movements_select" on stock_movements for select
  using (is_super_admin() or company_id = my_company_id());
create policy "stock_movements_insert" on stock_movements for insert
  with check (is_super_admin() or company_id = my_company_id());

-- =====================================================================
-- STORAGE (product images) — run once; bucket is public-read for simple <img> use
-- =====================================================================
insert into storage.buckets (id, name, public)
  values ('product-images', 'product-images', true)
  on conflict (id) do nothing;

create policy "product_images_public_read" on storage.objects for select
  using (bucket_id = 'product-images');
create policy "product_images_authenticated_write" on storage.objects for insert
  with check (bucket_id = 'product-images' and auth.role() = 'authenticated');
