import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Safe wrapper: creates client and verifies .from() works.
 * Returns the client or null if broken.
 */
export async function createSafeClient() {
  const client = await createClient()
  // Check for stub (error field present means something is wrong)
  if ((client as any).error?.message) return null
  return client
}

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
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

export async function createClient(): Promise<ReturnType<typeof createServerClient>> {
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

  const url = getSupabaseUrl()
  const key = getSupabaseKey()

  try {
    let client: ReturnType<typeof createServerClient>

    try {
      const cookieStore = await cookies()
      client = createServerClient(url, key, {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options),
              )
            } catch { /* Server Component context */ }
          },
        },
      })
    } catch {
      client = createServerClient(url, key, {
        cookies: { getAll() { return [] }, setAll() {} },
      })
    }

    // Verify the client is actually functional
    if (client && typeof (client as any).from === 'function') {
      return client
    }
  } catch (e) {
    console.error('[v0] Supabase client creation failed:', e)
  }

  // Fallback stub – never throws, always returns { data: null, error }
  return makeStub('Supabase client initialization failed')
}

function makeStub(msg: string) {
  const noop = () => stub
  const stub: Record<string, unknown> = {
    from: () => stub,
    select: noop, insert: noop, update: noop, upsert: noop, delete: noop,
    eq: noop, neq: noop, single: noop, order: noop, limit: noop,
    ilike: noop, or: noop, in: noop, is: noop, match: noop, maybeSingle: noop,
    then: (resolve: (v: { data: null; error: { message: string } }) => void) =>
      Promise.resolve().then(() => resolve({ data: null, error: { message: msg } })),
    data: null, error: { message: msg },
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
    },
  }
  return stub as unknown as ReturnType<typeof createServerClient>
}
