-- =====================================================================
-- Bill360 — migration 013: subscription plans with configurable limits,
-- per-company manual overrides, usage tracking for print/report actions,
-- and enforcement triggers for row-count-based limits.
--
-- Limit semantics: NULL on a plan or override = unlimited. A company's
-- *effective* limit = coalesce(company override, plan value). Row-count
-- limits (products/users) are checked against the live count; monthly
-- limits (sales bills, purchase bills, report/bill prints) reset every
-- calendar month by counting rows created since the 1st of the month.
-- =====================================================================

create table if not exists subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price numeric(10,2) not null default 0,
  report_print_limit integer,   -- per calendar month
  bill_print_limit integer,     -- per calendar month
  user_limit integer,           -- total active team members
  product_limit integer,        -- total active products
  sales_bill_limit integer,     -- per calendar month
  purchase_bill_limit integer,  -- per calendar month
  created_at timestamptz not null default now()
);

insert into subscription_plans (name, price, report_print_limit, bill_print_limit, user_limit, product_limit, sales_bill_limit, purchase_bill_limit)
values
  ('Free', 0, 10, 30, 3, 50, 100, 50),
  ('Pro', 999, 100, 500, 15, 1000, 2000, 1000),
  ('Enterprise', 4999, null, null, null, null, null, null)
on conflict (name) do nothing;

alter table companies add column if not exists plan_id uuid references subscription_plans (id);
alter table companies add column if not exists report_print_limit_override integer;
alter table companies add column if not exists bill_print_limit_override integer;
alter table companies add column if not exists user_limit_override integer;
alter table companies add column if not exists product_limit_override integer;
alter table companies add column if not exists sales_bill_limit_override integer;
alter table companies add column if not exists purchase_bill_limit_override integer;

-- Deliberately NOT backfilling existing companies onto the Free plan here —
-- a NULL plan_id means unlimited (coalesce(override, plan.limit) => null),
-- so existing companies keep working exactly as before until a super admin
-- explicitly assigns them a plan from the new UI.

-- ---------------------------------------------------------------------
-- USAGE LOGS — one row per bill-PDF print or report export, used to meter
-- report_print_limit / bill_print_limit (there's no other table row created
-- when a PDF/export is merely downloaded, unlike bills/products/purchases).
-- ---------------------------------------------------------------------
create table if not exists usage_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  usage_type text not null check (usage_type in ('report_print', 'bill_print')),
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists idx_usage_logs_company_type_date on usage_logs (company_id, usage_type, created_at);

alter table subscription_plans enable row level security;
alter table usage_logs enable row level security;

drop policy if exists "subscription_plans_select" on subscription_plans;
create policy "subscription_plans_select" on subscription_plans for select
  using (auth.role() in ('authenticated', 'service_role'));
drop policy if exists "subscription_plans_write" on subscription_plans;
create policy "subscription_plans_write" on subscription_plans for insert with check (is_super_admin());
drop policy if exists "subscription_plans_update" on subscription_plans;
create policy "subscription_plans_update" on subscription_plans for update using (is_super_admin());
drop policy if exists "subscription_plans_delete" on subscription_plans;
create policy "subscription_plans_delete" on subscription_plans for delete using (is_super_admin());

drop policy if exists "usage_logs_select" on usage_logs;
create policy "usage_logs_select" on usage_logs for select
  using (is_super_admin() or company_id = my_company_id());
-- Inserts to usage_logs only ever happen via log_and_check_usage() below
-- (security definer), so no direct insert policy is needed for regular users.
drop policy if exists "usage_logs_insert_service" on usage_logs;
create policy "usage_logs_insert_service" on usage_logs for insert
  with check (auth.role() = 'service_role');

-- ---------------------------------------------------------------------
-- Only super_admin (or the service_role edge function) may change a
-- company's plan or limit overrides — otherwise a company_admin could
-- edit their own row to remove their limits entirely.
-- ---------------------------------------------------------------------
create or replace function protect_company_subscription_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' or is_super_admin() then
    return new;
  end if;

  if new.plan_id is distinct from old.plan_id
     or new.report_print_limit_override is distinct from old.report_print_limit_override
     or new.bill_print_limit_override is distinct from old.bill_print_limit_override
     or new.user_limit_override is distinct from old.user_limit_override
     or new.product_limit_override is distinct from old.product_limit_override
     or new.sales_bill_limit_override is distinct from old.sales_bill_limit_override
     or new.purchase_bill_limit_override is distinct from old.purchase_bill_limit_override
  then
    raise exception 'Only a super admin can change subscription plan or limits';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_company_subscription_fields on companies;
