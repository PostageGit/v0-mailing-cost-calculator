import { createClient, supabaseReady } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// ─── CSV PARSER ──────────────────────────────────────────────────────
// Handles multiline quoted fields (QB Online exports addresses with
// embedded line-breaks inside double-quoted cells).
function parseCSV(text: string): Record<string, string>[] {
  const records: string[][] = []
  let current: string[] = []
  let cell = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ }
        else { inQuotes = false }
      } else {
        cell += c === "\r" ? "" : c === "\n" ? " " : c
      }
    } else {
      if (c === '"') { inQuotes = true }
      else if (c === ",") { current.push(cell); cell = "" }
      else if (c === "\n" || (c === "\r" && text[i + 1] === "\n")) {
        if (c === "\r") i++
        current.push(cell); cell = ""
        if (current.some((v) => v.trim())) records.push(current)
        current = []
      } else if (c !== "\r") { cell += c }
    }
  }
  current.push(cell)
  if (current.some((v) => v.trim())) records.push(current)
  if (records.length < 2) return []

  const headers = records[0].map((h) => h.trim())
  return records.slice(1).map((vals) => {
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (vals[i] || "").trim() })
    return row
  })
}

// ─── QB CSV → DB COLUMN MAPPING ─────────────────────────────────────
// Maps every known variation of QB Online column headers to our DB columns.
const FIELD_MAP: Record<string, string> = {
  // QB Online Customer Contact List export columns
  "name": "contact_name",
  "customer": "contact_name",
  "display name": "contact_name",
  "display name as": "contact_name",
  "contact name": "contact_name",

  "company": "company_name",
  "company name": "company_name",

  "email": "email",
  "e-mail": "email",
  "main email": "email",

  "phone": "office_phone",
  "main phone": "office_phone",
  "work phone": "office_phone",
  "office phone": "office_phone",

  "mobile": "cell_phone",
  "mobile phone": "cell_phone",
  "cell": "cell_phone",
  "cell phone": "cell_phone",

  "website": "website",
  "web site": "website",

  "street": "street",
  "street address": "street",
  "address": "street",
  "billing street": "street",
  "billing address": "street",
  "shipping street": "_shipping_street",

  "city": "city",
  "billing city": "city",
  "shipping city": "_shipping_city",

  "state": "state",
  "state/province": "state",
  "billing state": "state",
  "billing state/province": "state",
  "province": "state",
  "shipping state": "_shipping_state",

  "zip": "postal_code",
  "zip code": "postal_code",
  "postal code": "postal_code",
  "postalcode": "postal_code",
  "billing zip": "postal_code",
  "billing postal code": "postal_code",
  "shipping zip": "_shipping_zip",

  "country": "country",
  "billing country": "country",
  "shipping country": "_shipping_country",

  "notes": "notes",
  "memo": "notes",

  "terms": "terms",
  "payment terms": "terms",

  // QB fields stored in custom_fields jsonb
  "customer type": "_qb_customer_type",
  "type": "_qb_customer_type",
  "open balance": "_qb_open_balance",
  "balance": "_qb_open_balance",
  "open balance total": "_qb_open_balance",
  "attachments": "_qb_attachments",
  "tax id": "_qb_tax_id",
  "resale number": "_qb_resale_number",
}

interface CustomerRow {
  company_name: string
  contact_name?: string
  office_phone?: string
  cell_phone?: string
  email?: string
  website?: string
  street?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
  notes?: string
  terms?: string
  billing_same_as_primary: boolean
  custom_fields: Record<string, string>
}

