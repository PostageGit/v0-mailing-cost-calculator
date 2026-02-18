import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Helper to check if Supabase env vars are available
// Checks both NEXT_PUBLIC_ prefixed and non-prefixed variants
export function supabaseReady() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  return !!(url && key)
}

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
}

function getSupabaseKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
}

export async function createClient() {
  // When env vars are missing, return a safe stub that won't throw.
  if (!supabaseReady()) {
    const noop = () => stub
    const stub: Record<string, unknown> = {
      from: () => stub,
      select: noop, insert: noop, update: noop, upsert: noop, delete: noop,
      eq: noop, neq: noop, single: noop, order: noop, limit: noop,
      ilike: noop, or: noop, in: noop, is: noop, match: noop, maybeSingle: noop,
      then: (resolve: (v: { data: null; error: { message: string } }) => void) =>
        Promise.resolve().then(() => resolve({ data: null, error: { message: 'Supabase not configured' } })),
      data: null,
      error: { message: 'Supabase not configured' },
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        getSession: async () => ({ data: { session: null }, error: null }),
      },
    }
    return stub as unknown as ReturnType<typeof createServerClient>
  }

  try {
    const cookieStore = await cookies()

    return createServerClient(
      getSupabaseUrl(),
      getSupabaseKey(),
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options),
              )
            } catch {
              // The "setAll" method was called from a Server Component.
            }
          },
        },
      },
    )
  } catch {
    // Fallback: if cookies() throws (e.g. during static init), use direct client
    return createServerClient(
      getSupabaseUrl(),
      getSupabaseKey(),
      {
        cookies: {
          getAll() { return [] },
          setAll() {},
        },
      },
    )
  }
}
