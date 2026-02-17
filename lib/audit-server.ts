import { createClient } from "@/lib/supabase/server"

/**
 * Server-side audit logging. Call from API routes.
 * Fire-and-forget -- never throws, never blocks the response.
 */
export async function logActivityServer(entry: {
  entity_type: string
  entity_id?: string | null
  event: string
  detail: string
  user_name?: string
}) {
  try {
    const supabase = await createClient()
    await supabase.from("quote_activity_log").insert({
      quote_id: entry.entity_id || null,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id || null,
      event: entry.event,
      detail: entry.detail,
      user_name: entry.user_name || "",
    })
  } catch {
    // Audit must never break the request
  }
}
