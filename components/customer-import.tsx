"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Upload,
  X,
  FileText,
  Loader2,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  SkipForward,
} from "lucide-react"

interface Props {
  onClose: () => void
  onImported: () => void
}

type DuplicateMode = "skip" | "update"

interface ImportResult {
  success: boolean
  total_rows: number
  parsed: number
  inserted: number
  updated: number
  skipped: number
  errors: number
  error?: string
  details?: {
    parse_errors: number
    insert_errors: number
    update_errors: number
  }
}

// Client-side CSV row counter (just for preview -- real parsing happens server-side)
function quickParsePreview(text: string): { rowCount: number; preview: string[][] } {
  const lines = text.split("\n").filter((l) => l.trim())
  if (lines.length < 2) return { rowCount: 0, preview: [] }

  // Simple split for preview only (the server handles proper parsing)
  const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim())
  const nameIdx = headers.findIndex(
    (h) => h.toLowerCase() === "name" || h.toLowerCase() === "company name"
  )
  const emailIdx = headers.findIndex(
    (h) => h.toLowerCase() === "email" || h.toLowerCase() === "e-mail"
  )
  const phoneIdx = headers.findIndex(
    (h) => h.toLowerCase() === "phone" || h.toLowerCase() === "main phone"
  )

  const preview: string[][] = []
  const maxPreview = Math.min(lines.length, 8) // show up to 7 data rows
  for (let i = 1; i < maxPreview; i++) {
    const cells = lines[i].split(",").map((c) => c.replace(/"/g, "").trim())
    preview.push([
      cells[nameIdx] || cells[0] || "?",
      emailIdx >= 0 ? cells[emailIdx] || "" : "",
      phoneIdx >= 0 ? cells[phoneIdx] || "" : "",
    ])
  }

  return { rowCount: lines.length - 1, preview }
}

export function CustomerImportModal({ onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [rowCount, setRowCount] = useState(0)
  const [preview, setPreview] = useState<string[][]>([])
  const [importing, setImporting] = useState(false)
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>("skip")
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errorMsg, setErrorMsg] = useState("")

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setResult(null)
    setErrorMsg("")

    // Quick preview (just for the UI -- server does real parsing)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const { rowCount: count, preview: prev } = quickParsePreview(text)
      setRowCount(count)
      setPreview(prev)
    }
    reader.readAsText(f)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (!f) return
    // Trigger the same flow as file input
    const dt = new DataTransfer()
    dt.items.add(f)
    if (fileRef.current) {
      fileRef.current.files = dt.files
      fileRef.current.dispatchEvent(new Event("change", { bubbles: true }))
    }
    // Also set directly
    setFile(f)
    setResult(null)
    setErrorMsg("")
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const { rowCount: count, preview: prev } = quickParsePreview(text)
      setRowCount(count)
      setPreview(prev)
    }
    reader.readAsText(f)
  }

  const handleImport = async () => {
    if (!file) return
    setImporting(true)
    setErrorMsg("")
    setResult(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("duplicateMode", duplicateMode)

      const resp = await fetch("/api/customers/import", {
        method: "POST",
        body: formData,
      })

      const data: ImportResult = await resp.json()

      if (!resp.ok) {
        setErrorMsg(data.error || `Server error (${resp.status})`)
        setImporting(false)
        return
      }

      setResult(data)
      setImporting(false)

      if (data.inserted > 0 || data.updated > 0) {
        setTimeout(() => onImported(), 1500)
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error -- could not reach server.")
      setImporting(false)
    }
  }

  const hasResults = result && (result.inserted > 0 || result.updated > 0)

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !importing) onClose()
      }}
    >
      <Card className="w-full max-w-lg border-border shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Customers from QuickBooks CSV
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={importing}
              className="h-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground text-pretty">
            Export your Customer Contact List from QuickBooks Online as CSV
            and upload it here. Duplicates are detected by company name.
          </p>

          {/* File picker / drop zone */}
          <div
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleFile}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-foreground">{file.name}</span>
                <Badge variant="secondary" className="text-xs">
                  ~{rowCount} rows
                </Badge>
              </div>
            ) : (
              <div>
                <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Click or drag a CSV file here
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Supports QuickBooks Online Customer Contact List export
                </p>
              </div>
            )}
          </div>

          {/* Duplicate handling */}
          {file && !result && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground">
                If a customer already exists:
              </p>
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
          {preview.length > 0 && !result && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 max-h-48 overflow-y-auto">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                Preview (first {preview.length} rows)
              </p>
              {preview.map((row, i) => (
                <div
                  key={i}
                  className="text-xs text-foreground py-1.5 border-b border-border last:border-0 flex items-baseline gap-2"
                >
                  <span className="font-medium truncate flex-1">{row[0]}</span>
                  {row[1] && (
                    <span className="text-muted-foreground text-[11px] truncate max-w-[160px]">
                      {row[1]}
                    </span>
                  )}
                  {!row[1] && row[2] && (
                    <span className="text-muted-foreground text-[11px]">{row[2]}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {errorMsg && (
            <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-400">{errorMsg}</p>
            </div>
          )}

          {/* Importing progress */}
          {importing && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>
                Importing {rowCount} customers... This may take a moment for large files.
              </span>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="rounded-lg border border-border p-4 flex flex-col gap-2">
              <div className="flex items-center gap-3">
                {result.errors > 0 && !hasResults ? (
                  <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">Import complete</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    {result.inserted > 0 && (
                      <span className="text-xs text-green-600 dark:text-green-400">
                        {result.inserted} new customers added
                      </span>
                    )}
                    {result.updated > 0 && (
                      <span className="text-xs text-blue-600 dark:text-blue-400">
                        {result.updated} updated
                      </span>
                    )}
                    {result.skipped > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {result.skipped} skipped (duplicates)
                      </span>
                    )}
                    {result.errors > 0 && (
                      <span className="text-xs text-red-600 dark:text-red-400">
                        {result.errors} errors
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Processed {result.total_rows} CSV rows, parsed {result.parsed} valid customers
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {!result ? (
              <Button
                size="sm"
                className="gap-1.5 text-xs h-9"
                onClick={handleImport}
                disabled={importing || !file}
              >
                {importing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" />
                    Import{rowCount > 0 ? ` ~${rowCount} Customers` : ""}
                  </>
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                className="gap-1.5 text-xs h-9"
                onClick={() => {
                  setFile(null)
                  setRowCount(0)
                  setPreview([])
                  setResult(null)
                  setErrorMsg("")
                  if (fileRef.current) fileRef.current.value = ""
                }}
              >
                Import Another File
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-9"
              onClick={onClose}
              disabled={importing}
            >
              {result ? "Close" : "Cancel"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