create trigger trg_protect_company_subscription_fields
  before update on companies
  for each row execute function protect_company_subscription_fields();

-- ---------------------------------------------------------------------
-- ROW-COUNT ENFORCEMENT: products (active count), bills & purchases
-- (created this calendar month). Fires regardless of caller (RLS bypass
-- via service_role does NOT bypass triggers), so this holds even through
-- the admin-create-user edge function or a direct API call.
-- ---------------------------------------------------------------------
create or replace function enforce_product_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_limit integer;
  v_count integer;
begin
  select coalesce(c.product_limit_override, p.product_limit) into v_limit
  from companies c left join subscription_plans p on p.id = c.plan_id
  where c.id = new.company_id;

  if v_limit is not null then
    select count(*) into v_count from products where company_id = new.company_id and is_active = true;
    if v_count >= v_limit then
      raise exception 'Product limit reached (% of % used). Ask a super admin to raise your plan or limit.', v_count, v_limit;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_product_limit on products;
create trigger trg_enforce_product_limit
  before insert on products
  for each row execute function enforce_product_limit();

create or replace function enforce_sales_bill_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_limit integer;
  v_count integer;
begin
  select coalesce(c.sales_bill_limit_override, p.sales_bill_limit) into v_limit
  from companies c left join subscription_plans p on p.id = c.plan_id
  where c.id = new.company_id;

  if v_limit is not null then
    select count(*) into v_count from bills
      where company_id = new.company_id and created_at >= date_trunc('month', now());
    if v_count >= v_limit then
      raise exception 'Monthly sales bill limit reached (% of % used). Ask a super admin to raise your plan or limit.', v_count, v_limit;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_sales_bill_limit on bills;
create trigger trg_enforce_sales_bill_limit
  before insert on bills
  for each row execute function enforce_sales_bill_limit();

create or replace function enforce_purchase_bill_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_limit integer;
  v_count integer;
begin
  select coalesce(c.purchase_bill_limit_override, p.purchase_bill_limit) into v_limit
  from companies c left join subscription_plans p on p.id = c.plan_id
  where c.id = new.company_id;

  if v_limit is not null then
    select count(*) into v_count from purchases
      where company_id = new.company_id and created_at >= date_trunc('month', now());
    if v_count >= v_limit then
      raise exception 'Monthly purchase bill limit reached (% of % used). Ask a super admin to raise your plan or limit.', v_count, v_limit;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_purchase_bill_limit on purchases;
create trigger trg_enforce_purchase_bill_limit
  before insert on purchases
  for each row execute function enforce_purchase_bill_limit();

-- ---------------------------------------------------------------------
-- log_and_check_usage: called by the client right before generating a
-- bill-PDF or a report export. Atomically checks the monthly count against
-- the effective limit and logs the event in one call — if it raises, the
-- client skips the PDF/export generation.
-- ---------------------------------------------------------------------
create or replace function log_and_check_usage(p_company_id uuid, p_usage_type text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_limit integer;
  v_count integer;
  v_month_start timestamptz := date_trunc('month', now());
begin
  if p_usage_type = 'report_print' then
    select coalesce(c.report_print_limit_override, p.report_print_limit) into v_limit
      from companies c left join subscription_plans p on p.id = c.plan_id where c.id = p_company_id;
  elsif p_usage_type = 'bill_print' then
    select coalesce(c.bill_print_limit_override, p.bill_print_limit) into v_limit
      from companies c left join subscription_plans p on p.id = c.plan_id where c.id = p_company_id;
  else
    raise exception 'Unknown usage type: %', p_usage_type;
  end if;

  if v_limit is not null then
    select count(*) into v_count from usage_logs
      where company_id = p_company_id and usage_type = p_usage_type and created_at >= v_month_start;
    if v_count >= v_limit then
      raise exception 'Monthly % limit reached (% of % used). Ask a super admin to raise your plan or limit.',
        replace(p_usage_type, '_', ' '), v_count, v_limit;
    end if;
  end if;

  insert into usage_logs (company_id, usage_type, created_by) values (p_company_id, p_usage_type, auth.uid());
end;
$$;
