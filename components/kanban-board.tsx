"use client"

import { useState, useCallback, useMemo, useRef, useEffect, type ReactNode } from "react"
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
  printed_by?: string; vendor_job?: string; prints_arrived?: boolean
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

  // OHP items indicate out-of-house printing
  const ohpItems = items.filter((it) => it.category === "ohp")
  if (ohpItems.length > 0) {
    derived.printed_by = ohpItems[0].label?.replace(/Out of House\s*[-–:]\s*/i, "").replace(/OHP[:\s]*/i, "").trim() || "Out of House"
  } else if (printItems.length > 0) {
    derived.printed_by = "In-House"
  }

  return derived
}

function isOverdue(meta?: JobMeta) {
  if (!meta?.due_date) return false
  return new Date(meta.due_date) < new Date()
}

function daysOverdue(meta?: JobMeta) {
  if (!meta?.due_date) return 0
  const diff = Date.now() - new Date(meta.due_date).getTime()
  return Math.max(0, Math.ceil(diff / 86400000))
}

/* ════════════════════════════════════════════════════
   INLINE EDITABLE FIELD
   ════════════════════════════════════════════════════ */

function InlineField({ label, value, onChange, type = "text", isDerived }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; isDerived?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState(value)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { setLocal(value) }, [value])
  useEffect(() => { if (editing) ref.current?.focus() }, [editing])
  const commit = () => { setEditing(false); if (local !== value) onChange(local) }

  return (
    <div className="min-w-0">
      <span className="text-[8px] text-muted-foreground/60 uppercase tracking-wider font-medium">{label}</span>
      {editing ? (
        <input ref={ref} type={type} value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setLocal(value); setEditing(false) } }}
          className="w-full text-[11px] font-medium text-foreground bg-transparent border-b border-foreground/20 outline-none py-0.5 focus:border-foreground/40"
        />
      ) : (
        <button onClick={() => setEditing(true)}
          className={cn("w-full text-left text-[11px] py-0.5 border-b border-transparent hover:border-border transition-colors truncate min-h-[18px]",
            value ? (isDerived ? "font-normal text-muted-foreground italic" : "font-medium text-foreground") : ""
          )}>
          {value || <span className="text-muted-foreground/30 font-normal">--</span>}
        </button>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════
   CHECKBOX ROW
   ════════════════════════════════════════════════════ */

function MetaCheck({ label, checked, onChange, bold }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; bold?: boolean
}) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer group/ck">
      <Checkbox checked={checked} onCheckedChange={(c) => onChange(!!c)} className="h-3.5 w-3.5 rounded-[3px]" />
      <span className={cn("text-[10px] transition-colors select-none",
        bold ? "font-bold" : "font-medium",
        checked ? "text-foreground" : "text-muted-foreground group-hover/ck:text-foreground"
      )}>{label}</span>
    </label>
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
        "rounded-lg border bg-card transition-all",
        isArchived ? "opacity-50 border-border" : "border-border hover:border-foreground/15",
        open ? "shadow-md" : "shadow-sm",
        !open && !isArchived && "cursor-grab active:cursor-grabbing"
      )}
    >
      {/* ── COLLAPSED HEADER ── */}
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-3 py-2 text-left select-none">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-semibold text-foreground truncate leading-tight">{quote.project_name || "Untitled"}</span>
            {listColumn && (
              <span className="flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: listColumn.color }} />
                <span className="text-[8px] text-muted-foreground font-medium">{listColumn.title}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {quote.contact_name && <span className="text-[10px] text-muted-foreground">{quote.contact_name}</span>}
            {overdue && (
              <span className="inline-flex items-center gap-0.5 text-[8px] font-bold px-1 py-px rounded bg-destructive/10 text-destructive leading-tight">
                <AlertCircle className="h-2 w-2" /> OVERDUE ({days}d)
              </span>
            )}
            {meta.assignee && (
              <span className="text-[8px] font-medium px-1.5 py-px rounded-full border border-border text-muted-foreground">{meta.assignee}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {quote.quote_number && <span className="text-[9px] font-mono text-muted-foreground/60">Q-{quote.quote_number}</span>}
            {quote.reference_number && <span className="text-[9px] font-mono text-muted-foreground/60">{quote.reference_number}</span>}
            {quote.created_at && <span className="text-[9px] text-muted-foreground/50">{fmtDate(quote.created_at)}</span>}
          </div>
        </div>
        <span className="text-[12px] font-bold font-mono text-foreground tabular-nums shrink-0">{formatCurrency(quote.total)}</span>
        <ChevronDown className={cn("h-3 w-3 text-muted-foreground/40 transition-transform duration-150 shrink-0", open && "rotate-180")} />
      </button>

      {/* ── EXPANDED DETAIL ── */}
      {open && (
        <div className="border-t border-border">
          <div className="px-3 py-2.5 flex flex-col gap-2">

            {/* Action bar */}
            <div className="flex items-center justify-between pb-1.5 border-b border-border/50">
              <div className="flex items-center gap-0.5">
                {canL && (
                  <button onClick={(e) => { e.stopPropagation(); onColumnChange(quote.id, columns[colIdx - 1].id) }}
                    className="flex items-center gap-0.5 h-5 px-1.5 rounded text-[9px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                    <ChevronLeft className="h-2.5 w-2.5" />{columns[colIdx - 1].title}
                  </button>
                )}
                {canR && (
                  <button onClick={(e) => { e.stopPropagation(); onColumnChange(quote.id, columns[colIdx + 1].id) }}
                    className="flex items-center gap-0.5 h-5 px-1.5 rounded text-[9px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                    {columns[colIdx + 1].title}<ChevronRight className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-px">
                {isArchived && (
                  <button onClick={(e) => { e.stopPropagation(); onRestore(quote.id) }}
                    className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-emerald-600 hover:bg-secondary" title="Restore">
                    <ArchiveRestore className="h-2.5 w-2.5" />
                  </button>
                )}
                {!isArchived && boardType === "quote" && onConvertToJob && (
                  <button onClick={(e) => { e.stopPropagation(); onConvertToJob(quote.id) }}
                    className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary" title="Convert to Job">
                    <Briefcase className="h-2.5 w-2.5" />
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); onEdit(quote.id) }}
                  className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary" title="Edit">
                  <Pencil className="h-2.5 w-2.5" />
                </button>
                {!isArchived && (
                  <button onClick={(e) => { e.stopPropagation(); onArchive(quote.id) }}
                    className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-amber-600 hover:bg-secondary" title="Archive">
                    <Archive className="h-2.5 w-2.5" />
                  </button>
                )}
                {confirmDel ? (
                  <div className="flex items-center gap-0.5 ml-0.5">
                    <button onClick={(e) => { e.stopPropagation(); onDelete(quote.id) }}
                      className="h-5 px-1.5 text-[9px] font-semibold text-destructive-foreground bg-destructive rounded hover:bg-destructive/90">Yes</button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDel(false) }}
                      className="h-5 px-1.5 text-[9px] text-muted-foreground hover:text-foreground rounded hover:bg-secondary">No</button>
                  </div>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); setConfirmDel(true) }}
                    className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Delete">
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            </div>

            {/* ── ROW 1: Job Details + Postage Details ── */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border p-2">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Job Details</p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  <InlineField label="Quantity" value={String(quote.quantity || "")} onChange={(v) => onPatch(quote.id, { quantity: parseInt(v) || 0 })} />
                  <InlineField label="Mail Piece Desc." value={meta.piece_desc || ""} isDerived={!rawMeta.piece_desc && !!derived.piece_desc} onChange={(v) => updateMeta({ piece_desc: v })} />
                  <InlineField label="Insert Count" value={String(meta.insert_count || "")} isDerived={!rawMeta.insert_count && !!derived.insert_count} onChange={(v) => updateMeta({ insert_count: parseInt(v) || 0 })} />
                  <InlineField label="Inserts Desc." value={meta.inserts_desc || ""} isDerived={!rawMeta.inserts_desc && !!derived.inserts_desc} onChange={(v) => updateMeta({ inserts_desc: v })} />
                </div>
              </div>
              <div className="rounded-lg border border-border p-2">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Postage Details</p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  <InlineField label="Mailing Class" value={meta.mailing_class || ""} isDerived={!rawMeta.mailing_class && !!derived.mailing_class} onChange={(v) => updateMeta({ mailing_class: v })} />
                  <InlineField label="Drop Off Location" value={meta.drop_off || ""} onChange={(v) => updateMeta({ drop_off: v })} />
                </div>
                <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer">
                  <Checkbox checked={!!meta.international} onCheckedChange={(c) => updateMeta({ international: !!c })} className="h-3 w-3 rounded-[3px]" />
                  <span className="text-[9px] text-muted-foreground font-medium">Mail International</span>
                </label>
              </div>
            </div>

            {/* ── ROW 2: Printing + List/Mail + Billing ── */}
            <div className="grid grid-cols-3 gap-2">
              {/* PRINTING DETAILS */}
              <div className={cn("rounded-lg border p-2 transition-colors", printDone ? "border-emerald-400/50 bg-emerald-50/20 dark:bg-emerald-950/10" : "border-border")}>
                <p className={cn("text-[9px] font-bold uppercase tracking-widest mb-1.5", printDone ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>Printing Details</p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 mb-1.5">
                  <InlineField label="Printed By" value={meta.printed_by || ""} isDerived={!rawMeta.printed_by && !!derived.printed_by} onChange={(v) => updateMeta({ printed_by: v })} />
                  <InlineField label="Vendor Job #" value={meta.vendor_job || ""} onChange={(v) => updateMeta({ vendor_job: v })} />
                </div>
                <MetaCheck label="Prints Arrived" checked={!!meta.prints_arrived} onChange={(c) => updateMeta({ prints_arrived: c })} />
              </div>
              {/* LIST / MAIL STATUS */}
              <div className={cn("rounded-lg border p-2 transition-colors", mailDone ? "border-emerald-400/50 bg-emerald-50/20 dark:bg-emerald-950/10" : "border-border")}>
                <p className={cn("text-[9px] font-bold uppercase tracking-widest mb-1.5", mailDone ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>List / Mail Status</p>
                <div className="flex flex-col gap-1">
                  <MetaCheck label="BCC Done" checked={!!meta.bcc_done} onChange={(c) => updateMeta({ bcc_done: c })} />
                  <MetaCheck label="Paperwork Done" checked={!!meta.paperwork_done} onChange={(c) => updateMeta({ paperwork_done: c })} />
                  <MetaCheck label="Folder Archived" checked={!!meta.folder_archived} onChange={(c) => updateMeta({ folder_archived: c })} />
                  <MetaCheck label="Job Mailed" checked={!!meta.job_mailed} onChange={(c) => updateMeta({ job_mailed: c })} bold />
                </div>
              </div>
              {/* BILLING STATUS */}
              <div className={cn("rounded-lg border p-2 transition-colors", billDone ? "border-emerald-400/50 bg-emerald-50/20 dark:bg-emerald-950/10" : "border-border")}>
                <p className={cn("text-[9px] font-bold uppercase tracking-widest mb-1.5", billDone ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>Billing Status</p>
                <div className="flex flex-col gap-1">
                  <MetaCheck label="Invoice Updated" checked={!!meta.invoice_updated} onChange={(c) => updateMeta({ invoice_updated: c })} />
                  <MetaCheck label="Invoice Emailed" checked={!!meta.invoice_emailed} onChange={(c) => updateMeta({ invoice_emailed: c })} />
                  <MetaCheck label="Paid (Postage)" checked={!!meta.paid_postage} onChange={(c) => updateMeta({ paid_postage: c })} />
                  <MetaCheck label="Paid (Full)" checked={!!meta.paid_full} onChange={(c) => updateMeta({ paid_full: c })} />
                </div>
              </div>
            </div>

            {/* ── Assignee + Due Date ── */}
            <div className="grid grid-cols-2 gap-2">
              <InlineField label="Assignee" value={meta.assignee || ""} onChange={(v) => updateMeta({ assignee: v })} />
              <InlineField label="Due Date" value={meta.due_date || ""} onChange={(v) => updateMeta({ due_date: v })} type="date" />
            </div>

            {/* ── Quote line items ── */}
            {(quote.items || []).length > 0 && (
              <div className="border-t border-border/50 pt-2">
                <p className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-1">Line Items</p>
                <div className="flex flex-col gap-px">
                  {(quote.items || []).map((it, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground truncate flex-1">{it.label || it.description || it.category}</span>
                      <span className="text-[10px] font-mono text-foreground/70 tabular-nums shrink-0 ml-2">{formatCurrency(it.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border/50">
                  <span className="text-[10px] font-semibold text-foreground">Total</span>
                  <span className="text-[12px] font-bold font-mono text-foreground tabular-nums">{formatCurrency(quote.total)}</span>
                </div>
              </div>
            )}

            {quote.notes && (
              <p className="text-[9px] text-muted-foreground leading-relaxed line-clamp-3 border-t border-border/50 pt-1.5 italic">{quote.notes}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════
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
   ════════════════════════════════════════════════════ */

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

/* ════════════════════════════════════════════════════
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
    <div className="flex flex-col min-w-[240px] w-[260px] shrink-0 lg:min-w-0 lg:w-auto lg:flex-1 min-h-0">
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
        className={cn("flex-1 flex flex-col gap-1.5 p-1 rounded-lg overflow-y-auto transition-colors min-h-0",
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
   ════════════════════════════════════════════════════ */

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

    // --- Printed by: if there's an OHP item, use its label ---
    const ohpItems = items.filter((it) => it.category === "ohp")
    if (ohpItems.length > 0 && !meta.printed_by) {
      meta.printed_by = ohpItems[0].label?.replace(/Out of House\s*[-–:]\s*/i, "").trim() || "Out of House"
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
