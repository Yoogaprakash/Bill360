-- Must run as its own statement/transaction — a newly added enum value
-- can't be referenced by policies created in the same transaction that
-- added it (and the simple-query protocol batches a multi-statement file
-- into one implicit transaction), so this is a separate file from 004b.
alter type user_role add value if not exists 'manager';
