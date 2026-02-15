"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Upload, X, FileText, Loader2, CheckCircle, AlertTriangle } from "lucide-react"

interface Props {
  onClose: () => void
  onImported: () => void
}

// Minimal CSV parser
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []

  const headers = parseLine(lines[0])
  return lines.slice(1).map((line) => {
    const vals = parseLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h.trim()] = (vals[i] || "").trim()
    })
    return row
  })
}

function parseLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (c === '"') {
        inQuotes = false
      } else {
        current += c
      }
    } else {
      if (c === '"') {
        inQuotes = true
      } else if (c === ",") {
        result.push(current)
        current = ""
      } else {
        current += c
      }
    }
  }
  result.push(current)
  return result
}

// QB Online CSV headers mapped to our DB columns
const FIELD_MAP: Record<string, string> = {
  "Name": "contact_name",
  "Company": "company_name",
  "company": "company_name",
  "company_name": "company_name",
  "Email": "email",
  "email": "email",
  "Phone": "office_phone",
  "phone": "office_phone",
  "office_phone": "office_phone",
  "Mobile": "cell_phone",
  "mobile": "cell_phone",
  "cell_phone": "cell_phone",
  "Website": "website",
  "website": "website",
  "Street": "street",
  "street": "street",
  "City": "city",
  "city": "city",
  "State": "state",
  "state": "state",
  "PostalCode": "postal_code",
  "postal_code": "postal_code",
  "Zip": "postal_code",
  "Country": "country",
  "country": "country",
  "Notes": "notes",
  "notes": "notes",
  "contact_name": "contact_name",
}

export function CustomerImportModal({ onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [fileName, setFileName] = useState("")
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ success: number; errors: number } | null>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setRows(parseCSV(text))
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    setImporting(true)
    let success = 0
    let errors = 0

    for (const row of rows) {
      const customer: Record<string, string | boolean> = {
        billing_same_as_primary: true,
      }

      for (const [csvKey, value] of Object.entries(row)) {
        const dbField = FIELD_MAP[csvKey]
        if (dbField && value) {
          customer[dbField] = value
        }
      }

      // Require company_name
      if (!customer.company_name) {
        // Try to use contact_name as company_name if no company
        if (customer.contact_name) {
          customer.company_name = customer.contact_name as string
        } else {
          errors++
          continue
        }
      }

      try {
        const res = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(customer),
        })
        if (res.ok) success++
        else errors++
      } catch {
        errors++
      }
    }

    setResult({ success, errors })
    setImporting(false)
    if (success > 0) {
      setTimeout(() => onImported(), 1500)
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
            Upload a CSV file exported from QuickBooks Online or any spreadsheet. Supported columns:
            Name, Company, Email, Phone, Mobile, Website, Street, City, State, PostalCode, Country, Notes.
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

          {/* Preview */}
          {rows.length > 0 && !result && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 max-h-48 overflow-y-auto">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Preview (first 5 rows)</p>
              {rows.slice(0, 5).map((row, i) => (
                <div key={i} className="text-xs text-foreground py-1 border-b border-border last:border-0">
                  <span className="font-medium">{row.Company || row.company_name || row.Name || "?"}</span>
                  {(row.Email || row.email) && (
                    <span className="text-muted-foreground ml-2">{row.Email || row.email}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="rounded-lg border border-border p-4 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Import complete</p>
                <p className="text-xs text-muted-foreground">
                  {result.success} imported successfully
                  {result.errors > 0 && `, ${result.errors} failed`}
                </p>
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
