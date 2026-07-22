-- Preserve the original uploaded filename separately from file_name, which
-- the user can rename at any time. Without this, renaming was one-way: there
-- was nothing left to revert to.
--
-- Backfill: for every existing row, file_name IS the original today (no
-- rename has diverged it from what was uploaded), so it's copied straight
-- across. Only renames made AFTER this migration will cause the two columns
-- to differ.

ALTER TABLE public.user_files
  ADD COLUMN IF NOT EXISTS original_file_name text;

UPDATE public.user_files
  SET original_file_name = file_name
  WHERE original_file_name IS NULL;
