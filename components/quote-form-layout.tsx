"use client"

/**
 * QuoteFormLayout
 *
 * App-wide QuickBooks-style quote form view. The QUOTE DOCUMENT is the main
 * focus with generous breathing room. The current step's tool lives in a
 * wide, comfortable side panel - not a cramped sidebar.
 *
 * Layout uses fluid proportions so calculators have enough room to breathe:
 *  - Quote document: ~55-60% of viewport (min 520px)
 *  - Step tool panel: ~40-45% (min 560px - enough for form fields)
 *
 * Toggled globally via header; classic views still work when off.
 */

import type { ReactNode } from "react"
import { useQuote } from "@/lib/quote-context"
import { formatCurrency } from "@/lib/pricing"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  FileText, Check, Loader2, Save, AlertCircle, Trash2,
  Calendar, Hash, Clock,
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
  usps: "USPS Postage",
  labor: "Services",
  item: "Items & Supplies",
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
  children, stepTitle, stepDescription, stepIcon, stepId, onExit,
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

  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  })

  return (
    <div className="flex h-full overflow-hidden bg-muted/30">
      {/* ═══════════ LEFT: QUOTE DOCUMENT ═══════════ */}
      {/* Fluid ~55% width with a reasonable minimum so both panes always breathe. */}
      <div className="flex-[1.2] min-w-[520px] overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-6">
          {/* Save status indicator - right-aligned, minimal */}
          {(hasUnsavedChanges || lastSavedAt) && (
            <div className="flex items-center justify-end mb-4">
              {hasUnsavedChanges ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <AlertCircle className="h-3 w-3 text-amber-600" />
                  <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">Unsaved changes</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                  <Check className="h-3 w-3 text-green-600" />
                  <span className="text-[11px] font-medium text-green-700 dark:text-green-300">Saved {lastSavedLabel}</span>
                </div>
              )}
            </div>
          )}

          {/* ═══ Quote Document ═══ */}
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            {/* Document header - generous padding */}
            <div className="px-10 py-8 border-b border-border">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">Quote</h1>
                  <p className="text-sm text-muted-foreground">Postage Plus</p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  {quoteNumber && (
                    <div className="flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-mono font-bold text-foreground">Q-{quoteNumber}</span>
                    </div>
                  )}
                  {currentRevision > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                      <Clock className="h-3 w-3 text-amber-600" />
                      <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                        Revision {currentRevision}
                        {revisions.length > 1 && ` of ${revisions.length}`}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {currentDate}
                  </div>
                </div>
              </div>

              {/* Project details - more spacious grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Project Name
                  </label>
                  <Input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Enter project name"
                    className="h-10 bg-background text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Customer / Contact
                  </label>
                  <Input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Customer name"
                    className="h-10 bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Reference #
                  </label>
                  <Input
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="Optional"
                    className="h-10 bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Items on Quote
                  </label>
                  <div className="h-10 px-3 flex items-center rounded-md border border-border bg-muted/30 text-sm font-semibold text-foreground">
                    {itemCount} {itemCount === 1 ? "line" : "lines"}
                  </div>
                </div>
              </div>
            </div>

            {/* Line items table - generous padding */}
            <div className="px-10 py-8">
              <div className="flex items-center gap-4 px-2 pb-3 border-b-2 border-foreground/10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span className="w-28">Category</span>
                <span className="flex-1">Description</span>
                <span className="w-24 text-right">Qty</span>
                <span className="w-28 text-right">Amount</span>
                <span className="w-8" />
              </div>

              {itemCount === 0 ? (
                <div className="py-20 text-center">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                    <FileText className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">No items on this quote yet</p>
                  <p className="text-xs text-muted-foreground">
                    Use <span className="font-semibold text-foreground">{stepTitle}</span> on the right to add line items
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {CATEGORY_ORDER.map((cat) => {
                    const catItems = items.filter((i) => i.category === cat)
                    if (catItems.length === 0) return null
                    return catItems.map((item) => {
                      const isActive = activeCategories.includes(cat)
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "flex items-center gap-4 px-2 py-4 group hover:bg-secondary/30 transition-colors rounded-md",
                            isActive && "bg-blue-50/40 dark:bg-blue-950/10"
                          )}
                        >
                          <span className={cn(
                            "w-28 shrink-0 text-[10px] font-bold uppercase tracking-wide",
                            isActive ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"
                          )}>
                            {CATEGORY_LABELS[cat]}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {item.label}
                            </p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <span className="w-24 text-right text-xs font-mono tabular-nums text-muted-foreground">
                            {item.metadata?.quantity ? item.metadata.quantity.toLocaleString() : "—"}
                          </span>
                          <span className="w-28 text-right text-sm font-mono font-bold tabular-nums text-foreground">
                            {formatCurrency(item.amount)}
                          </span>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="w-8 h-8 rounded-md text-muted-foreground/30 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center"
                            title="Remove item"
                            aria-label={`Remove ${item.label}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )
                    })
                  })}
                </div>
              )}

              {/* Total */}
              {itemCount > 0 && (
                <div className="mt-6 pt-5 border-t-2 border-foreground/10">
                  <div className="flex items-center justify-end">
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Quote Total
                      </div>
                      <div className="text-4xl font-bold font-mono tabular-nums text-foreground">
                        {formatCurrency(total)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Save action footer */}
            {hasUnsavedChanges && itemCount > 0 && (
              <div className="px-10 py-5 border-t border-border bg-amber-50/40 dark:bg-amber-950/10">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">You have unsaved changes</p>
                      <p className="text-xs text-muted-foreground">Save to create a new revision of this quote</p>
                    </div>
                  </div>
                  <Button
                    onClick={saveQuote}
                    disabled={isSaving}
                    className="gap-2 h-10 px-5 rounded-lg font-bold bg-green-600 hover:bg-green-700 text-white shadow-sm shrink-0"
                  >
                    {isSaving ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                    ) : (
                      <><Save className="h-4 w-4" /> Save Quote</>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════ RIGHT: STEP TOOL ═══════════ */}
      {/* Wider panel with proper breathing room for calculator forms. */}
      <aside className="hidden lg:flex flex-col flex-1 min-w-[560px] max-w-[720px] shrink-0 border-l border-border bg-background overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-card shrink-0">
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
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="p-5">
            {children}
          </div>
        </div>
      </aside>
    </div>
  )
}
