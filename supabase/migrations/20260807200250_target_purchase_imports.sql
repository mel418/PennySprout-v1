-- Tracks each Target purchase-history CSV import as its own record, the
-- same way user_files tracks each bank statement — so the Files tab can
-- list "here's every Target CSV you've imported" with a Review modal per
-- import, mirroring the bank-statement file cards.
--
-- item_count is the number of NEW rows this import actually wrote (rows
-- that collide with an earlier import on the target_purchase_items dedup
-- key keep their original import_id — re-uploading an overlapping export
-- doesn't reassign existing items to the new import). The API only creates
-- an import row at all when at least one new item was written, so a
-- fully-duplicate re-upload doesn't clutter the list with a 0-item entry.
--
-- Same security model as the other tables: RLS is ON with NO policy, so the
-- public anon key can read nothing. All access goes through the
-- service-role key on the server (lib/targetPurchaseStorage.js).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.target_purchase_imports (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     text NOT NULL,
  file_name   text NOT NULL DEFAULT 'Target purchase history',
  item_count  integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS target_purchase_imports_user_idx ON public.target_purchase_imports (user_id);

ALTER TABLE public.target_purchase_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.target_purchase_imports FORCE ROW LEVEL SECURITY;

-- Nullable and unbacked for rows written before this migration — those
-- items just won't show up under any import card, which is fine; they're
-- still reachable via their matched transaction's "view items" toggle.
ALTER TABLE public.target_purchase_items
  ADD COLUMN IF NOT EXISTS import_id uuid REFERENCES public.target_purchase_imports(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS target_purchase_items_import_idx ON public.target_purchase_items (import_id);

-- Intentionally NO `CREATE POLICY`: the service-role key bypasses RLS and is
-- the only path that should ever read/write this data.
-- ============================================================================
