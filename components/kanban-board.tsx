"use client"

import { useState, useCallback, useMemo } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/lib/pricing"
import { getCategoryLabel, type QuoteCategory } from "@/lib/quote-types"
import { buildQuoteText } from "@/lib/build-quote-text"
import {
  FileText, Trash2, ArrowRight, ArrowLeft,
  Pencil, Clock, Loader2, X, Save, ClipboardCopy, Check,
  Plus, Settings2, CalendarDays, Briefcase,
  Search, Archive, ArchiveRestore, ChevronDown,
} from "lucide-react"

/* ---- Types ---- */

interface QuoteItem {
  id: number; category: QuoteCategory; label: string; description: string; amount: number
}

interface BoardColumn {
  id: string; title: string; color: string; sort_order: number; board_type?: string
}

interface Quote {
  id: string; project_name: string; status: string; column_id: string | null
  items: QuoteItem[]; total: number; notes: string | null
  quote_number: number | null; mailing_date: string | null
  customer_id?: string | null; contact_name?: string | null
  reference_number?: string | null
  lights: Record<string, string> | null
  is_job?: boolean; converted_at?: string | null
  archived?: boolean; archived_at?: string | null
  created_at: string; updated_at: string
}

const fetcher = async (url: string) => {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Fetch failed: ${r.status}`)
  const json = await r.json()
  if (json && typeof json === "object" && "error" in json && !Array.isArray(json)) {
    throw new Error(json.error)
  }
  return json
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/* ---- Helpers ---- */

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
    `${q.total}`.includes(s) ||
    (q.items || []).some(
      (it) =>
        it.label.toLowerCase().includes(s) ||
        it.description.toLowerCase().includes(s)
    )
  )
}

/** Group line items by category for the expanded view */
function groupByCategory(items: QuoteItem[]) {
  const groups: Record<string, { items: QuoteItem[]; total: number }> = {}
  for (const it of items) {
    if (!groups[it.category]) groups[it.category] = { items: [], total: 0 }
    groups[it.category].items.push(it)
    groups[it.category].total += it.amount
  }
  return groups
}

/* ---- Toggle Card (Apple-style) ---- */

function QuoteCard({
  quote, columns, onColumnChange, onDelete, onArchive, onRestore, onEdit, onConvertToJob, boardType, isArchived,
}: {
  quote: Quote; columns: BoardColumn[]
  onColumnChange: (id: string, colId: string) => void
  onDelete: (id: string) => void
  onArchive: (id: string) => void
  onRestore: (id: string) => void
  onEdit: (id: string) => void
  onConvertToJob?: (id: string) => void
  boardType: "quote" | "job"
  isArchived?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const colIdx = columns.findIndex((c) => c.id === quote.column_id)
  const canMoveLeft = !isArchived && colIdx > 0
  const canMoveRight = !isArchived && colIdx < columns.length - 1
  const groups = useMemo(() => groupByCategory(quote.items || []), [quote.items])
  const categoryKeys = Object.keys(groups) as QuoteCategory[]

  // Determine current column name
  const currentCol = columns.find((c) => c.id === quote.column_id)

  return (
    <div
      draggable={!isArchived && !expanded}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", quote.id)
        e.dataTransfer.effectAllowed = "move"
        ;(e.currentTarget as HTMLElement).style.opacity = "0.4"
      }}
      onDragEnd={(e) => {
        ;(e.currentTarget as HTMLElement).style.opacity = "1"
      }}
      className={`rounded-xl border border-border bg-card overflow-hidden transition-all ${
        isArchived ? "opacity-60" : expanded ? "" : "cursor-grab active:cursor-grabbing"
      } ${expanded ? "shadow-md" : "shadow-sm hover:shadow-md"}`}
    >
      {/* ---- Collapsed Header (always visible) ---- */}
      <div
        className="flex items-start justify-between gap-2 px-3 py-2.5 cursor-pointer select-none transition-colors hover:bg-secondary/40"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-[13px] font-semibold text-foreground truncate leading-tight">{quote.project_name}</p>
          </div>
          {quote.contact_name && (
            <p className="text-[11px] text-muted-foreground truncate leading-tight">{quote.contact_name}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {quote.quote_number && (
              <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">Q-{quote.quote_number}</span>
            )}
            {quote.reference_number && (
              <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{quote.reference_number}</span>
            )}
            {quote.mailing_date && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <CalendarDays className="h-2.5 w-2.5" />
                {formatDate(quote.mailing_date)}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {formatDate(quote.updated_at)}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-sm font-bold font-mono text-foreground tabular-nums">{formatCurrency(quote.total)}</span>
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
        </div>
      </div>

      {/* ---- Expanded Content ---- */}
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border bg-secondary/20 px-3 py-3 flex flex-col gap-2.5">

            {/* Info sections grid */}
            {categoryKeys.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {categoryKeys.map((cat) => {
                  const g = groups[cat]
                  return (
                    <div key={cat} className="bg-card border border-border rounded-lg p-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{getCategoryLabel(cat)}</span>
                        <span className="text-[10px] font-mono font-semibold text-foreground tabular-nums">{formatCurrency(g.total)}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {g.items.map((it, i) => (
                          <div key={i} className="flex items-baseline justify-between gap-1">
                            <span className="text-[10px] text-muted-foreground truncate leading-tight">{it.label}</span>
                            <span className="text-[10px] font-mono text-foreground tabular-nums shrink-0">{formatCurrency(it.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Notes */}
            {quote.notes && (
              <div className="bg-card border border-border rounded-lg p-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Notes</span>
                <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-3">{quote.notes}</p>
              </div>
            )}

            {/* Total bar */}
            <div className="flex items-center justify-between px-1 pt-1 border-t border-border">
              <span className="text-[11px] font-semibold text-foreground">Total</span>
              <span className="text-[13px] font-bold font-mono text-foreground tabular-nums">{formatCurrency(quote.total)}</span>
            </div>

            {/* Actions row */}
            <div className="flex items-center justify-between pt-1">
              {/* Move arrows */}
              <div className="flex items-center gap-1">
                {canMoveLeft && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onColumnChange(quote.id, columns[colIdx - 1].id) }}
                    className="flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    title={`Move to ${columns[colIdx - 1].title}`}
                  >
                    <ArrowLeft className="h-3 w-3" /> {columns[colIdx - 1].title}
                  </button>
                )}
                {canMoveRight && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onColumnChange(quote.id, columns[colIdx + 1].id) }}
                    className="flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    title={`Move to ${columns[colIdx + 1].title}`}
                  >
                    {columns[colIdx + 1].title} <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-0.5">
                {isArchived && (
                  <button onClick={(e) => { e.stopPropagation(); onRestore(quote.id) }}
                    className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    title="Restore"><ArchiveRestore className="h-3 w-3" /></button>
                )}
                {!isArchived && boardType === "quote" && onConvertToJob && (
                  <button onClick={(e) => { e.stopPropagation(); onConvertToJob(quote.id) }}
                    className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    title="Convert to Job"><Briefcase className="h-3 w-3" /></button>
                )}
                <button onClick={(e) => { e.stopPropagation(); onEdit(quote.id) }}
                  className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  title="Edit"><Pencil className="h-3 w-3" /></button>
                {!isArchived && (
                  <button onClick={(e) => { e.stopPropagation(); onArchive(quote.id) }}
                    className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    title="Archive"><Archive className="h-3 w-3" /></button>
                )}
                {confirmDelete ? (
                  <div className="flex items-center gap-1 ml-1">
                    <button onClick={(e) => { e.stopPropagation(); onDelete(quote.id) }}
                      className="h-6 px-2 text-[10px] font-semibold text-destructive-foreground bg-destructive rounded-md hover:bg-destructive/90">Delete</button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(false) }}
                      className="h-6 px-2 text-[10px] font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary">No</button>
                  </div>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
                    className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete permanently"><Trash2 className="h-3 w-3" /></button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---- Column Settings ---- */

function ColumnSettings({
  columns, onAdd, onRename, onDelete, onReorder, onClose,
}: {
  columns: BoardColumn[]
  onAdd: () => void; onRename: (id: string, name: string) => void
  onDelete: (id: string) => void; onReorder: (ids: string[]) => void; onClose: () => void
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground">Manage Columns</h3>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 text-xs">Done</Button>
      </div>
      <div className="flex flex-col gap-2">
        {columns.map((col, idx) => (
          <div key={col.id} className="flex items-center gap-2 py-1">
            <div className="flex flex-col gap-0.5">
              {idx > 0 && (
                <button onClick={() => {
                  const ids = columns.map(c => c.id)
                  ;[ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]]
                  onReorder(ids)
                }} className="text-muted-foreground hover:text-foreground text-[10px] leading-none">{"^"}</button>
              )}
              {idx < columns.length - 1 && (
                <button onClick={() => {
                  const ids = columns.map(c => c.id)
                  ;[ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]]
                  onReorder(ids)
                }} className="text-muted-foreground hover:text-foreground text-[10px] leading-none">{"v"}</button>
              )}
            </div>
            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
            <Input defaultValue={col.title} onBlur={(e) => { if (e.target.value !== col.title) onRename(col.id, e.target.value) }} className="h-7 text-xs flex-1" />
            {columns.length > 1 && (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(col.id)}><X className="h-3 w-3" /></Button>
            )}
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="mt-3 gap-1 text-xs h-7" onClick={onAdd}>
        <Plus className="h-3 w-3" /> Add Column
      </Button>
    </div>
  )
}

/* ---- Quote Edit Modal ---- */

function QuoteEditModal({
  quote, onClose, onSaved, onLoadIntoCalculator,
}: {
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
      await fetch(`/api/quotes/${quote.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_name: name, items: editItems, total, notes: notes || null }),
      })
      onSaved(); onClose()
    } finally { setSaving(false) }
  }

  const buildPlainText = () => buildQuoteText(editItems, name || undefined, notes || undefined)

  const handleCopy = async () => {
    const text = buildPlainText()
    try { await navigator.clipboard.writeText(text) } catch {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta)
    }
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
                <span className="text-xs text-muted-foreground">Updated {formatDate(quote.updated_at)}</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs shrink-0">Close</Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {ALL_CATS.map((cat) => {
            const catItems = editItems.filter((i) => i.category === cat)
            if (catItems.length === 0) return null
            const ct = catTotal(cat)
            return (
              <div key={cat}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{getCategoryLabel(cat)}</span>
                  <span className="text-sm font-mono font-semibold tabular-nums">{formatCurrency(ct)}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {catItems.map((item, idx) => (
                    <div key={item.id} className="flex items-start justify-between gap-2 py-2 px-3 bg-secondary/40 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {catItems.length > 1 && <span className="text-muted-foreground font-mono mr-1.5">#{idx + 1}</span>}
                          {item.label}
                        </p>
                        {item.description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                          <input type="number" inputMode="decimal" step="0.01" value={item.amount || ""}
                            onChange={(e) => updateAmount(item.id, parseFloat(e.target.value) || 0)}
                            className="w-24 h-9 text-right text-sm font-mono tabular-nums bg-card border border-border rounded-md pl-5 pr-2 focus:outline-none focus:ring-2 focus:ring-ring" />
                        </div>
                        <button onClick={() => removeItem(item.id)}
                          className="p-1.5 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Remove ${item.label}`}>
                          <X className="h-3.5 w-3.5" />
                        </button>
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
            <Button size="sm" className="gap-1.5 text-xs h-9" onClick={handleSave} disabled={saving}>
              <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save Changes"}
            </Button>
            <Button variant={copied ? "default" : "outline"} size="sm" className="gap-1.5 text-xs h-9" onClick={handleCopy}>
              {copied ? <><Check className="h-3.5 w-3.5" />Copied</> : <><ClipboardCopy className="h-3.5 w-3.5" />Copy for Email</>}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9" onClick={() => setShowPlainText(!showPlainText)}>
              <FileText className="h-3.5 w-3.5" /> {showPlainText ? "Hide Text" : "View as Text"}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9" onClick={() => onLoadIntoCalculator(quote.id)}>
              <Pencil className="h-3.5 w-3.5" /> Edit in Calculator
            </Button>
          </div>

          {showPlainText && (
            <pre className="bg-secondary rounded-lg p-3 text-[11px] font-mono text-foreground leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto border border-border select-all">
              {buildPlainText()}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ---- Droppable Column ---- */

function DroppableColumn({
  col, quotes, allColumns, onColumnChange, onDelete, onArchive, onRestore, onEdit, onConvertToJob, boardType,
}: {
  col: BoardColumn; quotes: Quote[]; allColumns: BoardColumn[]
  onColumnChange: (id: string, colId: string) => void
  onDelete: (id: string) => void
  onArchive: (id: string) => void
  onRestore: (id: string) => void
  onEdit: (id: string) => void
  onConvertToJob?: (id: string) => void; boardType: "quote" | "job"
}) {
  const [dragOver, setDragOver] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const quoteId = e.dataTransfer.getData("text/plain")
    if (quoteId) {
      onColumnChange(quoteId, col.id)
    }
  }, [col.id, onColumnChange])

  const colTotal = quotes.reduce((s, q) => s + Number(q.total), 0)

  return (
    <div className="flex-1 min-w-[240px] flex flex-col gap-2">
      {/* Column header */}
      <div className="flex items-center justify-between px-1 h-8">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
          <span className="text-xs font-semibold text-foreground">{col.title}</span>
          <span className="text-[10px] font-mono text-muted-foreground tabular-nums bg-secondary px-1.5 py-0.5 rounded">{quotes.length}</span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{formatCurrency(colTotal)}</span>
      </div>

      {/* Column body (droppable) */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col gap-2 min-h-[100px] p-1.5 rounded-xl border flex-1 overflow-y-auto transition-colors ${
          dragOver
            ? "bg-foreground/[0.02] border-foreground/20"
            : "bg-secondary/20 border-transparent"
        }`}
      >
        {quotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center flex-1">
            <p className="text-[11px] text-muted-foreground/50">{dragOver ? "Drop here" : "Empty"}</p>
          </div>
        ) : (
          quotes.map((quote) => (
            <QuoteCard key={quote.id} quote={quote} columns={allColumns}
              onColumnChange={onColumnChange} onDelete={onDelete}
              onArchive={onArchive} onRestore={onRestore}
              onEdit={onEdit} onConvertToJob={onConvertToJob} boardType={boardType} />
          ))
        )}
      </div>
    </div>
  )
}

/* ---- Main Kanban Board ---- */

export function KanbanBoard({
  boardType = "quote",
  onLoadQuote,
}: {
  boardType?: "quote" | "job"
  onLoadQuote: (quoteId: string) => void
}) {
  const colsUrl = `/api/board-columns?type=${boardType}`
  const quotesUrl = `/api/quotes?is_job=${boardType === "job" ? "true" : "false"}&archived=false`
  const archivedUrl = `/api/quotes?is_job=${boardType === "job" ? "true" : "false"}&archived=true`

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
    if (!searchTerm) return quotes
    return quotes.filter((q) => matchesSearch(q, searchTerm))
  }, [quotes, searchTerm])

  const filteredArchived = useMemo(() => {
    if (!archivedQuotes) return []
    if (!searchTerm) return archivedQuotes
    return archivedQuotes.filter((q) => matchesSearch(q, searchTerm))
  }, [archivedQuotes, searchTerm])

  const refreshAll = useCallback(() => {
    globalMutate(quotesUrl)
    globalMutate(archivedUrl)
  }, [quotesUrl, archivedUrl])

  const handleColumnChange = useCallback(async (id: string, colId: string) => {
    await fetch(`/api/quotes/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ column_id: colId }),
    })
    refreshAll()
  }, [refreshAll])

  const handleDelete = useCallback(async (id: string) => {
    await fetch(`/api/quotes/${id}`, { method: "DELETE" })
    refreshAll()
  }, [refreshAll])

  const handleArchive = useCallback(async (id: string) => {
    await fetch(`/api/quotes/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true, archived_at: new Date().toISOString() }),
    })
    refreshAll()
  }, [refreshAll])

  const handleRestore = useCallback(async (id: string) => {
    await fetch(`/api/quotes/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false, archived_at: null }),
    })
    refreshAll()
  }, [refreshAll])

  const handleConvertToJob = useCallback(async (id: string) => {
    const res = await fetch("/api/board-columns?type=job")
    const jobCols: BoardColumn[] = await res.json()
    const firstJobCol = jobCols?.[0]?.id || null
    await fetch(`/api/quotes/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_job: true, converted_at: new Date().toISOString(), column_id: firstJobCol }),
    })
    refreshAll()
    globalMutate(`/api/quotes?is_job=true&archived=false`)
    globalMutate(`/api/quotes?is_job=false&archived=false`)
  }, [refreshAll])

  const addColumn = useCallback(async () => {
    await fetch("/api/board-columns", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Stage", board_type: boardType }),
    })
    globalMutate(colsUrl)
  }, [colsUrl, boardType])

  const renameColumn = useCallback(async (id: string, name: string) => {
    await fetch(`/api/board-columns/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    globalMutate(colsUrl)
  }, [colsUrl])

  const deleteColumn = useCallback(async (id: string) => {
    await fetch(`/api/board-columns/${id}`, { method: "DELETE" })
    globalMutate(colsUrl)
    refreshAll()
  }, [colsUrl, refreshAll])

  const reorderColumns = useCallback(async (ids: string[]) => {
    globalMutate(colsUrl, (prev: BoardColumn[] | undefined) => {
      if (!prev) return prev
      return ids.map((id, i) => {
        const col = prev.find((c) => c.id === id)!
        return { ...col, sort_order: i }
      })
    }, false)
    await fetch("/api/board-columns/reorder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: ids }),
    })
    globalMutate(colsUrl)
  }, [colsUrl])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-destructive">
        Failed to load. Check your database connection.
      </div>
    )
  }

  const cols = columns || []
  const archiveCount = archivedQuotes?.length || 0
  const label = boardType === "job" ? "Job" : "Quote"

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-col gap-2.5 mb-3 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-foreground shrink-0">
            {boardType === "job" ? "Production Pipeline" : "Quote Pipeline"}
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowArchive(!showArchive)}
              className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium transition-colors ${
                showArchive ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              <Archive className="h-3 w-3" />
              Archive{archiveCount > 0 && ` (${archiveCount})`}
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium transition-colors ${
                showSettings ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              <Settings2 className="h-3 w-3" />
              Columns
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="search"
            placeholder={`Search ${label.toLowerCase()}s...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-8 pl-8 pr-8 rounded-lg bg-secondary/60 border-0 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {searchTerm && (
          <p className="text-[10px] text-muted-foreground">
            {filteredQuotes.length} active + {filteredArchived.length} archived match{filteredQuotes.length + filteredArchived.length !== 1 ? "es" : ""}
          </p>
        )}
      </div>

      {showSettings && (
        <ColumnSettings columns={cols} onAdd={addColumn} onRename={renameColumn}
          onDelete={deleteColumn} onReorder={reorderColumns} onClose={() => setShowSettings(false)} />
      )}

      {/* Archive drawer */}
      {showArchive && (
        <div className="rounded-xl border border-border bg-secondary/30 p-3 mb-3 shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <Archive className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">Archived {label}s</span>
            <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{filteredArchived.length}</span>
          </div>
          {filteredArchived.length === 0 ? (
            <p className="text-[10px] text-muted-foreground py-4 text-center">No archived {label.toLowerCase()}s{searchTerm ? " matching search" : ""}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 max-h-[280px] overflow-y-auto">
              {filteredArchived.map((q) => (
                <QuoteCard key={q.id} quote={q} columns={cols}
                  onColumnChange={handleColumnChange} onDelete={handleDelete}
                  onArchive={handleArchive} onRestore={handleRestore}
                  onEdit={(id) => { const found = filteredArchived.find((x) => x.id === id); if (found) setDetailQuote(found) }}
                  onConvertToJob={boardType === "quote" ? handleConvertToJob : undefined}
                  boardType={boardType} isArchived />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Board -- horizontal columns */}
      <div className="overflow-x-auto flex-1 -mx-1 px-1">
        <div className="flex gap-2.5 h-full" style={{ minWidth: `${Math.max(cols.length * 250, 300)}px` }}>
          {cols.map((col) => {
            const colQuotes = filteredQuotes.filter((q) => q.column_id === col.id)
            return (
              <DroppableColumn key={col.id} col={col} quotes={colQuotes} allColumns={cols}
                onColumnChange={handleColumnChange} onDelete={handleDelete}
                onArchive={handleArchive} onRestore={handleRestore}
                onEdit={(id) => { const q = filteredQuotes.find((x) => x.id === id); if (q) setDetailQuote(q) }}
                onConvertToJob={boardType === "quote" ? handleConvertToJob : undefined}
                boardType={boardType} />
            )
          })}
        </div>
      </div>

      {/* Unassigned */}
      {(() => {
        const unassigned = filteredQuotes.filter((q) => !q.column_id || !cols.some((c) => c.id === q.column_id))
        if (unassigned.length === 0) return null
        return (
          <div className="mt-4 shrink-0">
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
              <span className="text-xs font-semibold text-muted-foreground">Unassigned</span>
              <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{unassigned.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {unassigned.map((quote) => (
                <QuoteCard key={quote.id} quote={quote} columns={cols}
                  onColumnChange={handleColumnChange} onDelete={handleDelete}
                  onArchive={handleArchive} onRestore={handleRestore}
                  onEdit={(id) => { const q = unassigned.find((x) => x.id === id); if (q) setDetailQuote(q) }}
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
          onSaved={refreshAll}
          onLoadIntoCalculator={(id) => { setDetailQuote(null); onLoadQuote(id) }} />
      )}
    </div>
  )
}
