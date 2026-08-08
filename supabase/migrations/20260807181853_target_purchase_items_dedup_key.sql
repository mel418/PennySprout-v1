-- Broadens target_purchase_items' dedup key to include `date`.
--
-- The original unique key was (user_id, order_ref, item_name, item_price).
-- That works for online orders, where order_ref is a genuinely unique order
-- number — but in-store purchase exports reuse the *store's name* as
-- order_ref for every visit ("Cerritos Bloomfield Avenue" appears on dozens
-- of different dates). Without date in the key, buying the same item at the
-- same store on two different days collided on import and the second
-- purchase was silently dropped (upsert ... ignoreDuplicates).
--
-- date disambiguates: each row's real identity is "this order, or this
-- day's visit to this store."

DO $$
DECLARE
  old_constraint text;
BEGIN
  SELECT conname INTO old_constraint
  FROM pg_constraint
  WHERE conrelid = 'public.target_purchase_items'::regclass
    AND contype = 'u';

  IF old_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.target_purchase_items DROP CONSTRAINT %I', old_constraint);
  END IF;
END $$;

ALTER TABLE public.target_purchase_items
  ADD CONSTRAINT target_purchase_items_user_order_date_item_price_key
  UNIQUE (user_id, order_ref, date, item_name, item_price);
