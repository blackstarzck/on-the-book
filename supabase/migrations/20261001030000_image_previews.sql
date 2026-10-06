-- Derived file information stays outside book rows and publication snapshots.
alter table public.assets add column if not exists image_preview jsonb;
comment on column public.assets.image_preview is 'Versioned dominant colour, inline WebP LQIP and image dimensions';
