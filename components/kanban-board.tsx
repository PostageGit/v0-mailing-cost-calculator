"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { formatCurrency } from "@/lib/pricing"
import { getCategoryLabel, type QuoteCategory } from "@/lib/quote-types"
import { buildQuoteText } from "@/lib/build-quote-text"
import { cn } from "@/lib/utils"
import {
  FileText, Trash2, ArrowRight, ArrowLeft,
  Pencil, Clock, Loader2, X, Save, ClipboardCopy, Check,
  Plus, Settings2, CalendarDays, Briefcase, AlertCircle,
  Search, Archive, ArchiveRestore, ChevronDown, ChevronLeft, ChevronRight,
  Paperclip, Upload, File, FileImage, FileSpreadsheet, Download,
  Hash, GripVertical, Copy,
} from "lucide-react"

/* ── Types ── */

interface QuoteItem {
  id: number; category: QuoteCategory; label: string; description: string; amount: number
}
interface BoardColumn {
  id: string; title: string; color: string; sort_order: number; board_type?: string
}
interface JobMeta {
  piece_desc?: string; insert_count?: number; inserts_desc?: string
  mailing_class?: string; drop_off?: string; international?: boolean
  printed_by?: string; vendor_name?: string; vendor_job?: string; prints_arrived?: boolean
  bcc_done?: boolean; paperwork_done?: boolean; folder_archived?: boolean; job_mailed?: boolean
  invoice_updated?: boolean; invoice_emailed?: boolean; paid_postage?: boolean; paid_full?: boolean
  assignee?: string; due_date?: string
}
interface Quote {
  id: string; project_name: string; status: string; column_id: string | null
  items: QuoteItem[]; total: number; notes: string | null
  quote_number: number | null; mailing_date: string | null; quantity?: number
  customer_id?: string | null; contact_name?: string | null
  reference_number?: string | null
  lights: Record<string, string> | null
  is_job?: boolean; converted_at?: string | null
  archived?: boolean; archived_at?: string | null
  job_meta?: JobMeta
  created_at: string; updated_at: string
}

const fetcher = async (url: string) => {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Fetch failed: ${r.status}`)
  const json = await r.json()
  if (json && typeof json === "object" && "error" in json && !Array.isArray(json)) throw new Error(json.error)
  return json
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function matchesSearch(q: Quote, term: string): boolean {
  if (!term) return true
  const s = term.toLowerCase()
  return (
    (q.project_name || "").toLowerCase().includes(s) ||
    (q.contact_name || "").toLowerCase().includes(s) ||
    (q.reference_number || "").toLowerCase().includes(s) ||
    (q.notes || "").toLowerCase().includes(s) ||
    (q.status || "").toLowerCase().includes(s) ||
    (q.quote_number ? `q-${q.quote_number}`.includes(s) : false) ||
    (q.quote_number ? `${q.quote_number}`.includes(s) : false) ||
    formatCurrency(q.total).toLowerCase().includes(s) ||
    (q.job_meta?.assignee || "").toLowerCase().includes(s) ||
    (q.job_meta?.piece_desc || "").toLowerCase().includes(s) ||
    (q.job_meta?.printed_by || "").toLowerCase().includes(s) ||
    (q.items || []).some((it) => it.label.toLowerCase().includes(s) || it.description.toLowerCase().includes(s))
  )
}

function groupByCategory(items: QuoteItem[]) {
  const groups: Record<string, { items: QuoteItem[]; total: number }> = {}
  for (const it of items) {
    if (!groups[it.category]) groups[it.category] = { items: [], total: 0 }
    groups[it.category].items.push(it)
    groups[it.category].total += it.amount
  }
  return groups
}

function sectionDone(meta: JobMeta | undefined, keys: (keyof JobMeta)[]) {
  if (!meta) return false
  return keys.every((k) => !!meta[k])
}

/** Derives job_meta field values from a quote's line items as fallback display values */
function deriveMetaFromItems(quote: Quote): JobMeta {
  const items: QuoteItem[] = quote.items || []
  const derived: JobMeta = {}

  // Printing items (flat, booklet, etc) contain piece descriptions
  const printItems = items.filter((it) => ["flat", "booklet", "spiral", "perfect"].includes(it.category))
  if (printItems.length > 0) {
    const desc = printItems[0].description || printItems[0].label || ""
    const sizeMatch = desc.match(/(\d+\.?\d*)\s*[xX×]\s*(\d+\.?\d*)/i)
    const sizeStr = sizeMatch ? `${sizeMatch[1]}x${sizeMatch[2]}` : ""
    const typeHints = ["Postcard", "Flat Card", "Folded Card", "Booklet", "Letter", "Self-Mailer", "Spiral", "Perfect Bound"]
    const foundType = typeHints.find((t) => desc.toLowerCase().includes(t.toLowerCase()))
    const fallbackType = printItems[0].label?.split(" - ").pop()?.split(",")[0]?.trim() || ""
    derived.piece_desc = sizeStr && (foundType || fallbackType) ? `${sizeStr} ${foundType || fallbackType}` : (sizeStr || foundType || fallbackType || desc.split(",")[0]?.trim() || "")
  }

  // Inserts: additional printing items beyond the first
  if (printItems.length > 1) {
    derived.insert_count = printItems.length - 1
    const insertDescs = printItems.slice(1).map((it) => {
      const d = it.description || it.label || ""
      const m = d.match(/(\d+\.?\d*)\s*[xX×]\s*(\d+\.?\d*)/)
      return m ? `${m[1]}x${m[2]}` : d.split(",")[0]?.trim() || ""
    }).filter(Boolean)
    if (insertDescs.length > 0) derived.inserts_desc = insertDescs.join(" + ")
  }

  // Postage items contain mailing class
  const postageItems = items.filter((it) => it.category === "postage")
  if (postageItems.length > 0) {
    const pDesc = postageItems[0].description || postageItems[0].label || ""
    const classHints = ["First Class", "1st Class", "Standard", "Marketing", "Non-Profit", "Priority", "Presorted", "Letter Class"]
    const foundClass = classHints.find((c) => pDesc.toLowerCase().includes(c.toLowerCase()))
    derived.mailing_class = foundClass || pDesc.split(",")[0]?.replace(/Postage\s*[-–]\s*/i, "").replace(/USPS\s*/i, "").trim() || ""
  }

  // OHP items: vendor name is in .description ("PrintOut | +15% markup"), piece info in .label ("OHP: 5,750 - 2.5x6.5 Postcard")
  const ohpItems = items.filter((it) => it.category === "ohp")
  if (ohpItems.length > 0) {
    // Extract vendor name from description: "PrintOut | +15% markup" -> "PrintOut"
    const ohpDesc = ohpItems[0].description || ""
    const vendorFromDesc = ohpDesc.split("|")[0]?.trim()
    if (vendorFromDesc) {
      derived.vendor_name = vendorFromDesc
    }
    derived.printed_by = "Out of House"

    // If no piece_desc yet, try to get it from OHP label: "OHP: 5,750 - 2.5" x 6.5" Postcard"
    if (!derived.piece_desc) {
      const ohpLabel = ohpItems[0].label || ""
      const afterOHP = ohpLabel.replace(/^OHP[:\s]*/i, "").trim()
      // Try to extract size from the label
      const sizeM = afterOHP.match(/(\d+\.?\d*)\s*[""]?\s*[xX×]\s*(\d+\.?\d*)\s*[""]?/)
      if (sizeM) {
        const afterSize = afterOHP.substring(afterOHP.indexOf(sizeM[0]) + sizeM[0].length).trim()
        const pieceType = afterSize.split(",")[0]?.trim() || ""
        derived.piece_desc = `${sizeM[1]}x${sizeM[2]}${pieceType ? " " + pieceType : ""}`
      }
    }
  } else if (printItems.length > 0) {
    derived.printed_by = "In-House"
  }

  return derived
}

/* ════════════════════════════════════════════════════
   HELPERS: Field, Select, Checkbox, Overdue
   ════════════════════════════════════════════════════ */

function FieldInput({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  const [local, setLocal] = useState(value)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { setLocal(value) }, [value])
  const commit = () => { if (local !== value) onChange(local) }

  return (
    <div className="min-w-0">
      <span className="text-[10px] text-muted-foreground font-medium mb-1 block">{label}</span>
      <input ref={ref} type={type} value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { commit(); ref.current?.blur() } }}
        placeholder={placeholder || label}
        className="w-full text-xs font-medium text-foreground bg-background border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-ring/30 focus:border-foreground/30 transition-all placeholder:text-muted-foreground/30"
      />
    </div>
  )
}

function FieldSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]
}) {
  return (
    <div className="min-w-0">
      <span className="text-[10px] text-muted-foreground font-medium mb-1 block">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full text-xs font-medium text-foreground bg-background border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-ring/30 focus:border-foreground/30 transition-all appearance-none cursor-pointer"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2364748b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", paddingRight: "24px" }}
      >
        <option value="">--</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function MetaCheck({ label, checked, onChange, bold }: {
  label: string; checked: boolean; onChange: (c: boolean) => void; bold?: boolean
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group/chk py-0.5">
      <Checkbox checked={checked} onCheckedChange={(c) => onChange(!!c)} className="h-4 w-4 rounded data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500" />
      <span className={cn("text-[11px] transition-colors select-none", bold ? "font-bold text-foreground" : "font-medium text-muted-foreground", checked && "text-emerald-600 dark:text-emerald-400")}>
        {label}
      </span>
    </label>
  )
}

function isOverdue(meta: JobMeta) {
  if (!meta.due_date) return false
  return new Date(meta.due_date) < new Date()
}
function daysOverdue(meta: JobMeta) {
  if (!meta.due_date) return 0
  return Math.ceil((Date.now() - new Date(meta.due_date).getTime()) / 86400000)
}

/* ════════════════════════════════════════════════════
   FILE PANEL (Full folder view)
   ════════════════════════════════════════════════════ */

interface JobFile {
  id: string; quote_id: string; blob_url: string; filename: string; size: number; mime_type: string | null; uploaded_at: string
}

function fileIconLg(mime: string | null, size: "sm" | "lg" = "sm") {
  const cls = size === "lg" ? "h-8 w-8" : "h-3.5 w-3.5"
  if (!mime) return <File className={cls} />
  if (mime.startsWith("image/")) return <FileImage className={cls} />
  if (mime.includes("pdf")) return <FileText className={cls} />
  if (mime.includes("sheet") || mime.includes("csv") || mime.includes("excel")) return <FileSpreadsheet className={cls} />
  return <File className={cls} />
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / 1048576).toFixed(1)}MB`
}

