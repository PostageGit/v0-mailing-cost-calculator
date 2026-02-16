import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// ─── ADMIN CLIENT (service role – bypasses RLS, no cookies needed) ───
function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ─── ROBUST CSV PARSER ───────────────────────────────────────────────
// Handles: multiline quoted fields, commas inside quotes, escaped quotes (""),
// trailing commas in quoted fields, \r\n and \n line endings.
// This is critical because QB Online exports addresses with embedded newlines
// and company names with commas like: "Akiva Spitzer, CPA"
function parseCSV(text: string): Record<string, string>[] {
  const records: string[][] = []
  let current: string[] = []
  let cell = ""
  let inQuotes = false
  const len = text.length

  for (let i = 0; i < len; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        // Escaped quote "" → literal "
        if (i + 1 < len && text[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          // End of quoted field
          inQuotes = false
        }
      } else if (c === "\r") {
        // Skip \r inside quotes (normalize to space for multiline addresses)
        continue
      } else if (c === "\n") {
        // Newline inside quoted field → replace with space (address lines)
        cell += " "
      } else {
        cell += c
      }
    } else {
      if (c === '"') {
        inQuotes = true
      } else if (c === ",") {
        current.push(cell.trim())
        cell = ""
      } else if (c === "\n" || (c === "\r" && i + 1 < len && text[i + 1] === "\n")) {
        if (c === "\r") i++ // skip the \n in \r\n
        current.push(cell.trim())
        cell = ""
        // Only add rows that have at least one non-empty cell
        if (current.some((v) => v !== "")) records.push(current)
        current = []
      } else if (c === "\r") {
        // Bare \r (old Mac line ending)
        current.push(cell.trim())
        cell = ""
        if (current.some((v) => v !== "")) records.push(current)
        current = []
      } else {
        cell += c
      }
    }
  }

  // Don't forget the last cell/row
  current.push(cell.trim())
  if (current.some((v) => v !== "")) records.push(current)

  if (records.length < 2) return []

  // First row = headers
  const headers = records[0].map((h) => h.trim())
  return records.slice(1).map((vals) => {
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = (vals[i] || "").trim()
    })
    return row
  })
}

// ─── QB CSV → DB COLUMN MAPPING ─────────────────────────────────────
// Maps every known variation of QuickBooks Online column headers to our DB
// columns. QB exports vary based on what report you run, so we cover all
// known header variants.
const FIELD_MAP: Record<string, string> = {
  // Name / Contact
  "name": "contact_name",
  "customer": "contact_name",
  "display name": "contact_name",
  "display name as": "contact_name",
  "contact name": "contact_name",
  "full name": "contact_name",

  // Company
  "company": "company_name",
  "company name": "company_name",

  // Email
  "email": "email",
  "e-mail": "email",
  "main email": "email",

  // Phone
  "phone": "office_phone",
  "main phone": "office_phone",
  "work phone": "office_phone",
  "office phone": "office_phone",

  // Mobile
  "mobile": "cell_phone",
  "mobile phone": "cell_phone",
  "cell": "cell_phone",
  "cell phone": "cell_phone",

  // Fax
  "fax": "fax",
  "fax number": "fax",

  // Website
  "website": "website",
  "web site": "website",

  // Address - primary/billing
  "street": "street",
  "street address": "street",
  "address": "street",
  "billing street": "street",
  "billing address": "street",

  "city": "city",
  "billing city": "city",

  "state": "state",
  "state/province": "state",
  "billing state": "state",
  "billing state/province": "state",
  "province": "state",

  "zip": "postal_code",
  "zip code": "postal_code",
  "postal code": "postal_code",
  "postalcode": "postal_code",
  "billing zip": "postal_code",
  "billing postal code": "postal_code",

  "country": "country",
  "billing country": "country",

  // Shipping address → custom_fields
  "shipping street": "_shipping_street",
  "shipping address": "_shipping_street",
  "shipping city": "_shipping_city",
  "shipping state": "_shipping_state",
  "shipping state/province": "_shipping_state",
  "shipping zip": "_shipping_zip",
  "shipping postal code": "_shipping_zip",
  "shipping country": "_shipping_country",

  // Other DB columns
  "notes": "notes",
  "memo": "notes",
  "terms": "terms",
  "payment terms": "terms",

  // QB fields → stored in custom_fields jsonb
  "customer type": "_qb_customer_type",
  "type": "_qb_customer_type",
  "open balance": "_qb_open_balance",
  "balance": "_qb_open_balance",
  "open balance total": "_qb_open_balance",
  "attachments": "_qb_attachments",
  "tax id": "_qb_tax_id",
  "resale number": "_qb_resale_number",
  "tax rate": "_qb_tax_rate",
}

