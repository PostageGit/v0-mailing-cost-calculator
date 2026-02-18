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
import type { Vendor } from "@/lib/vendor-types"
import {
  FileText, Trash2, ArrowRight, ArrowLeft,
  Pencil, Clock, Loader2, X, Save, ClipboardCopy, Check,
  Plus, Settings2, CalendarDays, Briefcase, AlertCircle,
  Search, Archive, ArchiveRestore, ChevronDown, ChevronLeft, ChevronRight,
  Paperclip, Upload, File, FileImage, FileSpreadsheet, Download,
  Hash, GripVertical, NotepadText, ExternalLink, User, CirclePlus,
  LayoutPanelLeft, Zap, Info, MapPin,
} from "lucide-react"

/* ── Types ── */

interface QuoteItem {
  id: number; category: QuoteCategory; label: string; description: string; amount: number
  metadata?: Record<string, unknown>
}
interface BoardColumn {
  id: string; title: string; color: string; sort_order: number; board_type?: string
}
interface PieceMeta { vendor?: string; expected_date?: string; expected_time?: string; prints_arrived?: boolean }
interface JobMeta {
  piece_desc?: string; insert_count?: number; inserts_desc?: string
  mailing_class?: string; drop_off?: string; international?: boolean
  printed_by?: string; vendor_name?: string; vendor_job?: string; prints_arrived?: boolean
  bcc_done?: boolean; paperwork_done?: boolean; folder_archived?: boolean; job_mailed?: boolean
  invoice_updated?: boolean; invoice_emailed?: boolean; paid_postage?: boolean; paid_full?: boolean
  assignee?: string; due_date?: string; expected_date?: string
  zendesk_ticket?: string; next_step?: string; quick_notes?: string
  /** Per-piece vendor / expected date / arrived, keyed by piece index */
  piece_meta?: PieceMeta[]
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

/** Derives job_meta field values from a quote's line items.
 *  Prefers structured metadata fields when present; falls back to regex heuristics. */
function deriveMetaFromItems(quote: Quote): JobMeta {
  const items: QuoteItem[] = quote.items || []
  const derived: JobMeta = {}

  // --- Printing items (flat, booklet, etc.) ---
  const printItems = items.filter((it) => ["flat", "booklet", "spiral", "perfect"].includes(it.category))
  if (printItems.length > 0) {
    const first = printItems[0]
    const m = first.metadata as Record<string, unknown> | undefined

    // Prefer structured metadata
    if (m?.pieceDimensions || m?.pieceType || m?.pieceLabel) {
      const dims = (m.pieceDimensions as string) || ""
      const type = (m.pieceLabel as string) || (m.pieceType as string) || ""
      derived.piece_desc = dims && type ? `${dims} ${type}` : (dims || type)
    } else {
      // Regex fallback
      const desc = first.description || first.label || ""
      const sizeMatch = desc.match(/(\d+\.?\d*)\s*[xX×]\s*(\d+\.?\d*)/i)
      const sizeStr = sizeMatch ? `${sizeMatch[1]}x${sizeMatch[2]}` : ""
      const typeHints = ["Postcard", "Flat Card", "Folded Card", "Booklet", "Letter", "Self-Mailer", "Spiral", "Perfect Bound"]
      const foundType = typeHints.find((t) => desc.toLowerCase().includes(t.toLowerCase()))
      const fallbackType = first.label?.split(" - ").pop()?.split(",")[0]?.trim() || ""
      derived.piece_desc = sizeStr && (foundType || fallbackType) ? `${sizeStr} ${foundType || fallbackType}` : (sizeStr || foundType || fallbackType || desc.split(",")[0]?.trim() || "")
    }

  // Production route from metadata
  if (m?.production) {
  const prodMap: Record<string, string> = { inhouse: "PrintOut", ohp: "Out of House", both: "Both", customer: "Customer Provided" }
  derived.printed_by = prodMap[m.production as string] || "PrintOut"
  } else {
  derived.printed_by = "PrintOut"
  }
  }

  // Inserts: additional printing items beyond the first
  if (printItems.length > 1) {
    derived.insert_count = printItems.length - 1
    const insertDescs = printItems.slice(1).map((it) => {
      const m = it.metadata as Record<string, unknown> | undefined
      if (m?.pieceDimensions) return m.pieceDimensions as string
      const d = it.description || it.label || ""
      const sm = d.match(/(\d+\.?\d*)\s*[xX×]\s*(\d+\.?\d*)/)
      return sm ? `${sm[1]}x${sm[2]}` : d.split(",")[0]?.trim() || ""
    }).filter(Boolean)
    if (insertDescs.length > 0) derived.inserts_desc = insertDescs.join(" + ")
  }

  // --- Postage items ---
  const postageItems = items.filter((it) => it.category === "postage")
  if (postageItems.length > 0) {
    const pm = postageItems[0].metadata as Record<string, unknown> | undefined
    if (pm?.mailingClass) {
      derived.mailing_class = pm.mailingClass as string
    } else {
      const pDesc = postageItems[0].description || postageItems[0].label || ""
      const classHints = ["First Class", "1st Class", "Standard", "Marketing", "Non-Profit", "Priority", "Presorted", "Letter Class"]
      const foundClass = classHints.find((c) => pDesc.toLowerCase().includes(c.toLowerCase()))
      derived.mailing_class = foundClass || pDesc.split(",")[0]?.replace(/Postage\s*[-–]\s*/i, "").replace(/USPS\s*/i, "").trim() || ""
    }
    // Drop-off location from metadata
    if (pm?.entryPoint) derived.drop_off = pm.entryPoint as string
    else if (pm?.dropOff) derived.drop_off = pm.dropOff as string
  }

  // --- Envelope items ---
  const envItems = items.filter((it) => it.category === "envelope")
  if (envItems.length > 0) {
    const em = envItems[0].metadata as Record<string, unknown> | undefined
    if (em?.customerProvided) {
      derived.printed_by = "Customer Provided"
      if (em.providerVendor) derived.vendor_name = em.providerVendor as string
      if (em.providerExpectedDate) derived.expected_date = em.providerExpectedDate as string
    }
  }

  // --- OHP items ---
  const ohpItems = items.filter((it) => it.category === "ohp")
  if (ohpItems.length > 0) {
    const ohpDesc = ohpItems[0].description || ""
    const vendorFromDesc = ohpDesc.split("|")[0]?.trim()
    if (vendorFromDesc) derived.vendor_name = vendorFromDesc
    derived.printed_by = "Out of House"

    if (!derived.piece_desc) {
      const ohpLabel = ohpItems[0].label || ""
      const afterOHP = ohpLabel.replace(/^OHP[:\s]*/i, "").trim()
      const sizeM = afterOHP.match(/(\d+\.?\d*)\s*[""]?\s*[xX×]\s*(\d+\.?\d*)\s*[""]?/)
      if (sizeM) {
        const afterSize = afterOHP.substring(afterOHP.indexOf(sizeM[0]) + sizeM[0].length).trim()
        const pieceType = afterSize.split(",")[0]?.trim() || ""
        derived.piece_desc = `${sizeM[1]}x${sizeM[2]}${pieceType ? " " + pieceType : ""}`
      }
    }
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

/* ==== ETA Date Field with relative day badges ==== */
const ETA_TIMES = ["7 AM","8 AM","9 AM","10 AM","11 AM","12 PM","1 PM","2 PM","3 PM","4 PM","5 PM","6 PM"]

function getRelativeDay(dateStr: string) {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + "T00:00:00"); d.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diff < -1) return { label: `${Math.abs(diff)}d overdue`, diff, color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200/50 dark:border-red-800/30" }
  if (diff === -1) return { label: "Yesterday", diff, color: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border-red-200/40 dark:border-red-800/30" }
  if (diff === 0) return { label: "Today", diff, color: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200/50 dark:border-amber-800/30" }
  if (diff === 1) return { label: "Tomorrow", diff, color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/30" }
  if (diff <= 7) return { label: `In ${diff}d`, diff, color: "bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400 border-teal-200/50 dark:border-teal-800/30" }
  return { label: "", diff, color: "" }
}

function EtaDateField({ value, onChange, time, onTimeChange }: { value: string; onChange: (v: string) => void; time?: string; onTimeChange?: (v: string) => void }) {
  const [local, setLocal] = useState(value)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { setLocal(value) }, [value])
  const commit = () => { if (local !== value) onChange(local) }
  const rel = getRelativeDay(local)

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[10px] text-muted-foreground font-medium">ETA</span>
        {rel && rel.label && (
          <span className={cn("text-[9px] font-semibold px-1.5 py-0 rounded border leading-relaxed", rel.color)}>
            {rel.label}{time ? ` ${time}` : ""}
          </span>
        )}
      </div>
      <div className="flex gap-1">
        <input ref={ref} type="date" value={local}
          onChange={(e) => { setLocal(e.target.value); }}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") { commit(); ref.current?.blur() } }}
          className={cn(
            "flex-1 min-w-0 text-xs font-medium bg-background border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-ring/30 focus:border-foreground/30 transition-all",
            rel && rel.diff !== undefined && rel.diff < 0
              ? "text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/40"
              : rel && rel.diff === 0
                ? "text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40"
                : rel && rel.diff === 1
                  ? "text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40"
                  : "text-foreground border-border"
          )}
        />
        {onTimeChange && (
          <select
            value={time || ""}
            onChange={(e) => onTimeChange(e.target.value)}
            className="text-[10px] font-medium text-foreground bg-background border border-border rounded-md px-1 py-1.5 outline-none focus:ring-2 focus:ring-ring/30 cursor-pointer w-[62px] shrink-0"
          >
            <option value="">Time</option>
            {ETA_TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>
    </div>
  )
}

/* Vendor Facility Info Popover */
function VendorInfoPopover({ vendorName, vendors }: { vendorName: string; vendors: Vendor[] }) {
  const [showInfo, setShowInfo] = useState(false)
  const vendor = vendors.find((v) => v.company_name === vendorName)
  const { data: facilities } = useSWR<Array<{ id: string; name: string; address_line1?: string; city?: string; state?: string; zip?: string; pickup_contact?: string; pickup_phone?: string; pickup_window?: string; is_24h?: boolean; notes?: string }>>(
    showInfo && vendor ? `/api/vendors/${vendor.id}/facilities` : null, fetcher
  )

  if (!vendorName || !vendor) return null

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setShowInfo(!showInfo) }}
        className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-secondary transition-colors"
        title="Vendor facility info"
      >
        <Info className="h-3 w-3" />
      </button>
      {showInfo && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowInfo(false)} />
          <div className="absolute z-50 top-6 right-0 w-64 bg-card border border-border rounded-lg shadow-lg p-3 text-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-foreground text-[11px]">{vendor.company_name}</span>
              <button onClick={() => setShowInfo(false)} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
            </div>
            {vendor.contact_name && <p className="text-muted-foreground"><span className="font-medium text-foreground">Contact:</span> {vendor.contact_name}</p>}
            {vendor.office_phone && <p className="text-muted-foreground"><span className="font-medium text-foreground">Phone:</span> {vendor.office_phone}</p>}
            {vendor.email && <p className="text-muted-foreground"><span className="font-medium text-foreground">Email:</span> {vendor.email}</p>}
            {facilities && facilities.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border space-y-2">
                {facilities.map((f) => (
                  <div key={f.id} className="space-y-0.5">
                    <p className="font-semibold text-foreground flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />{f.name}</p>
                    {f.address_line1 && <p className="text-muted-foreground pl-3.5">{f.address_line1}{f.city ? `, ${f.city}` : ""}{f.state ? ` ${f.state}` : ""} {f.zip || ""}</p>}
                    {f.pickup_window && <p className="text-muted-foreground pl-3.5"><span className="font-medium text-foreground">Pickup:</span> {f.pickup_window}</p>}
                    {f.pickup_contact && <p className="text-muted-foreground pl-3.5"><span className="font-medium text-foreground">Contact:</span> {f.pickup_contact} {f.pickup_phone || ""}</p>}
                    {f.is_24h && <span className="inline-block ml-3.5 text-[9px] font-semibold px-1.5 py-0 rounded bg-teal-50 text-teal-600 border border-teal-200/50">24h</span>}
                    {f.notes && <p className="text-muted-foreground/70 pl-3.5 italic">{f.notes}</p>}
                  </div>
                ))}
              </div>
            )}
            {facilities && facilities.length === 0 && <p className="text-muted-foreground/50 mt-1 italic">No facilities on file</p>}
            {!facilities && showInfo && <p className="text-muted-foreground/50 mt-1">Loading...</p>}
          </div>
        </>
      )}
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

  /* Color map for mailing classes */
  const MAIL_CLASS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    "First Class":    { bg: "bg-blue-50 dark:bg-blue-950/30",    text: "text-blue-700 dark:text-blue-400",    border: "border-blue-300 dark:border-blue-700" },
    "Marketing":      { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-400", border: "border-orange-300 dark:border-orange-700" },
    "Non-Profit":     { bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-700 dark:text-violet-400", border: "border-violet-300 dark:border-violet-700" },
    "Retail":         { bg: "bg-slate-50 dark:bg-slate-950/30",   text: "text-slate-700 dark:text-slate-400",   border: "border-slate-300 dark:border-slate-700" },
    "Parcel Select":  { bg: "bg-teal-50 dark:bg-teal-950/30",    text: "text-teal-700 dark:text-teal-400",    border: "border-teal-300 dark:border-teal-700" },
    "Media Mail":     { bg: "bg-amber-50 dark:bg-amber-950/30",  text: "text-amber-700 dark:text-amber-400",  border: "border-amber-300 dark:border-amber-700" },
    "Library Mail":   { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-300 dark:border-emerald-700" },
    "Bound Printed Matter": { bg: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-700 dark:text-rose-400", border: "border-rose-300 dark:border-rose-700" },
    "Single Piece":   { bg: "bg-gray-50 dark:bg-gray-950/30",    text: "text-gray-700 dark:text-gray-400",    border: "border-gray-300 dark:border-gray-700" },
    "Stamps":         { bg: "bg-pink-50 dark:bg-pink-950/30",    text: "text-pink-700 dark:text-pink-400",    border: "border-pink-300 dark:border-pink-700" },
  }
  const ALL_MAIL_CLASSES = Object.keys(MAIL_CLASS_COLORS)

  function MailClassSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const colors = MAIL_CLASS_COLORS[value]
    return (
      <div className="min-w-0">
        <span className="text-[10px] text-muted-foreground font-medium mb-1 block">Mailing Class</span>
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full text-xs font-semibold rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-ring/30 transition-all appearance-none cursor-pointer border",
            colors ? `${colors.bg} ${colors.text} ${colors.border}` : "bg-background text-foreground border-border"
          )}
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2364748b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", paddingRight: "24px" }}
        >
          <option value="">--</option>
          {ALL_MAIL_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
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

/* ════════════════════════════════════════════════�������������═══
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
   DEFAULT NEXT STEPS (fallback if not configured)
   ════════════════════════════════════════════════════ */
const DEFAULT_NEXT_STEPS = [
  "Working on Quote",
  "Waiting for Approval",
  "Waiting for Customer Reply",
  "Waiting for List",
  "Ready to Print",
  "Printing in Progress",
  "Prints Arrived",
  "Working on Mailing",
  "Ready to Mail",
  "Out for Delivery",
  "Brand New",
]

const ZENDESK_BASE = "https://postageplus.zendesk.com/agent/tickets/"

/* ════════════════════════════════��══���═══════════���════
   QUICK NOTES POPUP (like PostFlow)
   ═══════════════════════════════════════════════════�� */
function QuickNotesPopup({ value, onChange, onClose }: { value: string; onChange: (v: string) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { ref.current?.focus() }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (draft !== value) onChange(draft)
        onClose()
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [draft, value, onChange, onClose])

  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0

  return (
    <div ref={containerRef} className="absolute right-0 top-0 z-20 w-56 rounded-lg border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
      <div className="px-3 py-2 border-b border-border">
        <p className="text-[11px] font-semibold text-foreground">Quick Notes</p>
      </div>
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Add a note..."
        className="w-full px-3 py-2 text-xs text-foreground bg-transparent resize-none outline-none min-h-[80px]"
        onKeyDown={(e) => {
          if (e.key === "Escape") { onClose(); return }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { if (draft !== value) onChange(draft); onClose() }
        }}
      />
      <div className="px-3 py-1.5 border-t border-border flex items-center justify-between">
        <span className="text-[9px] text-muted-foreground">{wordCount} word{wordCount !== 1 ? "s" : ""}</span>
        <button onClick={() => { if (draft !== value) onChange(draft); onClose() }}
          className="text-[10px] font-medium text-foreground hover:text-foreground/70 transition-colors">Done</button>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════
   EDITABLE ZD# INLINE (click to edit, links to Zendesk)
   ════════════════════════════════════════════════════ */
function ZendeskField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing) ref.current?.focus() }, [editing])

  const commit = () => { setEditing(false); if (draft !== value) onChange(draft) }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px]" onClick={(e) => e.stopPropagation()}>
        <FileText className="h-3 w-3 text-muted-foreground/50" />
        <span className="text-muted-foreground/50">ZD#</span>
        <input ref={ref} value={draft} onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value); setEditing(false) } }}
          className="w-16 text-[11px] font-mono text-foreground bg-transparent border-b border-foreground/20 outline-none"
          placeholder="10558"
        />
      </span>
    )
  }

  if (value) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] group/zd">
        <FileText className="h-3 w-3 text-emerald-500" />
        <span className="text-muted-foreground/50">ZD#</span>
        <a href={`${ZENDESK_BASE}${value}`} target="_blank" rel="noopener noreferrer"
          className="font-mono text-emerald-600 dark:text-emerald-400 font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
          {value}
        </a>
        <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/30 group-hover/zd:text-emerald-500 transition-colors" />
        <button onClick={(e) => { e.stopPropagation(); setEditing(true) }}
          className="h-4 w-4 flex items-center justify-center rounded text-muted-foreground/30 hover:text-foreground opacity-0 group-hover/zd:opacity-100 transition-opacity">
          <Pencil className="h-2.5 w-2.5" />
        </button>
      </span>
    )
  }

  return (
    <button onClick={(e) => { e.stopPropagation(); setEditing(true) }}
      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/40 hover:text-muted-foreground transition-colors">
      <FileText className="h-3 w-3" />ZD# <span className="font-mono">---</span>
    </button>
  )
}

