"use client"

import { useQuote } from "@/lib/quote-context"
import {
  getCategoryLabel,
  getCategoryColor,
  type QuoteCategory,
} from "@/lib/quote-types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { X, FileText, ChevronDown, ChevronUp, ClipboardCopy, Check, FilePlus, Cloud, Loader2, Users } from "lucide-react"
import { useState, useCallback } from "react"
import useSWR from "swr"
import { formatCurrency } from "@/lib/pricing"
import { buildQuoteText } from "@/lib/build-quote-text"
import type { Customer } from "@/lib/customer-types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const CATEGORIES: QuoteCategory[] = ["flat", "booklet", "postage", "listwork", "item", "ohp"]

export function QuoteSidebar() {
  const {
    items,
    projectName,
    customerId,
    referenceNumber,
    savedId,
    isSaving,
    lastSavedAt,
    removeItem,
    clearAll,
    getTotal,
    getCategoryTotal,
    newQuote,
  } = useQuote()

  const { data: customers } = useSWR<Customer[]>("/api/customers", fetcher)

  const [collapsedCats, setCollapsedCats] = useState<Set<QuoteCategory>>(new Set())
  const [confirmClear, setConfirmClear] = useState(false)

  const toggleCategory = (cat: QuoteCategory) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const total = getTotal()
  const hasItems = items.length > 0

  const [copied, setCopied] = useState(false)
  const [showPlainText, setShowPlainText] = useState(false)

  const buildPlainText = useCallback(() => {
    return buildQuoteText(items, projectName || undefined)
  }, [items, projectName])

  const handleCopy = useCallback(async () => {
    const text = buildPlainText()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const ta = document.createElement("textarea")
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [buildPlainText])

  // Auto-save status text
  const saveStatusText = isSaving
    ? "Saving..."
    : lastSavedAt
    ? `Saved ${formatTimeSince(lastSavedAt)}`
    : savedId
    ? "Saved"
    : null

  return (
    <Card className="border-border bg-card shadow-sm h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Quote Builder
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Auto-save indicator */}
            {saveStatusText && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                {isSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Cloud className="h-3 w-3 text-emerald-500" />
                )}
                {saveStatusText}
              </span>
            )}
            {hasItems && (
              confirmClear ? (
                <div className="flex items-center gap-1">
                  <Button variant="destructive" size="sm" className="h-6 text-[10px] px-2"
                    onClick={() => { clearAll(); setConfirmClear(false) }}>
                    Confirm
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2"
                    onClick={() => setConfirmClear(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirmClear(true)}>
                  Clear
                </Button>
              )
            )}
          </div>
        </div>

        {/* Job info summary (fields are in the header now) */}
        {(projectName || customerId) && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {projectName && (
              <Badge variant="secondary" className="text-[10px]">
                <FileText className="h-2.5 w-2.5 mr-1" />{projectName}
              </Badge>
            )}
            {customerId && customers && (
              <Badge variant="outline" className="text-[10px]">
                <Users className="h-2.5 w-2.5 mr-1" />
                {customers.find((c) => c.id === customerId)?.company_name || "Customer"}
              </Badge>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pt-0" style={{ overscrollBehavior: "contain" }}>
        {!hasItems ? (
          <div className="flex flex-col items-center justify-center py-12 text-center flex-1">
            <div className="rounded-full bg-muted p-3 mb-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground max-w-[180px] leading-relaxed">
              Add items from any calculator to build your project quote.
            </p>
          </div>
        ) : (
          <>
            {CATEGORIES.map((cat) => {
              const catItems = items.filter((i) => i.category === cat)
              if (catItems.length === 0) return null

              const catTotal = getCategoryTotal(cat)
              const isCollapsed = collapsedCats.has(cat)

              return (
                <div key={cat}>
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="w-full flex items-center justify-between py-2 px-1 group"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 font-semibold ${getCategoryColor(cat)}`}>
                        {getCategoryLabel(cat)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">({catItems.length})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-foreground tabular-nums">
                        {formatCurrency(catTotal)}
                      </span>
                      {isCollapsed ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronUp className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  </button>

                  {!isCollapsed && (
                    <div className="flex flex-col gap-1.5 ml-1">
                      {catItems.map((item, idx) => (
                        <div key={item.id} className="flex items-start justify-between gap-2 py-1.5 px-2 rounded-md bg-muted/40 group/item">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">
                              {catItems.length > 1 && <span className="text-muted-foreground font-mono mr-1">#{idx + 1}</span>}
                              {item.label}
                            </p>
                            {item.description && (
                              <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">{item.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className="text-xs font-mono font-semibold text-foreground tabular-nums">
                              {formatCurrency(item.amount)}
                            </span>
                            <button
                              onClick={() => removeItem(item.id)}
                              className="p-1 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none transition-colors"
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
          </>
        )}
      </CardContent>

      {/* Footer */}
      {hasItems && (
        <div className="flex-shrink-0 border-t border-border p-4 flex flex-col gap-2.5">
          {CATEGORIES.map((cat) => {
            const catTotal = getCategoryTotal(cat)
            if (catTotal === 0) return null
            return (
              <div key={cat} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{getCategoryLabel(cat)}</span>
                <span className="text-xs font-mono text-muted-foreground tabular-nums">{formatCurrency(catTotal)}</span>
              </div>
            )
          })}
          {getCategoryTotal("flat") > 0 && getCategoryTotal("booklet") > 0 && (
            <div className="flex items-center justify-between pt-1 border-t border-dashed border-border">
              <span className="text-xs font-medium text-foreground">All Printing</span>
              <span className="text-xs font-mono font-medium text-foreground tabular-nums">
                {formatCurrency(getCategoryTotal("flat") + getCategoryTotal("booklet"))}
              </span>
            </div>
          )}
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Project Total</span>
            <span className="text-lg font-bold font-mono text-primary tabular-nums">{formatCurrency(total)}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs h-8"
              onClick={() => setShowPlainText(!showPlainText)}>
              <FileText className="h-3.5 w-3.5" />
              {showPlainText ? "Hide Text" : "View as Text"}
            </Button>
            <Button variant={copied ? "default" : "outline"} size="sm" className="flex-1 gap-1.5 text-xs h-8" onClick={handleCopy}>
              {copied ? <><Check className="h-3.5 w-3.5" />Copied</> : <><ClipboardCopy className="h-3.5 w-3.5" />Copy for Email</>}
            </Button>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={newQuote}>
            <FilePlus className="h-3.5 w-3.5" />
            New Quote
          </Button>

          {showPlainText && (
            <pre className="bg-muted rounded-lg p-3 text-[11px] font-mono text-foreground leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto border border-border select-all">
              {buildPlainText()}
            </pre>
          )}
        </div>
      )}
    </Card>
  )
}

function formatTimeSince(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 10) return "just now"
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ago`
}
