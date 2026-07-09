import { NextResponse, type NextRequest } from "next/server"
import {
  GATE_COOKIE,
  GATE_COOKIE_MAX_AGE,
  buildCookieValue,
  createSession,
  getSitePassword,
  isGateConfigured,
  revokeSession,
  safeEqual,
  verifyCookieSignature,
} from "@/lib/site-gate"

/** Best-effort client IP from proxy headers. */
function getClientIp(request: NextRequest): string | null {
  const xff = request.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  return request.headers.get("x-real-ip")
}

/**
 * POST /api/gate
 * Body: { password: string }
 * Verifies the shared site password and, on success, creates a tracked
 * session (IP + user-agent) and sets an httpOnly cookie holding the signed
 * session id.
 */
export async function POST(request: NextRequest) {
  if (!isGateConfigured()) {
    return NextResponse.json(
      { error: "Site password is not configured. Set the SITE_PASSWORD environment variable." },
      { status: 503 },
    )
  }

  let password = ""
  try {
    const body = await request.json()
    password = typeof body?.password === "string" ? body.password : ""
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  if (!password) {
    return NextResponse.json({ error: "Password required" }, { status: 400 })
  }

  const expected = getSitePassword()
  if (!safeEqual(password, expected)) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 })
  }

  // Record this login so it can be listed & revoked from the admin panel.
  const sessionId = await createSession({
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  })
  if (!sessionId) {
    return NextResponse.json(
      { error: "Could not start a session. Please try again." },
      { status: 500 },
    )
  }

  const cookieValue = await buildCookieValue(sessionId)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(GATE_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GATE_COOKIE_MAX_AGE,
  })
  return res
}

/**
 * DELETE /api/gate — lock again: revoke the current session and clear the
 * cookie. Used by manual "Lock" and the client-side idle auto-logout.
 */
export async function DELETE(request: NextRequest) {
  const cookie = request.cookies.get(GATE_COOKIE)?.value
  const sessionId = await verifyCookieSignature(cookie)
  if (sessionId) {
    await revokeSession(sessionId)
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(GATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
  return res
}
