alter table purchases add column if not exists discount_total numeric(12,2) not null default 0;
