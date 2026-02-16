"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Upload, X, FileText, Loader2, CheckCircle, AlertTriangle, RefreshCw, SkipForward } from "lucide-react"
import { createClient, supabaseClientReady } from "@/lib/supabase/client"

interface Props {
  onClose: () => void
  onImported: () => void
}

// Robust CSV parser that handles multiline quoted fields (QB Online exports
// addresses with embedded line breaks inside double-quoted cells).
function parseCSV(text: string): Record<string, string>[] {
  const records: string[][] = []
  let current: string[] = []
  let cell = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        // Collapse embedded newlines to a single space for clean display
        cell += c === "\r" ? "" : c === "\n" ? " " : c
      }
    } else {
      if (c === '"') {
        inQuotes = true
      } else if (c === ",") {
        current.push(cell)
        cell = ""
      } else if (c === "\n" || (c === "\r" && text[i + 1] === "\n")) {
        if (c === "\r") i++ // skip \r in \r\n
        current.push(cell)
        cell = ""
        if (current.some((v) => v.trim())) records.push(current)
        current = []
      } else if (c !== "\r") {
        cell += c
      }
    }
  }
  // Flush last record
  current.push(cell)
  if (current.some((v) => v.trim())) records.push(current)

  if (records.length < 2) return []

  const headers = records[0].map((h) => h.trim())
  return records.slice(1).map((vals) => {
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = (vals[i] || "").trim()
    })
    return row
  })
}

// QB Online CSV headers mapped to our DB columns
const FIELD_MAP: Record<string, string> = {
  "name": "contact_name",
  "company": "company_name",
  "company name": "company_name",
  "company_name": "company_name",
  "email": "email",
  "e-mail": "email",
  "phone": "office_phone",
  "office_phone": "office_phone",
  "mobile": "cell_phone",
  "cell_phone": "cell_phone",
  "website": "website",
  "street": "street",
  "street address": "street",
  "address": "street",
  "billing street": "street",
  "city": "city",
  "state": "state",
  "state/province": "state",
  "postalcode": "postal_code",
  "postal_code": "postal_code",
  "zip": "postal_code",
  "zip code": "postal_code",
  "country": "country",
  "notes": "notes",
  "contact_name": "contact_name",
  "customer type": "customer_type_qb",
  "open balance": "open_balance_qb",
}

type DuplicateMode = "skip" | "update"

interface ImportResult {
  inserted: number
  updated: number
  skipped: number
  errors: number
}

