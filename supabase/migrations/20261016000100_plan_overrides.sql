-- Manual plan overrides.
--
-- Lets an admin (Clerk publicMetadata.role = 'admin') set a user's plan by
-- hand, without Stripe — for family and friends. An override beats the
-- Stripe-synced `subscriptions` row in getPlan() (lib/subscriptionStorage.js),
-- and lives in its own table so the Stripe webhook, the only writer of
-- `subscriptions`, can never overwrite it. Removing the row hands the user
-- back to whatever Stripe says.
--
-- Same security model as the other tables: RLS is ON with NO policy, so the
-- public anon key can read nothing. All access goes through the service-role
-- key on the server.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.plan_overrides (
  user_id     text PRIMARY KEY,                              -- Clerk user id
  plan        text NOT NULL CHECK (plan IN ('free', 'pro')),
  granted_by  text NOT NULL,                                 -- Clerk user id of the admin
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.plan_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_overrides FORCE ROW LEVEL SECURITY;

-- Intentionally NO `CREATE POLICY`: service-role only.
-- ============================================================================
