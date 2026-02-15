import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// QuickBooks Online Customer CSV format
const QB_HEADERS = [
  "Name",
  "Company",
  "Email",
  "Phone",
  "Mobile",
  "Website",
  "Street",
  "City",
  "State",
  "PostalCode",
  "Country",
  "Notes",
]

function escapeCSV(val: string | null | undefined): string {
  if (val == null || val === "") return ""
  const s = String(val)
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

export async function GET() {
  const supabase = await createClient()
  const { data: customers, error } = await supabase
    .from("customers")
    .select("*")
    .order("company_name", { ascending: true })

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 })

  const rows: string[] = [QB_HEADERS.join(",")]

  for (const c of customers || []) {
    const displayName = c.contact_name
      ? `${c.contact_name}`
      : c.company_name

    rows.push(
      [
        escapeCSV(displayName),
        escapeCSV(c.company_name),
        escapeCSV(c.email),
        escapeCSV(c.office_phone),
        escapeCSV(c.cell_phone),
        escapeCSV(c.website),
        escapeCSV(c.street),
        escapeCSV(c.city),
        escapeCSV(c.state),
        escapeCSV(c.postal_code),
        escapeCSV(c.country),
        escapeCSV(c.notes),
      ].join(",")
    )
  }

  const csv = rows.join("\n")
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="customers-qb-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  })
}
