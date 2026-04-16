"use client"

/**
 * QuoteFormLayout
 *
 * QuickBooks-style view:
 *  - LEFT:  the step's tool / calculator (main work area)
 *  - RIGHT: the quote document (live summary of line items)
 *
 * No page-level scrolling. Each column scrolls independently only when
 * its own content overflows. Line items are rendered as simple neat
 * item rows - like an invoice line list.
 */

import type { ReactNode } from "react"
import { useQuote } from "@/lib/quote-context"
import { formatCurrency } from "@/lib/pricing"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  FileText, Check, Loader2, Save, AlertCircle, Trash2, Clock, Hash,
} from "lucide-react"

type QuoteCategory =
  | "printing" | "booklet" | "spiral" | "perfect" | "pad"
  | "envelope" | "usps" | "labor" | "item" | "shipping"

const CATEGORY_LABELS: Record<QuoteCategory, string> = {
  printing: "Printing",
  booklet: "Booklets",
  spiral: "Spiral",
  perfect: "Perfect Bound",
  pad: "Pads",
  envelope: "Envelopes",
  usps: "Postage",
  labor: "Services",
  item: "Items",
  shipping: "Shipping",
}

const CATEGORY_ORDER: QuoteCategory[] = [
  "printing", "booklet", "spiral", "perfect", "pad", "envelope",
  "usps", "labor", "item", "shipping",
]

const STEP_CATEGORY_HINTS: Record<string, QuoteCategory[]> = {
  envelope: ["envelope"],
  usps: ["usps"],
  labor: ["labor", "item"],
  printing: ["printing"],
  booklet: ["booklet"],
  spiral: ["spiral"],
  perfect: ["perfect"],
  pad: ["pad"],
  ohp: ["printing", "booklet", "spiral", "perfect", "pad"],
}

export interface QuoteFormLayoutProps {
  children: ReactNode
  stepTitle: string
  stepDescription?: string
  stepIcon?: ReactNode
  stepId?: string
  onExit: () => void
}

