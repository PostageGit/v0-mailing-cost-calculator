import { NextResponse, type NextRequest } from "next/server"
import {
  GATE_COOKIE,
  GATE_COOKIE_MAX_AGE,
  computeGateToken,
  getSitePassword,
  isGateConfigured,
  safeEqual,
} from "@/lib/site-gate"

/**
 * POST /api/gate
 * Body: { password: string }
 * Verifies the shared site password and, on success, sets an httpOnly
 * cookie holding an HMAC token derived from the password.
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

  const token = await computeGateToken(password)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(GATE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GATE_COOKIE_MAX_AGE,
  })
  return res
}

/**
 * DELETE /api/gate — lock again (clear the cookie).
 */
export async function DELETE() {
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
