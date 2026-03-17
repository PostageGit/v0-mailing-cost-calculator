"use client"

import { useState, useEffect, useCallback } from "react"
import { useQuote, type QuoteRevision } from "@/lib/quote-context"
import { getCategoryLabel } from "@/lib/quote-types"
import { formatCurrency } from "@/lib/pricing"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RotateCcw, CheckCircle2, Clock, Package, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface RevisionHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function RelativeTime({ date }: { date: string }) {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHrs = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHrs / 24)

  let relative = ""
  if (diffMins < 1) relative = "Just now"
  else if (diffMins < 60) relative = `${diffMins}m ago`
  else if (diffHrs < 24) relative = `${diffHrs}h ago`
  else if (diffDays < 7) relative = `${diffDays}d ago`
  else relative = d.toLocaleDateString()

  return (
    <span title={d.toLocaleString()}>
      {relative}
    </span>
  )
}

// Generate a detailed change summary between two revisions
function getChangeSummary(prev: QuoteRevision, current: QuoteRevision): string[] {
  const changes: string[] = []
  
  // Price change
  const priceDiff = current.total - prev.total
  if (priceDiff !== 0) {
    const sign = priceDiff > 0 ? "+" : ""
    changes.push(`${sign}${formatCurrency(priceDiff)}`)
  }
  
  // Quantity change
  if (prev.quantity && current.quantity && prev.quantity !== current.quantity) {
    changes.push(`Qty: ${prev.quantity.toLocaleString()}\u2192${current.quantity.toLocaleString()}`)
  }
  
  // Compare items metadata for detailed changes
  const prevItems = prev.items || []
  const curItems = current.items || []
  
  // Try to match items by category for comparison
  for (const curItem of curItems) {
    const prevItem = prevItems.find(p => p.category === curItem.category)
    if (!prevItem) continue
    
    const prevMeta = prevItem.metadata || {}
    const curMeta = curItem.metadata || {}
    const prevCalc = (prevMeta.calculatorInputs || {}) as Record<string, unknown>
    const curCalc = (curMeta.calculatorInputs || {}) as Record<string, unknown>
    
    // Paper change
    const prevPaper = prevCalc.paperName || prevCalc.insidePaper || prevMeta.paperName
    const curPaper = curCalc.paperName || curCalc.insidePaper || curMeta.paperName
    if (prevPaper && curPaper && prevPaper !== curPaper) {
      changes.push("Paper changed")
    }
    
    // Size change
    const prevW = prevCalc.width || prevCalc.pageWidth
    const prevH = prevCalc.height || prevCalc.pageHeight
    const curW = curCalc.width || curCalc.pageWidth
    const curH = curCalc.height || curCalc.pageHeight
    if (prevW && curW && prevH && curH && (prevW !== curW || prevH !== curH)) {
      changes.push(`Size: ${prevW}x${prevH}\u2192${curW}x${curH}`)
    }
    
    // Sides change
    const prevSides = prevCalc.sidesValue || prevMeta.sides
    const curSides = curCalc.sidesValue || curMeta.sides
    if (prevSides && curSides && prevSides !== curSides) {
      changes.push(`Sides: ${String(prevSides).toUpperCase()}\u2192${String(curSides).toUpperCase()}`)
    }
    
    // Pages change (booklet/perfect)
    const prevPages = prevCalc.pagesPerBook || prevCalc.contentPages || prevMeta.pageCount
    const curPages = curCalc.pagesPerBook || curCalc.contentPages || curMeta.pageCount
    if (prevPages && curPages && prevPages !== curPages) {
      changes.push(`Pages: ${prevPages}\u2192${curPages}`)
    }
    
    // Lamination change
    const prevLam = prevCalc.laminationType || (prevCalc.lamination as Record<string, unknown>)?.type
    const curLam = curCalc.laminationType || (curCalc.lamination as Record<string, unknown>)?.type
    if (prevLam !== curLam) {
      if ((!prevLam || prevLam === "none") && curLam && curLam !== "none") {
        changes.push("+Lamination")
      } else if (prevLam && prevLam !== "none" && (!curLam || curLam === "none")) {
        changes.push("-Lamination")
      }
    }
    
    // Binding change (booklet)
    const prevBind = prevCalc.bindingType
    const curBind = curCalc.bindingType
    if (prevBind && curBind && prevBind !== curBind) {
      changes.push(`Binding: ${prevBind}\u2192${curBind}`)
    }
    
    // Item quantity change (from label or calculatorInputs)
    const prevQty = prevCalc.qty || prevCalc.bookQty
    const curQty = curCalc.qty || curCalc.bookQty
    if (prevQty && curQty && prevQty !== curQty) {
      changes.push(`Qty: ${Number(prevQty).toLocaleString()}\u2192${Number(curQty).toLocaleString()}`)
    }
  }
  
  // Item count changes
  if (curItems.length > prevItems.length) {
    const diff = curItems.length - prevItems.length
    changes.push(`+${diff} ${diff === 1 ? "item" : "items"}`)
  } else if (curItems.length < prevItems.length) {
    const diff = prevItems.length - curItems.length
    changes.push(`-${diff} ${diff === 1 ? "item" : "items"}`)
  }
  
  // Deduplicate (e.g. Qty might appear from both quantity and calculatorInputs)
  const unique = [...new Set(changes)]
  return unique.length > 0 ? unique.slice(0, 4) : ["Minor adjustments"]
}

