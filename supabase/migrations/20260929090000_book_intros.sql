-- 저자 소개·책 소개 for the book detail page (library fields authorIntro and bookIntro, see server/rows.js).
-- Nullable on purpose: save_draft inserts through jsonb_populate_recordset, which writes NULL for a key a studio
-- does not send, so a studio saved before this change still saves; the server reads NULL back as an empty intro.
-- The code that fills these columns raises server/storage.js SCHEMA_VERSION to 2, so after its first save an
-- older studio is refused instead of blanking them.
alter table public.books
  add column if not exists author_intro text,
  add column if not exists book_intro text;
