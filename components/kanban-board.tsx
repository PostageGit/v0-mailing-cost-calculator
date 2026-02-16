"use client"

import { useState, useCallback } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/lib/pricing"
import { getCategoryLabel, getCategoryColor, type QuoteCategory } from "@/lib/quote-types"
import { buildQuoteText } from "@/lib/build-quote-text"
import {
  FileText, Trash2, GripVertical, ArrowRight, ArrowLeft,
  Pencil, Clock, Loader2, X, Save, ClipboardCopy, Check,
  Plus, Settings2, CalendarDays, Circle,
} from "lucide-react"

/* ─── Types ───────────────────────────────── */

interface QuoteItem {
  id: number; category: QuoteCategory; label: string; description: string; amount: number
}

interface BoardColumn {
  id: string; title: string; color: string; sort_order: number
}

interface Quote {
  id: string; project_name: string; status: string; column_id: string | null
  items: QuoteItem[]; total: number; notes: string | null
  quote_number: number | null; mailing_date: string | null
  lights: Record<string, string> | null
  created_at: string; updated_at: string
}

const fetcher = async (url: string) => {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Fetch failed: ${r.status}`)
  const json = await r.json()
  // If API returns an error object instead of an array, treat as error
  if (json && typeof json === "object" && "error" in json && !Array.isArray(json)) {
    throw new Error(json.error)
  }
  return json
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

const LIGHT_COLORS: Record<string, string> = {
  green: "text-emerald-500",
  yellow: "text-amber-400",
  red: "text-red-500",
  off: "text-muted-foreground/20",
}

/* ─── Quote Card ──────────────────────────── */

function QuoteCard({
  quote, columns, onColumnChange, onDelete, onEdit,
}: {
  quote: Quote; columns: BoardColumn[]
  onColumnChange: (id: string, colId: string) => void
  onDelete: (id: string) => void; onEdit: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const colIdx = columns.findIndex((c) => c.id === quote.column_id)
  const canMoveLeft = colIdx > 0
  const canMoveRight = colIdx < columns.length - 1

  const lights = quote.lights || {}
  const lightKeys = Object.keys(lights)

  return (
    <Card className="border-border bg-card shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-3 flex flex-col gap-2">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0 cursor-grab" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{quote.project_name}</p>
              {quote.quote_number && (
                <span className="text-[10px] font-mono text-muted-foreground">Q-{quote.quote_number}</span>
              )}
            </div>
          </div>
          <span className="text-base font-bold font-mono text-primary tabular-nums shrink-0">
            {formatCurrency(quote.total)}
          </span>
        </div>

        {/* Traffic lights */}
        {lightKeys.length > 0 && (
          <div className="flex items-center gap-2">
            {lightKeys.map((k) => (
              <div key={k} className="flex items-center gap-1">
                <Circle className={`h-2.5 w-2.5 fill-current ${LIGHT_COLORS[lights[k]] || LIGHT_COLORS.off}`} />
                <span className="text-[9px] text-muted-foreground uppercase">{k}</span>
              </div>
            ))}
          </div>
        )}

        {/* Item badges */}
        {quote.items?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {quote.items.slice(0, 3).map((item, i) => (
              <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0 font-normal max-w-[140px] truncate">
                {item.label}
              </Badge>
            ))}
            {quote.items.length > 3 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">+{quote.items.length - 3}</Badge>
            )}
          </div>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(quote.updated_at)}
          </div>
          {quote.mailing_date && (
            <div className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              Mail {formatDate(quote.mailing_date)}
            </div>
          )}
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            {canMoveLeft && (
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 min-h-[44px] min-w-[44px]"
                onClick={() => onColumnChange(quote.id, columns[colIdx - 1].id)}
                aria-label={`Move to ${columns[colIdx - 1].title}`}>
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
            )}
            {canMoveRight && (
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 min-h-[44px] min-w-[44px]"
                onClick={() => onColumnChange(quote.id, columns[colIdx + 1].id)}
                aria-label={`Move to ${columns[colIdx + 1].title}`}>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 min-h-[44px] min-w-[44px] text-muted-foreground hover:text-primary"
              onClick={() => onEdit(quote.id)} aria-label="Edit quote">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <Button variant="destructive" size="sm" className="h-8 text-xs px-2" onClick={() => onDelete(quote.id)}>Delete</Button>
                <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 min-h-[44px] min-w-[44px] text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmDelete(true)} aria-label="Delete quote">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ─── Column Settings Inline ──────────────── */

function ColumnSettings({
  columns, onAdd, onRename, onDelete, onReorder, onClose,
}: {
  columns: BoardColumn[]
  onAdd: () => void; onRename: (id: string, name: string) => void
  onDelete: (id: string) => void; onReorder: (ids: string[]) => void; onClose: () => void
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground">Manage Columns</h3>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">Done</Button>
      </div>
      <div className="flex flex-col gap-2">
        {columns.map((col, idx) => (
          <div key={col.id} className="flex items-center gap-2 py-1.5">
            <div className="flex flex-col gap-0.5">
              {idx > 0 && (
                <button onClick={() => {
                  const ids = columns.map(c => c.id)
                  ;[ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]]
                  onReorder(ids)
                }} className="text-muted-foreground hover:text-foreground text-[10px] leading-none"
                  aria-label="Move up">
                  {"^"}
                </button>
              )}
              {idx < columns.length - 1 && (
                <button onClick={() => {
                  const ids = columns.map(c => c.id)
                  ;[ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]]
                  onReorder(ids)
                }} className="text-muted-foreground hover:text-foreground text-[10px] leading-none"
                  aria-label="Move down">
                  {"v"}
                </button>
              )}
            </div>
            <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
            <Input
              defaultValue={col.title}
              onBlur={(e) => { if (e.target.value !== col.title) onRename(col.id, e.target.value) }}
              className="h-8 text-sm flex-1"
            />
            {columns.length > 1 && (
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(col.id)} aria-label={`Delete ${col.title}`}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="mt-3 gap-1.5 text-xs" onClick={onAdd}>
        <Plus className="h-3.5 w-3.5" /> Add Column
      </Button>
    </div>
  )
}

/* ─── Quote Edit Modal (preserved from existing) ─── */

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
                {quote.quote_number && (
                  <Badge variant="secondary" className="text-xs font-mono">Q-{quote.quote_number}</Badge>
                )}
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
                  <Badge variant="secondary" className={`text-[11px] px-2 py-0.5 font-semibold ${getCategoryColor(cat)}`}>
                    {getCategoryLabel(cat)}
                  </Badge>
                  <span className="text-sm font-mono font-semibold tabular-nums">{formatCurrency(ct)}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {catItems.map((item, idx) => (
                    <div key={item.id} className="flex items-start justify-between gap-2 py-2 px-3 bg-muted/40 rounded-lg">
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
                          className="p-2 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive min-h-[44px] min-w-[44px] flex items-center justify-center"
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

          {(() => {
            const printCats: QuoteCategory[] = ["flat", "booklet", "spiral", "perfect"]
            const printTotals = printCats.map(catTotal)
            const activePrint = printTotals.filter(t => t > 0)
            if (activePrint.length > 1) {
              return (
                <div className="flex items-center justify-between px-1 pt-1 border-t border-dashed border-border">
                  <span className="text-xs font-medium text-foreground">All Printing</span>
                  <span className="text-xs font-mono font-medium text-foreground tabular-nums">
                    {formatCurrency(printTotals.reduce((a, b) => a + b, 0))}
                  </span>
                </div>
              )
            }
            return null
          })()}

          <Separator />

          <div className="flex items-center justify-between">
            <span className="text-base font-semibold text-foreground">Project Total</span>
            <span className="text-xl font-bold font-mono text-primary tabular-nums">{formatCurrency(total)}</span>
          </div>

          <div>
            <label htmlFor="quote-notes" className="text-sm font-medium text-foreground mb-1.5 block">Notes</label>
            <textarea id="quote-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes for this quote..." rows={3}
              className="w-full text-sm bg-card border border-border rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-1.5 text-xs h-10 min-h-[44px]" onClick={handleSave} disabled={saving}>
              <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save Changes"}
            </Button>
            <Button variant={copied ? "default" : "outline"} size="sm" className="gap-1.5 text-xs h-10 min-h-[44px]" onClick={handleCopy}>
              {copied ? <><Check className="h-3.5 w-3.5" />Copied</> : <><ClipboardCopy className="h-3.5 w-3.5" />Copy for Email</>}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-10 min-h-[44px]" onClick={() => setShowPlainText(!showPlainText)}>
              <FileText className="h-3.5 w-3.5" /> {showPlainText ? "Hide Text" : "View as Text"}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-10 min-h-[44px]" onClick={() => onLoadIntoCalculator(quote.id)}>
              <Pencil className="h-3.5 w-3.5" /> Edit in Calculator
            </Button>
          </div>

          {showPlainText && (
            <pre className="bg-muted rounded-lg p-3 text-[11px] font-mono text-foreground leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto border border-border select-all">
              {buildPlainText()}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ─── Main Kanban Board ───────────────────── */

export function KanbanBoard({ onLoadQuote }: { onLoadQuote: (quoteId: string) => void }) {
  const { data: columns, isLoading: colsLoading } = useSWR<BoardColumn[]>("/api/board-columns", fetcher)
  const { data: quotes, error, isLoading: quotesLoading } = useSWR<Quote[]>("/api/quotes", fetcher, { refreshInterval: 10000 })
  const [showSettings, setShowSettings] = useState(false)
  const [detailQuote, setDetailQuote] = useState<Quote | null>(null)

  const isLoading = colsLoading || quotesLoading

  const handleColumnChange = useCallback(async (id: string, colId: string) => {
    await fetch(`/api/quotes/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ column_id: colId }),
    })
    globalMutate("/api/quotes")
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    await fetch(`/api/quotes/${id}`, { method: "DELETE" })
    globalMutate("/api/quotes")
  }, [])

  // Column CRUD
  const addColumn = useCallback(async () => {
    await fetch("/api/board-columns", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Stage" }),
    })
    globalMutate("/api/board-columns")
  }, [])

  const renameColumn = useCallback(async (id: string, name: string) => {
    await fetch(`/api/board-columns/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    globalMutate("/api/board-columns")
  }, [])

  const deleteColumn = useCallback(async (id: string) => {
    await fetch(`/api/board-columns/${id}`, { method: "DELETE" })
    globalMutate("/api/board-columns")
    globalMutate("/api/quotes")
  }, [])

  const reorderColumns = useCallback(async (ids: string[]) => {
    // Optimistic update
    globalMutate("/api/board-columns", (prev: BoardColumn[] | undefined) => {
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
    globalMutate("/api/board-columns")
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-destructive">
        Failed to load quotes. Check your database connection.
      </div>
    )
  }

  const cols = columns || []

  return (
    <>
      {/* Settings toggle */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-foreground">Job Board</h2>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-10 min-h-[44px]"
          onClick={() => setShowSettings(!showSettings)}>
          <Settings2 className="h-3.5 w-3.5" />
          {showSettings ? "Close" : "Columns"}
        </Button>
      </div>

      {showSettings && (
        <ColumnSettings columns={cols} onAdd={addColumn} onRename={renameColumn}
          onDelete={deleteColumn} onReorder={reorderColumns} onClose={() => setShowSettings(false)} />
      )}

      {/* Board */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-4" style={{ minWidth: `${Math.max(cols.length * 280, 300)}px` }}>
          {cols.map((col) => {
            const colQuotes = (quotes || []).filter((q) => q.column_id === col.id)
            return (
              <div key={col.id} className="flex-1 min-w-[260px] flex flex-col gap-3">
                {/* Column header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                    <span className="text-sm font-semibold text-foreground">{col.title}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
                      {colQuotes.length}
                    </Badge>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground tabular-nums">
                    {formatCurrency(colQuotes.reduce((s, q) => s + Number(q.total), 0))}
                  </span>
                </div>

                {/* Column body */}
                <div className="flex flex-col gap-2 min-h-[120px] p-2 rounded-lg bg-muted/30 border border-dashed border-border flex-1">
                  {colQuotes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center flex-1">
                      <FileText className="h-5 w-5 text-muted-foreground/50 mb-2" />
                      <p className="text-xs text-muted-foreground">No quotes</p>
                    </div>
                  ) : (
                    colQuotes.map((quote) => (
                      <QuoteCard key={quote.id} quote={quote} columns={cols}
                        onColumnChange={handleColumnChange} onDelete={handleDelete}
                        onEdit={(id) => {
                          const q = (quotes || []).find((x) => x.id === id)
                          if (q) setDetailQuote(q)
                        }} />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Unassigned quotes (no column_id) */}
      {(() => {
        const unassigned = (quotes || []).filter((q) => !q.column_id)
        if (unassigned.length === 0) return null
        return (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
              <span className="text-sm font-semibold text-muted-foreground">Unassigned</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">{unassigned.length}</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {unassigned.map((quote) => (
                <QuoteCard key={quote.id} quote={quote} columns={cols}
                  onColumnChange={handleColumnChange} onDelete={handleDelete}
                  onEdit={(id) => {
                    const q = unassigned.find((x) => x.id === id)
                    if (q) setDetailQuote(q)
                  }} />
              ))}
            </div>
          </div>
        )
      })()}

      {/* Edit modal */}
      {detailQuote && (
        <QuoteEditModal quote={detailQuote} onClose={() => setDetailQuote(null)}
          onSaved={() => globalMutate("/api/quotes")}
          onLoadIntoCalculator={(id) => { setDetailQuote(null); onLoadQuote(id) }} />
      )}
    </>
  )
}