function RevisionCard({
  rev,
  prevRev,
  onRestore,
  isLatest,
}: {
  rev: QuoteRevision
  prevRev: QuoteRevision | null
  onRestore: (revNum: number) => void
  isLatest: boolean
}) {
  const [expanded, setExpanded] = useState(isLatest)
  const items = rev.items || []
  const totalDiff = prevRev ? rev.total - prevRev.total : 0
  const changeSummary = prevRev ? getChangeSummary(prevRev, rev) : []

  return (
    <div
      className={cn(
        "relative rounded-xl border transition-all duration-200",
        rev.is_current
          ? "border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20"
          : "border-border/60 bg-card hover:border-border"
      )}
    >
      {/* Card header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Revision badge */}
            <div
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold",
                rev.is_current
                  ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300"
                  : "bg-secondary text-muted-foreground"
              )}
            >
              {rev.revision_number}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  Revision {rev.revision_number}
                </span>
                {rev.is_current && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" />
                    Current
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <RelativeTime date={rev.created_at} />
                </span>
                <span className="inline-flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  {items.length} {items.length === 1 ? "item" : "items"}
                </span>
                {rev.quantity && (
                  <span>{rev.quantity.toLocaleString()} pcs</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Total + diff */}
            <div className="text-right">
              <div className="text-base font-bold tabular-nums text-foreground">
                {formatCurrency(rev.total)}
              </div>
              {prevRev && totalDiff !== 0 && (
                <div
                  className={cn(
                    "text-[11px] font-semibold tabular-nums",
                    totalDiff > 0
                      ? "text-rose-500 dark:text-rose-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  )}
                >
                  {totalDiff > 0 ? "+" : ""}{formatCurrency(totalDiff)}
                </div>
              )}
            </div>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Change summary line */}
        {prevRev && changeSummary.length > 0 && (
          <div className="mt-2 ml-[52px]">
            <p className={cn(
              "text-[11px] font-medium",
              totalDiff < 0
                ? "text-emerald-600 dark:text-emerald-400"
                : totalDiff > 0
                  ? "text-rose-500 dark:text-rose-400"
                  : "text-blue-600 dark:text-blue-400"
            )}>
              Changed: {changeSummary.join(", ")}
            </p>
          </div>
        )}
      </button>

      {/* Expanded item list */}
      {expanded && (
        <div className="px-5 pb-4 border-t border-border/40">
          {/* Change summary banner in expanded view */}
          {prevRev && changeSummary.length > 0 && (
            <div className={cn(
              "mt-3 px-3 py-2 rounded-lg text-[12px] font-medium",
              totalDiff < 0
                ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300"
                : totalDiff > 0
                  ? "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400"
                  : "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400"
            )}>
              Changed: {changeSummary.join(", ")}
            </div>
          )}
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3">No items in this revision.</p>
          ) : (
            <div className="mt-3 space-y-1.5">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-3 py-2 px-3 rounded-lg bg-secondary/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-foreground/5 text-muted-foreground border border-border/40">
                        {getCategoryLabel(item.category)}
                      </span>
                    </div>
                    <p className="text-[13px] font-medium text-foreground mt-1 leading-snug">
                      {item.label}
                    </p>
                    {item.description && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <span className="text-[13px] font-semibold tabular-nums text-foreground shrink-0 pt-5">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Restore button for non-current revisions */}
          {!rev.is_current && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRestore(rev.revision_number)
              }}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-background text-sm font-medium text-foreground hover:bg-secondary transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restore this version
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Shared inner content for both dialog variants
function RevisionDialogInner({
  revisions,
  loading,
  onRestore,
}: {
  revisions: QuoteRevision[]
  loading: boolean
  onRestore: (revNum: number) => void
}) {
  const sorted = [...revisions].sort((a, b) => {
    if (a.is_current && !b.is_current) return -1
    if (!a.is_current && b.is_current) return 1
    return b.revision_number - a.revision_number
  })

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border/40 p-5 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 rounded bg-secondary" />
                <div className="h-3 w-40 rounded bg-secondary/60" />
              </div>
              <div className="h-5 w-20 rounded bg-secondary" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-3">
          <Clock className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">No versions yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Versions are created each time you save changes to your quote.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {sorted.map((rev, idx) => {
        const prevRev = sorted[idx + 1] || null
        return (
          <RevisionCard
            key={rev.revision_number}
            rev={rev}
            prevRev={prevRev}
            onRestore={onRestore}
            isLatest={idx === 0}
          />
        )
      })}
    </div>
  )
}

