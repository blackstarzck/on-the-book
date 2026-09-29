-- On the Book: every managed point is a row, every file is a storage object with an assets row.
-- The server reaches this database with the service_role key only; RLS without policies keeps anon out.

create table public.library_state (
  id boolean primary key default true check (id),
  version bigint not null default 1,
  schema_version int not null default 1,
  updated_at timestamptz not null default now()
);
insert into public.library_state default values;

create table public.models (
  id text primary key,
  sort_order int not null,
  name text not null,
  kind text not null,
  rigged boolean not null,
  clips jsonb not null,
  url text,
  thumbnail text,
  credit text not null,
  color text not null
);

create table public.books (
  id text primary key,
  sort_order int not null,
  title text not null,
  english_title text not null,
  author text not null,
  category text not null,
  cover text not null,
  floor_assets jsonb,
  year int not null,
  description text not null,
  source text not null,
  rights text not null,
  published boolean not null
);

create table public.chapters (
  id text primary key,
  book_id text not null references public.books(id) on delete cascade deferrable initially deferred,
  sort_order int not null,
  main_placement_id text,
  title text not null,
  subtitle text not null,
  body text not null,
  theme text not null,
  thumbnail text not null,
  width double precision not null,
  depth double precision not null,
  floor_arrows boolean not null,
  floor_route jsonb,
  floor_arrow_spacing double precision not null,
  floor_arrow_scale double precision not null,
  floor_decals jsonb,
  floor_decor text not null,
  floor_enabled boolean not null,
  floor_text text not null,
  floor_offset_x double precision not null,
  floor_offset_z double precision not null,
  reaction_multiplier double precision not null,
  floor_page_size int not null,
  floor_stagger boolean not null,
  floor_zoom double precision not null
);

create table public.placements (
  id text primary key,
  chapter_id text not null references public.chapters(id) on delete cascade deferrable initially deferred,
  sort_order int not null,
  model_id text not null references public.models(id) deferrable initially deferred,
  x double precision not null,
  y double precision not null,
  z double precision not null,
  scale double precision not null,
  rotation double precision not null,
  radius double precision not null,
  collision boolean not null,
  collision_radius double precision not null,
  animation text not null,
  clip text not null,
  title text not null,
  story text not null
);

alter table public.chapters add constraint chapters_main_placement_fkey
  foreign key (main_placement_id) references public.placements(id) deferrable initially deferred;

create table public.hero_slides (
  id text primary key,
  sort_order int not null,
  book_id text not null references public.books(id) on delete cascade deferrable initially deferred,
  image text not null,
  focus text not null,
  kicker text not null,
  title text not null,
  description text not null
);

create index chapters_book_id_idx on public.chapters (book_id);
create index placements_chapter_id_idx on public.placements (chapter_id);
create index placements_model_id_idx on public.placements (model_id);
create index hero_slides_book_id_idx on public.hero_slides (book_id);
create index chapters_main_placement_id_idx on public.chapters (main_placement_id);

-- A published snapshot per "공개". Readers use the newest one.
create table public.publications (
  id bigint generated always as identity primary key,
  library jsonb not null,
  published_at timestamptz not null default now()
);

-- One row per stored file, whatever bucket it lives in.
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  bucket text not null check (bucket in ('uploads', 'archive')),
  path text not null,
  kind text not null,
  content_type text not null,
  bytes bigint not null check (bytes >= 0),
  sha256 text not null,
  width int,
  height int,
  rigged boolean,
  clips jsonb,
  owner text,
  note text,
  created_at timestamptz not null default now(),
  unique (bucket, path)
);

-- 3D material used outside books, such as the about page journey.
create table public.site_assets (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.sessions (
  token uuid primary key,
  expires_at timestamptz not null
);

-- An edit made outside the studio (for example in the Supabase table editor) bumps the version,
-- so a studio tab that loaded earlier gets a conflict instead of overwriting it.
create function public.bump_library_version() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('otb.saving', true), '') <> 'on' then
    update public.library_state set version = version + 1, updated_at = now() where id;
  end if;
  return null;
end $$;

