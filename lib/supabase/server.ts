import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Helper to check if Supabase env vars are available
export function supabaseReady() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export async function createClient() {
  // When env vars are missing, return a safe stub that won't throw.
  // This prevents the entire server from crashing during development
  // or in v0 preview when Supabase isn't configured yet.
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

  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    },
  )
}
