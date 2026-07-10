-- Drop the monthly_analysis cache. The one-shot per-month AI analysis it
-- cached was replaced by the /api/chat conversation (which is stateless and
-- builds its context from the transactions table on every request), so
-- nothing reads or writes this table anymore.
DROP TABLE IF EXISTS public.monthly_analysis;
