/**
 * Site-wide password gate.
 *
 * A single shared password protects EVERY page of the app (including the
 * simple calculator tools). This is intentionally a lightweight gate — not
 * per-user auth. The password lives in the SITE_PASSWORD env var and is
 * never stored in a cookie directly. Instead we store an HMAC token derived
 * from the password so the raw secret never leaves the server, and the
 * cookie can't be forged without knowing SITE_PASSWORD.
 *
 * These helpers use the Web Crypto API (`crypto.subtle`), which is available
 * in BOTH the Edge middleware runtime and Node route handlers, so the exact
 * same token logic runs on the set side (API route) and the verify side
 * (middleware).
 */

export const GATE_COOKIE = "pf_site_gate"

// A fixed message that we sign with the password. The signature is what we
// store in the cookie. Bump the version suffix to invalidate all sessions.
const GATE_MESSAGE = "postflow-site-gate-v1"

/** Returns the configured site password, or "" if not set. */
export function getSitePassword(): string {
  return process.env.SITE_PASSWORD || ""
}

/** Whether a site password has been configured at all. */
export function isGateConfigured(): boolean {
  return getSitePassword().length > 0
}

/**
 * Compute the cookie token for a given password using HMAC-SHA256.
 * base64-encoded. Deterministic, so middleware can recompute & compare.
 */
export async function computeGateToken(password: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(GATE_MESSAGE))
  const bytes = new Uint8Array(sig)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

/**
 * The token the cookie SHOULD contain given the current SITE_PASSWORD.
 * Returns "" when no password is configured.
 */
export async function expectedGateToken(): Promise<string> {
  const pw = getSitePassword()
  if (!pw) return ""
  return computeGateToken(pw)
}

/** Constant-time-ish string compare to avoid trivial timing leaks. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

/** Verify a cookie value against the current SITE_PASSWORD. */
export async function isValidGateCookie(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue) return false
  const expected = await expectedGateToken()
  if (!expected) return false
  return safeEqual(cookieValue, expected)
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

// Cookie lifetime: 30 days. Long enough to be convenient, short enough that
// access naturally expires. Adjust as needed.
export const GATE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30