export function QuoteFormLayout({
  children, stepTitle, stepDescription, stepIcon, stepId,
}: QuoteFormLayoutProps) {
  const {
    items,
    projectName,
    contactName,
    referenceNumber,
    quoteNumber,
    currentRevision,
    revisions,
    isSaving,
    lastSavedAt,
    hasUnsavedChanges,
    saveQuote,
    getTotal,
    removeItem,
    setProjectName,
    setContactName,
    setReferenceNumber,
  } = useQuote()

  const total = getTotal()
  const itemCount = items.length
  const activeCategories = stepId ? STEP_CATEGORY_HINTS[stepId] || [] : []

  const lastSavedLabel = (() => {
    if (!lastSavedAt) return "Not saved yet"
    const seconds = Math.floor((Date.now() - lastSavedAt) / 1000)
    if (seconds < 10) return "just now"
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return new Date(lastSavedAt).toLocaleDateString()
  })()

  return (
    // Full-height, no page scroll. Each column scrolls only its own content.
    <div className="flex h-full overflow-hidden bg-muted/20">
      {/* ═══════════ LEFT: STEP TOOL (main work area) ═══════════ */}
      <section className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Tool header */}
        <header className="shrink-0 flex items-center gap-3 px-6 py-3 border-b border-border bg-card">
          {stepIcon && (
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              {stepIcon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground truncate">{stepTitle}</p>
            {stepDescription && (
              <p className="text-[11px] text-muted-foreground truncate">{stepDescription}</p>
            )}
          </div>
        </header>
        {/* Tool content - only this area scrolls if its content overflows */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-6">
            {children}
          </div>
        </div>
      </section>

      {/* ═══════════ RIGHT: QUOTE DOCUMENT ═══════════ */}
      <aside className="hidden lg:flex flex-col w-[400px] xl:w-[440px] shrink-0 border-l border-border bg-card overflow-hidden">
        {/* Document header - fixed, compact */}
        <div className="shrink-0 px-5 py-4 border-b border-border">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">Quote</h2>
              <p className="text-[11px] text-muted-foreground">
                {itemCount} {itemCount === 1 ? "line item" : "line items"}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {quoteNumber && (
                <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-foreground">
                  <Hash className="h-3 w-3 text-muted-foreground" />
                  Q-{quoteNumber}
                </div>
              )}
              {currentRevision > 0 && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <Clock className="h-2.5 w-2.5 text-amber-600" />
                  <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                    Rev {currentRevision}
                    {revisions.length > 1 && ` · ${revisions.length}`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Project / customer - compact 2-col grid */}
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Project name"
              className="h-8 text-xs font-semibold col-span-2"
            />
            <Input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Customer"
              className="h-8 text-xs"
            />
            <Input
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Reference #"
              className="h-8 text-xs font-mono"
            />
          </div>
        </div>

        {/* Save status strip */}
        <div className="shrink-0 px-5 py-2 border-b border-border/60 bg-muted/40">
          {hasUnsavedChanges ? (
            <div className="flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3 text-amber-600 shrink-0" />
              <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">Unsaved changes</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Check className="h-3 w-3 text-green-600 shrink-0" />
              <span className="text-[11px] text-muted-foreground">Saved {lastSavedLabel}</span>
            </div>
          )}
        </div>

        {/* Line items table header */}
        <div className="shrink-0 px-5 py-2 border-b border-border bg-muted/30 grid grid-cols-[1fr_auto] items-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <span>Item</span>
          <span className="text-right">Amount</span>
        </div>

        {/* Line items list - ONLY this scrolls if too many items */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {itemCount === 0 ? (
            <div className="p-8 text-center">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-3">
                <FileText className="h-4 w-4 text-muted-foreground/50" />
              </div>
              <p className="text-xs font-medium text-foreground mb-0.5">No items yet</p>
              <p className="text-[11px] text-muted-foreground">
                Add items from <span className="font-semibold text-foreground">{stepTitle}</span>
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {CATEGORY_ORDER.flatMap((cat) => {
                const catItems = items.filter((i) => i.category === cat)
                if (catItems.length === 0) return []
                return catItems.map((item) => {
                  const isActive = activeCategories.includes(cat)
                  return (
                    <li
                      key={item.id}
                      className={cn(
                        "group flex items-center gap-3 px-5 py-2.5 hover:bg-secondary/40 transition-colors",
                        isActive && "bg-blue-50/50 dark:bg-blue-950/10"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0",
                              isActive
                                ? "bg-blue-600 text-white"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {CATEGORY_LABELS[cat]}
                          </span>
                          <p className="text-xs font-semibold text-foreground truncate">
                            {item.label}
                          </p>
                        </div>
                        {item.description && (
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5 pl-0">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <span className="text-xs font-mono font-bold tabular-nums text-foreground shrink-0">
                        {formatCurrency(item.amount)}
                      </span>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="w-6 h-6 rounded text-muted-foreground/30 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center shrink-0"
                        title="Remove"
                        aria-label={`Remove ${item.label}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </li>
                  )
                })
              })}
            </ul>
          )}
        </div>

        {/* Total + Save - fixed footer, always visible */}
        <div className="shrink-0 border-t-2 border-foreground/10 bg-card">
          {itemCount > 0 && (
            <div className="px-5 py-3 flex items-center justify-between border-b border-border/60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total</span>
              <span className="text-xl font-bold font-mono tabular-nums text-foreground">
                {formatCurrency(total)}
              </span>
            </div>
          )}
          {hasUnsavedChanges && itemCount > 0 ? (
            <div className="p-3">
              <Button
                onClick={saveQuote}
                disabled={isSaving}
                className="w-full gap-2 h-10 rounded-lg font-bold bg-green-600 hover:bg-green-700 text-white shadow-sm"
              >
                {isSaving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="h-4 w-4" /> Save Quote</>
                )}
              </Button>
            </div>
          ) : itemCount === 0 ? null : (
            <div className="p-3">
              <div className="w-full h-10 rounded-lg border border-dashed border-border flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                <Check className="h-3 w-3 text-green-600" /> All changes saved
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
