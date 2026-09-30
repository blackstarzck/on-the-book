-- 도서 메인 썸네일: the square picture of the home scene previews' big tile (library field books[].thumbnail, see
-- server/rows.js). Nullable for the same reason as 20260929090000_book_intros.sql: save_draft writes NULL for a key a
-- studio does not send, so a studio saved before this change still saves, and the server reads NULL back as no
-- thumbnail. The code that fills this column raises server/storage.js SCHEMA_VERSION to 3, so after its first save an
-- older studio is refused instead of dropping the thumbnails.
alter table public.books
  add column if not exists thumbnail text;
