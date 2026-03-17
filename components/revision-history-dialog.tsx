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
import { RotateCcw, CheckCircle2, Clock, ChevronDown, ChevronUp } from "lucide-react"
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
  isOriginal,
  totalRevisions,
}: {
  rev: QuoteRevision
  prevRev: QuoteRevision | null
  onRestore: (revNum: number) => void
  isLatest: boolean
  isOriginal: boolean
  totalRevisions: number
}) {
  const [expanded, setExpanded] = useState(isLatest)
  const items = rev.items || []
  const totalDiff = prevRev ? rev.total - prevRev.total : 0
  const changeSummary = prevRev ? getChangeSummary(prevRev, rev) : []

  // Determine the label and visual style
  const label = isOriginal
    ? "Original"
    : rev.is_current
      ? `Revision ${rev.revision_number - 1}`
      : `Revision ${rev.revision_number - 1}`

  const sublabel = rev.is_current
    ? "Current version"
    : isOriginal
      ? `First saved \u00b7 ${totalRevisions - 1} revision${totalRevisions - 1 !== 1 ? "s" : ""} since`
      : null

  return (
    <div
      className={cn(
        "relative rounded-xl border transition-all duration-200",
        rev.is_current
          ? "border-foreground/20 bg-background shadow-sm ring-1 ring-foreground/5"
          : isOriginal
            ? "border-border/40 bg-muted/30"
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
            {/* Badge */}
            <div
              className={cn(
                "flex items-center justify-center w-9 h-9 rounded-full text-[11px] font-bold shrink-0",
                rev.is_current
                  ? "bg-foreground text-background"
                  : isOriginal
                    ? "bg-muted text-muted-foreground/60 border border-border/50"
                    : "bg-secondary text-muted-foreground"
              )}
            >
              {isOriginal ? "v1" : `v${rev.revision_number}`}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-sm font-semibold",
                  rev.is_current ? "text-foreground" : isOriginal ? "text-muted-foreground" : "text-foreground"
                )}>
                  {label}
                </span>
                {rev.is_current && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-foreground text-background">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    CURRENT
                  </span>
                )}
                {isOriginal && !rev.is_current && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-medium text-muted-foreground/60 bg-muted border border-border/40">
                    ORIGINAL
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <RelativeTime date={rev.created_at} />
                </span>
                {items.length > 0 && (
                  <span>{items.length} {items.length === 1 ? "item" : "items"}</span>
                )}
                {rev.quantity ? (
                  <span>{rev.quantity.toLocaleString()} pcs</span>
                ) : null}
                {sublabel && (
                  <span className="text-muted-foreground/50">{sublabel}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className={cn(
                "text-base font-bold tabular-nums",
                rev.is_current ? "text-foreground" : isOriginal ? "text-muted-foreground" : "text-foreground"
              )}>
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

        {/* Change summary - only on revised versions, not original */}
        {!isOriginal && prevRev && changeSummary.length > 0 && (
          <div className={cn(
            "mt-2 ml-12 px-2.5 py-1.5 rounded-md text-[11px] font-medium inline-block",
            totalDiff < 0
              ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300"
              : totalDiff > 0
                ? "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400"
                : "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400"
          )}>
            Changed: {changeSummary.join(", ")}
          </div>
        )}
      </button>

      {/* Expanded item list with diff against previous revision */}
      {expanded && (
        <div className="px-5 pb-4 border-t border-border/40">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3">No items in this revision.</p>
          ) : (() => {
            // Build diff status for each item
            const prevItems = prevRev?.items || []

            type ItemDiff = {
              item: typeof items[0]
              status: "unchanged" | "changed" | "new" | "price_changed"
              prevItem?: typeof items[0]
              priceChange?: number
            }

            const diffs: ItemDiff[] = items.map(item => {
              if (!prevRev || isOriginal) {
                // Original revision - nothing to compare against
                return { item, status: "unchanged" as const }
              }
              // Try to find matching item by category + similar label
              const match = prevItems.find(p =>
                p.category === item.category &&
                // Match by label similarity (strip leading numbers for comparison)
                p.label.replace(/^[\d,]+\s*[-–]\s*/, "") === item.label.replace(/^[\d,]+\s*[-–]\s*/, "")
              )
              if (!match) {
                // No matching item in previous revision
                return { item, status: "new" as const }
              }
              // Check what changed
              const priceChange = item.amount - match.amount
              const labelChanged = item.label !== match.label
              const descChanged = item.description !== match.description
              if (priceChange === 0 && !labelChanged && !descChanged) {
                return { item, status: "unchanged" as const, prevItem: match }
              }
              if (!labelChanged && !descChanged && priceChange !== 0) {
                return { item, status: "price_changed" as const, prevItem: match, priceChange }
              }
              return { item, status: "changed" as const, prevItem: match, priceChange }
            })

            // Find removed items (in prev but not in current)
            const removedItems = prevRev && !isOriginal ? prevItems.filter(prev =>
              !items.find(cur =>
                cur.category === prev.category &&
                cur.label.replace(/^[\d,]+\s*[-–]\s*/, "") === prev.label.replace(/^[\d,]+\s*[-–]\s*/, "")
              )
            ) : []

            const unchangedCount = diffs.filter(d => d.status === "unchanged").length
            const changedDiffs = diffs.filter(d => d.status !== "unchanged")

            return (
              <div className="mt-3 space-y-1.5">
                {/* Only show items that actually changed */}
                {changedDiffs.map(({ item, status, prevItem, priceChange }, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-start justify-between gap-3 py-2.5 px-3 rounded-lg border",
                      status === "new"
                        ? "bg-emerald-50/60 dark:bg-emerald-950/15 border-emerald-200/60 dark:border-emerald-800/40"
                        : "bg-amber-50/60 dark:bg-amber-950/15 border-amber-200/60 dark:border-amber-800/40"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="shrink-0 inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-foreground/5 text-muted-foreground border border-border/40">
                          {getCategoryLabel(item.category)}
                        </span>
                        {status === "new" && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                            NEW
                          </span>
                        )}
                        {status === "changed" && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                            MODIFIED
                          </span>
                        )}
                        {status === "price_changed" && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">
                            REPRICED
                          </span>
                        )}
                      </div>
                      {/* For modified items: show before → after */}
                      {prevItem && (status === "changed" || status === "price_changed") ? (
                        <div className="space-y-0.5">
                          <p className="text-[11px] text-muted-foreground/50 line-through leading-snug">
                            {prevItem.label}
                          </p>
                          <p className="text-[13px] font-medium text-foreground leading-snug">
                            {item.label}
                          </p>
                        </div>
                      ) : (
                        <p className="text-[13px] font-medium text-foreground leading-snug">
                          {item.label}
                        </p>
                      )}
                      {item.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0 pt-5">
                      <span className="text-[13px] font-semibold tabular-nums text-foreground">
                        {formatCurrency(item.amount)}
                      </span>
                      {priceChange && priceChange !== 0 && (
                        <p className={cn(
                          "text-[10px] font-medium tabular-nums",
                          priceChange > 0 ? "text-rose-500 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                        )}>
                          {priceChange > 0 ? "+" : ""}{formatCurrency(priceChange)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {/* Quiet unchanged count — only when there are also changed items to compare against */}
                {!isOriginal && unchangedCount > 0 && changedDiffs.length > 0 && (
                  <p className="text-[11px] text-muted-foreground/50 px-1 pt-0.5">
                    + {unchangedCount} item{unchangedCount !== 1 ? "s" : ""} unchanged
                  </p>
                )}

                {/* No-changes fallback */}
                {!isOriginal && changedDiffs.length === 0 && removedItems.length === 0 && (
                  <p className="text-[11px] text-muted-foreground/50 px-1">
                    No changes from previous version
                  </p>
                )}

                {/* Removed items */}
                {removedItems.map((item, idx) => (
                  <div
                    key={`removed-${idx}`}
                    className="flex items-start justify-between gap-3 py-2.5 px-3 rounded-lg border bg-rose-50/50 dark:bg-rose-950/10 border-rose-200/50 dark:border-rose-800/30"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-foreground/5 text-muted-foreground/40 border border-border/30">
                          {getCategoryLabel(item.category)}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400">
                          REMOVED
                        </span>
                      </div>
                      <p className="text-[13px] font-medium text-muted-foreground/50 mt-1 leading-snug line-through">
                        {item.label}
                      </p>
                    </div>
                    <span className="text-[13px] font-semibold tabular-nums text-muted-foreground/40 shrink-0 pt-4 line-through">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )
          })()}

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

  const lowestRevNum = sorted.length > 0 ? sorted[sorted.length - 1].revision_number : 0

  return (
    <div className="space-y-3">
      {sorted.map((rev, idx) => {
        const prevRev = sorted[idx + 1] || null
        const isOriginal = rev.revision_number === lowestRevNum
        return (
          <RevisionCard
            key={rev.revision_number}
            rev={rev}
            prevRev={prevRev}
            onRestore={onRestore}
            isLatest={idx === 0}
            isOriginal={isOriginal}
            totalRevisions={sorted.length}
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
            Original + {Math.max(0, revisions.length - 1)} {revisions.length - 1 === 1 ? "revision" : "revisions"}
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
            Original + {Math.max(0, revisions.length - 1)} {revisions.length - 1 === 1 ? "revision" : "revisions"}
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
