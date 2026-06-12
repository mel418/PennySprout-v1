// `server-only` makes the build fail if this module is ever imported into a
// client component — a hard guarantee that the service-role key (which bypasses
// Row Level Security) never reaches the browser bundle.
import 'server-only'
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  // This client is only ever used in stateless API routes; no need to persist
  // or auto-refresh sessions on the server.
  { auth: { persistSession: false, autoRefreshToken: false } }
)