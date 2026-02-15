"use client"

import { useQuote } from "@/lib/quote-context"
import {
  getCategoryLabel,
  getCategoryColor,
  type QuoteCategory,
} from "@/lib/quote-types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, FileText, ChevronDown, ChevronUp, ClipboardCopy, Check, FilePlus, Cloud, Loader2 } from "lucide-react"
import { useState, useCallback } from "react"
import { formatCurrency } from "@/lib/pricing"
import { buildQuoteText } from "@/lib/build-quote-text"

const CATEGORIES: QuoteCategory[] = ["flat", "booklet", "postage", "listwork", "item", "ohp"]

export function QuoteSidebar() {
  const {
    items, projectName, savedId, isSaving, lastSavedAt,
    removeItem, clearAll, getTotal, getCategoryTotal, newQuote,
  } = useQuote()

  const [collapsedCats, setCollapsedCats] = useState<Set<QuoteCategory>>(new Set())
  const [confirmClear, setConfirmClear] = useState(false)
  const [copied, setCopied] = useState(false)

  const toggleCat = (cat: QuoteCategory) => {
    setCollapsedCats((p) => { const n = new Set(p); n.has(cat) ? n.delete(cat) : n.add(cat); return n })
  }

  const total = getTotal()
  const hasItems = items.length > 0

  const handleCopy = useCallback(async () => {
    const text = buildQuoteText(items, projectName || undefined)
    try { await navigator.clipboard.writeText(text) } catch { /* fallback */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [items, projectName])

  const saveText = isSaving ? "Saving..." : lastSavedAt ? `Saved ${timeSince(lastSavedAt)}` : savedId ? "Saved" : null

  return (
    <div className="rounded-2xl bg-card border border-border flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-10 border-b border-border/60 bg-secondary/30 shrink-0">
        <span className="text-[11px] font-semibold text-foreground tracking-tight">Quote</span>
        <div className="flex items-center gap-2">
          {saveText && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              {isSaving ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Cloud className="h-2.5 w-2.5 text-chart-2" />}
              {saveText}
            </span>
          )}
          {hasItems && (
            confirmClear ? (
              <div className="flex gap-1">
                <button onClick={() => { clearAll(); setConfirmClear(false) }}
                  className="text-[10px] font-medium text-destructive hover:underline">Clear</button>
                <button onClick={() => setConfirmClear(false)}
                  className="text-[10px] text-muted-foreground hover:underline">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmClear(true)}
                className="text-[10px] text-muted-foreground hover:text-destructive transition-colors">Clear all</button>
            )
          )}
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3" style={{ overscrollBehavior: "contain" }}>
        {!hasItems ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-2xl bg-secondary p-4 mb-4">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground max-w-[200px] leading-relaxed">
              Add items from any step to build your quote.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {CATEGORIES.map((cat) => {
              const catItems = items.filter((i) => i.category === cat)
              if (catItems.length === 0) return null
              const catTotal = getCategoryTotal(cat)
              const collapsed = collapsedCats.has(cat)

              return (
                <div key={cat} className="rounded-xl bg-secondary/40 overflow-hidden">
                  <button
                    onClick={() => toggleCat(cat)}
                    className="w-full flex items-center justify-between px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary"
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border-0 ${getCategoryColor(cat)}`}>
                        {getCategoryLabel(cat)}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{catItems.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-foreground tabular-nums">
                        {formatCurrency(catTotal)}
                      </span>
                      {collapsed ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronUp className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  </button>
                  {!collapsed && (
                    <div className="flex flex-col gap-px px-2 pb-2">
                      {catItems.map((item, idx) => (
                        <div key={item.id} className="flex items-start justify-between gap-2 py-2 px-2 rounded-lg bg-card group">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate leading-tight">
                              {catItems.length > 1 && <span className="text-muted-foreground font-mono mr-1 text-[10px]">#{idx + 1}</span>}
                              {item.label}
                            </p>
                            {item.description && (
                              <p className="text-[10px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">{item.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs font-mono font-semibold text-foreground tabular-nums">
                              {formatCurrency(item.amount)}
                            </span>
                            <button
                              onClick={() => removeItem(item.id)}
                              className="p-1 rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                              aria-label={`Remove ${item.label}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {hasItems && (
        <div className="shrink-0 border-t border-border/60 px-3 py-3 flex flex-col gap-2.5 bg-secondary/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Total</span>
            <span className="text-lg font-bold font-mono text-foreground tabular-nums">{formatCurrency(total)}</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant={copied ? "default" : "secondary"}
              size="sm"
              className="flex-1 gap-1.5 text-[11px] h-8 rounded-lg"
              onClick={handleCopy}
            >
              {copied ? <><Check className="h-3 w-3" />Copied</> : <><ClipboardCopy className="h-3 w-3" />Copy</>}
            </Button>
            <Button variant="secondary" size="sm" className="gap-1.5 text-[11px] h-8 rounded-lg" onClick={newQuote}>
              <FilePlus className="h-3 w-3" />New
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function timeSince(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 10) return "just now"
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}