function buildCustomer(row: Record<string, string>): CustomerRow | null {
  const customer: Partial<CustomerRow> = {
    billing_same_as_primary: true,
    custom_fields: {},
  }

  for (const [csvKey, value] of Object.entries(row)) {
    if (!value) continue
    const dbField = FIELD_MAP[csvKey.toLowerCase().trim()]
    if (!dbField) continue

    // QB fields → custom_fields jsonb
    if (dbField === "_qb_customer_type") {
      customer.custom_fields!["QB Customer Type"] = value
    } else if (dbField === "_qb_open_balance") {
      const cleaned = value.replace(/[,"$\s]/g, "")
      const parsed = parseFloat(cleaned)
      if (!isNaN(parsed) && parsed !== 0) {
        customer.custom_fields!["QB Open Balance"] = value.replace(/"/g, "")
      }
    } else if (dbField === "_qb_attachments") {
      if (value.trim()) customer.custom_fields!["QB Attachments"] = value
    } else if (dbField === "_qb_tax_id") {
      customer.custom_fields!["QB Tax ID"] = value
    } else if (dbField === "_qb_resale_number") {
      customer.custom_fields!["QB Resale Number"] = value
    } else if (dbField.startsWith("_shipping_")) {
      // Store shipping address info in custom_fields for now
      const shippingKey = "Shipping " + dbField.replace("_shipping_", "").replace(/^\w/, c => c.toUpperCase())
      customer.custom_fields![shippingKey] = value
    } else {
      // Direct DB column
      ;(customer as Record<string, unknown>)[dbField] = value
    }
  }

  // company_name is required -- fall back to contact_name
  if (!customer.company_name) {
    if (customer.contact_name) {
      customer.company_name = customer.contact_name
    } else {
      return null
    }
  }

  // If contact_name wasn't set, default to company_name
  if (!customer.contact_name) {
    customer.contact_name = customer.company_name
  }

  // Clean up empty custom_fields
  if (Object.keys(customer.custom_fields!).length === 0) {
    customer.custom_fields = {}
  }

  return customer as CustomerRow
}

// ─── API ROUTE ────────────────────────────────────────────────────────
export async function POST(req: Request) {
  if (!supabaseReady()) {
    return NextResponse.json(
      { error: "Supabase not configured. Please connect your Supabase integration." },
      { status: 503 }
    )
  }

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const duplicateMode = (formData.get("duplicateMode") as string) || "skip"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Read and parse CSV
    const text = await file.text()
    const rows = parseCSV(text)

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No data rows found in the CSV. Make sure it has a header row and at least one data row." },
        { status: 400 }
      )
    }

    // Build customer records
    const customers: CustomerRow[] = []
    let parseErrors = 0
    for (const row of rows) {
      const c = buildCustomer(row)
      if (c) {
        customers.push(c)
      } else {
        parseErrors++
      }
    }

    if (customers.length === 0) {
      return NextResponse.json(
        { error: `Could not parse any valid customers from the CSV (${parseErrors} rows had no Name or Company).` },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Fetch existing customers for duplicate detection
    const { data: existing, error: fetchError } = await supabase
      .from("customers")
      .select("id, company_name")

    if (fetchError) {
      return NextResponse.json(
        { error: `Failed to check existing customers: ${fetchError.message}` },
        { status: 500 }
      )
    }

    const existingMap = new Map<string, string>()
    if (existing) {
      for (const c of existing) {
        if (c.company_name) {
          existingMap.set(c.company_name.toLowerCase().trim(), c.id)
        }
      }
    }

    // Categorize
    const toInsert: CustomerRow[] = []
    const toUpdate: { id: string; data: CustomerRow }[] = []
    let skipped = 0
    const seenInBatch = new Set<string>()

    for (const customer of customers) {
      const key = customer.company_name.toLowerCase().trim()

      // Skip duplicates within the same CSV file
      if (seenInBatch.has(key)) {
        skipped++
        continue
      }
      seenInBatch.add(key)

      const existingId = existingMap.get(key)
      if (existingId) {
        if (duplicateMode === "update") {
          toUpdate.push({ id: existingId, data: customer })
        } else {
          skipped++
        }
      } else {
        toInsert.push(customer)
      }
    }

    // Batch insert new customers
    let inserted = 0
    let insertErrors = 0
    const BATCH_SIZE = 50

    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE)
      const { data: insertData, error: insertError } = await supabase
        .from("customers")
        .insert(batch)
        .select("id")

      if (insertError) {
        console.error(`[Import] Batch insert error at ${i}:`, insertError.message)
        // Try inserting one by one to salvage what we can
        for (const single of batch) {
          const { error: singleErr } = await supabase
            .from("customers")
            .insert(single)
            .select("id")
          if (singleErr) {
            insertErrors++
            console.error(`[Import] Single insert error for "${single.company_name}":`, singleErr.message)
          } else {
            inserted++
          }
        }
      } else {
        inserted += insertData?.length || 0
      }
    }

    // Update existing customers
    let updated = 0
    let updateErrors = 0

    for (const { id, data } of toUpdate) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { company_name, ...updateData } = data
      const { error: updateError } = await supabase
        .from("customers")
        .update(updateData)
        .eq("id", id)

      if (updateError) {
        updateErrors++
        console.error(`[Import] Update error for "${data.company_name}":`, updateError.message)
      } else {
        updated++
      }
    }

    return NextResponse.json({
      success: true,
      total_rows: rows.length,
      parsed: customers.length,
      inserted,
      updated,
      skipped,
      errors: parseErrors + insertErrors + updateErrors,
      details: {
        parse_errors: parseErrors,
        insert_errors: insertErrors,
        update_errors: updateErrors,
      }
    })
  } catch (err) {
    console.error("[Import] Unexpected error:", err)
    return NextResponse.json(
      { error: `Import failed: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 500 }
    )
  }
}