/* ══════════════════��═════════════��═══════════════════
   NEXT STEP SELECTOR
   ════════════════════════════════════════════════════ */
function NextStepSelect({ value, onChange, steps }: { value: string; onChange: (v: string) => void; steps: string[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [isOpen])

  // Determine dot color based on step keywords
  const getDotColor = (step: string) => {
    const s = step.toLowerCase()
    if (s.includes("wait")) return "bg-amber-500"
    if (s.includes("ready") || s.includes("done") || s.includes("arrived")) return "bg-emerald-500"
    if (s.includes("work") || s.includes("progress")) return "bg-sky-500"
    if (s.includes("brand new")) return "bg-violet-500"
    if (s.includes("deliver") || s.includes("mail")) return "bg-blue-500"
    return "bg-orange-500"
  }

  return (
    <div ref={containerRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground/80 hover:text-foreground transition-colors w-full">
        <span className={cn("h-2 w-2 rounded-full shrink-0", getDotColor(value || ""))} />
        <span className="truncate">{value || "Set status..."}</span>
        <ChevronDown className={cn("h-3 w-3 text-muted-foreground/40 shrink-0 ml-auto transition-transform", isOpen && "rotate-180")} />
      </button>
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-1 w-56 rounded-lg border border-border bg-card shadow-xl z-30 py-1 max-h-52 overflow-y-auto">
          {steps.map((step) => (
            <button key={step} onClick={() => { onChange(step); setIsOpen(false) }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left hover:bg-secondary transition-colors",
                step === value ? "font-semibold text-foreground" : "text-muted-foreground"
              )}>
              <span className={cn("h-2 w-2 rounded-full shrink-0", getDotColor(step))} />
              {step}
              {step === value && <Check className="h-3 w-3 ml-auto text-foreground" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ������═══════════════����══════════════════════════════════
   MAIL DATE PICKER (Yesterday / Today / Tomorrow / custom)
   ══════════════�����═════���══════════════════════════════ */
function getDateLabel(dateStr: string | undefined) {
  if (!dateStr) return null
  const d = new Date(dateStr + "T12:00:00")
  const today = new Date(); today.setHours(12, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return { label: "TODAY", color: "text-sky-700 bg-sky-100 dark:text-sky-400 dark:bg-sky-900/30 border-sky-200/50 dark:border-sky-800/30" }
  if (diff === 1) return { label: "TOMORROW", color: "text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30 border-emerald-200/50 dark:border-emerald-800/30" }
  if (diff === -1) return { label: "YESTERDAY", color: "text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30 border-amber-200/50 dark:border-amber-800/30" }
  if (diff < -1) return { label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), color: "text-destructive bg-destructive/10 border-destructive/20" }
  return { label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), color: "text-foreground/70 bg-secondary border-border" }
}

function toISO(date: Date) { return date.toISOString().split("T")[0] }

function MailDatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [showPicker, setShowPicker] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showPicker) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowPicker(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [showPicker])

  const today = new Date(); today.setHours(12, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

  const info = getDateLabel(value)

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setShowPicker(!showPicker)}
        className={cn(
          "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md border transition-colors",
          info ? info.color : "text-muted-foreground bg-transparent border-border hover:bg-secondary"
        )}>
        <CalendarDays className="h-3 w-3" />
        {info ? info.label : "Set Mail Date"}
      </button>
      {showPicker && (
        <div className="absolute top-full left-0 mt-1 z-30 w-48 rounded-lg border border-border bg-card shadow-xl py-1">
          {[
            { label: "Yesterday", date: yesterday },
            { label: "Today", date: today },
            { label: "Tomorrow", date: tomorrow },
          ].map((opt) => {
            const iso = toISO(opt.date)
            return (
              <button key={opt.label} onClick={() => { onChange(iso); setShowPicker(false) }}
                className={cn("w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left hover:bg-secondary transition-colors",
                  value === iso ? "font-semibold text-foreground" : "text-muted-foreground"
                )}>
                {opt.label}
                {value === iso && <Check className="h-3 w-3 ml-auto text-foreground" />}
              </button>
            )
          })}
          <div className="border-t border-border mt-1 pt-1 px-3 pb-1">
            <label className="text-[10px] text-muted-foreground font-medium block mb-1">Custom date</label>
            <input type="date" value={value || ""} onChange={(e) => { onChange(e.target.value); setShowPicker(false) }}
              className="w-full text-[11px] text-foreground bg-secondary rounded-md px-2 py-1 border border-border outline-none" />
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
  const [showQuickNotes, setShowQuickNotes] = useState(false)
  const { data: appSettings } = useSWR<Record<string, unknown>>("/api/app-settings", fetcher)
  const { data: vendors } = useSWR<Vendor[]>(open ? "/api/vendors" : null, fetcher)
  const nextSteps: string[] = (appSettings?.next_steps as string[] | undefined) || DEFAULT_NEXT_STEPS
  const colIdx = columns.findIndex((c) => c.id === quote.column_id)
  const canL = !isArchived && colIdx > 0
  const canR = !isArchived && colIdx < columns.length - 1

  const rawMeta: JobMeta = quote.job_meta || {}
  const derived = useMemo(() => deriveMetaFromItems(quote), [quote])
  // Merge: saved meta wins over derived, derived fills gaps
  const meta: JobMeta = useMemo(() => ({ ...derived, ...rawMeta }), [derived, rawMeta])
  const overdue = isOverdue(meta)
  const days = daysOverdue(meta)
  const printDone = (() => { const pm = meta.piece_meta; return !!(pm && pm.length > 0 && pm.every((p) => p.prints_arrived)) || sectionDone(rawMeta, ["prints_arrived"]) })()
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
        isArchived ? "opacity-50 border-border"
        : boardType === "job"
          ? "border-teal-400/30 dark:border-teal-700/30 hover:border-teal-400/50 dark:hover:border-teal-600/50 hover:shadow-md"
          : "border-border hover:border-foreground/20 hover:shadow-md",
        open
          ? boardType === "job"
            ? "shadow-md ring-1 ring-teal-400/10 dark:ring-teal-600/10"
            : "shadow-md ring-1 ring-foreground/5"
          : "shadow-sm"
      )}
    >
      {/* ── CARD CONTENT (PostFlow style) ── */}
      <div className="px-4 pt-3 pb-3">
        {/* Row 1: Title + icons */}
        <div className="flex items-start justify-between gap-2 mb-0.5 relative">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0 cursor-grab" />
            {boardType === "job" && (
              <span className="shrink-0 text-[8px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400 border border-teal-200/50 dark:border-teal-700/30">Active</span>
            )}
            <p className="text-[15px] font-bold text-foreground truncate leading-snug">{quote.project_name || "Untitled"}</p>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={(e) => { e.stopPropagation(); setShowQuickNotes(!showQuickNotes) }}
              className={cn("h-6 w-6 flex items-center justify-center rounded transition-colors",
                showQuickNotes ? "text-foreground bg-secondary" : "text-muted-foreground/40 hover:text-foreground"
              )} title="Quick Notes">
              <NotepadText className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setOpen(!open)}
              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground/40 hover:text-foreground transition-colors" title="Expand">
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-90")} />
            </button>
          </div>
          {/* Quick Notes popup */}
          {showQuickNotes && (
            <QuickNotesPopup
              value={meta.quick_notes || quote.notes || ""}
              onChange={(v) => updateMeta({ quick_notes: v })}
              onClose={() => setShowQuickNotes(false)}
            />
          )}
        </div>

        {/* Row 2: Subtitle (contact name) */}
        <p className="text-[13px] text-muted-foreground ml-6 mb-2.5 truncate">{quote.contact_name || "\u00A0"}</p>

        {/* Row 3: Mail Date picker + Assignee badge */}
        <div className="flex items-center gap-2 ml-6 mb-3 flex-wrap">
          <MailDatePicker value={meta.due_date || ""} onChange={(v) => updateMeta({ due_date: v })} />
          {meta.assignee ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200/50 dark:border-orange-800/30">
              <User className="h-3 w-3" />{meta.assignee}
            </span>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); setOpen(true) }}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/40 px-2.5 py-1 rounded-md border border-dashed border-border hover:border-foreground/20 hover:text-muted-foreground transition-colors">
              <User className="h-3 w-3" /> Assign
            </button>
          )}
          {meta.mailing_class && MAIL_CLASS_COLORS[meta.mailing_class] && (
            <span className={cn(
              "inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md border",
              MAIL_CLASS_COLORS[meta.mailing_class].bg,
              MAIL_CLASS_COLORS[meta.mailing_class].text,
              MAIL_CLASS_COLORS[meta.mailing_class].border,
            )}>
              {meta.mailing_class}
            </span>
          )}
          {overdue && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-destructive/10 text-destructive">
              OVERDUE ({days}d)
            </span>
          )}
        </div>

        {/* Row 4: ZD# (editable, links to Zendesk) + INV */}
        <div className="flex items-center gap-4 ml-6 mb-2">
          <ZendeskField value={meta.zendesk_ticket || ""} onChange={(v) => updateMeta({ zendesk_ticket: v })} />
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/50">
            <Hash className="h-3 w-3" />INV <span className="font-mono text-foreground/70">{quote.reference_number || "---"}</span>
          </span>
        </div>

        {/* Row 5: Add note / notes preview */}
        <div className="ml-6 mb-3">
          {(meta.quick_notes || quote.notes) ? (
            <button onClick={(e) => { e.stopPropagation(); setShowQuickNotes(true) }}
              className="text-[11px] text-muted-foreground italic line-clamp-1 text-left hover:text-foreground transition-colors">
              {meta.quick_notes || quote.notes}
            </button>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); setShowQuickNotes(true) }}
              className="text-[11px] text-muted-foreground/30 hover:text-muted-foreground transition-colors italic">
              Add note...
            </button>
          )}
        </div>

        {/* Row 6: Next Step status dropdown */}
        <div className="ml-6 pt-2 border-t border-border/40">
          <NextStepSelect value={meta.next_step || ""} onChange={(v) => updateMeta({ next_step: v })} steps={nextSteps} />
        </div>

        {/* Row 7: Activate Job (only on quote board) */}
        {!isArchived && boardType === "quote" && onConvertToJob && (
          <div className="pt-2 pb-1 ml-6">
            <button
              onClick={(e) => {
                e.stopPropagation()
                const btn = e.currentTarget
                btn.classList.add("activate-pulse")
                setTimeout(() => { btn.classList.remove("activate-pulse"); onConvertToJob(quote.id) }, 400)
              }}
              className="group relative overflow-hidden inline-flex items-center gap-1.5 rounded-full border border-foreground/15 bg-foreground/[0.04] hover:bg-foreground hover:text-background px-3 py-1.5 text-[10px] font-semibold tracking-wide text-foreground/60 transition-all duration-200 hover:shadow-sm active:scale-95"
            >
              <Zap className="h-3 w-3 transition-transform group-hover:text-teal-400 group-hover:scale-110" />
              <span>Activate</span>
              <style>{`
                @keyframes activatePulse {
                  0% { box-shadow: 0 0 0 0 rgba(45, 212, 191, 0.4); }
                  70% { box-shadow: 0 0 0 8px rgba(45, 212, 191, 0); }
                  100% { box-shadow: 0 0 0 0 rgba(45, 212, 191, 0); }
                }
                .activate-pulse {
                  animation: activatePulse 0.4s ease-out;
                  background: hsl(var(--foreground)) !important;
                  color: hsl(var(--background)) !important;
                }
              `}</style>
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
                <button onClick={(e) => {
                    e.stopPropagation()
                    const btn = e.currentTarget
                    btn.classList.add("activate-pulse")
                    setTimeout(() => { btn.classList.remove("activate-pulse"); onConvertToJob(quote.id) }, 400)
                  }}
                  className="group h-6 px-2 flex items-center justify-center gap-1 rounded-full border border-foreground/15 bg-foreground/[0.04] text-foreground/60 hover:bg-foreground hover:text-background text-[10px] font-semibold tracking-wide transition-all duration-200 active:scale-95" title="Activate Job">
                  <Zap className="h-2.5 w-2.5 group-hover:text-teal-400" />
                  Activate
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

            {/* ── MAIL PIECES: simplified for jobs (type + vendor only), full for quotes ── */}
            {(() => {
              const pieces = (quote.items || []).filter((it) =>
                ["flat", "booklet", "spiral", "perfect", "ohp", "envelope"].includes(it.category)
              )
              if (pieces.length === 0) return null
              const typeHints = ["Postcard", "Flat", "Booklet", "Letter", "Self-Mailer", "Spiral", "Envelope", "Card"]

              // Full detail cards with price (shared for both quote + job boards)
              const cols = pieces.length === 1 ? 1 : pieces.length === 2 ? 2 : 3
              // Collect vendor info from OHP or customer-provided pieces
              const vendorInfos: { name: string; date?: string }[] = []
              for (const pc of pieces) {
                const md = pc.metadata as Record<string, unknown> | undefined
                const isOHP = pc.category === "ohp"
                if (isOHP) {
                  const vn = pc.description?.split("|")[0]?.trim()
                  if (vn) vendorInfos.push({ name: vn })
                } else if (md?.customerProvided && md?.providerVendor) {
                  vendorInfos.push({ name: md.providerVendor as string, date: md.providerExpectedDate as string | undefined })
                }
              }
              // Helper to update per-piece meta
              const pieceMetas: PieceMeta[] = meta.piece_meta || []
              const getPm = (idx: number): PieceMeta => pieceMetas[idx] || {}
              const setPm = (idx: number, patch: Partial<PieceMeta>) => {
                const arr = [...pieceMetas]
                while (arr.length <= idx) arr.push({})
                arr[idx] = { ...arr[idx], ...patch }
                updateMeta({ piece_meta: arr })
              }

              // Pre-compute data for each piece
              const pieceData = pieces.map((pc, i) => {
                const label = pc.label || pc.description || pc.category
                const md = pc.metadata as Record<string, unknown> | undefined
                const sizeStr = (md?.pieceDimensions as string)
                  ? `${(md.pieceDimensions as string).replace("x", '" x ')}"`
                  : (() => { const m = label.match(/(\d+\.?\d*)\s*[""]?\s*[xX×]\s*(\d+\.?\d*)\s*[""]?/); return m ? `${m[1]}" x ${m[2]}"` : null })()
                const isOHP = pc.category === "ohp"
                const qtyStr = (() => {
                  const m1 = label.match(/([\d,]+)\s*[-–]/)
                  if (m1) return m1[1]
                  const m2 = label.match(/([\d,]+)\s+\w/)
                  if (m2) return m2[1]
                  return ""
                })()
                const foundType = (md?.pieceLabel as string) || (md?.pieceType as string) || typeHints.find((t) => label.toLowerCase().includes(t.toLowerCase())) || pc.category
                const paper = md?.paperName as string | undefined
                const sides = md?.sides as string | undefined
                const bleed = md?.hasBleed as boolean | undefined
                const pages = md?.pageCount as number | undefined
                const production = md?.production as string | undefined
                const printDetails = [paper, sides, bleed ? "Bleed" : null, pages ? `${pages}pg` : null].filter(Boolean)
                // Show actual vendor name from piece_meta if set, otherwise show production route label
                const pmVendor = getPm(i).vendor
                const prodLabel = (() => {
                  if (pmVendor) return pmVendor
                  const prodLabels: Record<string, string> = { inhouse: "PrintOut", ohp: "OHP", both: "Both", customer: "Customer" }
                  return production ? prodLabels[production] || null : null
                })()
                return { pc, i, md, sizeStr, isOHP, qtyStr, foundType, printDetails, prodLabel, production, pmVendor }
              })

              // Smart grid: 1->1col, 2->2col, 3->3col, 4->2col(2rows), 5+->3col
              const gridCls = pieces.length === 1 ? "grid-cols-1"
                : pieces.length === 2 ? "grid-cols-2"
                : pieces.length === 4 ? "grid-cols-2"
                : "grid-cols-3"

              return (
                <div>
                  {/* Header row: huge count + label */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-4xl font-black text-foreground leading-none tabular-nums">{pieces.length}</span>
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Mail<br/>Pieces</span>
                  </div>

                  {/* ROW 1: Piece cards -- all equal height via grid stretch */}
                  <div className={cn("grid gap-2", gridCls)}>
                    {pieceData.map(({ pc, i, isOHP, qtyStr, sizeStr, foundType, printDetails, prodLabel, production, pmVendor }) => (
                      <div key={i} className={cn("rounded-lg border bg-card p-3 flex flex-col min-h-[100px]", isOHP ? "border-sky-200 dark:border-sky-800/40" : "border-border")}>
                        {/* Type name */}
                        <div className="flex items-center gap-1.5">
                          {isOHP && <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 shrink-0">OHP</span>}
                          <span className="text-base font-extrabold text-foreground truncate leading-tight">{foundType}</span>
                        </div>
                        {/* Qty + size */}
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mt-1">
                          {qtyStr && <span className="text-[11px] text-muted-foreground"><span className="font-semibold text-foreground">{qtyStr}</span> pcs</span>}
                          {sizeStr && <span className="text-[11px] text-muted-foreground">{sizeStr}</span>}
                        </div>
                        {/* Printing specs */}
                        {printDetails.length > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{printDetails.join(" / ")}</p>
                        )}
                        {/* Vendor / Production tag */}
                        {prodLabel && (
                          <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded self-start mt-1",
                            prodLabel.startsWith("PrintOut") ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : production === "ohp" || (pmVendor && !pmVendor.startsWith("PrintOut")) ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
                            : production === "customer" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-muted text-muted-foreground"
                          )}>{prodLabel}</span>
                        )}
                        {/* Price anchored bottom */}
                        <span className="text-xs font-bold font-mono text-foreground/70 tabular-nums mt-auto pt-1.5">{formatCurrency(pc.amount)}</span>
                      </div>
                    ))}
                  </div>

                  {/* ROW 2: Per-piece vendor/date/arrived -- ALL pieces get tracking */}
                  <div className={cn("grid gap-2 mt-2", gridCls)}>
                    {pieceData.map(({ i, production }) => {
                      const pm = getPm(i)
                      const isInhouse = !production || production === "inhouse"
                      const internalVendors = (vendors || []).filter((v) => v.is_internal)
                      const externalVendors = (vendors || []).filter((v) => !v.is_internal)

                      return (
                        <div key={i} className={cn("rounded-lg border bg-card px-3 py-2.5 transition-colors", pm.prints_arrived ? "border-emerald-400/60 bg-emerald-50/30 dark:bg-emerald-950/20" : "border-border")}>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                            <div className="min-w-0">
                              <span className="text-[10px] text-muted-foreground font-medium mb-1 block">Vendor</span>
                              <select
                                value={pm.vendor || ""}
                                onChange={(e) => setPm(i, { vendor: e.target.value })}
                                className="w-full text-xs font-medium text-foreground bg-background border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-ring/30 focus:border-foreground/30 transition-all appearance-none cursor-pointer"
                                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2364748b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", paddingRight: "24px" }}
                              >
                                <option value="">Select vendor...</option>
                                {isInhouse ? (
                                  /* In-house pieces: show only PrintOut locations */
                                  internalVendors.map((v) => <option key={v.id} value={v.company_name}>{v.company_name}</option>)
                                ) : (
                                  /* OHP/Both/Customer: show external vendors first, then internal in a separate group */
                                  <>
                                    {externalVendors.length > 0 && (
                                      <optgroup label="External Vendors">
                                        {externalVendors.map((v) => <option key={v.id} value={v.company_name}>{v.company_name}</option>)}
                                      </optgroup>
                                    )}
                                    {internalVendors.length > 0 && (
                                      <optgroup label="PrintOut (In-House)">
                                        {internalVendors.map((v) => <option key={v.id} value={v.company_name}>{v.company_name}</option>)}
                                      </optgroup>
                                    )}
                                  </>
                                )}
                              </select>
                            </div>
                            <EtaDateField value={pm.expected_date || ""} onChange={(v) => setPm(i, { expected_date: v })} time={pm.expected_time || ""} onTimeChange={(v) => setPm(i, { expected_time: v })} />
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <MetaCheck label="Prints Arrived" checked={!!pm.prints_arrived} onChange={(c) => setPm(i, { prints_arrived: c })} />
                            {pm.vendor && vendors && <VendorInfoPopover vendorName={pm.vendor} vendors={vendors} />}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* ── ROW: Postage Details (full width) ── */}
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2.5">Postage Details</p>
              <div className="grid grid-cols-3 gap-x-3 gap-y-2">
                <MailClassSelect value={meta.mailing_class || ""} onChange={(v) => updateMeta({ mailing_class: v })} />
                <FieldSelect label="Drop Off Location" value={meta.drop_off || ""} onChange={(v) => updateMeta({ drop_off: v })}
                  options={["Brooklyn", "Monsey", "KJ", "Lakewood"]} />
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={!!meta.international} onCheckedChange={(c) => updateMeta({ international: !!c })} className="h-4 w-4 rounded" />
                    <span className="text-[11px] text-muted-foreground font-medium select-none">Mail International</span>
                  </label>
                </div>
              </div>
            </div>

            {/* ── ROW: Vendor Job # ── */}
            <div className="rounded-lg border border-border bg-card p-3">
              <FieldInput label="Vendor Job / PO #" value={meta.vendor_job || ""} placeholder="PO-2024-..." onChange={(v) => updateMeta({ vendor_job: v })} />
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
              <FieldInput label="Mail Date" value={meta.due_date || ""} type="date" onChange={(v) => updateMeta({ due_date: v })} />
            </div>

            {/* ── Files ── */}
            <JobFilesInline quoteId={quote.id} onOpenPanel={() => setShowFiles(true)} />

            {/* ── Line items (only on quote board) ── */}
            {boardType === "quote" && (quote.items || []).length > 0 && (
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

/* ═════════════════════════════���═══════════════════���══
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
      {boardType === "job" && <div className="h-px rounded-full bg-gradient-to-r from-teal-400/40 to-emerald-400/40 mb-1 mx-1" />}
      <div className="flex items-center justify-between px-1 pb-1.5 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: col.color }} />
          <span className={cn("text-[11px] font-semibold", boardType === "job" ? "text-teal-700 dark:text-teal-400" : "text-foreground")}>{col.title}</span>
          <span className="text-[9px] font-mono text-muted-foreground/60 tabular-nums">{quotes.length}</span>
        </div>
        <span className="text-[9px] font-mono text-muted-foreground/50 tabular-nums">{formatCurrency(colTotal)}</span>
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const id = e.dataTransfer.getData("text/plain"); if (id) onColumnChange(id, col.id) }}
        className={cn("flex-1 flex flex-col gap-2.5 p-1.5 rounded-lg overflow-y-auto transition-colors min-h-0",
          dragOver
            ? boardType === "job" ? "bg-teal-50/30 dark:bg-teal-950/10 ring-1 ring-teal-300/15" : "bg-foreground/[0.03] ring-1 ring-foreground/10"
            : boardType === "job" ? "bg-teal-50/10 dark:bg-teal-950/5" : "bg-secondary/20"
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

/* ════════════════════════���═══════════════════════════
   MAIN KANBAN BOARD
   ════════════════════════════════════��═══════════════ */

export function KanbanBoard({ boardType = "quote", viewMode = "board", onLoadQuote }: {
  boardType?: "quote" | "job"; viewMode?: "board" | "list" | "sidebar"; onLoadQuote: (quoteId: string) => void
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
  const [sidebarColId, setSidebarColId] = useState<string | null>(null)

  // Auto-select first column for sidebar view when columns load
  const resolvedSidebarColId = sidebarColId && columns?.some((c) => c.id === sidebarColId) ? sidebarColId : columns?.[0]?.id || null

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

    // --- Piece description: prefer structured metadata, fallback to regex ---
    const printingItems = items.filter((it) => ["flat", "booklet", "spiral", "perfect"].includes(it.category))
    if (printingItems.length > 0 && !meta.piece_desc) {
      const pm = printingItems[0].metadata as Record<string, unknown> | undefined
      if (pm?.pieceDimensions || pm?.pieceLabel) {
        const dims = (pm.pieceDimensions as string) || ""
        const type = (pm.pieceLabel as string) || (pm.pieceType as string) || ""
        meta.piece_desc = dims && type ? `${dims} ${type}` : (dims || type)
      } else {
        const desc = printingItems[0].description || printingItems[0].label || ""
        const sizeMatch = desc.match(/(\d+\.?\d*)\s*[xX×]\s*(\d+\.?\d*)/i)
        const sizeStr = sizeMatch ? `${sizeMatch[1]}x${sizeMatch[2]}` : ""
        const typeHints = ["Postcard", "Flat Card", "Folded Card", "Booklet", "Letter", "Self-Mailer", "Spiral", "Perfect Bound"]
        const foundType = typeHints.find((t) => desc.toLowerCase().includes(t.toLowerCase())) || printingItems[0].label?.split(" - ").pop()?.split(",")[0]?.trim() || ""
        meta.piece_desc = sizeStr && foundType ? `${sizeStr} ${foundType}` : (sizeStr || foundType || desc.split(",")[0]?.trim() || "")
      }
      // Production route from metadata
      if (pm?.production && !meta.printed_by) {
        const prodMap: Record<string, string> = { inhouse: "PrintOut", ohp: "Out of House", both: "Both", customer: "Customer Provided" }
        meta.printed_by = prodMap[pm.production as string] || undefined
      }
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

  // --- Mailing class: prefer structured metadata, fallback to regex ---
  const postageItems = items.filter((it) => it.category === "postage")
  if (postageItems.length > 0 && !meta.mailing_class) {
  const pm = postageItems[0].metadata as Record<string, unknown> | undefined
  if (pm?.mailingClass) {
    meta.mailing_class = pm.mailingClass as string
  } else {
    const pDesc = postageItems[0].description || postageItems[0].label || ""
    const classHints = ["First Class", "1st Class", "Standard", "Marketing", "Non-Profit", "Priority", "Presorted"]
    const foundClass = classHints.find((c) => pDesc.toLowerCase().includes(c.toLowerCase()))
    meta.mailing_class = foundClass || pDesc.split(",")[0]?.replace(/Postage\s*[-–]\s*/i, "").trim() || ""
  }
  // Drop-off / entry point from metadata
  if (!meta.drop_off && pm) {
    meta.drop_off = (pm.entryPoint as string) || (pm.dropOff as string) || undefined
  }
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
  meta.printed_by = "PrintOut"
  }

    // --- Build piece_meta: auto-set vendor per piece based on production route ---
    if (!meta.piece_meta || meta.piece_meta.length === 0) {
      const allPieceItems = items.filter((it) =>
        ["flat", "booklet", "spiral", "perfect", "envelope", "ohp"].includes(it.category)
      )
      if (allPieceItems.length > 0) {
        meta.piece_meta = allPieceItems.map((it) => {
          const pm: PieceMeta = {}
          const md = it.metadata as Record<string, unknown> | undefined
          const production = md?.production as string | undefined
          if (!production || production === "inhouse") {
            // Default to PrintOut -- user can pick exact location on the job board
            pm.vendor = ""
          } else if (it.category === "ohp") {
            // Extract vendor from OHP description: "VendorName | +15% markup"
            const vendorFromDesc = (it.description || "").split("|")[0]?.trim()
            if (vendorFromDesc) pm.vendor = vendorFromDesc
          }
          return pm
        })
      }
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
  const label = isJob ? "Active Job" : "Quote"

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

      {/* ── SIDEBAR VIEW ── */}
      {viewMode === "sidebar" && (() => {
        const activeCol = cols.find((c) => c.id === resolvedSidebarColId)
        const sidebarQuotes = filteredQuotes.filter((q) => q.column_id === resolvedSidebarColId)
        const unassigned = filteredQuotes.filter((q) => !q.column_id || !cols.some((c) => c.id === q.column_id))

        return (
          <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-0">
            {/* Stage tabs -- horizontal scroll on mobile, vertical sidebar on desktop */}
            <div className="shrink-0 md:w-44 md:border-r border-b md:border-b-0 border-border flex md:flex-col min-h-0 overflow-x-auto md:overflow-x-visible md:overflow-y-auto">
              <div className="flex md:flex-col gap-0 min-w-max md:min-w-0 w-full">
                {cols.map((col) => {
                  const count = filteredQuotes.filter((q) => q.column_id === col.id).length
                  const colTotal = filteredQuotes.filter((q) => q.column_id === col.id).reduce((s, q) => s + Number(q.total), 0)
                  const isActive = col.id === resolvedSidebarColId
                  return (
                    <button
                      key={col.id}
                      onClick={() => setSidebarColId(col.id)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 md:py-2.5 text-left transition-all shrink-0",
                        "md:border-l-2 border-b-2 md:border-b-0",
                        isActive
                          ? "bg-secondary/60 md:border-l-foreground border-b-foreground"
                          : "md:border-l-transparent border-b-transparent hover:bg-secondary/30"
                      )}
                    >
                      <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                      <span className={cn("text-[11px] font-medium whitespace-nowrap", isActive ? "text-foreground" : "text-muted-foreground")}>{col.title}</span>
                      <span className={cn("text-[10px] font-mono tabular-nums shrink-0", isActive ? "text-foreground" : "text-muted-foreground/60")}>{count}</span>
                      {count > 0 && <span className="text-[9px] font-mono text-muted-foreground/50 tabular-nums hidden md:inline">{formatCurrency(colTotal)}</span>}
                    </button>
                  )
                })}
                {unassigned.length > 0 && (
                  <button
                    onClick={() => setSidebarColId("__unassigned__")}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 md:py-2.5 text-left transition-all shrink-0",
                      "md:border-l-2 border-b-2 md:border-b-0 md:border-t md:border-t-border",
                      (resolvedSidebarColId === "__unassigned__" || (!resolvedSidebarColId && sidebarColId === "__unassigned__"))
                        ? "bg-secondary/60 md:border-l-foreground border-b-foreground"
                        : "md:border-l-transparent border-b-transparent hover:bg-secondary/30"
                    )}
                  >
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/30 shrink-0" />
                    <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">Unassigned</span>
                    <span className="text-[10px] font-mono text-muted-foreground/60 tabular-nums shrink-0">{unassigned.length}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Main content: cards in a responsive grid */}
            <div className="flex-1 min-h-0 overflow-y-auto p-2 md:p-3">
              {/* Stage header */}
              {activeCol && sidebarColId !== "__unassigned__" && (
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: activeCol.color }} />
                  <span className="text-sm font-semibold text-foreground">{activeCol.title}</span>
                  <span className="text-[10px] font-mono text-muted-foreground/60 tabular-nums">{sidebarQuotes.length} active</span>
                  <span className="text-[10px] font-mono text-muted-foreground/40 tabular-nums ml-auto">{formatCurrency(sidebarQuotes.reduce((s, q) => s + Number(q.total), 0))}</span>
                </div>
              )}
              {sidebarColId === "__unassigned__" && (
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30 shrink-0" />
                  <span className="text-sm font-semibold text-foreground">Unassigned</span>
                  <span className="text-[10px] font-mono text-muted-foreground/60 tabular-nums">{unassigned.length}</span>
                </div>
              )}

              {/* Cards -- responsive grid: 1 col mobile (full width), 2 cols on larger screens */}
              {(() => {
                const cardsToShow = sidebarColId === "__unassigned__" ? unassigned : sidebarQuotes
                if (cardsToShow.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center mb-2">
                        <Briefcase className="h-4 w-4 text-muted-foreground/40" />
                      </div>
                      <p className="text-xs text-muted-foreground/50">No {label.toLowerCase()}s in this stage</p>
                    </div>
                  )
                }
                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                    {cardsToShow.map((q) => (
                      <QuoteCard key={q.id} quote={q} columns={cols}
                        onColumnChange={handleColumnChange} onDelete={handleDelete} onArchive={handleArchive}
                        onRestore={handleRestore} onPatch={handlePatch}
                        onEdit={(id) => { const found = filteredQuotes.find((x) => x.id === id); if (found) setDetailQuote(found) }}
                        onConvertToJob={boardType === "quote" ? handleConvertToJob : undefined}
                        boardType={boardType} />
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>
        )
      })()}

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
