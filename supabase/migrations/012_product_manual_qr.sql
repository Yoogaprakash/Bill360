-- Optional manually-set QR/barcode value for a product — overrides SKU/id
-- as the value encoded on printed labels and matched when scanning, useful
-- when a business already has printed barcodes with their own coding scheme.
alter table products add column if not exists qr_code text;
