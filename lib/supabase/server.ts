import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Especially important if using Fluid compute: Don't put this client in a
 * global variable. Always create a new client within each function when using
 * it.
 */
export async function createClient() {
  const cookieStore = await cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a stub object that mimics the Supabase client interface.
    // All queries will return empty data. This prevents the server
    // from crashing when env vars aren't yet configured.
    const stub = {
      from: () => stub,
      select: () => stub,
      insert: () => stub,
      update: () => stub,
      upsert: () => stub,
      delete: () => stub,
      eq: () => stub,
      neq: () => stub,
      single: () => stub,
      order: () => stub,
      limit: () => stub,
      ilike: () => stub,
      or: () => stub,
      in: () => stub,
      is: () => stub,
      match: () => stub,
      then: (resolve: (v: { data: null; error: { message: string } }) => void) =>
        resolve({ data: null, error: { message: "Supabase not configured" } }),
      data: null,
      error: { message: "Supabase not configured" },
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        getSession: async () => ({ data: { session: null }, error: null }),
      },
    }
    return stub as unknown as Awaited<ReturnType<typeof createServerClient>>
  }

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
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
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  )
}
