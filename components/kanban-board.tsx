"use client"

import { useState, useEffect, useCallback } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { formatCurrency } from "@/lib/pricing"
import { getCategoryLabel, type QuoteCategory } from "@/lib/quote-types"
import {
  FileText,
  Trash2,
  GripVertical,
  ArrowRight,
  ArrowLeft,
  Pencil,
  Clock,
  Loader2,
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

// Expanded quote detail view
function QuoteDetail({ quote, onClose }: { quote: Quote; onClose: () => void }) {
  // Group items by category
  const categories = Array.from(new Set(quote.items?.map((i) => i.category) || []))

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-lg max-h-[80vh] overflow-y-auto border-border shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{quote.project_name}</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">
              Close
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-xs capitalize">
              {quote.status}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Updated {formatDate(quote.updated_at)}
            </span>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {categories.map((cat) => {
            const catItems = quote.items.filter((i) => i.category === cat)
            const catTotal = catItems.reduce((s, i) => s + i.amount, 0)
            return (
              <div key={cat}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-foreground">
                    {getCategoryLabel(cat)}
                  </span>
                  <span className="text-sm font-mono font-semibold tabular-nums">
                    {formatCurrency(catTotal)}
                  </span>
                </div>
                {catItems.map((item, idx) => (
                  <div key={idx} className="flex items-start justify-between py-1.5 px-2 bg-muted/40 rounded-md mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {catItems.length > 1 && (
                          <span className="text-muted-foreground font-mono mr-1">#{idx + 1}</span>
                        )}
                        {item.label}
                      </p>
                      {item.description && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{item.description}</p>
                      )}
                    </div>
                    <span className="text-xs font-mono font-semibold tabular-nums ml-2">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )
          })}

          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Total</span>
            <span className="text-lg font-bold font-mono text-primary tabular-nums">
              {formatCurrency(quote.total)}
            </span>
          </div>
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

      {/* Detail modal */}
      {detailQuote && (
        <QuoteDetail
          quote={detailQuote}
          onClose={() => setDetailQuote(null)}
        />
      )}
    </>
  )
}
