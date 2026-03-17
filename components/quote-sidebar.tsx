"use client"

import { useQuote } from "@/lib/quote-context"
import {
  getCategoryLabel,
  getCategoryColor,
  type QuoteCategory,
  type QuoteLineItem,
} from "@/lib/quote-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  FileText, ChevronDown, ChevronRight, ClipboardCopy, Check,
  FilePlus, Cloud, Loader2, Pencil, Trash2, Clock, Send,
  AlertCircle, SkipForward, CheckCircle2, List, LayoutGrid, Search, X,
} from "lucide-react"
import { useState, useCallback, useRef, useEffect } from "react"
import { formatCurrency } from "@/lib/pricing"
import { cn } from "@/lib/utils"
import { calcMailPieceWeightOz, formatWeight, getEnvelopeWeightOz } from "@/lib/paper-weights"
import { buildQuoteText } from "@/lib/build-quote-text"
import { BOX_SIZES, selectBestBoxes, formatShippingWeight, type BoxSize, type ShippingEstimate } from "@/lib/shipping-boxes"
import { ShippingLabelModal } from "@/components/shipping-label"
import { buildQuotePDF, quotePdfFilename } from "@/lib/build-quote-pdf"
import { Download } from "lucide-react"
import { RevisionHistoryDialog } from "@/components/revision-history-dialog"

// Printing categories first, then services/postage/ohp
const CATEGORIES: QuoteCategory[] = ["flat", "booklet", "spiral", "perfect", "pad", "envelope", "ohp", "postage", "listwork", "item"]

