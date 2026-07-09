/**
 * Site-wide password gate WITH server-side session tracking.
 *
 * A single shared password protects EVERY page of the app (including the
 * simple calculator tools). This is a lightweight shared-password gate, not
 * per-user auth. The password lives in the SITE_PASSWORD env var.
 *
 * Unlike a purely stateless cookie, each successful unlock creates a row in
 * the `site_gate_sessions` table (IP, user-agent, timestamps). The cookie
 * holds `${sessionId}.${signature}` where the signature is an HMAC of the
 * session id keyed by SITE_PASSWORD — so the cookie can't be forged without
 * the password, and every login is individually listable and revocable.
 *
 * Sessions auto-expire after IDLE_TIMEOUT_MS (5 minutes) of inactivity:
 * every validated request slides `last_seen_at` forward, and a session is
 * only valid while `last_seen_at` is within the window. Revoking a session
 * (or bumping past the idle window) logs that login out.
 *
 * All crypto uses the Web Crypto API (`crypto.subtle`), available in BOTH
 * the Edge middleware runtime and Node route handlers. Session reads/writes
 * use the Supabase REST API over fetch(), which also works in both runtimes.
 */

export const GATE_COOKIE = "pf_site_gate"

/** Idle timeout: sessions log out after 5 minutes of inactivity. */
export const IDLE_TIMEOUT_MS = 5 * 60 * 1000

/** Cookie lifetime (upper bound). The real gate is the idle window above. */
export const GATE_COOKIE_MAX_AGE = 60 * 60 * 24 // 1 day hard cap

/** Returns the configured site password, or "" if not set. */
export function getSitePassword(): string {
  return process.env.SITE_PASSWORD || ""
}

/** Whether a site password has been configured at all. */
export function isGateConfigured(): boolean {
  return getSitePassword().length > 0
}

/** Base64url-encode an ArrayBuffer (cookie-safe, no +/=). */
function toBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/** HMAC-SHA256 a message with the site password; returns base64url. */
async function hmac(message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSitePassword()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message))
  return toBase64Url(sig)
}

/** Constant-time-ish string compare to avoid trivial timing leaks. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

/** Build the signed cookie value for a session id. */
export async function buildCookieValue(sessionId: string): Promise<string> {
  const sig = await hmac(sessionId)
  return `${sessionId}.${sig}`
}

/**
 * Parse & signature-verify a cookie value. Returns the session id if the
 * signature is valid (cheap, no DB), otherwise null.
 */
export async function verifyCookieSignature(cookieValue: string | undefined): Promise<string | null> {
  if (!cookieValue || !isGateConfigured()) return null
  const dot = cookieValue.lastIndexOf(".")
  if (dot <= 0) return null
  const sessionId = cookieValue.slice(0, dot)
  const sig = cookieValue.slice(dot + 1)
  const expected = await hmac(sessionId)
  if (!safeEqual(sig, expected)) return null
  return sessionId
}

/**
 * Paths that must remain reachable WITHOUT a valid gate cookie, otherwise
 * the user could never reach the unlock screen or submit the password.
 */
export function isPublicGatePath(pathname: string): boolean {
  if (pathname === "/gate") return true
  if (pathname === "/api/gate") return true
  return false
}

// ---------------------------------------------------------------------------
// Supabase REST helpers (work in Edge + Node via fetch, service-role keyed)
// ---------------------------------------------------------------------------

const SESSIONS_TABLE = "site_gate_sessions"

function supabaseRestBase(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ""
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  if (!url || !key) return null
  return { url: url.replace(/\/$/, ""), key }
}

function restHeaders(key: string, extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  }
}

export type GateSession = {
  id: string
  ip: string | null
  user_agent: string | null
  label: string | null
  created_at: string
  last_seen_at: string
  revoked: boolean
}

/**
 * Validate a session AND slide its last_seen_at forward in a single REST
 * round-trip. Returns true only when the session exists, is not revoked,
 * and was last seen within the idle window. Used by middleware on every
 * gated request, so it must be a single fast call.
 */
export async function touchSession(sessionId: string): Promise<boolean> {
  const cfg = supabaseRestBase()
  if (!cfg) return false
  const idleCutoff = new Date(Date.now() - IDLE_TIMEOUT_MS).toISOString()
  const nowIso = new Date().toISOString()
  const query =
    `id=eq.${encodeURIComponent(sessionId)}` +
    `&revoked=eq.false` +
    `&last_seen_at=gte.${encodeURIComponent(idleCutoff)}`
  try {
    const res = await fetch(`${cfg.url}/rest/v1/${SESSIONS_TABLE}?${query}`, {
      method: "PATCH",
      headers: restHeaders(cfg.key, { Prefer: "return=representation" }),
      body: JSON.stringify({ last_seen_at: nowIso }),
      cache: "no-store",
    })
    if (!res.ok) return false
    const rows = (await res.json()) as unknown[]
    return Array.isArray(rows) && rows.length > 0
  } catch {
    return false
  }
}

/** Create a new session row and return its id (or null on failure). */
export async function createSession(input: {
  ip: string | null
  userAgent: string | null
}): Promise<string | null> {
  const cfg = supabaseRestBase()
  if (!cfg) return null
  try {
    const res = await fetch(`${cfg.url}/rest/v1/${SESSIONS_TABLE}`, {
      method: "POST",
      headers: restHeaders(cfg.key, { Prefer: "return=representation" }),
      body: JSON.stringify({ ip: input.ip, user_agent: input.userAgent }),
      cache: "no-store",
    })
    if (!res.ok) return null
    const rows = (await res.json()) as GateSession[]
    return rows?.[0]?.id ?? null
  } catch {
    return null
  }
}

/**
 * List sessions for the admin panel. By default returns only sessions that
 * are currently active (not revoked, seen within the idle window).
 */
export async function listSessions(opts?: { includeInactive?: boolean }): Promise<GateSession[]> {
  const cfg = supabaseRestBase()
  if (!cfg) return []
  let query = "select=*&order=last_seen_at.desc&limit=200"
  if (!opts?.includeInactive) {
    const idleCutoff = new Date(Date.now() - IDLE_TIMEOUT_MS).toISOString()
    query += `&revoked=eq.false&last_seen_at=gte.${encodeURIComponent(idleCutoff)}`
  }
  try {
    const res = await fetch(`${cfg.url}/rest/v1/${SESSIONS_TABLE}?${query}`, {
      method: "GET",
      headers: restHeaders(cfg.key),
      cache: "no-store",
    })
    if (!res.ok) return []
    return (await res.json()) as GateSession[]
  } catch {
    return []
  }
}

/** Revoke a single session by id. Returns true on success. */
export async function revokeSession(sessionId: string): Promise<boolean> {
  const cfg = supabaseRestBase()
  if (!cfg) return false
  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/${SESSIONS_TABLE}?id=eq.${encodeURIComponent(sessionId)}`,
      {
        method: "PATCH",
        headers: restHeaders(cfg.key),
        body: JSON.stringify({ revoked: true }),
        cache: "no-store",
      },
    )
    return res.ok
  } catch {
    return false
  }
}
