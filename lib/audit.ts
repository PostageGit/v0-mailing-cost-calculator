/**
 * Fire-and-forget audit logging. Never blocks user actions.
 * Posts to /api/activity-log, silently swallows errors.
 */

export type EntityType = "quote" | "job" | "customer" | "system"

export interface AuditEntry {
  entity_type: EntityType
  entity_id?: string
  event: string
  detail: string
  user_name?: string
}

/**
 * Log an activity event. Fire-and-forget -- never awaited in UI code.
 */
export function logActivity(entry: AuditEntry) {
  try {
    fetch("/api/activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quote_id: entry.entity_id || null,
        entity_type: entry.entity_type,
        entity_id: entry.entity_id || null,
        event: entry.event,
        detail: entry.detail,
        user_name: entry.user_name || "",
      }),
    }).catch(() => {})
  } catch {
    // silently fail -- audit must never block UI
  }
}

/**
 * Helper to get current user name from the app_users cookie/state.
 * Falls back to "System" if not available.
 */
export function getCurrentUserName(): string {
  if (typeof window === "undefined") return "System"
  try {
    const stored = localStorage.getItem("app_current_user")
    if (stored) {
      const parsed = JSON.parse(stored)
      return parsed.name || parsed.initials || "Unknown"
    }
  } catch {}
  return "Unknown"
}
