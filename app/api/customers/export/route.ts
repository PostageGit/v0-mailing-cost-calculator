import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { logActivityServer } from "@/lib/audit-server"

/*
 * QBO Customer CSV columns -- maps exactly to QuickBooks Online import wizard.
 * QBO matches on "Name" (display name) to detect duplicates.
 */
const QBO_HEADERS = [
  "Name", "Company", "Email", "Phone", "Mobile", "Website",
  "Street", "City", "State", "PostalCode", "Country", "Notes",
  "Billing Street", "Billing City", "Billing State", "Billing PostalCode",
]

const PLAIN_HEADERS = [
  "Company", "Contact", "Email", "Office Phone", "Cell Phone", "Website",
  "Street", "City", "State", "Zip", "Country", "Notes", "Terms",
  "Billing Contact", "Billing Email", "Billing Phone",
  "Created", "QBO Synced",
]

function esc(val: string | null | undefined): string {
  if (val == null || val === "") return ""
  const s = String(val)
  return (s.includes(",") || s.includes('"') || s.includes("\n"))
    ? '"' + s.replace(/"/g, '""') + '"'
    : s
}

/*
 * GET /api/customers/export
 * Query params:
 *   format    = "qbo" (default) | "full"
 *   filter    = "all" | "new_only" (unsynced) | "since" (date range)
 *   since     = ISO date string (used when filter=since)
 *   mark_synced = "true" -- marks exported customers as qbo_synced
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const format = sp.get("format") || "qbo"
  const filter = sp.get("filter") || "all"
  const since = sp.get("since") || ""
  const markSynced = sp.get("mark_synced") === "true"

  const supabase = await createClient()

  // Build query
  let query = supabase.from("customers").select("*").order("company_name", { ascending: true })
  if (filter === "new_only") query = query.eq("qbo_synced", false)
  if (filter === "since" && since) query = query.gte("created_at", since)

  const { data: customers, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!customers?.length) return NextResponse.json({ error: "No customers match the selected filter" }, { status: 404 })

  // Mark exported customers as synced
  if (markSynced) {
    const ids = customers.map((c) => c.id)
    await supabase
      .from("customers")
      .update({ qbo_synced: true, qbo_synced_at: new Date().toISOString() })
      .in("id", ids)
  }

  let csv: string
  if (format === "full") {
    // Full internal format with all fields
    const rows = [PLAIN_HEADERS.join(",")]
    for (const c of customers) {
      rows.push([
        esc(c.company_name), esc(c.contact_name), esc(c.email),
        esc(c.office_phone), esc(c.cell_phone), esc(c.website),
        esc(c.street), esc(c.city), esc(c.state), esc(c.postal_code),
        esc(c.country), esc(c.notes), esc(c.terms),
        esc(c.billing_contact_name), esc(c.billing_contact_email), esc(c.billing_contact_phone),
        esc(c.created_at?.split("T")[0]), esc(c.qbo_synced ? "Yes" : "No"),
      ].join(","))
    }
    csv = rows.join("\n")
  } else {
    // QBO format -- exact columns QBO import wizard expects
    const rows = [QBO_HEADERS.join(",")]
    for (const c of customers) {
      // QBO "Name" = display name. Must be unique. Use "Company - Contact" or just Company.
      const displayName = c.contact_name
        ? `${c.company_name} - ${c.contact_name}`
        : c.company_name

      rows.push([
        esc(displayName), esc(c.company_name), esc(c.email),
        esc(c.office_phone), esc(c.cell_phone), esc(c.website),
        esc(c.street), esc(c.city), esc(c.state), esc(c.postal_code),
        esc(c.country), esc(c.notes),
        // Billing address (same or separate)
        esc(c.billing_same_as_primary ? c.street : ""),
        esc(c.billing_same_as_primary ? c.city : ""),
        esc(c.billing_same_as_primary ? c.state : ""),
        esc(c.billing_same_as_primary ? c.postal_code : ""),
      ].join(","))
    }
    csv = rows.join("\n")
  }

  // Audit log
  logActivityServer({
    entity_type: "system",
    event: "customer_exported",
    detail: `Exported ${customers.length} customers (${format}, ${filter})${markSynced ? " + marked synced" : ""}`,
  })

  const tag = filter === "new_only" ? "new" : filter === "since" ? "since-" + since : "all"
  const filename = `customers-${format}-${tag}-${new Date().toISOString().split("T")[0]}.csv`

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
