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
  X, FileText, ChevronDown, ChevronRight, ClipboardCopy, Check,
  FilePlus, Cloud, Loader2, Pencil, Trash2,
} from "lucide-react"
import { useState, useCallback, useRef, useEffect } from "react"
import { formatCurrency } from "@/lib/pricing"
import { buildQuoteText } from "@/lib/build-quote-text"

const CATEGORIES: QuoteCategory[] = ["flat", "booklet", "postage", "listwork", "item", "ohp"]

/* ── Inline-editable item row ─────────────────────────── */
function QuoteItemRow({
  item,
  index,
  count,
  onUpdate,
  onRemove,
}: {
  item: QuoteLineItem
  index: number
  count: number
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
      <div className="rounded-xl bg-background border border-border p-3 flex flex-col gap-2">
        <Input
          ref={labelRef}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="h-8 text-sm font-medium rounded-lg"
          placeholder="Label"
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        <Input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="h-8 text-xs rounded-lg"
          placeholder="Description (optional)"
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">$</span>
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-8 text-sm font-mono font-semibold rounded-lg flex-1"
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 h-7 text-xs rounded-lg" onClick={save}>
            <Check className="h-3 w-3 mr-1" />Save
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs rounded-lg" onClick={cancel}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-start gap-3 py-2.5 px-3 rounded-xl bg-background hover:bg-secondary/40 transition-colors">
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground leading-tight">
          {count > 1 && (
            <span className="inline-flex items-center justify-center h-4 w-4 rounded bg-secondary text-[10px] font-bold text-muted-foreground mr-1.5 align-text-bottom">
              {index + 1}
            </span>
          )}
          {item.label}
        </p>
        {item.description && (
          <p className="text-[11px] text-muted-foreground leading-snug mt-1 line-clamp-2">
            {item.description}
          </p>
        )}
      </div>

      {/* Amount + actions */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[13px] font-mono font-bold text-foreground tabular-nums">
          {formatCurrency(item.amount)}
        </span>
        {/* Edit / delete icons on hover */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
          <button
            onClick={() => setEditing(true)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label={`Edit ${item.label}`}
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={() => onRemove(item.id)}
            className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
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
export function QuoteSidebar() {
  const {
    items, projectName, savedId, isSaving, lastSavedAt,
    removeItem, updateItem, clearAll, getTotal, getCategoryTotal, newQuote,
  } = useQuote()

  const [collapsedCats, setCollapsedCats] = useState<Set<QuoteCategory>>(new Set())
  const [confirmClear, setConfirmClear] = useState(false)
  const [copied, setCopied] = useState(false)

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
      <div className="px-4 py-3 border-b border-border/60 bg-secondary/20 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground tracking-tight">Quote</h2>
          <div className="flex items-center gap-3">
            {saveText && (
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {isSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Cloud className="h-3 w-3 text-green-500" />
                )}
                {saveText}
              </span>
            )}
            {hasItems && !confirmClear && (
              <button
                onClick={() => setConfirmClear(true)}
                className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
              >
                Clear all
              </button>
            )}
            {confirmClear && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { clearAll(); setConfirmClear(false) }}
                  className="text-[11px] font-semibold text-destructive hover:underline"
                >
                  Yes, clear
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

      {/* ── Items ── */}
      <div
        className="flex-1 min-h-0 overflow-y-auto px-3 py-3"
        style={{ overscrollBehavior: "contain" }}
      >
        {!hasItems ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-2xl bg-secondary/60 p-5 mb-4">
              <FileText className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">No items yet</p>
            <p className="text-xs text-muted-foreground max-w-[220px] leading-relaxed">
              Add items from any calculator step to build your quote.
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
                <div key={cat} className="rounded-xl overflow-hidden">
                  {/* Category header */}
                  <button
                    onClick={() => toggleCat(cat)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-secondary/50 hover:bg-secondary/70 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      {collapsed ? (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getCategoryColor(cat)}`}>
                        {getCategoryLabel(cat)}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {catItems.length} item{catItems.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <span className="text-[13px] font-mono font-bold text-foreground tabular-nums">
                      {formatCurrency(catTotal)}
                    </span>
                  </button>

                  {/* Items list */}
                  {!collapsed && (
                    <div className="flex flex-col gap-0.5 mt-1">
                      {catItems.map((item, idx) => (
                        <QuoteItemRow
                          key={item.id}
                          item={item}
                          index={idx}
                          count={catItems.length}
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
        <div className="shrink-0 border-t border-border/60 px-4 py-4 bg-secondary/10">
          {/* Total */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-foreground">Total</span>
            <span className="text-xl font-black font-mono text-foreground tabular-nums tracking-tight">
              {formatCurrency(total)}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant={copied ? "default" : "secondary"}
              size="sm"
              className="flex-1 gap-1.5 text-xs h-9 rounded-xl font-semibold"
              onClick={handleCopy}
            >
              {copied ? (
                <><Check className="h-3.5 w-3.5" />Copied</>
              ) : (
                <><ClipboardCopy className="h-3.5 w-3.5" />Copy</>
              )}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5 text-xs h-9 rounded-xl font-semibold"
              onClick={newQuote}
            >
              <FilePlus className="h-3.5 w-3.5" />New
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
