-- Mirrors bills.payment_method — needed so the initial "amount paid now" on
-- a purchase has a recorded method, same as the credit/debit ledger expects
-- for every other payment event.
alter table purchases add column if not exists payment_method text not null default 'Cash';
