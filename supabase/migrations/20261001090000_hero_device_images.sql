-- Service links and independent PC/mobile banner images. Keep legacy columns so old
-- publications remain readable. SCHEMA_VERSION 4 prevents older studios dropping these fields.
alter table public.hero_slides
  alter column book_id drop not null,
  add column if not exists url text,
  add column if not exists image_mobile text;