function fmtDateFull(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
}

function useJobFiles(quoteId: string) {
  const { data, mutate, isLoading } = useSWR<JobFile[]>(`/api/job-files?quote_id=${quoteId}`, fetcher)
  return { files: data || [], refreshFiles: mutate, isLoading }
}

/** Inline file count badge + quick drop in the card */
function JobFilesInline({ quoteId, onOpenPanel }: { quoteId: string; onOpenPanel: () => void }) {
  const { files, refreshFiles } = useJobFiles(quoteId)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const uploadFiles = async (fileList: FileList | File[]) => {
    setUploading(true)
    try {
      for (const file of Array.from(fileList)) {
        const fd = new FormData()
        fd.append("file", file)
        fd.append("quote_id", quoteId)
        await fetch("/api/job-files", { method: "POST", body: fd })
      }
      refreshFiles()
    } finally { setUploading(false) }
  }

  return (
    <div className="border-t border-border/50 pt-2">
      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = "" }} />
      <div
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(true) }}
        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(true) }}
        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(false) }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(false); if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files) }}
        className={cn(
          "rounded-md border border-dashed transition-all flex items-center gap-2 px-2.5 py-1.5",
          dragging ? "border-foreground/30 bg-foreground/[0.03]" : "border-border/40",
          uploading && "opacity-60"
        )}
      >
        {uploading ? (
          <div className="flex items-center gap-1.5 flex-1">
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Uploading...</span>
          </div>
        ) : (
          <>
            <Paperclip className="h-3 w-3 text-muted-foreground/50 shrink-0" />
            <button onClick={onOpenPanel} className="flex items-center gap-1 flex-1 min-w-0 text-left">
              <span className="text-[10px] font-medium text-foreground">{files.length > 0 ? `${files.length} file${files.length > 1 ? "s" : ""}` : "No files"}</span>
              {files.length > 0 && (
                <span className="text-[9px] text-muted-foreground truncate">
                  - {files.slice(0, 2).map((f) => f.filename).join(", ")}{files.length > 2 ? ` +${files.length - 2}` : ""}
                </span>
              )}
            </button>
            <button onClick={onOpenPanel}
              className="text-[9px] text-muted-foreground hover:text-foreground font-medium shrink-0 transition-colors">
              Open
            </button>
            <button onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}
              className="text-[9px] text-muted-foreground hover:text-foreground font-medium shrink-0 flex items-center gap-0.5 transition-colors">
              <Upload className="h-2.5 w-2.5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/** Full file folder panel (overlay) */
function JobFilesPanel({ quoteId, projectName, onClose }: { quoteId: string; projectName: string; onClose: () => void }) {
  const { files, refreshFiles, isLoading } = useJobFiles(quoteId)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [preview, setPreview] = useState<JobFile | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const uploadFiles = async (fileList: FileList | File[]) => {
    setUploading(true)
    try {
      for (const file of Array.from(fileList)) {
        const fd = new FormData()
        fd.append("file", file)
        fd.append("quote_id", quoteId)
        await fetch("/api/job-files", { method: "POST", body: fd })
      }
      refreshFiles()
    } finally { setUploading(false) }
  }

  const deleteFile = async (id: string) => {
    setDeleting(id)
    await fetch(`/api/job-files/${id}`, { method: "DELETE" })
    refreshFiles()
    setDeleting(null)
    if (preview?.id === id) setPreview(null)
  }

  const isImage = (f: JobFile) => f.mime_type?.startsWith("image/")
  const totalSize = files.reduce((s, f) => s + f.size, 0)

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-card border-l border-border shadow-2xl flex flex-col h-full animate-in slide-in-from-right-8 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-foreground truncate">{projectName || "Job"} Files</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">{files.length} file{files.length !== 1 ? "s" : ""} &middot; {fmtSize(totalSize)}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} className="h-7 text-[10px] gap-1 font-medium">
              <Upload className="h-3 w-3" /> Upload
            </Button>
            <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-secondary transition-colors">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = "" }} />

        {/* Drop zone + File list */}
        <div
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(true) }}
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(true) }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(false) }}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(false); if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files) }}
          className={cn("flex-1 overflow-y-auto p-4 transition-colors", dragging && "bg-foreground/[0.02]")}
        >
          {/* Upload state */}
          {uploading && (
            <div className="flex items-center justify-center gap-2 py-6 mb-4 rounded-xl border border-dashed border-border bg-secondary/30">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">Uploading files...</span>
            </div>
          )}

          {/* Drag overlay */}
          {dragging && (
            <div className="flex flex-col items-center justify-center gap-2 py-10 mb-4 rounded-xl border-2 border-dashed border-foreground/20 bg-foreground/[0.02]">
              <Upload className="h-6 w-6 text-muted-foreground/50" />
              <span className="text-xs text-muted-foreground font-medium">Drop files to upload</span>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && files.length === 0 && !uploading && !dragging && (
            <button onClick={() => inputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 py-16 w-full rounded-xl border border-dashed border-border/60 hover:border-border hover:bg-secondary/20 transition-all cursor-pointer">
              <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
                <Upload className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-foreground">Drop files here or click to upload</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">PDF, images, spreadsheets, documents</p>
              </div>
            </button>
          )}

          {/* File grid */}
          {files.length > 0 && (
            <div className="flex flex-col gap-1">
              {files.map((f) => (
                <div key={f.id} className={cn(
                  "group/f flex items-center gap-3 px-3 py-2 rounded-lg border border-transparent hover:border-border hover:bg-secondary/30 transition-all",
                  deleting === f.id && "opacity-40 pointer-events-none"
                )}>
                  {/* Thumbnail / Icon */}
                  {isImage(f) ? (
                    <button onClick={() => setPreview(f)} className="h-10 w-10 rounded-md overflow-hidden bg-secondary shrink-0 border border-border/50 hover:ring-2 hover:ring-ring transition-all">
                      <img src={f.blob_url} alt={f.filename} className="h-full w-full object-cover" crossOrigin="anonymous" />
                    </button>
                  ) : (
                    <button onClick={() => window.open(f.blob_url, "_blank")}
                      className="h-10 w-10 rounded-md bg-secondary flex items-center justify-center shrink-0 border border-border/50 text-muted-foreground hover:text-foreground transition-colors">
                      {fileIconLg(f.mime_type, "lg")}
                    </button>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{f.filename}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5 tabular-nums">
                      {fmtSize(f.size)} &middot; {fmtDateFull(f.uploaded_at)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover/f:opacity-100 transition-opacity shrink-0">
                    {isImage(f) && (
                      <button onClick={() => setPreview(f)}
                        className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary" title="Preview">
                        <FileImage className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <a href={f.blob_url} download={f.filename}
                      className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary" title="Download">
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    <button onClick={() => deleteFile(f.id)}
                      className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer drop hint */}
        <div className="px-4 py-2 border-t border-border shrink-0">
          <p className="text-[9px] text-muted-foreground/50 text-center">Drag and drop files anywhere in this panel to upload</p>
        </div>
      </div>

      {/* Image preview lightbox */}
      {preview && (
        <div className="fixed inset-0 z-[60] bg-background/90 backdrop-blur-md flex items-center justify-center p-8"
          onClick={() => setPreview(null)}>
          <button onClick={() => setPreview(null)} className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 text-foreground">
            <X className="h-4 w-4" />
          </button>
          <div className="flex flex-col items-center gap-3 max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <img src={preview.blob_url} alt={preview.filename} className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-2xl" crossOrigin="anonymous" />
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">{preview.filename}</span>
              <span className="text-xs text-muted-foreground">{fmtSize(preview.size)}</span>
              <a href={preview.blob_url} download={preview.filename}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors">
                <Download className="h-3 w-3" /> Download
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════
   POSTFLOW TOGGLE CARD
   ════════════════════════════════════════════════════ */

function QuoteCard({
  quote, columns, onColumnChange, onDelete, onArchive, onRestore, onEdit, onConvertToJob, onPatch, boardType, isArchived, listColumn,
}: {
  quote: Quote; columns: BoardColumn[]
  onColumnChange: (id: string, colId: string) => void
  onDelete: (id: string) => void
  onArchive: (id: string) => void
  onRestore: (id: string) => void
  onEdit: (id: string) => void
  onConvertToJob?: (id: string) => void
  onPatch: (id: string, patch: Record<string, unknown>) => void
  boardType: "quote" | "job"
  isArchived?: boolean
  listColumn?: BoardColumn
}) {
  const [open, setOpen] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [showFiles, setShowFiles] = useState(false)
  const colIdx = columns.findIndex((c) => c.id === quote.column_id)
  const canL = !isArchived && colIdx > 0
  const canR = !isArchived && colIdx < columns.length - 1

  const rawMeta: JobMeta = quote.job_meta || {}
  const derived = useMemo(() => deriveMetaFromItems(quote), [quote])
  // Merge: saved meta wins over derived, derived fills gaps
  const meta: JobMeta = useMemo(() => ({ ...derived, ...rawMeta }), [derived, rawMeta])
  const overdue = isOverdue(meta)
  const days = daysOverdue(meta)
  const printDone = sectionDone(rawMeta, ["prints_arrived"])
  const mailDone = sectionDone(rawMeta, ["bcc_done", "paperwork_done", "folder_archived", "job_mailed"])
  const billDone = sectionDone(rawMeta, ["invoice_updated", "invoice_emailed", "paid_postage", "paid_full"])

  const updateMeta = (patch: Partial<JobMeta>) => {
    onPatch(quote.id, { job_meta: { ...rawMeta, ...patch } })
  }

  return (
    <div
      draggable={!isArchived && !open}
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", quote.id); e.dataTransfer.effectAllowed = "move"; (e.currentTarget as HTMLElement).style.opacity = "0.4" }}
      onDragEnd={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1" }}
      className={cn(
        "rounded-xl border bg-card transition-all",
        isArchived ? "opacity-50 border-border" : "border-border hover:border-foreground/20 hover:shadow-md",
        open ? "shadow-md ring-1 ring-foreground/5" : "shadow-sm"
      )}
    >
      {/* ── CARD CONTENT (PostFlow style) ── */}
      <div className="px-4 pt-3 pb-2.5">
        {/* Row 1: Title + icons */}
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0 cursor-grab" />
            <p className="text-[15px] font-bold text-foreground truncate leading-snug">{quote.project_name || "Untitled"}</p>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${quote.project_name} - ${quote.contact_name || ""}`) }}
              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground/40 hover:text-foreground transition-colors" title="Copy">
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setOpen(!open)}
              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground/40 hover:text-foreground transition-colors" title="Expand">
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-90")} />
            </button>
          </div>
        </div>

        {/* Row 2: Subtitle / description */}
        <p className="text-[13px] text-muted-foreground ml-6 mb-2.5 truncate">{quote.contact_name || "\u00A0"}</p>

        {/* Row 3: Mail Date + Assignee badges */}
        <div className="flex items-center gap-2 ml-6 mb-3 flex-wrap">
          <button onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground px-2.5 py-1 rounded-md border border-border hover:bg-secondary transition-colors">
            <CalendarDays className="h-3 w-3" />
            {meta.due_date ? new Date(meta.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Set Mail Date"}
          </button>
          {meta.assignee ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200/50 dark:border-orange-800/30">
              <span className="h-2 w-2 rounded-full bg-orange-500" />{meta.assignee}
            </span>
          ) : (
            <button onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/40 px-2.5 py-1 rounded-md border border-dashed border-border hover:border-foreground/20 hover:text-muted-foreground transition-colors">
              Assign
            </button>
          )}
          {overdue && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-destructive/10 text-destructive">
              OVERDUE ({days}d)
            </span>
          )}
          {meta.vendor_name && (meta.printed_by === "Out of House" || meta.printed_by === "Both") && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border border-sky-200/50 dark:border-sky-800/30">
              <Briefcase className="h-2.5 w-2.5" />{meta.vendor_name}
            </span>
          )}
        </div>

        {/* Row 4: ZD# + INV inline fields */}
        <div className="flex items-center gap-4 ml-6 mb-2">
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/50">
            <FileText className="h-3 w-3" />ZD# <span className="font-mono text-foreground/70">{quote.quote_number || "---"}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/50">
            <Hash className="h-3 w-3" />INV <span className="font-mono text-foreground/70">{quote.reference_number || "---"}</span>
          </span>
        </div>

        {/* Row 5: Add note / notes preview */}
        <div className="ml-6 mb-3">
          {quote.notes ? (
            <p className="text-[11px] text-muted-foreground italic line-clamp-1">{quote.notes}</p>
          ) : (
            <button onClick={() => setOpen(true)} className="text-[11px] text-muted-foreground/30 hover:text-muted-foreground transition-colors italic">
              Add note...
            </button>
          )}
        </div>

        {/* Row 6: Stage + Total */}
        <div className="flex items-center justify-between ml-6 mb-2">
          <div className="flex items-center gap-2">
            {listColumn && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground/70">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: listColumn.color }} />
                {listColumn.title}
              </span>
            )}
          </div>
          <span className="text-sm font-bold font-mono text-foreground tabular-nums">{formatCurrency(quote.total)}</span>
        </div>

        {/* Row 7: Convert to Job (only on quote board) */}
        {!isArchived && boardType === "quote" && onConvertToJob && (
          <div className="ml-6 pt-2 border-t border-border/50">
            <button
              onClick={(e) => { e.stopPropagation(); onConvertToJob(quote.id) }}
              className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors"
            >
              <Briefcase className="h-3 w-3" /> Convert to Job
            </button>
          </div>
        )}
      </div>

      {/* ── EXPANDED DETAIL ── */}
      {open && (
        <div className="border-t border-border">
          {/* Action toolbar */}
          <div className="flex items-center justify-between px-4 py-2 bg-secondary/30">
            <div className="flex items-center gap-1">
              {canL && (
                <button onClick={(e) => { e.stopPropagation(); onColumnChange(quote.id, columns[colIdx - 1].id) }}
                  className="flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-background border border-transparent hover:border-border transition-all">
                  <ChevronLeft className="h-3 w-3" />{columns[colIdx - 1].title}
                </button>
              )}
              {canR && (
                <button onClick={(e) => { e.stopPropagation(); onColumnChange(quote.id, columns[colIdx + 1].id) }}
                  className="flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-background border border-transparent hover:border-border transition-all">
                  {columns[colIdx + 1].title}<ChevronRight className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              {isArchived && (
                <button onClick={(e) => { e.stopPropagation(); onRestore(quote.id) }}
                  className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-emerald-600 hover:bg-background border border-transparent hover:border-border" title="Restore">
                  <ArchiveRestore className="h-3.5 w-3.5" />
                </button>
              )}
              {!isArchived && boardType === "quote" && onConvertToJob && (
                <button onClick={(e) => { e.stopPropagation(); onConvertToJob(quote.id) }}
                  className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-background border border-transparent hover:border-border" title="Convert to Job">
                  <Briefcase className="h-3.5 w-3.5" />
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); setShowFiles(true) }}
                className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-background border border-transparent hover:border-border" title="Files">
                <Paperclip className="h-3.5 w-3.5" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onEdit(quote.id) }}
                className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-background border border-transparent hover:border-border" title="Edit Quote">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              {!isArchived && (
                <button onClick={(e) => { e.stopPropagation(); onArchive(quote.id) }}
                  className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-amber-600 hover:bg-background border border-transparent hover:border-border" title="Archive">
                  <Archive className="h-3.5 w-3.5" />
                </button>
              )}
              {confirmDel ? (
                <div className="flex items-center gap-1 ml-1">
                  <button onClick={(e) => { e.stopPropagation(); onDelete(quote.id) }}
                    className="h-7 px-2 text-[11px] font-semibold text-destructive-foreground bg-destructive rounded-md hover:bg-destructive/90">Delete</button>
                  <button onClick={(e) => { e.stopPropagation(); setConfirmDel(false) }}
                    className="h-7 px-2 text-[11px] text-muted-foreground rounded-md hover:bg-background">Cancel</button>
                </div>
              ) : (
                <button onClick={(e) => { e.stopPropagation(); setConfirmDel(true) }}
                  className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20" title="Delete">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Info sections on gray bg */}
          <div className="bg-secondary/20 px-4 py-3 flex flex-col gap-3">

            {/* ── MAIL PIECES: full-width, wrapping grid ── */}
            {(() => {
              // Gather mail pieces from items: printing items (flat, booklet etc) + OHP + envelope
              const pieces = (quote.items || []).filter((it) =>
                ["flat", "booklet", "spiral", "perfect", "ohp", "envelope"].includes(it.category)
              )
              if (pieces.length === 0) return null
              // Max 3 per row, 1 piece = full width, 2 = 2 col, 3+ = 3 col then wraps
              const cols = pieces.length === 1 ? 1 : pieces.length === 2 ? 2 : 3
              return (
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Mail Pieces ({pieces.length})</p>
                  <div className={cn("grid gap-2", cols === 1 ? "grid-cols-1" : cols === 2 ? "grid-cols-2" : "grid-cols-3")}>
                    {pieces.map((pc, i) => {
                      const label = pc.label || pc.description || pc.category
                      const sizeMatch = label.match(/(\d+\.?\d*)\s*[""]?\s*[xX×]\s*(\d+\.?\d*)\s*[""]?/)
                      const sizeStr = sizeMatch ? `${sizeMatch[1]}" x ${sizeMatch[2]}"` : null
                      const isOHP = pc.category === "ohp"
                      const vendorName = isOHP ? (pc.description?.split("|")[0]?.trim() || "") : ""
                      // Extract the qty from label like "5,750 - 11x8.5..."
                      const qtyMatch = label.match(/([\d,]+)\s*[-–]/)
                      const qtyStr = qtyMatch ? qtyMatch[1] : ""
                      // Extract type hint
                      const typeHints = ["Postcard", "Flat", "Booklet", "Letter", "Self-Mailer", "Spiral", "Envelope", "Card"]
                      const foundType = typeHints.find((t) => label.toLowerCase().includes(t.toLowerCase())) || pc.category

                      return (
                        <div key={i} className={cn("rounded-lg border bg-card p-3", isOHP ? "border-sky-200 dark:border-sky-800/40" : "border-border")}>
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {isOHP && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 shrink-0">OHP</span>}
                              <span className="text-xs font-semibold text-foreground truncate">{foundType}</span>
                            </div>
                            <span className="text-xs font-bold font-mono text-foreground tabular-nums shrink-0">{formatCurrency(pc.amount)}</span>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                            {qtyStr && <span className="text-[10px] text-muted-foreground"><span className="font-medium text-foreground">{qtyStr}</span> pcs</span>}
                            {sizeStr && <span className="text-[10px] text-muted-foreground">{sizeStr}</span>}
                            {isOHP && vendorName && <span className="text-[10px] text-sky-600 dark:text-sky-400 font-medium">{vendorName}</span>}
                          </div>
                          <p className="text-[9px] text-muted-foreground/60 mt-1 truncate">{label}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* ── ROW: Job Details + Postage Details (2 col) ── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2.5">Job Details</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <FieldInput label="Quantity" value={String(quote.quantity || "")} placeholder="0" onChange={(v) => onPatch(quote.id, { quantity: parseInt(v) || 0 })} />
                  <FieldInput label="Mail Piece Desc." value={meta.piece_desc || ""} placeholder="e.g. 6x9 Postcard" onChange={(v) => updateMeta({ piece_desc: v })} />
                  <FieldInput label="Insert Count" value={String(meta.insert_count || "")} placeholder="0" onChange={(v) => updateMeta({ insert_count: parseInt(v) || 0 })} />
                  <FieldInput label="Inserts Desc." value={meta.inserts_desc || ""} placeholder="e.g. Flyer + Card" onChange={(v) => updateMeta({ inserts_desc: v })} />
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2.5">Postage Details</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <FieldSelect label="Mailing Class" value={meta.mailing_class || ""} onChange={(v) => updateMeta({ mailing_class: v })}
                    options={["1st Class", "Marketing", "Non Profit", "Single Piece", "Stamps"]} />
                  <FieldSelect label="Drop Off Location" value={meta.drop_off || ""} onChange={(v) => updateMeta({ drop_off: v })}
                    options={["Brooklyn", "Monsey", "KJ", "Lakewood"]} />
                </div>
                <label className="flex items-center gap-2 mt-3 cursor-pointer">
                  <Checkbox checked={!!meta.international} onCheckedChange={(c) => updateMeta({ international: !!c })} className="h-4 w-4 rounded" />
                  <span className="text-[11px] text-muted-foreground font-medium select-none">Mail International</span>
                </label>
              </div>
            </div>

            {/* ── ROW: Printing Details (full width) ── */}
            <div className={cn("rounded-lg border bg-card p-3 transition-colors", printDone ? "border-emerald-400/60 bg-emerald-50/40 dark:bg-emerald-950/20" : "border-border")}>
              <p className={cn("text-[11px] font-bold uppercase tracking-wide mb-2.5", printDone ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>Printing Details</p>
              <div className={cn("grid gap-x-4 gap-y-2 mb-2.5",
                (meta.printed_by === "Out of House" || meta.printed_by === "Both") ? "grid-cols-3" : "grid-cols-2"
              )}>
                <FieldSelect label="Printed By" value={meta.printed_by || ""} onChange={(v) => updateMeta({ printed_by: v })}
                  options={["In-House", "Out of House", "Both"]} />
                {(meta.printed_by === "Out of House" || meta.printed_by === "Both") && (
                  <FieldInput label="Vendor" value={meta.vendor_name || ""} placeholder="e.g. PrintOut" onChange={(v) => updateMeta({ vendor_name: v })} />
                )}
                <FieldInput label="Vendor Job #" value={meta.vendor_job || ""} placeholder="PO-2024-..." onChange={(v) => updateMeta({ vendor_job: v })} />
              </div>
              <MetaCheck label="Prints Arrived" checked={!!meta.prints_arrived} onChange={(c) => updateMeta({ prints_arrived: c })} />
            </div>

            {/* ── ROW: List/Mail + Billing (2 col) ── */}
            <div className="grid grid-cols-2 gap-3">
              <div className={cn("rounded-lg border bg-card p-3 transition-colors", mailDone ? "border-emerald-400/60 bg-emerald-50/40 dark:bg-emerald-950/20" : "border-border")}>
                <p className={cn("text-[11px] font-bold uppercase tracking-wide mb-2.5", mailDone ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>List / Mail Status</p>
                <div className="flex flex-col gap-1.5">
                  <MetaCheck label="BCC Done" checked={!!meta.bcc_done} onChange={(c) => updateMeta({ bcc_done: c })} />
                  <MetaCheck label="Paperwork Done" checked={!!meta.paperwork_done} onChange={(c) => updateMeta({ paperwork_done: c })} />
                  <MetaCheck label="Folder Archived" checked={!!meta.folder_archived} onChange={(c) => updateMeta({ folder_archived: c })} />
                  <MetaCheck label="Job Mailed" checked={!!meta.job_mailed} onChange={(c) => updateMeta({ job_mailed: c })} bold />
                </div>
              </div>
              <div className={cn("rounded-lg border bg-card p-3 transition-colors", billDone ? "border-emerald-400/60 bg-emerald-50/40 dark:bg-emerald-950/20" : "border-border")}>
                <p className={cn("text-[11px] font-bold uppercase tracking-wide mb-2.5", billDone ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>Billing Status</p>
                <div className="flex flex-col gap-1.5">
                  <MetaCheck label="Invoice Updated" checked={!!meta.invoice_updated} onChange={(c) => updateMeta({ invoice_updated: c })} />
                  <MetaCheck label="Invoice Emailed" checked={!!meta.invoice_emailed} onChange={(c) => updateMeta({ invoice_emailed: c })} />
                  <MetaCheck label="Paid (Postage)" checked={!!meta.paid_postage} onChange={(c) => updateMeta({ paid_postage: c })} />
                  <MetaCheck label="Paid (Full)" checked={!!meta.paid_full} onChange={(c) => updateMeta({ paid_full: c })} />
                </div>
              </div>
            </div>

            {/* ── Assignee + Due Date ── */}
            <div className="grid grid-cols-2 gap-3">
              <FieldInput label="Assignee" value={meta.assignee || ""} placeholder="Assign to..." onChange={(v) => updateMeta({ assignee: v })} />
              <FieldInput label="Due Date" value={meta.due_date || ""} type="date" onChange={(v) => updateMeta({ due_date: v })} />
            </div>

            {/* ── Files ── */}
            <JobFilesInline quoteId={quote.id} onOpenPanel={() => setShowFiles(true)} />

            {/* ── Line items ── */}
            {(quote.items || []).length > 0 && (
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Line Items</p>
                <div className="flex flex-col gap-1">
                  {(quote.items || []).map((it, i) => (
                    <div key={i} className="flex items-center justify-between py-0.5">
                      <span className="text-xs text-foreground/80 truncate flex-1">{it.label || it.description || it.category}</span>
                      <span className="text-xs font-mono text-foreground font-medium tabular-nums shrink-0 ml-3">{formatCurrency(it.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                  <span className="text-xs font-bold text-foreground">Total</span>
                  <span className="text-sm font-bold font-mono text-foreground tabular-nums">{formatCurrency(quote.total)}</span>
                </div>
              </div>
            )}

            {quote.notes && (
              <p className="text-[11px] text-muted-foreground leading-relaxed italic bg-card rounded-lg border border-border p-3">{quote.notes}</p>
            )}
          </div>
        </div>
      )}

      {/* File folder panel */}
      {showFiles && (
        <JobFilesPanel quoteId={quote.id} projectName={quote.project_name} onClose={() => setShowFiles(false)} />
      )}
    </div>
  )
}

/* ═════════════════════════════════════════════════���══
   COLUMN SETTINGS
   ════════════════════════════════════════════════════ */

function ColumnSettings({ columns, onAdd, onRename, onDelete, onReorder, onClose }: {
  columns: BoardColumn[]; onAdd: () => void; onRename: (id: string, name: string) => void
  onDelete: (id: string) => void; onReorder: (ids: string[]) => void; onClose: () => void
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 mb-2 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-foreground">Manage Columns</h3>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-6 text-[10px]">Done</Button>
      </div>
      <div className="flex flex-col gap-1.5">
        {columns.map((col, idx) => (
          <div key={col.id} className="flex items-center gap-2 py-0.5">
            <div className="flex flex-col gap-px">
              {idx > 0 && (
                <button onClick={() => { const ids = columns.map(c => c.id); [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]]; onReorder(ids) }}
                  className="text-muted-foreground hover:text-foreground text-[9px] leading-none">{"^"}</button>
              )}
              {idx < columns.length - 1 && (
                <button onClick={() => { const ids = columns.map(c => c.id); [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]]; onReorder(ids) }}
                  className="text-muted-foreground hover:text-foreground text-[9px] leading-none">{"v"}</button>
              )}
            </div>
            <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
            <Input defaultValue={col.title} onBlur={(e) => { if (e.target.value !== col.title) onRename(col.id, e.target.value) }}
              className="h-6 text-[10px] flex-1 px-1.5 rounded" />
            {columns.length > 1 && (
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(col.id)}><X className="h-2.5 w-2.5" /></Button>
            )}
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="mt-2 gap-1 text-[10px] h-6" onClick={onAdd}><Plus className="h-2.5 w-2.5" /> Add Column</Button>
    </div>
  )
}

/* ════════════════════════════════════════════════════
   QUOTE EDIT MODAL
   ════════════════════════���═══════════════════════════ */

function QuoteEditModal({ quote, onClose, onSaved, onLoadIntoCalculator }: {
  quote: Quote; onClose: () => void; onSaved: () => void; onLoadIntoCalculator: (id: string) => void
}) {
  const [name, setName] = useState(quote.project_name)
  const [editItems, setEditItems] = useState<QuoteItem[]>(quote.items || [])
  const [notes, setNotes] = useState(quote.notes || "")
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showPlainText, setShowPlainText] = useState(false)
  const ALL_CATS: QuoteCategory[] = ["flat", "booklet", "spiral", "perfect", "postage", "listwork", "item", "ohp"]
  const total = editItems.reduce((s, i) => s + i.amount, 0)
  const catTotal = (cat: QuoteCategory) => editItems.filter((i) => i.category === cat).reduce((s, i) => s + i.amount, 0)
  const removeItem = (id: number) => setEditItems((prev) => prev.filter((i) => i.id !== id))
  const updateAmount = (id: number, amount: number) => setEditItems((prev) => prev.map((i) => (i.id === id ? { ...i, amount } : i)))
  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(`/api/quotes/${quote.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_name: name, items: editItems, total, notes: notes || null }) })
      onSaved(); onClose()
    } finally { setSaving(false) }
  }
  const buildPlainText = () => buildQuoteText(editItems, name || undefined, notes || undefined)
  const handleCopy = async () => {
    const text = buildPlainText()
    try { await navigator.clipboard.writeText(text) } catch { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta) }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center p-4 pt-[10vh] overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <Card className="w-full max-w-2xl border-border shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="text-lg font-bold text-foreground bg-transparent border-none outline-none w-full placeholder:text-muted-foreground focus:ring-0"
                placeholder="Project / Client Name..." autoComplete="off" spellCheck={false} />
              <div className="flex items-center gap-2 mt-1.5">
                {quote.quote_number && <Badge variant="secondary" className="text-xs font-mono">Q-{quote.quote_number}</Badge>}
                <span className="text-xs text-muted-foreground">Updated {fmtDate(quote.updated_at)}</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs shrink-0">Close</Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {ALL_CATS.map((cat) => {
            const catItems = editItems.filter((i) => i.category === cat)
            if (catItems.length === 0) return null
            return (
              <div key={cat}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{getCategoryLabel(cat)}</span>
                  <span className="text-sm font-mono font-semibold tabular-nums">{formatCurrency(catTotal(cat))}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {catItems.map((item, idx) => (
                    <div key={item.id} className="flex items-start justify-between gap-2 py-2 px-3 bg-secondary/40 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{catItems.length > 1 && <span className="text-muted-foreground font-mono mr-1.5">#{idx + 1}</span>}{item.label}</p>
                        {item.description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                          <input type="number" inputMode="decimal" step="0.01" value={item.amount || ""}
                            onChange={(e) => updateAmount(item.id, parseFloat(e.target.value) || 0)}
                            className="w-24 h-9 text-right text-sm font-mono tabular-nums bg-card border border-border rounded-md pl-5 pr-2 focus:outline-none focus:ring-2 focus:ring-ring" />
                        </div>
                        <button onClick={() => removeItem(item.id)} className="p-1.5 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold text-foreground">Project Total</span>
            <span className="text-xl font-bold font-mono text-foreground tabular-nums">{formatCurrency(total)}</span>
          </div>
          <div>
            <label htmlFor="quote-notes" className="text-sm font-medium text-foreground mb-1.5 block">Notes</label>
            <textarea id="quote-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes for this quote..." rows={3}
              className="w-full text-sm bg-card border border-border rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-1.5 text-xs h-9" onClick={handleSave} disabled={saving}><Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save Changes"}</Button>
            <Button variant={copied ? "default" : "outline"} size="sm" className="gap-1.5 text-xs h-9" onClick={handleCopy}>{copied ? <><Check className="h-3.5 w-3.5" />Copied</> : <><ClipboardCopy className="h-3.5 w-3.5" />Copy for Email</>}</Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9" onClick={() => setShowPlainText(!showPlainText)}><FileText className="h-3.5 w-3.5" /> {showPlainText ? "Hide Text" : "View as Text"}</Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9" onClick={() => onLoadIntoCalculator(quote.id)}><Pencil className="h-3.5 w-3.5" /> Edit in Calculator</Button>
          </div>
          {showPlainText && (
            <pre className="bg-secondary rounded-lg p-3 text-[11px] font-mono text-foreground leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto border border-border select-all">{buildPlainText()}</pre>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ═══════════════════════════════════════════════════��
   DROPPABLE COLUMN
   ════════════════════════════════════════════════════ */

function DroppableColumn({ col, quotes, allColumns, onColumnChange, onDelete, onArchive, onRestore, onEdit, onConvertToJob, onPatch, boardType }: {
  col: BoardColumn; quotes: Quote[]; allColumns: BoardColumn[]
  onColumnChange: (id: string, colId: string) => void; onDelete: (id: string) => void
  onArchive: (id: string) => void; onRestore: (id: string) => void; onEdit: (id: string) => void
  onConvertToJob?: (id: string) => void; onPatch: (id: string, patch: Record<string, unknown>) => void; boardType: "quote" | "job"
}) {
  const [dragOver, setDragOver] = useState(false)
  const colTotal = quotes.reduce((s, q) => s + Number(q.total), 0)

  return (
    <div className="flex flex-col min-w-[280px] w-[320px] shrink-0 lg:min-w-0 lg:w-auto lg:flex-1 min-h-0">
      <div className="flex items-center justify-between px-1 pb-1.5 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: col.color }} />
          <span className="text-[11px] font-semibold text-foreground">{col.title}</span>
          <span className="text-[9px] font-mono text-muted-foreground/60 tabular-nums">{quotes.length}</span>
        </div>
        <span className="text-[9px] font-mono text-muted-foreground/50 tabular-nums">{formatCurrency(colTotal)}</span>
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const id = e.dataTransfer.getData("text/plain"); if (id) onColumnChange(id, col.id) }}
        className={cn("flex-1 flex flex-col gap-2.5 p-1.5 rounded-lg overflow-y-auto transition-colors min-h-0",
          dragOver ? "bg-foreground/[0.03] ring-1 ring-foreground/10" : "bg-secondary/20"
        )}
      >
        {quotes.length === 0 ? (
          <div className="flex items-center justify-center flex-1 min-h-[60px]">
            <p className="text-[10px] text-muted-foreground/30">{dragOver ? "Drop here" : "Empty"}</p>
          </div>
        ) : quotes.map((q) => (
          <QuoteCard key={q.id} quote={q} columns={allColumns}
            onColumnChange={onColumnChange} onDelete={onDelete} onArchive={onArchive}
            onRestore={onRestore} onEdit={onEdit} onConvertToJob={onConvertToJob}
            onPatch={onPatch} boardType={boardType} />
        ))}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════
   MAIN KANBAN BOARD
   ════════════════════════════════════��═══════════════ */

export function KanbanBoard({ boardType = "quote", viewMode = "board", onLoadQuote }: {
  boardType?: "quote" | "job"; viewMode?: "board" | "list"; onLoadQuote: (quoteId: string) => void
}) {
  const isJob = boardType === "job"
  const colsUrl = `/api/board-columns?type=${boardType}`
  const quotesUrl = `/api/quotes?is_job=${isJob}&archived=false`
  const archivedUrl = `/api/quotes?is_job=${isJob}&archived=true`

  const { data: columns, isLoading: colsLoading } = useSWR<BoardColumn[]>(colsUrl, fetcher)
  const { data: quotes, error, isLoading: quotesLoading } = useSWR<Quote[]>(quotesUrl, fetcher, { refreshInterval: 10000 })
  const { data: archivedQuotes } = useSWR<Quote[]>(archivedUrl, fetcher)

  const [showSettings, setShowSettings] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [detailQuote, setDetailQuote] = useState<Quote | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  const isLoading = colsLoading || quotesLoading

  const filteredQuotes = useMemo(() => {
    if (!quotes) return []
    return searchTerm ? quotes.filter((q) => matchesSearch(q, searchTerm)) : quotes
  }, [quotes, searchTerm])

  const filteredArchived = useMemo(() => {
    if (!archivedQuotes) return []
    return searchTerm ? archivedQuotes.filter((q) => matchesSearch(q, searchTerm)) : archivedQuotes
  }, [archivedQuotes, searchTerm])

  const refreshAll = useCallback(() => { globalMutate(quotesUrl); globalMutate(archivedUrl) }, [quotesUrl, archivedUrl])

  const handleColumnChange = useCallback(async (id: string, colId: string) => {
    await fetch(`/api/quotes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ column_id: colId }) })
    refreshAll()
  }, [refreshAll])

  const handleDelete = useCallback(async (id: string) => { await fetch(`/api/quotes/${id}`, { method: "DELETE" }); refreshAll() }, [refreshAll])

  const handleArchive = useCallback(async (id: string) => {
    await fetch(`/api/quotes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: true, archived_at: new Date().toISOString() }) })
    refreshAll()
  }, [refreshAll])

  const handleRestore = useCallback(async (id: string) => {
    await fetch(`/api/quotes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: false, archived_at: null }) })
    refreshAll()
  }, [refreshAll])

  const handlePatch = useCallback(async (id: string, patch: Record<string, unknown>) => {
    await fetch(`/api/quotes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) })
    refreshAll()
  }, [refreshAll])

  const handleConvertToJob = useCallback(async (id: string) => {
    // Find the quote to extract data from
    const quote = (quotes || []).find((q) => q.id === id)
    const items: QuoteItem[] = quote?.items || []

    // Smart extraction: build job_meta from existing quote data
    const meta: JobMeta = { ...(quote?.job_meta || {}) }

    // --- Piece description: from the first printing item (flat/booklet/etc) label/description ---
    const printingItems = items.filter((it) => ["flat", "booklet", "spiral", "perfect"].includes(it.category))
    if (printingItems.length > 0 && !meta.piece_desc) {
      // The label or description usually contains the piece spec, e.g. "1,000 - 4x6 Flat Prints, 10pt Gloss"
      const desc = printingItems[0].description || printingItems[0].label || ""
      // Extract size pattern like "4x6", "6x9", "8.5x11" from the text
      const sizeMatch = desc.match(/(\d+\.?\d*)\s*[xX×]\s*(\d+\.?\d*)/i)
      const sizeStr = sizeMatch ? `${sizeMatch[1]}x${sizeMatch[2]}` : ""
      // Extract piece type hint
      const typeHints = ["Postcard", "Flat Card", "Folded Card", "Booklet", "Letter", "Self-Mailer", "Spiral", "Perfect Bound"]
      const foundType = typeHints.find((t) => desc.toLowerCase().includes(t.toLowerCase())) || printingItems[0].label?.split(" - ").pop()?.split(",")[0]?.trim() || ""
      meta.piece_desc = sizeStr && foundType ? `${sizeStr} ${foundType}` : (sizeStr || foundType || desc.split(",")[0]?.trim() || "")
    }

    // --- Inserts: count non-first printing items ---
    if (printingItems.length > 1 && !meta.insert_count) {
      meta.insert_count = printingItems.length - 1
      const insertDescs = printingItems.slice(1).map((it) => {
        const d = it.description || it.label || ""
        const m = d.match(/(\d+\.?\d*)\s*[xX×]\s*(\d+\.?\d*)/)
        return m ? `${m[1]}x${m[2]}` : d.split(",")[0]?.trim() || ""
      }).filter(Boolean)
      if (!meta.inserts_desc && insertDescs.length > 0) meta.inserts_desc = insertDescs.join(" + ")
    }

    // --- Mailing class: from postage item label/description ---
    const postageItems = items.filter((it) => it.category === "postage")
    if (postageItems.length > 0 && !meta.mailing_class) {
      const pDesc = postageItems[0].description || postageItems[0].label || ""
      // Look for class: "First Class", "Standard", "Marketing", "Priority"
      const classHints = ["First Class", "1st Class", "Standard", "Marketing", "Non-Profit", "Priority", "Presorted"]
      const foundClass = classHints.find((c) => pDesc.toLowerCase().includes(c.toLowerCase()))
      meta.mailing_class = foundClass || pDesc.split(",")[0]?.replace(/Postage\s*[-–]\s*/i, "").trim() || ""
    }

    // --- Printed by + Vendor: from OHP items ---
    const ohpItems = items.filter((it) => it.category === "ohp")
    if (ohpItems.length > 0 && !meta.printed_by) {
      // Vendor name from description: "PrintOut | +15% markup" -> "PrintOut"
      const ohpDesc = ohpItems[0].description || ""
      const vendorFromDesc = ohpDesc.split("|")[0]?.trim()
      if (vendorFromDesc && !meta.vendor_name) meta.vendor_name = vendorFromDesc

      // Check if there are ALSO in-house printing items
      if (printingItems.length > 0) {
        meta.printed_by = "Both"
      } else {
        meta.printed_by = "Out of House"
      }

      // Try piece desc from OHP label if not set: "OHP: 5,750 - 2.5x6.5 Postcard"
      if (!meta.piece_desc) {
        const ohpLabel = ohpItems[0].label || ""
        const afterOHP = ohpLabel.replace(/^OHP[:\s]*/i, "").trim()
        const sizeM = afterOHP.match(/(\d+\.?\d*)\s*[""]?\s*[xX×]\s*(\d+\.?\d*)\s*[""]?/)
        if (sizeM) {
          const afterSize = afterOHP.substring(afterOHP.indexOf(sizeM[0]) + sizeM[0].length).trim()
          const pieceType = afterSize.split(",")[0]?.trim() || ""
          meta.piece_desc = `${sizeM[1]}x${sizeM[2]}${pieceType ? " " + pieceType : ""}`
        }
      }
    } else if (printingItems.length > 0 && !meta.printed_by) {
      meta.printed_by = "In-House"
    }

    // Get the first job board column
    const res = await fetch("/api/board-columns?type=job")
    const jobCols: BoardColumn[] = await res.json()
    const firstJobCol = jobCols?.[0]?.id || null

    await fetch(`/api/quotes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        is_job: true,
        converted_at: new Date().toISOString(),
        column_id: firstJobCol,
        job_meta: meta,
      }),
    })
    refreshAll(); globalMutate(`/api/quotes?is_job=true&archived=false`); globalMutate(`/api/quotes?is_job=false&archived=false`)
  }, [refreshAll, quotes])

  const addColumn = useCallback(async () => {
    await fetch("/api/board-columns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "New Stage", board_type: boardType }) })
    globalMutate(colsUrl)
  }, [colsUrl, boardType])

  const renameColumn = useCallback(async (id: string, name: string) => {
    await fetch(`/api/board-columns/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) })
    globalMutate(colsUrl)
  }, [colsUrl])

  const deleteColumn = useCallback(async (id: string) => { await fetch(`/api/board-columns/${id}`, { method: "DELETE" }); globalMutate(colsUrl); refreshAll() }, [colsUrl, refreshAll])

  const reorderColumns = useCallback(async (ids: string[]) => {
    globalMutate(colsUrl, (prev: BoardColumn[] | undefined) => {
      if (!prev) return prev
      return ids.map((id, i) => { const col = prev.find((c) => c.id === id)!; return { ...col, sort_order: i } })
    }, false)
    await fetch("/api/board-columns/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: ids }) })
    globalMutate(colsUrl)
  }, [colsUrl])

  if (isLoading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  if (error) return <div className="flex items-center justify-center py-24 text-sm text-destructive">Failed to load. Check your database connection.</div>

  const cols = columns || []
  const archiveCount = archivedQuotes?.length || 0
  const label = isJob ? "Job" : "Quote"

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
          <input type="search" placeholder={`Search ${label.toLowerCase()}s...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-7 pl-7 pr-7 rounded-md bg-secondary/60 border-0 text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring" />
          {searchTerm && <button onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-2.5 w-2.5" /></button>}
        </div>
        {searchTerm && <span className="text-[9px] text-muted-foreground shrink-0">{filteredQuotes.length} found</span>}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setShowArchive(!showArchive)}
            className={cn("flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-medium transition-colors", showArchive ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}>
            <Archive className="h-2.5 w-2.5" />{archiveCount > 0 && archiveCount}
          </button>
          <button onClick={() => setShowSettings(!showSettings)}
            className={cn("flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-medium transition-colors", showSettings ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}>
            <Settings2 className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>

      {showSettings && <ColumnSettings columns={cols} onAdd={addColumn} onRename={renameColumn} onDelete={deleteColumn} onReorder={reorderColumns} onClose={() => setShowSettings(false)} />}

      {/* Archive drawer */}
      {showArchive && (
        <div className="rounded-lg border border-border bg-secondary/20 p-2 mb-2 shrink-0 max-h-[200px] overflow-y-auto">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Archive className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-semibold text-foreground">Archived</span>
            <span className="text-[9px] font-mono text-muted-foreground">{filteredArchived.length}</span>
          </div>
          {filteredArchived.length === 0 ? (
            <p className="text-[9px] text-muted-foreground/50 py-3 text-center">No archived {label.toLowerCase()}s</p>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-1.5">
              {filteredArchived.map((q) => (
                <QuoteCard key={q.id} quote={q} columns={cols}
                  onColumnChange={handleColumnChange} onDelete={handleDelete} onArchive={handleArchive}
                  onRestore={handleRestore} onPatch={handlePatch}
                  onEdit={(id) => { const found = filteredArchived.find((x) => x.id === id); if (found) setDetailQuote(found) }}
                  onConvertToJob={boardType === "quote" ? handleConvertToJob : undefined}
                  boardType={boardType} isArchived />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BOARD VIEW ── */}
      {viewMode === "board" && (
        <div className="flex-1 min-h-0 overflow-x-auto">
          <div className="flex gap-2 h-full">
            {cols.map((col) => {
              const colQuotes = filteredQuotes.filter((q) => q.column_id === col.id)
              return (
                <DroppableColumn key={col.id} col={col} quotes={colQuotes} allColumns={cols}
                  onColumnChange={handleColumnChange} onDelete={handleDelete} onArchive={handleArchive}
                  onRestore={handleRestore} onPatch={handlePatch}
                  onEdit={(id) => { const q = filteredQuotes.find((x) => x.id === id); if (q) setDetailQuote(q) }}
                  onConvertToJob={boardType === "quote" ? handleConvertToJob : undefined}
                  boardType={boardType} />
              )
            })}
          </div>
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {viewMode === "list" && (
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 pr-1">
          {filteredQuotes.length === 0 && <p className="text-xs text-muted-foreground text-center py-10">No {label.toLowerCase()}s found.</p>}
          {filteredQuotes.map((q) => {
            const col = cols.find((c) => c.id === q.column_id)
            return (
              <QuoteCard key={q.id} quote={q} columns={cols}
                onColumnChange={handleColumnChange} onDelete={handleDelete} onArchive={handleArchive}
                onRestore={handleRestore} onPatch={handlePatch}
                onEdit={(id) => { const found = filteredQuotes.find((x) => x.id === id); if (found) setDetailQuote(found) }}
                onConvertToJob={boardType === "quote" ? handleConvertToJob : undefined}
                boardType={boardType} listColumn={col} />
            )
          })}
        </div>
      )}

      {/* Unassigned */}
      {viewMode === "board" && (() => {
        const unassigned = filteredQuotes.filter((q) => !q.column_id || !cols.some((c) => c.id === q.column_id))
        if (unassigned.length === 0) return null
        return (
          <div className="mt-2 shrink-0 max-h-[140px] overflow-y-auto">
            <div className="flex items-center gap-1.5 mb-1 px-0.5">
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
              <span className="text-[10px] font-semibold text-muted-foreground">Unassigned</span>
              <span className="text-[9px] font-mono text-muted-foreground/50">{unassigned.length}</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5">
              {unassigned.map((q) => (
                <QuoteCard key={q.id} quote={q} columns={cols}
                  onColumnChange={handleColumnChange} onDelete={handleDelete} onArchive={handleArchive}
                  onRestore={handleRestore} onPatch={handlePatch}
                  onEdit={(id) => { const found = unassigned.find((x) => x.id === id); if (found) setDetailQuote(found) }}
                  onConvertToJob={boardType === "quote" ? handleConvertToJob : undefined}
                  boardType={boardType} />
              ))}
            </div>
          </div>
        )
      })()}

      {/* Edit modal */}
      {detailQuote && (
        <QuoteEditModal quote={detailQuote} onClose={() => setDetailQuote(null)}
          onSaved={refreshAll} onLoadIntoCalculator={(id) => { setDetailQuote(null); onLoadQuote(id) }} />
      )}
    </div>
  )
}
