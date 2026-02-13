"use client"

import { useState, useEffect, useCallback } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { formatCurrency } from "@/lib/pricing"
import { getCategoryLabel, getCategoryColor, type QuoteCategory } from "@/lib/quote-types"
import { buildQuoteText } from "@/lib/build-quote-text"
import { Input } from "@/components/ui/input"
import {
  FileText,
  Trash2,
  GripVertical,
  ArrowRight,
  ArrowLeft,
  Pencil,
  Clock,
  Loader2,
  X,
  Save,
  ClipboardCopy,
  Check,
} from "lucide-react"

interface QuoteItem {
  id: number
  category: QuoteCategory
  label: string
  description: string
  amount: number
}

interface Quote {
  id: string
  project_name: string
  status: string
  items: QuoteItem[]
  total: number
  notes: string | null
  created_at: string
  updated_at: string
}

const COLUMNS = [
  { key: "draft", label: "Draft", color: "bg-muted-foreground" },
  { key: "sent", label: "Sent", color: "bg-primary" },
  { key: "approved", label: "Approved", color: "bg-chart-2" },
  { key: "completed", label: "Completed", color: "bg-chart-4" },
]

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function QuoteCard({
  quote,
  onStatusChange,
  onDelete,
  onEdit,
}: {
  quote: Quote
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
  onEdit: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const colIdx = COLUMNS.findIndex((c) => c.key === quote.status)
  const canMoveLeft = colIdx > 0
  const canMoveRight = colIdx < COLUMNS.length - 1

  return (
    <Card className="border-border bg-card shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-3 flex flex-col gap-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <p className="text-sm font-semibold text-foreground truncate">{quote.project_name}</p>
          </div>
          <span className="text-base font-bold font-mono text-primary tabular-nums flex-shrink-0">
            {formatCurrency(quote.total)}
          </span>
        </div>

        {/* Item summary */}
        {quote.items && quote.items.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {quote.items.slice(0, 4).map((item, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="text-[10px] px-1.5 py-0 font-normal max-w-[140px] truncate"
              >
                {item.label}
              </Badge>
            ))}
            {quote.items.length > 4 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                +{quote.items.length - 4} more
              </Badge>
            )}
          </div>
        )}

        {/* Timestamp */}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          Updated {formatDate(quote.updated_at)}
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            {canMoveLeft && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => onStatusChange(quote.id, COLUMNS[colIdx - 1].key)}
                aria-label={`Move to ${COLUMNS[colIdx - 1].label}`}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
            )}
            {canMoveRight && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => onStatusChange(quote.id, COLUMNS[colIdx + 1].key)}
                aria-label={`Move to ${COLUMNS[colIdx + 1].label}`}
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
              onClick={() => onEdit(quote.id)}
              aria-label="Edit quote"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => onDelete(quote.id)}
                >
                  Delete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
                aria-label="Delete quote"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Full edit + copy modal for a saved quote
