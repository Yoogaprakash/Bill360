-- =====================================================================
-- Bill360 — migration 009:
--  * fix: recompute_bill_payment_status / recompute_purchase_payment_status
--    assigned a bare CASE expression (typed as `text`) to a `payment_status`
--    enum column. Postgres only auto-casts `unknown`-typed string literals
--    to an enum, not `text` — this PL/pgSQL context resolves the CASE to
--    `text`, so every "Record payment" (sales or purchase) has been failing
--    with "column payment_status is of type payment_status but expression
--    is of type text" since migration 002. Fixed with an explicit cast.
--  * add discount_pct to purchase_items, matching bill_items.
-- =====================================================================

create or replace function recompute_bill_payment_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_bill bills%rowtype;
  v_total_paid numeric;
begin
  select * into v_bill from bills where id = new.bill_id;
  select coalesce(v_bill.amount_received, 0) + coalesce(sum(amount), 0) into v_total_paid
    from payments where bill_id = new.bill_id;

  update bills set payment_status = (case
    when v_total_paid >= v_bill.grand_total then 'paid'
    when v_total_paid > 0 then 'partial'
    else 'pending'
  end)::payment_status
  where id = new.bill_id;

  return new;
end;
$$;

create or replace function recompute_purchase_payment_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_purchase purchases%rowtype;
  v_total_paid numeric;
begin
  select * into v_purchase from purchases where id = new.purchase_id;
  select coalesce(v_purchase.amount_paid, 0) + coalesce(sum(amount), 0) into v_total_paid
    from purchase_payments where purchase_id = new.purchase_id;

  update purchases set payment_status = (case
    when v_total_paid >= v_purchase.grand_total then 'paid'
    when v_total_paid > 0 then 'partial'
    else 'pending'
  end)::payment_status
  where id = new.purchase_id;

  return new;
end;
$$;

alter table purchase_items add column if not exists discount_pct numeric(5,2) not null default 0;
