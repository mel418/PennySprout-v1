-- Line items from a user's Target purchase history export (see
-- lib/targetCsv.js), linked to the matching card transaction so the
-- Files review modal can show what was actually bought, with a thumbnail,
-- for a given "Target" charge.
--
-- One row per line item. transaction_id is nullable and populated by the
-- matcher (lib/targetPurchaseStorage.js matchOrdersToTransactions): items
-- are grouped by order_ref into a "trip," and a trip is linked to a
-- transaction when a same-user "Target"-ish transaction has a matching
-- amount within a few days of the order date. Unmatched rows just have no
-- transaction_id yet (e.g. the statement for that charge hasn't been
-- uploaded) — re-running the match later (on each import) can fill them in.
--
-- Same security model as the other tables: RLS is ON with NO policy, so the
-- public anon key can read nothing. All access goes through the
-- service-role key on the server (lib/targetPurchaseStorage.js).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.target_purchase_items (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        text NOT NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  order_ref      text NOT NULL,       -- Target's order/trip number, e.g. '#912003635469757'
  date           date,
  item_name      text NOT NULL DEFAULT '',
  item_price     numeric NOT NULL DEFAULT 0,
  qty            integer NOT NULL DEFAULT 1,
  line_total     numeric NOT NULL DEFAULT 0,
  image_url      text,                -- Target's public CDN thumbnail — nothing hosted by us
  trip_total     numeric NOT NULL DEFAULT 0,
  fulfillment    text,                -- 'Picked up' / 'Delivered' / 'Canceled' / 'Return complete' / ...
  created_at     timestamptz DEFAULT now(),
  -- Re-importing the same export (or an overlapping date range from a fresh
  -- export) shouldn't duplicate line items.
  UNIQUE (user_id, order_ref, item_name, item_price)
);

CREATE INDEX IF NOT EXISTS target_purchase_items_user_idx        ON public.target_purchase_items (user_id);
CREATE INDEX IF NOT EXISTS target_purchase_items_transaction_idx ON public.target_purchase_items (transaction_id);
CREATE INDEX IF NOT EXISTS target_purchase_items_order_idx       ON public.target_purchase_items (user_id, order_ref);

ALTER TABLE public.target_purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.target_purchase_items FORCE ROW LEVEL SECURITY;

-- Intentionally NO `CREATE POLICY`: the service-role key bypasses RLS and is
-- the only path that should ever read/write this data.
-- ============================================================================
