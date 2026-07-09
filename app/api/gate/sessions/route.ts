import { NextResponse, type NextRequest } from "next/server"
import {
  GATE_COOKIE,
  listSessions,
  revokeSession,
  verifyCookieSignature,
} from "@/lib/site-gate"

/**
 * These endpoints are only reachable by someone already through the gate —
 * the middleware blocks /api/gate/sessions for anyone without a valid
 * session cookie. We additionally identify the CURRENT session so the UI
 * can flag "this device".
 */

/** GET /api/gate/sessions?all=1 — list logins (active by default). */
export async function GET(request: NextRequest) {
  const includeInactive = request.nextUrl.searchParams.get("all") === "1"
  const currentSessionId = await verifyCookieSignature(
    request.cookies.get(GATE_COOKIE)?.value,
  )
  const sessions = await listSessions({ includeInactive })
  return NextResponse.json({ sessions, currentSessionId })
}

/**
 * DELETE /api/gate/sessions
 * Body: { id: string }
 * Revoke a specific login by id. That login is kicked out on its next
 * request (and within the 5-minute idle window at the latest).
 */
export async function DELETE(request: NextRequest) {
  let id = ""
  try {
    const body = await request.json()
    id = typeof body?.id === "string" ? body.id : ""
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
  if (!id) {
    return NextResponse.json({ error: "Session id required" }, { status: 400 })
  }
  const ok = await revokeSession(id)
  if (!ok) {
    return NextResponse.json({ error: "Could not revoke session" }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