export function CustomerImportModal({ onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [fileName, setFileName] = useState("")
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState("")
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>("skip")
  const [result, setResult] = useState<ImportResult | null>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setRows(parseCSV(text))
    }
    reader.readAsText(file)
  }

  // Build a customer record from a CSV row
  function buildCustomer(row: Record<string, string>) {
    const customer: Record<string, string | boolean | Record<string, string>> = {
      billing_same_as_primary: true,
    }
    const extras: Record<string, string> = {}

    for (const [csvKey, value] of Object.entries(row)) {
      if (!value) continue
      const dbField = FIELD_MAP[csvKey.toLowerCase().trim()]
      if (!dbField) continue
      if (dbField === "customer_type_qb") {
        extras["QB Customer Type"] = value
      } else if (dbField === "open_balance_qb") {
        const parsed = parseFloat(value.replace(/[,"]/g, ""))
        if (parsed !== 0) extras["QB Open Balance"] = value.replace(/"/g, "")
      } else {
        customer[dbField] = value
      }
    }

    if (Object.keys(extras).length > 0) {
      customer.custom_fields = extras
    }

    if (!customer.company_name) {
      if (customer.contact_name) {
        customer.company_name = customer.contact_name as string
      } else {
        return null // skip rows with no name at all
      }
    }
    return customer
  }

  const handleImport = async () => {
    setImporting(true)
    setProgress("Preparing...")

    if (!supabaseClientReady()) {
      setResult({ inserted: 0, updated: 0, skipped: 0, errors: rows.length })
      setImporting(false)
      return
    }

    const supabase = createClient()

    // Step 1: fetch all existing customer names for duplicate detection
    setProgress("Checking for existing customers...")
    const { data: existing } = await supabase
      .from("customers")
      .select("id, company_name")

    const existingMap = new Map<string, string>() // lowered name -> id
    if (existing) {
      for (const c of existing) {
        if (c.company_name) {
          existingMap.set(c.company_name.toLowerCase().trim(), c.id)
        }
      }
    }

    // Step 2: categorize rows
    const toInsert: Record<string, unknown>[] = []
    const toUpdate: { id: string; data: Record<string, unknown> }[] = []
    let skipped = 0
    let errors = 0

    for (const row of rows) {
      const customer = buildCustomer(row)
      if (!customer) { errors++; continue }

      const key = (customer.company_name as string).toLowerCase().trim()
      const existingId = existingMap.get(key)

      if (existingId) {
        if (duplicateMode === "update") {
          toUpdate.push({ id: existingId, data: customer })
        } else {
          skipped++
        }
      } else {
        toInsert.push(customer)
        // Mark as "existing" so we don't try to insert the same new name twice
        existingMap.set(key, "pending")
      }
    }

    // Step 3: batch insert new customers
    let inserted = 0
    const BATCH_SIZE = 100
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE)
      setProgress(`Inserting ${i + 1}-${Math.min(i + BATCH_SIZE, toInsert.length)} of ${toInsert.length}...`)
      try {
        const { data, error: insertError } = await supabase
          .from("customers")
          .insert(batch)
          .select("id")
        if (!insertError && data) {
          inserted += data.length
        } else {
          errors += batch.length
        }
      } catch {
        errors += batch.length
      }
    }

    // Step 4: update existing customers (if mode = update)
    let updated = 0
    for (let i = 0; i < toUpdate.length; i++) {
      const { id, data } = toUpdate[i]
      if (i % 10 === 0) {
        setProgress(`Updating ${i + 1} of ${toUpdate.length}...`)
      }
      try {
        const { error: updateError } = await supabase
          .from("customers")
          .update(data)
          .eq("id", id)
        if (!updateError) {
          updated++
        } else {
          errors++
        }
      } catch {
        errors++
      }
    }

    setResult({ inserted, updated, skipped, errors })
    setImporting(false)
    setProgress("")
    if (inserted > 0 || updated > 0) {
      setTimeout(() => onImported(), 2000)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <Card className="w-full max-w-lg border-border shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Customers from CSV
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground text-pretty">
            Upload a CSV exported from QuickBooks Online. Safe to re-import -- duplicates are
            detected by company name and handled based on your choice below.
          </p>

          {/* File picker */}
          <div
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
            {fileName ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-foreground">{fileName}</span>
                <Badge variant="secondary" className="text-xs">{rows.length} rows</Badge>
              </div>
            ) : (
              <div>
                <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Click to select a CSV file</p>
              </div>
            )}
          </div>

          {/* Duplicate handling */}
          {rows.length > 0 && !result && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground">If a customer already exists:</p>
              <div className="flex gap-2">
                <Button
                  variant={duplicateMode === "skip" ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5 text-xs h-8 flex-1"
                  onClick={() => setDuplicateMode("skip")}
                >
                  <SkipForward className="h-3.5 w-3.5" />
                  Skip duplicates
                </Button>
                <Button
                  variant={duplicateMode === "update" ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5 text-xs h-8 flex-1"
                  onClick={() => setDuplicateMode("update")}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Update existing
                </Button>
              </div>
            </div>
          )}

          {/* Preview */}
          {rows.length > 0 && !result && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 max-h-48 overflow-y-auto">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Preview (first 5 rows)</p>
              {rows.slice(0, 5).map((row, i) => {
                const name = row["Company name"] || row["Company"] || row["company_name"] || row["Name"] || "?"
                const email = row["Email"] || row["email"] || ""
                const phone = row["Phone"] || row["phone"] || ""
                return (
                  <div key={i} className="text-xs text-foreground py-1.5 border-b border-border last:border-0 flex items-baseline gap-2">
                    <span className="font-medium truncate flex-1">{name}</span>
                    {email && <span className="text-muted-foreground text-[11px] truncate max-w-[160px]">{email}</span>}
                    {!email && phone && <span className="text-muted-foreground text-[11px]">{phone}</span>}
                  </div>
                )
              })}
            </div>
          )}

          {/* Progress */}
          {importing && progress && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {progress}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="rounded-lg border border-border p-4 flex flex-col gap-2">
              <div className="flex items-center gap-3">
                {result.errors > 0 && result.inserted === 0 && result.updated === 0 ? (
                  <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">Import complete</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    {result.inserted > 0 && (
                      <span className="text-xs text-green-600 dark:text-green-400">
                        {result.inserted} new
                      </span>
                    )}
                    {result.updated > 0 && (
                      <span className="text-xs text-blue-600 dark:text-blue-400">
                        {result.updated} updated
                      </span>
                    )}
                    {result.skipped > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {result.skipped} skipped (already exist)
                      </span>
                    )}
                    {result.errors > 0 && (
                      <span className="text-xs text-red-600 dark:text-red-400">
                        {result.errors} errors
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              size="sm"
              className="gap-1.5 text-xs h-9"
              onClick={handleImport}
              disabled={importing || rows.length === 0 || !!result}
            >
              {importing ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" />Importing...</>
              ) : (
                <><Upload className="h-3.5 w-3.5" />Import {rows.length} Customer{rows.length !== 1 ? "s" : ""}</>
              )}
            </Button>
            <Button variant="ghost" size="sm" className="text-xs h-9" onClick={onClose}>
              {result ? "Close" : "Cancel"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
