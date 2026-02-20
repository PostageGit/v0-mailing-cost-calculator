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
  AlertCircle, SkipForward, CheckCircle2,
} from "lucide-react"
import { useState, useCallback, useRef, useEffect } from "react"
import { formatCurrency } from "@/lib/pricing"
import { cn } from "@/lib/utils"
import { buildQuoteText } from "@/lib/build-quote-text"

const CATEGORIES: QuoteCategory[] = ["flat", "booklet", "spiral", "perfect", "pad", "envelope", "postage", "listwork", "item", "ohp"]

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
    <div className="group flex items-start gap-3 py-2.5 px-3 rounded-xl hover:bg-secondary/30 transition-colors">
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground/90 leading-snug">
          {item.label}
        </p>
        {item.metadata?.customerProvided && (
          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-[9px] font-bold text-amber-700 dark:text-amber-400 tracking-wide uppercase">
            Customer Provides
            {item.metadata.providerExpectedDate && (
              <span className="font-normal normal-case ml-0.5">
                {" "}&middot; {new Date(item.metadata.providerExpectedDate as string).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </span>
        )}
        {item.description && (
          <p className="text-[11px] text-muted-foreground/60 leading-relaxed mt-0.5 line-clamp-2 font-normal">
            {item.description}
          </p>
        )}
      </div>

      {/* Amount + hover actions */}
      <div className="flex items-center gap-1 shrink-0 pt-0.5">
        <span className="text-[13px] font-mono font-semibold text-foreground/80 tabular-nums">
          {formatCurrency(item.amount)}
        </span>
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity ml-0.5">
          <button
            onClick={() => setEditing(true)}
            className="p-1 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-secondary transition-colors"
            aria-label={`Edit ${item.label}`}
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={() => onRemove(item.id)}
            className="p-1 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
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
  } = useQuote()

  const [collapsedCats, setCollapsedCats] = useState<Set<QuoteCategory>>(new Set())
  const [confirmClear, setConfirmClear] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [sending, setSending] = useState(false)

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
    const text = buildQuoteText(items, projectName || undefined)
    try {
      await navigator.clipboard.writeText(text)
    } catch { /* fallback */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [items, projectName])

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
      <div className="px-5 pt-5 pb-4 border-b border-border/40 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2.5">
            <h2 className="text-[15px] font-semibold text-foreground tracking-tight">Quote</h2>
            {quoteNumber && (
              <span className="text-[11px] font-mono font-medium text-muted-foreground/70 bg-secondary/60 px-2 py-0.5 rounded-md">
                Q-{quoteNumber}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {saveText && (
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70 font-normal">
                {isSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Cloud className="h-3 w-3 text-emerald-500/70" />
                )}
                {saveText}
              </span>
            )}
            {hasItems && !confirmClear && (
              <button
                onClick={() => setConfirmClear(true)}
                className="text-[11px] text-muted-foreground/60 hover:text-destructive transition-colors font-medium"
              >
                Clear
              </button>
            )}
            {confirmClear && (
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => { clearAll(); setConfirmClear(false) }}
                  className="text-[11px] font-semibold text-destructive hover:underline"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="text-[11px] text-muted-foreground/60 hover:underline"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Pending Steps Banner ── */}
      {pendingSteps && pendingSteps.length > 0 && (
        <div className="shrink-0 mx-4 mt-3 mb-0 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-950/20 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              {pendingSteps.length} step{pendingSteps.length !== 1 ? "s" : ""} remaining
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {pendingSteps.map((s) => (
              <button
                key={s.id}
                onClick={() => onGoToStep?.(s.id)}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors",
                  s.status === "skipped"
                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-dashed border-amber-300 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-900/50"
                    : "bg-white dark:bg-secondary text-muted-foreground border border-border hover:bg-secondary dark:hover:bg-secondary/80"
                )}
              >
                {s.status === "skipped" ? <SkipForward className="h-2.5 w-2.5" /> : null}
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {pendingSteps && pendingSteps.length === 0 && hasItems && (
        <div className="shrink-0 mx-4 mt-3 mb-0 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 px-3 py-2 flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">All steps complete</span>
        </div>
      )}

      {/* ── Items ── */}
      <div
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4"
        style={{ overscrollBehavior: "contain" }}
      >
        {!hasItems ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-2xl bg-secondary/40 p-5 mb-4">
              <FileText className="h-7 w-7 text-muted-foreground/25" />
            </div>
            <p className="text-sm font-semibold text-foreground/80 mb-1">No items yet</p>
            <p className="text-[13px] text-muted-foreground/60 max-w-[220px] leading-relaxed">
              Add items from any calculator to start building your quote.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
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
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {collapsed ? (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                      )}
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${getCategoryColor(cat)}`}>
                        {getCategoryLabel(cat)}
                      </span>
                      <span className="text-[11px] text-muted-foreground/50 tabular-nums font-normal">
                        {catItems.length}
                      </span>
                    </div>
                    <span className="text-[13px] font-mono font-semibold text-foreground/80 tabular-nums">
                      {formatCurrency(catTotal)}
                    </span>
                  </button>

                  {/* Items list */}
                  {!collapsed && (
                    <div className="flex flex-col mt-1">
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
          </div>
        )}
      </div>

      {/* ── Footer with total ── */}
      {hasItems && (
        <div className="shrink-0 border-t border-border/40 px-5 py-4">
          {/* Total */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-[13px] font-semibold text-foreground/70">Total</span>
            <span className="text-xl font-bold font-mono text-foreground tabular-nums tracking-tight">
              {formatCurrency(total)}
            </span>
          </div>

          {/* Activity Log */}
          {activityLog.length > 0 && (
            <div className="mb-3.5">
              <button
                onClick={() => setShowLog(!showLog)}
                className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/60 hover:text-foreground transition-colors mb-2"
              >
                <Clock className="h-3 w-3" />
                Activity ({activityLog.length})
                {showLog ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
              </button>
              {showLog && (
                <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto rounded-lg bg-secondary/20 p-2.5">
                  {activityLog.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-2">
                      <div className="w-1 h-1 rounded-full bg-muted-foreground/25 mt-1.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-foreground/80 font-medium leading-snug">
                          {formatEvent(entry.event)}
                        </p>
                        {entry.detail && (
                          <p className="text-[10px] text-muted-foreground/50 truncate font-normal">{entry.detail}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground/40 tabular-nums font-normal">
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
                className="w-full gap-1.5 text-[12px] h-10 rounded-lg font-semibold bg-foreground text-background hover:bg-foreground/90"
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
            <div className="flex gap-2">
              <Button
                variant={copied ? "default" : "secondary"}
                size="sm"
                className="flex-1 gap-1.5 text-[12px] h-9 rounded-lg font-semibold"
                onClick={handleCopy}
              >
                {copied ? (
                  <><Check className="h-3.5 w-3.5" /> Copied</>
                ) : (
                  <><ClipboardCopy className="h-3.5 w-3.5" /> Copy</>
                )}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5 text-[12px] h-9 rounded-lg font-semibold"
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
