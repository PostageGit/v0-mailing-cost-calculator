import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import {
  GATE_COOKIE,
  isGateConfigured,
  isPublicGatePath,
  verifyCookieSignature,
  touchSession,
} from '@/lib/site-gate'

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // --- Site-wide password gate ---------------------------------------
  // Every page (including the simple calculator tools) requires the shared
  // site password. We let the unlock screen and its API through, then
  // require a valid, non-revoked, non-idle session for everything else.
  if (!isPublicGatePath(pathname)) {
    const cookie = request.cookies.get(GATE_COOKIE)?.value
    // 1) Cheap signature check — is this cookie even ours & unforged?
    const sessionId = await verifyCookieSignature(cookie)
    // 2) If the signature is valid, confirm the session is still active in
    //    the DB and slide its idle window forward (single REST round-trip).
    //    This is what enforces the 5-minute auto-logout and instant revoke.
    const unlocked = sessionId ? await touchSession(sessionId) : false

    if (!unlocked) {
      // If no password is configured yet, still send users to the gate so
      // the app is never silently wide open. The gate page explains that
      // SITE_PASSWORD must be set.
      const url = request.nextUrl.clone()
      url.pathname = '/gate'
      // Preserve where the user was trying to go so we can send them back
      // after a successful unlock.
      url.search = ''
      const next = `${pathname}${search || ''}`
      if (next && next !== '/gate') url.searchParams.set('next', next)

      // For API routes, return 401 JSON instead of an HTML redirect so
      // fetch() callers get a clean, handleable error.
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: isGateConfigured() ? 'Locked' : 'Site password not configured' },
          { status: 401 },
        )
      }

      return NextResponse.redirect(url)
    }
  }

  // Gate passed (or public path) — continue with Supabase session refresh.
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