// DB columns that we can write to directly
const DIRECT_DB_COLUMNS = new Set([
  "company_name", "contact_name", "office_phone", "cell_phone",
  "fax", "email", "website", "street", "city", "state",
  "postal_code", "country", "notes", "terms",
])

interface CustomerRow {
  company_name: string
  contact_name: string
  office_phone?: string
  cell_phone?: string
  fax?: string
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
    const normalizedKey = csvKey.toLowerCase().trim()
    const dbField = FIELD_MAP[normalizedKey]
    if (!dbField) continue

    // Custom fields (QB-specific or shipping)
    if (dbField === "_qb_customer_type") {
      customer.custom_fields!["QB Customer Type"] = value
    } else if (dbField === "_qb_open_balance") {
      const cleaned = value.replace(/[,"$\s]/g, "")
      const parsed = parseFloat(cleaned)
      if (!isNaN(parsed) && parsed !== 0) {
        customer.custom_fields!["QB Open Balance"] = cleaned
      }
    } else if (dbField === "_qb_attachments") {
      if (value !== "0" && value.trim()) {
        customer.custom_fields!["QB Attachments"] = value
      }
    } else if (dbField === "_qb_tax_id") {
      customer.custom_fields!["QB Tax ID"] = value
    } else if (dbField === "_qb_resale_number") {
      customer.custom_fields!["QB Resale Number"] = value
    } else if (dbField === "_qb_tax_rate") {
      customer.custom_fields!["QB Tax Rate"] = value
    } else if (dbField.startsWith("_shipping_")) {
      const label = dbField.replace("_shipping_", "")
      const pretty = label.charAt(0).toUpperCase() + label.slice(1)
      customer.custom_fields!["Shipping " + pretty] = value
    } else if (DIRECT_DB_COLUMNS.has(dbField)) {
      ;(customer as Record<string, unknown>)[dbField] = value
    }
  }

  // company_name is required - fall back to contact_name
  if (!customer.company_name) {
    if (customer.contact_name) {
      customer.company_name = customer.contact_name
    } else {
      return null // Can't import a row with no name at all
    }
  }

  // If contact_name wasn't set, default to company_name
  if (!customer.contact_name) {
    customer.contact_name = customer.company_name
  }

  // Strip trailing commas from company_name (QB sometimes adds them)
  customer.company_name = customer.company_name.replace(/,\s*$/, "").trim()
  customer.contact_name = customer.contact_name.replace(/,\s*$/, "").trim()

  // Default country to US if empty
  if (!customer.country || customer.country.trim() === "") {
    customer.country = "US"
  }

  // Clean up empty custom_fields
  if (Object.keys(customer.custom_fields!).length === 0) {
    customer.custom_fields = {}
  }

  return customer as CustomerRow
}

// ─── API ROUTE ────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const supabase = getAdminClient()

  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Supabase is not configured. Please make sure the Supabase integration is connected in the sidebar under 'Connect'.",
      },
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

    if (!file.name.toLowerCase().endsWith(".csv") && !file.name.toLowerCase().endsWith(".txt")) {
      return NextResponse.json(
        { error: "Please upload a .csv file (exported from QuickBooks Online)" },
        { status: 400 }
      )
    }

    // Read and parse CSV
    const text = await file.text()
    console.log("[v0] CSV file size:", text.length, "bytes")

    const rows = parseCSV(text)
    console.log("[v0] Parsed", rows.length, "data rows from CSV")

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "No data rows found in the CSV. Make sure it has a header row and at least one data row. Expected headers: Name, Company name, Email, Phone, etc.",
        },
        { status: 400 }
      )
    }

    // Log detected headers for debugging
    if (rows.length > 0) {
      console.log("[v0] Detected CSV headers:", Object.keys(rows[0]).join(", "))
    }

    // Build customer records from CSV rows
    const customers: CustomerRow[] = []
    const parseErrors: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const c = buildCustomer(rows[i])
      if (c) {
        customers.push(c)
      } else {
        parseErrors.push(`Row ${i + 2}: No name or company found`)
      }
    }

    console.log("[v0] Built", customers.length, "valid customers,", parseErrors.length, "parse errors")

    if (customers.length === 0) {
      return NextResponse.json(
        {
          error: `Could not parse any valid customers. ${parseErrors.length} rows had no Name or Company. Check that your CSV has a "Name" or "Company name" column.`,
        },
        { status: 400 }
      )
    }

    // Fetch ALL existing customers for duplicate detection by company_name
    const { data: existing, error: fetchError } = await supabase
      .from("customers")
      .select("id, company_name")

    if (fetchError) {
      console.error("[v0] Failed to fetch existing customers:", fetchError.message)
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
    console.log("[v0] Found", existingMap.size, "existing customers in DB")

    // Categorize into insert vs update vs skip
    const toInsert: CustomerRow[] = []
    const toUpdate: { id: string; data: CustomerRow }[] = []
    let skipped = 0
    const seenInBatch = new Set<string>()

    for (const customer of customers) {
      const key = customer.company_name.toLowerCase().trim()

      // Skip duplicate entries within the same CSV file
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

    console.log("[v0] To insert:", toInsert.length, "| To update:", toUpdate.length, "| Skipped:", skipped)

    // ── BATCH INSERT new customers ──
    let inserted = 0
    let insertErrors = 0
    const BATCH_SIZE = 25 // smaller batches = more reliable

    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE)
      const { data: insertData, error: insertError } = await supabase
        .from("customers")
        .insert(batch)
        .select("id")

      if (insertError) {
        console.error(`[v0] Batch insert error at offset ${i}:`, insertError.message)
        // Fall back to one-by-one inserts to salvage what we can
        for (const single of batch) {
          const { error: singleErr } = await supabase
            .from("customers")
            .insert(single)
            .select("id")
          if (singleErr) {
            insertErrors++
            console.error(`[v0] Single insert error for "${single.company_name}":`, singleErr.message)
          } else {
            inserted++
          }
        }
      } else {
        inserted += insertData?.length || batch.length
      }
    }

    // ── UPDATE existing customers ──
    let updated = 0
    let updateErrors = 0

    for (const { id, data } of toUpdate) {
      const { company_name: _cn, ...updateData } = data
      void _cn // intentionally unused
      const { error: updateError } = await supabase
        .from("customers")
        .update(updateData)
        .eq("id", id)

      if (updateError) {
        updateErrors++
        console.error(`[v0] Update error for "${data.company_name}":`, updateError.message)
      } else {
        updated++
      }
    }

    console.log("[v0] Import complete. Inserted:", inserted, "Updated:", updated, "Errors:", insertErrors + updateErrors)

    return NextResponse.json({
      success: true,
      total_rows: rows.length,
      parsed: customers.length,
      inserted,
      updated,
      skipped,
      errors: parseErrors.length + insertErrors + updateErrors,
      details: {
        parse_errors: parseErrors.length,
        insert_errors: insertErrors,
        update_errors: updateErrors,
        parse_error_details: parseErrors.slice(0, 10), // first 10 for debugging
      },
    })
  } catch (err) {
    console.error("[v0] Unexpected import error:", err)
    return NextResponse.json(
      { error: `Import failed: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 500 }
    )
  }
}