function QuoteEditModal({
  quote,
  onClose,
  onSaved,
  onLoadIntoCalculator,
}: {
  quote: Quote
  onClose: () => void
  onSaved: () => void
  onLoadIntoCalculator: (id: string) => void
}) {
  const [name, setName] = useState(quote.project_name)
  const [editItems, setEditItems] = useState<QuoteItem[]>(quote.items || [])
  const [notes, setNotes] = useState(quote.notes || "")
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showPlainText, setShowPlainText] = useState(false)

  const ALL_CATS: QuoteCategory[] = ["flat", "booklet", "postage", "listwork"]

  const total = editItems.reduce((s, i) => s + i.amount, 0)
  const catTotal = (cat: QuoteCategory) =>
    editItems.filter((i) => i.category === cat).reduce((s, i) => s + i.amount, 0)

  const removeItem = (id: number) => setEditItems((prev) => prev.filter((i) => i.id !== id))

  const updateAmount = (id: number, amount: number) =>
    setEditItems((prev) => prev.map((i) => (i.id === id ? { ...i, amount } : i)))

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(`/api/quotes/${quote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_name: name,
          items: editItems,
          total,
          notes: notes || null,
        }),
      })
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const buildPlainText = () => {
    return buildQuoteText(editItems, name || undefined, notes || undefined)
  }

  const handleCopy = async () => {
    const text = buildPlainText()
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement("textarea")
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center p-4 pt-[10vh] overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <Card className="w-full max-w-2xl border-border shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-lg font-bold text-foreground bg-transparent border-none outline-none w-full placeholder:text-muted-foreground focus:ring-0"
                placeholder="Project / Client Name..."
                autoComplete="off"
                spellCheck={false}
              />
              <div className="flex items-center gap-2 mt-1.5">
                <Badge variant="secondary" className="text-xs capitalize">
                  {quote.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Updated {formatDate(quote.updated_at)}
                </span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs flex-shrink-0">
              Close
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {/* Items by category */}
          {ALL_CATS.map((cat) => {
            const catItems = editItems.filter((i) => i.category === cat)
            if (catItems.length === 0) return null
            const ct = catTotal(cat)

            return (
              <div key={cat}>
                <div className="flex items-center justify-between mb-2">
                  <Badge
                    variant="secondary"
                    className={`text-[11px] px-2 py-0.5 font-semibold ${getCategoryColor(cat)}`}
                  >
                    {getCategoryLabel(cat)}
                  </Badge>
                  <span className="text-sm font-mono font-semibold tabular-nums">
                    {formatCurrency(ct)}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {catItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-2 py-2 px-3 bg-muted/40 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {catItems.length > 1 && (
                            <span className="text-muted-foreground font-mono mr-1.5">#{idx + 1}</span>
                          )}
                          {item.label}
                        </p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={item.amount || ""}
                            onChange={(e) => updateAmount(item.id, parseFloat(e.target.value) || 0)}
                            className="w-24 h-8 text-right text-sm font-mono tabular-nums bg-card border border-border rounded-md pl-5 pr-2 focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-1 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none transition-colors"
                          aria-label={`Remove ${item.label}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Combined printing total */}
          {catTotal("flat") > 0 && catTotal("booklet") > 0 && (
            <div className="flex items-center justify-between px-1 pt-1 border-t border-dashed border-border">
              <span className="text-xs font-medium text-foreground">All Printing</span>
              <span className="text-xs font-mono font-medium text-foreground tabular-nums">
                {formatCurrency(catTotal("flat") + catTotal("booklet"))}
              </span>
            </div>
          )}

          <Separator />

          {/* Grand total */}
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold text-foreground">Project Total</span>
            <span className="text-xl font-bold font-mono text-primary tabular-nums">
              {formatCurrency(total)}
            </span>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="quote-notes" className="text-sm font-medium text-foreground mb-1.5 block">
              Notes
            </label>
            <textarea
              id="quote-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes for this quote..."
              rows={3}
              className="w-full text-sm bg-card border border-border rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="gap-1.5 text-xs h-9"
              onClick={handleSave}
              disabled={saving}
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              variant={copied ? "default" : "outline"}
              size="sm"
              className="gap-1.5 text-xs h-9"
              onClick={handleCopy}
            >
              {copied ? (
                <><Check className="h-3.5 w-3.5" />Copied</>
              ) : (
                <><ClipboardCopy className="h-3.5 w-3.5" />Copy for Email</>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-9"
              onClick={() => setShowPlainText(!showPlainText)}
            >
              <FileText className="h-3.5 w-3.5" />
              {showPlainText ? "Hide Text" : "View as Text"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-9"
              onClick={() => onLoadIntoCalculator(quote.id)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit in Calculator
            </Button>
          </div>

          {/* Plain text preview */}
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

export function KanbanBoard({
  onLoadQuote,
}: {
  onLoadQuote: (quoteId: string) => void
}) {
  const { data: quotes, error, isLoading } = useSWR<Quote[]>("/api/quotes", fetcher, {
    refreshInterval: 10000,
  })

  const handleStatusChange = useCallback(async (id: string, newStatus: string) => {
    await fetch(`/api/quotes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    globalMutate("/api/quotes")
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    await fetch(`/api/quotes/${id}`, { method: "DELETE" })
    globalMutate("/api/quotes")
  }, [])

  const [detailQuote, setDetailQuote] = useState<Quote | null>(null)

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

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const colQuotes = (quotes || []).filter((q) => q.status === col.key)
          return (
            <div key={col.key} className="flex flex-col gap-3">
              {/* Column header */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
                  <span className="text-sm font-semibold text-foreground">{col.label}</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
                    {colQuotes.length}
                  </Badge>
                </div>
                <span className="text-xs font-mono text-muted-foreground tabular-nums">
                  {formatCurrency(colQuotes.reduce((s, q) => s + Number(q.total), 0))}
                </span>
              </div>

              {/* Column body */}
              <div className="flex flex-col gap-2 min-h-[120px] p-2 rounded-lg bg-muted/30 border border-dashed border-border">
                {colQuotes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center flex-1">
                    <FileText className="h-5 w-5 text-muted-foreground/50 mb-2" />
                    <p className="text-xs text-muted-foreground">No quotes</p>
                  </div>
                ) : (
                  colQuotes.map((quote) => (
                    <QuoteCard
                      key={quote.id}
                      quote={quote}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDelete}
                      onEdit={(id) => {
                        const q = colQuotes.find((x) => x.id === id)
                        if (q) setDetailQuote(q)
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit modal */}
      {detailQuote && (
        <QuoteEditModal
          quote={detailQuote}
          onClose={() => setDetailQuote(null)}
          onSaved={() => globalMutate("/api/quotes")}
          onLoadIntoCalculator={(id) => {
            setDetailQuote(null)
            onLoadQuote(id)
          }}
        />
      )}
    </>
  )
}
