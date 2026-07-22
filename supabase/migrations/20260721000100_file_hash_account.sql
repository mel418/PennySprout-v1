-- Duplicate-upload detection and account grouping for user_files.
--
-- content_hash: SHA-256 of the raw uploaded file's bytes, computed client-side
-- (crypto.subtle in FileUpload.js) before parsing. Lets the same PDF/CSV be
-- fingerprinted even though only the extracted transactions ever reach the
-- server — the original bytes for a CSV never do. Matched per-user so two
-- different users uploading the same public bank template don't collide.
--
-- account_name: free-text label the user assigns per upload (e.g. "Chase
-- Checking") so files can be grouped by which account/bank they came from,
-- alongside the existing statement-month grouping computed from transaction
-- dates.

ALTER TABLE public.user_files
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS account_name text;

CREATE INDEX IF NOT EXISTS user_files_user_hash_idx
  ON public.user_files (user_id, content_hash);
