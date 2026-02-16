import { createBrowserClient } from '@supabase/ssr'

export function supabaseClientReady() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("[v0] Missing Supabase env vars in client. Check Vars section.")
    // Return a minimal stub so the app doesn't crash
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
    }
    return stub as unknown as ReturnType<typeof createBrowserClient>
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