/** Used from the quote sidebar (depends on useQuote context) */
export function RevisionHistoryDialog({ open, onOpenChange }: RevisionHistoryDialogProps) {
  const { revisions, fetchRevisions, loadRevision, savedId } = useQuote()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !savedId) return
    if (revisions.length === 0) {
      setLoading(true)
      fetchRevisions().finally(() => setLoading(false))
    }
  }, [open, savedId, revisions.length, fetchRevisions])

  const handleRestore = useCallback(
    (revNum: number) => {
      loadRevision(revNum)
      onOpenChange(false)
    },
    [loadRevision, onOpenChange]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50 shrink-0">
          <DialogTitle className="text-lg font-semibold text-foreground">
            Version History
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {revisions.length} {revisions.length === 1 ? "version" : "versions"} saved
          </p>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <RevisionDialogInner revisions={revisions} loading={loading} onRestore={handleRestore} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Standalone version for kanban cards - fetches its own data by quoteId */
export function StandaloneRevisionDialog({
  open,
  onOpenChange,
  quoteId,
  quoteName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  quoteId: string
  quoteName?: string
}) {
  const [revisions, setRevisions] = useState<QuoteRevision[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !quoteId) return
    setLoading(true)
    fetch(`/api/quotes/${quoteId}/revisions`)
      .then((r) => r.json())
      .then((json) => {
        const all = [json.current, ...(json.revisions || [])]
          .filter(Boolean)
          .sort((a: QuoteRevision, b: QuoteRevision) => a.revision_number - b.revision_number)
        setRevisions(all)
      })
      .catch(() => setRevisions([]))
      .finally(() => setLoading(false))
  }, [open, quoteId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50 shrink-0">
          <DialogTitle className="text-lg font-semibold text-foreground">
            Version History {quoteName && <span className="text-muted-foreground font-normal ml-2">- {quoteName}</span>}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {revisions.length} {revisions.length === 1 ? "version" : "versions"} saved
          </p>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <RevisionDialogInner
            revisions={revisions}
            loading={loading}
            onRestore={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
