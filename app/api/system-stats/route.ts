import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()

    // 1. Row counts for all app tables
    const tables = [
      "customers",
      "customer_contacts",
      "delivery_addresses",
      "quotes",
      "mail_class_settings",
      "app_settings",
    ]

    const rowCounts: Record<string, number> = {}
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
      rowCounts[table] = error ? -1 : (count ?? 0)
    }

    // 2. Total data points (sum of all rows)
    const totalRows = Object.values(rowCounts).reduce(
      (s, v) => s + (v > 0 ? v : 0),
      0
    )

    // 3. Database size estimate via pg_database_size
    let dbSizeBytes = 0
    let dbSizeFormatted = "Unknown"
    const { data: sizeData } = await supabase.rpc("get_db_size").maybeSingle()
    if (sizeData?.size_bytes) {
      dbSizeBytes = sizeData.size_bytes
      dbSizeFormatted = formatBytes(sizeData.size_bytes)
    }

    // 4. Table sizes via pg_total_relation_size
    let tableSizes: { table_name: string; size_bytes: number; size_formatted: string }[] = []
    const { data: tblSizes } = await supabase.rpc("get_table_sizes")
    if (tblSizes) {
      tableSizes = tblSizes.map((t: { table_name: string; total_bytes: number }) => ({
        table_name: t.table_name,
        size_bytes: t.total_bytes,
        size_formatted: formatBytes(t.total_bytes),
      }))
    }

    // 5. Environment variable status (masked)
    const envKeys = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_JWT_SECRET",
      "POSTGRES_URL",
      "POSTGRES_HOST",
      "POSTGRES_DATABASE",
      "POSTGRES_USER",
    ]

    const envStatus: Record<string, { set: boolean; preview: string }> = {}
    for (const k of envKeys) {
      const val = process.env[k]
      envStatus[k] = {
        set: !!val,
        preview: val ? maskValue(val) : "(not set)",
      }
    }

    // 6. Add more tables to row counts
    const extraTables = ["quote_activity_log", "board_columns", "app_users", "vendor_bids", "quote_files"]
    for (const table of extraTables) {
      const { count, error: tErr } = await supabase.from(table).select("*", { count: "exact", head: true })
      rowCounts[table] = tErr ? -1 : (count ?? 0)
    }

    // 7. Activity metrics
    const now = new Date()
    const _24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const _7dAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { count: events24h } = await supabase.from("quote_activity_log").select("*", { count: "exact", head: true }).gte("created_at", _24hAgo)
    const { count: events7d } = await supabase.from("quote_activity_log").select("*", { count: "exact", head: true }).gte("created_at", _7dAgo)

    // Top events last 7d
    const { data: recentEvents } = await supabase.from("quote_activity_log").select("event, user_name").gte("created_at", _7dAgo)
    const eventCounts: Record<string, number> = {}
    const activeUsers = new Set<string>()
    for (const e of recentEvents || []) {
      eventCounts[e.event] = (eventCounts[e.event] || 0) + 1
      if (e.user_name) activeUsers.add(e.user_name)
    }
    const topEvents = Object.entries(eventCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([event, count]) => ({ event, count }))

    // Last 20 events for activity feed
    const { data: activityFeed } = await supabase.from("quote_activity_log").select("*").order("created_at", { ascending: false }).limit(20)

    // 8. Feature health metrics
    const { count: activeQuotes } = await supabase.from("quotes").select("*", { count: "exact", head: true }).eq("is_job", false).eq("archived", false)
    const { count: activeJobs } = await supabase.from("quotes").select("*", { count: "exact", head: true }).eq("is_job", true).eq("archived", false)
    const { count: totalConverted } = await supabase.from("quotes").select("*", { count: "exact", head: true }).eq("is_job", true)
    const { count: totalCustomers } = await supabase.from("customers").select("*", { count: "exact", head: true })
    const { count: syncedCustomers } = await supabase.from("customers").select("*", { count: "exact", head: true }).eq("qbo_synced", true)
    const { count: totalFiles } = await supabase.from("quote_files").select("*", { count: "exact", head: true })
    const { count: totalVendorBids } = await supabase.from("vendor_bids").select("*", { count: "exact", head: true })
    const { count: usersCount } = await supabase.from("app_users").select("*", { count: "exact", head: true })

    // Overdue deliveries (jobs where delivery date < today and not arrived)
    const todayStr = now.toISOString().split("T")[0]
    const { data: jobsWithMeta } = await supabase.from("quotes").select("job_meta").eq("is_job", true).eq("archived", false)
    let overdueDeliveries = 0
    let todayDeliveries = 0
    for (const j of jobsWithMeta || []) {
      const m = j.job_meta as Record<string, unknown> | null
      if (!m) continue
      for (const key of ["inhouse_delivery", "ohp_delivery"]) {
        const d = m[key] as { date?: string; arrived?: boolean } | undefined
        if (d?.date && !d.arrived) {
          if (d.date < todayStr) overdueDeliveries++
          else if (d.date === todayStr) todayDeliveries++
        }
      }
    }

    // 9. Purchase order stats
    const { count: totalPOs } = await supabase.from("purchase_orders").select("*", { count: "exact", head: true })
    const { count: pendingPOs } = await supabase.from("purchase_orders").select("*", { count: "exact", head: true }).neq("status", "received")
    const { count: receivedPOs } = await supabase.from("purchase_orders").select("*", { count: "exact", head: true }).eq("status", "received")
    rowCounts["purchase_orders"] = totalPOs ?? 0

    // 10. Supabase connection health
    let connectionOk = false
    try {
      const { error } = await supabase.from("app_settings").select("id").limit(1)
      connectionOk = !error
    } catch {
      connectionOk = false
    }

    // 7. Warnings
    const warnings: { level: "info" | "warning" | "critical"; message: string }[] = []

    // Free-tier Supabase limits
    const DB_SIZE_LIMIT = 500 * 1024 * 1024 // 500 MB free tier
    const ROW_WARN_THRESHOLD = 50000

    if (dbSizeBytes > DB_SIZE_LIMIT * 0.8) {
      warnings.push({
        level: dbSizeBytes > DB_SIZE_LIMIT * 0.95 ? "critical" : "warning",
        message: `Database size (${dbSizeFormatted}) is approaching the 500 MB free-tier limit.`,
      })
    }

    if (totalRows > ROW_WARN_THRESHOLD) {
      warnings.push({
        level: totalRows > 100000 ? "warning" : "info",
        message: `Total row count (${totalRows.toLocaleString()}) is growing. Consider indexing or archiving old data.`,
      })
    }

    if (!connectionOk) {
      warnings.push({
        level: "critical",
        message: "Cannot connect to the Supabase database. Check your environment variables.",
      })
    }

    for (const [k, v] of Object.entries(envStatus)) {
      if (!v.set) {
        warnings.push({
          level: "warning",
          message: `Environment variable ${k} is not set.`,
        })
      }
    }

    // Recalculate total after extra tables
    const finalTotal = Object.values(rowCounts).reduce((s, v) => s + (v > 0 ? v : 0), 0)

    return NextResponse.json({
      connection: connectionOk,
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL || null,
      row_counts: rowCounts,
      total_rows: finalTotal,
      db_size_bytes: dbSizeBytes,
      db_size_formatted: dbSizeFormatted,
      table_sizes: tableSizes,
      env_status: envStatus,
      warnings,
      checked_at: new Date().toISOString(),
      // Activity metrics
      activity: {
        events_24h: events24h ?? 0,
        events_7d: events7d ?? 0,
        top_events: topEvents,
        active_users: Array.from(activeUsers),
        feed: activityFeed || [],
      },
      // Feature health
      features: {
        active_quotes: activeQuotes ?? 0,
        active_jobs: activeJobs ?? 0,
        total_converted: totalConverted ?? 0,
        total_customers: totalCustomers ?? 0,
        synced_customers: syncedCustomers ?? 0,
        total_files: totalFiles ?? 0,
        total_vendor_bids: totalVendorBids ?? 0,
        total_users: usersCount ?? 0,
        overdue_deliveries: overdueDeliveries,
        today_deliveries: todayDeliveries,
        total_pos: totalPOs ?? 0,
        pending_pos: pendingPOs ?? 0,
        received_pos: receivedPOs ?? 0,
      },
    })
  } catch (err) {
    console.error("System stats error:", err)
    return NextResponse.json(
      { error: "Failed to gather system stats" },
      { status: 500 }
    )
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

function maskValue(val: string): string {
  if (val.length <= 8) return "****"
  return val.slice(0, 4) + "..." + val.slice(-4)
}
