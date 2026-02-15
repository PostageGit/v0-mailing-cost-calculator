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

    // 6. Supabase connection health
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

    return NextResponse.json({
      connection: connectionOk,
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL || null,
      row_counts: rowCounts,
      total_rows: totalRows,
      db_size_bytes: dbSizeBytes,
      db_size_formatted: dbSizeFormatted,
      table_sizes: tableSizes,
      env_status: envStatus,
      warnings,
      checked_at: new Date().toISOString(),
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