create trigger models_bump after insert or update or delete on public.models for each statement execute function public.bump_library_version();
create trigger books_bump after insert or update or delete on public.books for each statement execute function public.bump_library_version();
create trigger chapters_bump after insert or update or delete on public.chapters for each statement execute function public.bump_library_version();
create trigger placements_bump after insert or update or delete on public.placements for each statement execute function public.bump_library_version();
create trigger hero_slides_bump after insert or update or delete on public.hero_slides for each statement execute function public.bump_library_version();

-- The draft as table rows in one consistent read.
create function public.load_draft() returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'version', s.version,
    'schemaVersion', s.schema_version,
    'models', coalesce((select jsonb_agg(to_jsonb(m) order by m.sort_order) from public.models m), '[]'::jsonb),
    'books', coalesce((select jsonb_agg(to_jsonb(b) order by b.sort_order) from public.books b), '[]'::jsonb),
    'chapters', coalesce((select jsonb_agg(to_jsonb(c) order by c.book_id, c.sort_order) from public.chapters c), '[]'::jsonb),
    'placements', coalesce((select jsonb_agg(to_jsonb(p) order by p.chapter_id, p.sort_order) from public.placements p), '[]'::jsonb),
    'hero_slides', coalesce((select jsonb_agg(to_jsonb(h) order by h.sort_order) from public.hero_slides h), '[]'::jsonb),
    'publishedAt', (select published_at from public.publications order by id desc limit 1)
  )
  from public.library_state s where s.id
$$;

-- Replaces the draft rows atomically. p_live, when given, is published in the same transaction.
create function public.save_draft(p_version bigint, p_schema int, p_rows jsonb, p_live jsonb default null) returns jsonb
language plpgsql set search_path = public as $$
declare
  current_state public.library_state;
  next_version bigint;
  published timestamptz;
begin
  select * into current_state from public.library_state where id for update;
  if current_state.version <> p_version then
    raise exception 'library version conflict' using errcode = 'PT409';
  end if;
  if p_schema < current_state.schema_version then
    raise exception 'studio is older than the stored library' using errcode = 'PT426';
  end if;
  perform set_config('otb.saving', 'on', true);
  delete from public.books where true;
  delete from public.models where true;
  insert into public.models select * from jsonb_populate_recordset(null::public.models, coalesce(p_rows->'models', '[]'::jsonb));
  insert into public.books select * from jsonb_populate_recordset(null::public.books, coalesce(p_rows->'books', '[]'::jsonb));
  insert into public.chapters select * from jsonb_populate_recordset(null::public.chapters, coalesce(p_rows->'chapters', '[]'::jsonb));
  insert into public.placements select * from jsonb_populate_recordset(null::public.placements, coalesce(p_rows->'placements', '[]'::jsonb));
  insert into public.hero_slides select * from jsonb_populate_recordset(null::public.hero_slides, coalesce(p_rows->'hero_slides', '[]'::jsonb));
  update public.library_state
    set version = version + 1, schema_version = greatest(schema_version, p_schema), updated_at = now()
    where id returning version into next_version;
  perform set_config('otb.saving', 'off', true);
  if p_live is not null then
    insert into public.publications (library) values (p_live) returning published_at into published;
    delete from public.publications where id not in (select id from public.publications order by id desc limit 30);
  end if;
  return jsonb_build_object('version', next_version, 'publishedAt', published);
end $$;

alter table public.library_state enable row level security;
alter table public.models enable row level security;
alter table public.books enable row level security;
alter table public.chapters enable row level security;
alter table public.placements enable row level security;
alter table public.hero_slides enable row level security;
alter table public.publications enable row level security;
alter table public.assets enable row level security;
alter table public.site_assets enable row level security;
alter table public.sessions enable row level security;

revoke all on public.library_state, public.models, public.books, public.chapters, public.placements,
  public.hero_slides, public.publications, public.assets, public.site_assets, public.sessions from anon, authenticated;
grant all on public.library_state, public.models, public.books, public.chapters, public.placements,
  public.hero_slides, public.publications, public.assets, public.site_assets, public.sessions to service_role;

revoke execute on function public.load_draft(), public.save_draft(bigint, int, jsonb, jsonb), public.bump_library_version() from public, anon, authenticated;
grant execute on function public.load_draft(), public.save_draft(bigint, int, jsonb, jsonb) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('uploads', 'uploads', false, 26214400, array['model/gltf-binary', 'image/png', 'image/webp']),
  ('archive', 'archive', false, 52428800, null);