/* ── Inline-editable item row ─────────────────────────── */
function QuoteItemRow({
  item,
  onUpdate,
  onRemove,
}: {
  item: QuoteLineItem
  onUpdate: (id: number, updates: Partial<Omit<QuoteLineItem, "id">>) => void
  onRemove: (id: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(item.label)
  const [desc, setDesc] = useState(item.description)
  const [amount, setAmount] = useState(String(item.amount))
  const labelRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && labelRef.current) labelRef.current.focus()
  }, [editing])

  const save = () => {
    const parsed = parseFloat(amount)
    onUpdate(item.id, {
      label: label.trim() || item.label,
      description: desc,
      amount: isNaN(parsed) ? item.amount : parsed,
    })
    setEditing(false)
  }

  const cancel = () => {
    setLabel(item.label)
    setDesc(item.description)
    setAmount(String(item.amount))
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-border/60 bg-background p-3.5 flex flex-col gap-2.5">
        <div>
          <label className="text-[11px] font-medium text-muted-foreground/70 mb-1 block">Label</label>
          <Input
            ref={labelRef}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="h-9 text-[13px] font-medium rounded-lg"
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-muted-foreground/70 mb-1 block">Description</label>
          <Input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="h-9 text-[13px] rounded-lg"
            placeholder="Optional details..."
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-muted-foreground/70 mb-1 block">Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-medium text-muted-foreground/60">$</span>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-9 text-[13px] font-mono font-semibold rounded-lg pl-7"
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
          </div>
        </div>
        <div className="flex gap-2 pt-0.5">
          <Button size="sm" className="flex-1 h-8 text-[12px] rounded-lg font-semibold gap-1.5" onClick={save}>
            <Check className="h-3.5 w-3.5" /> Save
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-[12px] rounded-lg font-medium" onClick={cancel}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-start gap-2 py-2 px-2.5 rounded-lg hover:bg-secondary/30 transition-colors">
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground leading-snug">
          {item.label}
        </p>
        {item.metadata?.customerProvided && (
          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-[9px] font-bold text-amber-700 dark:text-amber-400 tracking-wide uppercase">
            Customer Provides
            {item.metadata.providerExpectedDate && (
              <span className="font-semibold normal-case ml-0.5">
                {" "}&middot; {new Date(item.metadata.providerExpectedDate as string).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </span>
        )}
        {item.description && (
          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-1">
            {item.description}
          </p>
        )}
        {/* Finishing details from metadata */}
        {item.metadata && (() => {
          const m = item.metadata
          const tags: string[] = []
          if (m.pieceType) tags.push(String(m.pieceLabel || m.pieceType))
          if (m.pieceDimensions) tags.push(String(m.pieceDimensions) + '"')
          if (m.foldType && m.foldType !== "none") tags.push("Fold: " + String(m.foldType).replace("x3long","Tri(Long)").replace("x2h","Half(H)").replace("x2w","Half(W)").replace("x3h","Tri(H)").replace("x3w","Tri(W)"))
          if (m.paperName) tags.push(String(m.paperName))
          if (m.sides) tags.push(String(m.sides))
          if (m.hasBleed) tags.push("Bleed")
          if (m.pageCount) tags.push(m.pageCount + "pg")
          // Score / Fold finishing
          if (m.scoreFoldEnabled) {
            const opLabels: Record<string, string> = { fold: "Fold", score_and_fold: "Score & Fold", score_only: "Score Only" }
            const foldLabels: Record<string, string> = { half: "Half", tri: "Tri-Fold", z: "Z-Fold", gate: "Gate", roll: "Roll", accordion: "Accordion", double_gate: "Dbl Gate" }
            const op = opLabels[String(m.scoreFoldFinishType)] || String(m.scoreFoldFinishType)
            const ft = foldLabels[String(m.scoreFoldFoldType)] || String(m.scoreFoldFoldType)
            const orient = m.scoreFoldOrientation ? ` (${String(m.scoreFoldOrientation).charAt(0).toUpperCase() + String(m.scoreFoldOrientation).slice(1)})` : ""
            tags.push(`${op}: ${ft}${orient}`)
          }
          // Lamination
          if (m.laminationEnabled) {
            const lamSides = m.laminationSides === "both" ? "2-sided" : "1-sided"
            tags.push(`Lam: ${String(m.laminationType || "Gloss")} ${lamSides}`)
          }
          if (m.envelopeSize) tags.push("Env: " + String(m.envelopeSize))
          if (m.envelopeKind) tags.push(String(m.envelopeKind))
          if (m.production && m.production !== "inhouse") tags.push(
            m.production === "ohp" ? "OHP" : m.production === "both" ? "In+OHP" : m.production === "customer" ? "Customer" : String(m.production)
          )
          if (m.mailingClass) tags.push(String(m.mailingClass))
          if (m.mailShape) tags.push(String(m.mailShape).charAt(0).toUpperCase() + String(m.mailShape).slice(1))
          if (m.tierName) tags.push(String(m.tierName))
          if (m.entryPoint) tags.push(String(m.entryPoint))
          const isEstimated = !!m.isEstimated
          if (tags.length === 0 && !isEstimated) return null
          return (
            <div className="flex flex-wrap gap-1 mt-1">
              {isEstimated && (
                <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-[9px] font-bold text-amber-700 dark:text-amber-400 leading-none uppercase tracking-wide">
                  Estimated
                </span>
              )}
              {tags.map((t, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded bg-secondary/60 text-[9px] font-medium text-muted-foreground/70 leading-none">
                  {t}
                </span>
              ))}
            </div>
          )
        })()}
      </div>

      {/* Amount + hover actions */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs font-mono font-bold text-foreground tabular-nums">
          {formatCurrency(item.amount)}
        </span>
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setEditing(true)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label={`Edit ${item.label}`}
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={() => onRemove(item.id)}
            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            aria-label={`Remove ${item.label}`}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main sidebar ─────────────────────────────────────── */
interface PendingStep {
  id: string
  label: string
  status: "skipped" | "pending"
}

interface QuoteSidebarProps {
  /** Navigate the user to the Export to QB page */
  onGoToExport?: () => void
  /** Pending / skipped steps to show in the sidebar */
  pendingSteps?: PendingStep[]
  /** Navigate to a specific step */
  onGoToStep?: (stepId: string) => void
}

export function QuoteSidebar({ onGoToExport, pendingSteps, onGoToStep }: QuoteSidebarProps = {}) {
  const {
    items, projectName, customerId, savedId, quoteNumber, isSaving, lastSavedAt, activityLog,
    removeItem, updateItem, clearAll, getTotal, getCategoryTotal, newQuote, ensureSaved,
    contactName, referenceNumber, quantity,
    currentRevision, revisions, fetchRevisions, loadRevision,
  } = useQuote()

  const [collapsedCats, setCollapsedCats] = useState<Set<QuoteCategory>>(new Set())
  const [confirmClear, setConfirmClear] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [sending, setSending] = useState(false)
  const [viewMode, setViewMode] = useState<"full" | "simple">("full")
  const [searchQuery, setSearchQuery] = useState("")
  const [showRevisionDialog, setShowRevisionDialog] = useState(false)

  // Filter items by search
  const filteredItems = searchQuery.trim()
    ? items.filter((item) => {
        const q = searchQuery.toLowerCase()
        return (
          item.label.toLowerCase().includes(q) ||
          (item.description?.toLowerCase().includes(q)) ||
          getCategoryLabel(item.category).toLowerCase().includes(q)
        )
      })
    : items

  const handleFinishAndSend = async () => {
    if (!items.length) return
    setSending(true)
    try {
      await ensureSaved()
      newQuote()
      onGoToExport?.()
    } finally {
      setSending(false)
    }
  }

  const toggleCat = (cat: QuoteCategory) => {
    setCollapsedCats((p) => {
      const n = new Set(p)
      n.has(cat) ? n.delete(cat) : n.add(cat)
      return n
    })
  }

  const total = getTotal()
  const hasItems = items.length > 0

  const handleCopy = useCallback(async () => {
  const text = buildQuoteText({
    items,
    projectName: projectName || undefined,
    customerName: contactName || undefined,
    referenceNumber: referenceNumber || undefined,
    quoteNumber: quoteNumber || undefined,
    quantity: quantity || undefined,
  })
  try {
  await navigator.clipboard.writeText(text)
  } catch { /* fallback */ }
  setCopied(true)
  setTimeout(() => setCopied(false), 2000)
  }, [items, projectName, contactName, referenceNumber, quoteNumber, quantity])

  const handleDownloadPDF = useCallback(() => {
    const pdfOpts = {
      items,
      projectName: projectName || undefined,
      customerName: contactName || undefined,
      referenceNumber: referenceNumber || undefined,
      quoteNumber: quoteNumber || undefined,
      quantity: quantity || undefined,
    }
    const doc = buildQuotePDF(pdfOpts)
    doc.save(quotePdfFilename(pdfOpts))
  }, [items, projectName, contactName, referenceNumber, quoteNumber, quantity])

  const saveText = isSaving
    ? "Saving..."
    : lastSavedAt
      ? `Saved ${timeSince(lastSavedAt)}`
      : savedId
        ? "Saved"
        : null

  return (
    <div className="rounded-2xl bg-card border border-border flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-border/50 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-foreground">Quote</h2>
            {quoteNumber && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono font-semibold text-foreground bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                  Q-{quoteNumber}
                </span>
                {currentRevision > 0 && (
                  <button 
                    onClick={() => {
                      if (savedId) {
                        fetchRevisions()
                        setShowRevisionDialog(true)
                      }
                    }}
                    className={cn(
                      "text-[11px] font-mono font-semibold px-2 py-0.5 rounded border transition-colors",
                      revisions.length > 1 
                        ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                        : "bg-secondary/60 text-muted-foreground border-border/50 hover:bg-secondary"
                    )}
                    title="View version history"
                  >
                    Rev {currentRevision}
                  </button>
                )}
              </div>
            )}
            {saveText && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                {isSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Cloud className="h-3 w-3 text-emerald-500" />
                )}
                {saveText}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            {hasItems && (
              <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/60 p-1">
                <button
                  onClick={() => setViewMode("simple")}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors",
                    viewMode === "simple"
                      ? "bg-background shadow-sm text-foreground border border-border"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  )}
                  title="Simple view"
                >
                  <List className="h-3 w-3" />
                  Simple
                </button>
                <button
                  onClick={() => setViewMode("full")}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors",
                    viewMode === "full"
                      ? "bg-background shadow-sm text-foreground border border-border"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  )}
                  title="Full view"
                >
                  <LayoutGrid className="h-3 w-3" />
                  Full
                </button>
              </div>
            )}
            {hasItems && !confirmClear && (
              <button
                onClick={() => setConfirmClear(true)}
                className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
              >
                Clear
              </button>
            )}
            {confirmClear && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { clearAll(); setConfirmClear(false) }}
                  className="text-[11px] font-semibold text-destructive hover:underline"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="text-[11px] text-muted-foreground hover:underline"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Revision History Dialog */}
      <RevisionHistoryDialog open={showRevisionDialog} onOpenChange={setShowRevisionDialog} />

      {/* Search bar - only in simple view */}
      {hasItems && viewMode === "simple" && (
        <div className="px-3 pb-2 pt-1 border-b border-border/30">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-8 text-xs rounded-lg bg-secondary/50 border-0 placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Items ── */}
      <div
        className="flex-1 min-h-0 overflow-y-auto px-3 py-3"
        style={{ overscrollBehavior: "contain" }}
      >
        {!hasItems ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 py-6 px-4 text-center justify-center">
              <FileText className="h-5 w-5 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No items yet</p>
            </div>
            {/* Show skipped steps even when no items */}
            {pendingSteps?.filter((s) => s.status === "skipped").map((s) => (
              <button
                key={`skip-${s.id}`}
                onClick={() => onGoToStep?.(s.id)}
                className="flex items-center justify-between px-3 py-2 rounded-lg border border-dashed border-amber-300 dark:border-amber-700/50 bg-amber-50/40 dark:bg-amber-950/10 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <SkipForward className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    {s.label}
                  </span>
                </div>
                <span className="text-[11px] text-amber-500">Unfinished</span>
              </button>
            ))}
          </div>
        ) : viewMode === "simple" ? (
          /* ═══════════ SIMPLE VIEW ═══════════ */
          <div className="flex flex-col">
            {/* Simple table header */}
            <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide border-b border-border/30 mb-1">
              <span className="w-16">Type</span>
              <span className="flex-1">Item</span>
              <span className="w-20 text-right">Amount</span>
            </div>
            {/* Simple rows */}
            {filteredItems.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No items match your search
              </div>
            ) : (
              filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setViewMode("full")}
                  className="group flex items-center gap-2 px-2 py-2 hover:bg-secondary/40 rounded-lg transition-colors text-left"
                >
                  <span className={cn(
                    "w-16 shrink-0 text-[10px] font-bold uppercase tracking-wide",
                    getCategoryColor(item.category).replace('px-2.5 py-1 rounded-lg', '').trim()
                  )}>
                    {getCategoryLabel(item.category).slice(0, 7)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {item.label}
                    </p>
                    {item.description && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <span className="w-20 text-right text-xs font-mono font-bold text-foreground tabular-nums shrink-0">
                    {formatCurrency(item.amount)}
                  </span>
                </button>
              ))
            )}
            {/* Category totals summary in simple view */}
            <div className="mt-3 pt-3 border-t border-border/30 space-y-1">
              {CATEGORIES.map((cat) => {
                const catTotal = getCategoryTotal(cat)
                if (catTotal === 0) return null
                return (
                  <div key={cat} className="flex items-center justify-between px-2 py-1">
                    <span className={cn(
                      "text-[10px] font-bold uppercase",
                      getCategoryColor(cat).replace('px-2.5 py-1 rounded-lg', '').trim()
                    )}>
                      {getCategoryLabel(cat)}
                    </span>
                    <span className="text-xs font-mono font-semibold text-muted-foreground tabular-nums">
                      {formatCurrency(catTotal)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          /* ═══════════ FULL VIEW ═══════════ */
          <div className="flex flex-col gap-2">
            {CATEGORIES.map((cat) => {
              const catItems = items.filter((i) => i.category === cat)
              if (catItems.length === 0) return null
              const catTotal = getCategoryTotal(cat)
              const collapsed = collapsedCats.has(cat)

              return (
                <div key={cat}>
                  {/* Category header */}
                  <button
                    onClick={() => toggleCat(cat)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary/70 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {collapsed ? (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className={`text-xs font-bold ${getCategoryColor(cat).replace('px-2.5 py-1 rounded-lg', '').trim()}`}>
                        {getCategoryLabel(cat)}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {catItems.length}
                      </span>
                      {catItems.some((i) => i.metadata?.isEstimated) && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 uppercase">Est</span>
                      )}
                    </div>
                    <span className="text-sm font-mono font-bold text-foreground tabular-nums">
                      {formatCurrency(catTotal)}
                    </span>
                  </button>

                  {/* Items list */}
                  {!collapsed && (
                    <div className="flex flex-col">
                      {catItems.map((item) => (
                        <QuoteItemRow
                          key={item.id}
                          item={item}
                          onUpdate={updateItem}
                          onRemove={removeItem}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Skipped / unfinished step sections */}
            {pendingSteps?.filter((s) => s.status === "skipped").map((s) => (
              <button
                key={`skip-${s.id}`}
                onClick={() => onGoToStep?.(s.id)}
                className="flex items-center justify-between px-3 py-2 rounded-lg border border-dashed border-amber-300 dark:border-amber-700/50 bg-amber-50/40 dark:bg-amber-950/10 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <SkipForward className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    {s.label}
                  </span>
                </div>
                <span className="text-[11px] text-amber-500">Unfinished</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Weight Estimate ── */}
      {hasItems && <WeightEstimatePanel items={items} quantity={quantity} />}

      {/* ── Shipping Estimate ── */}
      {hasItems && <ShippingEstimatePanel items={items} quantity={quantity} />}

      {/* ── Footer with total ── */}
      {hasItems && (
        <div className="shrink-0 border-t border-border/50 px-4 py-4">
          {/* Total */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-foreground">Total</span>
            <span className="text-xl font-bold font-mono text-foreground tabular-nums">
              {formatCurrency(total)}
            </span>
          </div>

          {/* Activity Log */}
          {activityLog.length > 0 && (
            <div className="mb-3">
              <button
                onClick={() => setShowLog(!showLog)}
                className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors mb-1.5"
              >
                <Clock className="h-3 w-3" />
                Activity ({activityLog.length})
                {showLog ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
              {showLog && (
                <div className="flex flex-col gap-1.5 max-h-28 overflow-y-auto rounded-lg bg-secondary/40 p-2">
                  {activityLog.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-muted-foreground/40 mt-1.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-foreground leading-tight">
                          {formatEvent(entry.event)}
                        </p>
                        <p className="text-[10px] text-muted-foreground tabular-nums">
                          {formatLogDate(entry.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {onGoToExport && items.length > 0 && (
              <Button
                size="sm"
                className="w-full gap-1.5 text-xs h-9 rounded-lg font-bold bg-foreground text-background hover:bg-foreground/90"
                onClick={handleFinishAndSend}
                disabled={sending}
              >
                {sending ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</>
                ) : (
                  <><Send className="h-3.5 w-3.5" /> Finish &amp; Send to Export</>
                )}
              </Button>
            )}
            <div className="flex gap-1.5">
              <Button
                variant={copied ? "default" : "secondary"}
                size="sm"
                className="flex-1 gap-1.5 text-xs h-8 rounded-lg font-semibold"
                onClick={handleCopy}
              >
                {copied ? (
                  <><Check className="h-3.5 w-3.5" /> Copied</>
                ) : (
                  <><ClipboardCopy className="h-3.5 w-3.5" /> Email</>
                )}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5 text-xs h-8 rounded-lg font-semibold"
                onClick={handleDownloadPDF}
                title="Download PDF quote"
              >
                <Download className="h-3.5 w-3.5" /> PDF
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5 text-xs h-8 rounded-lg font-semibold"
                onClick={newQuote}
              >
                <FilePlus className="h-3.5 w-3.5" /> New
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatEvent(event: string): string {
  switch (event) {
    case "created": return "Quote created"
    case "item_added": return "Item added"
    case "item_removed": return "Item removed"
    case "sent": return "Quote sent"
    case "copied": return "Quote copied"
    case "status_changed": return "Status changed"
    default: return event.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  }
}

function formatLogDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return "Just now"
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

function timeSince(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 10) return "just now"
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

/* ── Weight Estimate Panel ─────────────────────────────── */
import { Scale, Package, AlertTriangle, Box as BoxIcon, Printer } from "lucide-react"

function WeightEstimatePanel({ items, quantity }: { items: QuoteLineItem[]; quantity: number }) {
  const [expanded, setExpanded] = useState(false)

  // Extract printed pieces from metadata
  const pieces: Array<{
    paperName: string
    widthIn: number
    heightIn: number
    sheetsPerPiece: number
    label: string
  }> = []

  // Find envelope
  let envelopeType: string | undefined

  for (const item of items) {
    const m = item.metadata
    if (!m) continue

    // Envelope items
    if (m.envelopeSize && typeof m.envelopeSize === "string") {
      envelopeType = m.envelopeSize
    }

    // Printed pieces with paper + dimensions
    if (m.paperName && m.pieceDimensions) {
      const dimStr = String(m.pieceDimensions)
      const parts = dimStr.split("x").map((s: string) => parseFloat(s.trim()))
      if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
        const sheets = m.pageCount ? Math.ceil(Number(m.pageCount) / 2) : 1
        pieces.push({
          paperName: String(m.paperName),
          widthIn: parts[0],
          heightIn: parts[1],
          sheetsPerPiece: sheets,
          label: item.label,
        })
      }
    }
  }

  if (pieces.length === 0) return null

  const result = calcMailPieceWeightOz({
    pieces,
    envelopeType,
  })

  if (!result) return null

  const { totalOz, breakdown } = result

  // Postage weight class (USPS ounce tiers)
  const ozTier = totalOz <= 1 ? "1 oz" : totalOz <= 2 ? "2 oz" : totalOz <= 3 ? "3 oz" : `${Math.ceil(totalOz)} oz`

  return (
    <div className="shrink-0 border-t border-border/40 px-5 py-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center gap-2">
          <Scale className="h-3.5 w-3.5 text-muted-foreground/60" />
          <span className="text-[11px] font-semibold text-foreground/70">Weight Estimate</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-mono font-semibold text-foreground/80 tabular-nums">
            {formatWeight(totalOz)}
          </span>
          <span className="text-[10px] font-medium text-muted-foreground/50 bg-secondary/60 px-1.5 py-0.5 rounded">
            {ozTier}
          </span>
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground/40" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="mt-2.5 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
          {breakdown.map((row, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground/60 font-medium truncate leading-tight">
                {row.label}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground/70 tabular-nums shrink-0">
                {row.oz.toFixed(2)} oz
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-dashed border-border/30">
            <span className="text-[10px] font-semibold text-foreground/70">Per piece</span>
            <span className="text-[11px] font-mono font-semibold text-foreground/80 tabular-nums">
              {formatWeight(totalOz)}
            </span>
          </div>
          {quantity > 0 && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium text-muted-foreground/60">
                Total ({quantity.toLocaleString()} pcs)
              </span>
              <span className="text-[10px] font-mono text-muted-foreground/70 tabular-nums">
                {formatWeight(totalOz * quantity)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Shipping Estimate Panel ─────────────────────────────── */

function ShippingEstimatePanel({ items, quantity }: { items: QuoteLineItem[]; quantity: number }) {
  const [expanded, setExpanded] = useState(false)
  const [overrideBox, setOverrideBox] = useState<string | null>(null)
  const [upsOnly, setUpsOnly] = useState(false)
  const [showLabels, setShowLabels] = useState(false)
  const [manualW, setManualW] = useState("")
  const [manualH, setManualH] = useState("")

  if (quantity <= 0 || items.length === 0) return null

  // Extract piece dimensions and weight info from items
  const pieces: Array<{
    paperName: string
    widthIn: number
    heightIn: number
    sheetsPerPiece: number
    label: string
  }> = []

  let maxPieceW = 0
  let maxPieceH = 0

  for (const item of items) {
    const m = item.metadata
    if (!m) continue

    // Try to get dimensions from pieceDimensions
    if (m.pieceDimensions) {
      const dimStr = String(m.pieceDimensions)
      const parts = dimStr.split("x").map((s: string) => parseFloat(s.trim()))
      if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
        const sheets = m.pageCount ? Math.ceil(Number(m.pageCount) / 2) : 1
        pieces.push({
          paperName: m.paperName ? String(m.paperName) : "Unknown",
          widthIn: parts[0],
          heightIn: parts[1],
          sheetsPerPiece: sheets,
          label: item.label,
        })
        maxPieceW = Math.max(maxPieceW, parts[0])
        maxPieceH = Math.max(maxPieceH, parts[1])
      }
    }
  }

  // Allow manual dimension override when no dimensions detected
  const useManualDims = pieces.length === 0 && manualW && manualH
  const effectiveW = useManualDims ? parseFloat(manualW) : maxPieceW
  const effectiveH = useManualDims ? parseFloat(manualH) : maxPieceH

  // Calculate total weight (may return null if paper not found - that's OK)
  const weightResult = pieces.length > 0 ? calcMailPieceWeightOz({ pieces }) : null
  const perPieceOz = weightResult?.totalOz ?? 0
  const totalWeightOz = perPieceOz * quantity
  const hasWeight = weightResult !== null

  // Estimate thickness per piece
  const avgSheetsPerPiece = pieces.length > 0
    ? pieces.reduce((s, p) => s + p.sheetsPerPiece, 0) / pieces.length
    : 1
  const thicknessPerPiece = avgSheetsPerPiece * 0.005

  // Get box recommendation (only if we have dimensions)
  let estimate: ShippingEstimate | null = null

  if (effectiveW > 0 && effectiveH > 0) {
    if (overrideBox) {
      const box = BOX_SIZES.find((b) => b.name === overrideBox)
      if (box) {
        const maxPerBox = Math.floor(box.heightIn / thicknessPerPiece)
        const boxCount = maxPerBox > 0 ? Math.ceil(quantity / maxPerBox) : 1
        const piecesPerBox = maxPerBox > 0 ? Math.min(quantity, maxPerBox) : quantity
        const weightPerBox = (perPieceOz * piecesPerBox) + box.boxWeightOz
        estimate = {
          recommendations: [{
            box,
            count: boxCount,
            piecesPerBox,
            weightPerBoxOz: weightPerBox,
            fillPercent: Math.min(((piecesPerBox * thicknessPerPiece) / box.heightIn) * 100, 100),
          }],
          totalBoxes: boxCount,
          totalShippingWeightOz: weightPerBox * boxCount,
          totalShippingWeightLbs: (weightPerBox * boxCount) / 16,
          hasNonUPSBoxes: !box.upsEligible,
        }
      }
    } else {
      estimate = selectBestBoxes({
        pieceWidthIn: effectiveW,
        pieceHeightIn: effectiveH,
        thicknessPerPieceIn: thicknessPerPiece,
        quantity,
        totalWeightOz,
        upsOnly,
      })
    }
  }

  return (
    <div className="shrink-0 border-t border-border/40 px-5 py-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center gap-2">
          <Package className="h-3.5 w-3.5 text-muted-foreground/60" />
          <span className="text-[11px] font-semibold text-foreground/70">Shipping</span>
        </div>
        <div className="flex items-center gap-2">
          {estimate ? (
            <>
              <span className="text-[12px] font-mono font-semibold text-foreground/80 tabular-nums">
                {estimate.totalBoxes} box{estimate.totalBoxes !== 1 ? "es" : ""}
              </span>
              {hasWeight && (
                <span className="text-[10px] font-medium text-muted-foreground/50 bg-secondary/60 px-1.5 py-0.5 rounded">
                  {formatShippingWeight(estimate.totalShippingWeightOz)}
                </span>
              )}
            </>
          ) : (
            <span className="text-[10px] text-muted-foreground/50">
              {effectiveW > 0 ? "No fit" : "Set dims"}
            </span>
          )}
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground/40" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="mt-2.5 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Order summary */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground/60 font-medium">Pieces</span>
              <span className="text-[10px] font-mono text-muted-foreground/70 tabular-nums">
                {quantity.toLocaleString()}
              </span>
            </div>
            {effectiveW > 0 && effectiveH > 0 && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground/60 font-medium">Piece size</span>
                <span className="text-[10px] font-mono text-muted-foreground/70 tabular-nums">
                  {effectiveW}&quot; x {effectiveH}&quot;
                </span>
              </div>
            )}
            {hasWeight && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground/60 font-medium">Total piece weight</span>
                <span className="text-[10px] font-mono text-muted-foreground/70 tabular-nums">
                  {formatShippingWeight(totalWeightOz)}
                </span>
              </div>
            )}
          </div>

          {/* Manual dimensions if not auto-detected */}
          {pieces.length === 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-medium text-muted-foreground/60">Piece dimensions (inches)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.125"
                  placeholder="W"
                  value={manualW}
                  onChange={(e) => setManualW(e.target.value)}
                  className="flex-1 h-7 text-[10px] rounded-md border border-border/50 bg-background px-2 text-foreground font-mono tabular-nums"
                />
                <span className="text-[10px] text-muted-foreground/50">x</span>
                <input
                  type="number"
                  step="0.125"
                  placeholder="H"
                  value={manualH}
                  onChange={(e) => setManualH(e.target.value)}
                  className="flex-1 h-7 text-[10px] rounded-md border border-border/50 bg-background px-2 text-foreground font-mono tabular-nums"
                />
              </div>
            </div>
          )}

          {/* UPS filter */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={upsOnly}
              onChange={(e) => { setUpsOnly(e.target.checked); setOverrideBox(null) }}
              className="h-3 w-3 rounded border-border accent-foreground"
            />
            <span className="text-[10px] font-medium text-muted-foreground/70">UPS-safe boxes only</span>
          </label>

          {/* Box recommendations */}
          {estimate ? (
            <div className="space-y-2">
              {estimate.recommendations.map((rec, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border/50 bg-secondary/20 p-2.5"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <BoxIcon className="h-3.5 w-3.5 text-foreground/60" />
                      <span className="text-[11px] font-bold text-foreground">
                        {rec.box.name}
                      </span>
                      {rec.count > 1 && (
                        <span className="text-[10px] font-semibold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                          x{rec.count}
                        </span>
                      )}
                    </div>
                    {!rec.box.upsEligible && (
                      <span className="flex items-center gap-1 text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded uppercase">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Not UPS
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-muted-foreground/60">Dimensions</span>
                      <span className="text-[9px] font-mono text-muted-foreground/70">
                        {rec.box.lengthIn}&quot; x {rec.box.widthIn}&quot; x {rec.box.heightIn}&quot;
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-muted-foreground/60">Pieces/box</span>
                      <span className="text-[9px] font-mono text-muted-foreground/70">
                        {rec.piecesPerBox.toLocaleString()}
                      </span>
                    </div>
                    {hasWeight && (
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-muted-foreground/60">Weight/box</span>
                        <span className="text-[9px] font-mono text-muted-foreground/70">
                          {formatShippingWeight(rec.weightPerBoxOz)}
                        </span>
                      </div>
                    )}
                    {/* Fill bar */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            rec.fillPercent > 90 ? "bg-amber-500" : "bg-foreground/40"
                          )}
                          style={{ width: `${Math.min(rec.fillPercent, 100)}%` }}
                        />
                      </div>
                      <span className="text-[8px] font-mono text-muted-foreground/50 tabular-nums w-7 text-right">
                        {Math.round(rec.fillPercent)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Totals */}
              <div className="pt-1.5 border-t border-dashed border-border/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-foreground/70">Total boxes</span>
                  <span className="text-[11px] font-mono font-semibold text-foreground/80 tabular-nums">
                    {estimate.totalBoxes}
                  </span>
                </div>
                {hasWeight && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-foreground/70">Shipping weight</span>
                    <span className="text-[11px] font-mono font-semibold text-foreground/80 tabular-nums">
                      {formatShippingWeight(estimate.totalShippingWeightOz)}
                    </span>
                  </div>
                )}
              </div>

              {estimate.hasNonUPSBoxes && (
                <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 p-2">
                  <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                  <span className="text-[9px] text-amber-700 dark:text-amber-400 leading-tight">
                    Selected box(es) are not strong enough for UPS shipping. Consider upgrading or switching to a UPS-safe box.
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border/50 p-3 text-center">
              <span className="text-[10px] text-muted-foreground/50">
                {effectiveW > 0 && effectiveH > 0
                  ? `No box fits the piece dimensions (${effectiveW}" x ${effectiveH}")`
                  : "Enter piece dimensions above to calculate box recommendations"
                }
              </span>
            </div>
          )}

          {/* Manual override */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground/60 mb-1 block">
              Override box
            </label>
            <select
              value={overrideBox || ""}
              onChange={(e) => setOverrideBox(e.target.value || null)}
              className="w-full h-7 text-[10px] rounded-md border border-border/50 bg-background px-2 text-foreground"
            >
              <option value="">Auto-select</option>
              {BOX_SIZES.filter((b) => !upsOnly || b.upsEligible).map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name} ({b.lengthIn}&quot;x{b.widthIn}&quot;x{b.heightIn}&quot;)
                  {!b.upsEligible ? " - NOT UPS" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Print labels button */}
          {estimate && (
            <Button
              onClick={() => setShowLabels(true)}
              variant="outline"
              size="sm"
              className="w-full gap-1.5 h-8 text-[10px] font-semibold"
            >
              <Printer className="h-3 w-3" />
              Print Shipping Labels ({estimate.totalBoxes})
            </Button>
          )}
        </div>
      )}

      {/* Shipping label print modal */}
      {estimate && (
        <ShippingLabelModal
          open={showLabels}
          onClose={() => setShowLabels(false)}
          estimate={estimate}
        />
      )}
    </div>
  )
}
