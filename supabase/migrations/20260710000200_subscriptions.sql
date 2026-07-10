-- Stripe subscriptions.
--
-- One row per user, mirroring the state of their Stripe subscription. Stripe
-- is the source of truth — this table is a cache kept fresh by the webhook
-- (app/api/billing/webhook), so plan checks never call the Stripe API on the
-- hot path. A user with no row (or a non-active status) is on the free plan.
--
-- Same security model as the other tables: RLS is ON with NO policy, so the
-- public anon key can read nothing. All access goes through the service-role
-- key on the server (lib/subscriptionStorage.js).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                 text NOT NULL UNIQUE,          -- Clerk user id
  stripe_customer_id      text NOT NULL UNIQUE,
  stripe_subscription_id  text,
  status                  text NOT NULL,                 -- Stripe status: active, trialing, past_due, canceled, ...
  price_id                text,
  cancel_at_period_end    boolean DEFAULT false,
  current_period_end      timestamptz,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_customer_idx
  ON public.subscriptions (stripe_customer_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions FORCE ROW LEVEL SECURITY;

-- Intentionally NO `CREATE POLICY`: the service-role key bypasses RLS and is
-- the only path that should ever read/write this data.
-- ============================================================================
