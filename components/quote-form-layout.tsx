"use client"

/**
 * QuoteFormLayout
 *
 * QuickBooks-style view — the QUOTE is the main document you are working on.
 *
 *  - LEFT (main, flex-1):  the QUOTE DOCUMENT — center of attention.
 *  - RIGHT (helper ~460px): the current step's tool — labeled as a helper
 *                           whose only job is to help you price and add lines.
 *
 * No page-level scrolling. Each column scrolls only its own content.
 */

import type { ReactNode } from "react"
import { useQuote } from "@/lib/quote-context"
import { formatCurrency } from "@/lib/pricing"
import { getCategoryLabel, type QuoteCategory } from "@/lib/quote-types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  FileText, Check, Loader2, Save, AlertCircle, Trash2, Clock,
  Calendar, Wrench,
} from "lucide-react"

// Render order for categories inside the quote.
const CATEGORY_ORDER: QuoteCategory[] = [
  "flat", "booklet", "spiral", "perfect", "pad",
  "envelope", "postage", "listwork", "item", "ohp",
]

// Map each workflow step to the QuoteCategory values it contributes to.
const STEP_CATEGORY_HINTS: Record<string, QuoteCategory[]> = {
  envelope: ["envelope"],
  usps: ["postage"],
  labor: ["listwork", "item"],
  printing: ["flat"],
  booklet: ["booklet"],
  spiral: ["spiral"],
  perfect: ["perfect"],
  pad: ["pad"],
  ohp: ["ohp"],
}

export interface QuoteFormLayoutProps {
  children: ReactNode
  stepTitle: string
  stepDescription?: string
  stepIcon?: ReactNode
  stepId?: string
  onExit?: () => void
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
  const today = new Date().toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  })

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
    <div className="flex h-full overflow-hidden bg-muted/30">
      {/* ═══════════ LEFT: QUOTE DOCUMENT — the main thing ═══════════ */}
      <section className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Document paper */}
          <div className="max-w-4xl mx-auto px-6 lg:px-10 py-8">
            <article className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              {/* ─── Document header ─── */}
              <header className="px-10 pt-10 pb-6 border-b border-border/60">
                <div className="flex items-start justify-between gap-8 mb-8">
                  <div className="min-w-0">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground leading-none mb-1">
                      Quote
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {itemCount} {itemCount === 1 ? "line item" : "line items"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right space-y-2">
                    {quoteNumber && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Quote #
                        </p>
                        <p className="text-base font-mono font-bold text-foreground">
                          Q-{quoteNumber}
                        </p>
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-2">
                      {currentRevision > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                          <Clock className="h-3 w-3 text-amber-600" />
                          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                            Rev {currentRevision}
                            {revisions.length > 1 && ` of ${revisions.length}`}
                          </span>
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {today}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Project / customer fields - feel like the top of a QB form */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Project
                    </label>
                    <Input
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="Project name"
                      className="h-10 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Customer
                    </label>
                    <Input
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Customer name"
                      className="h-10 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Reference #
                    </label>
                    <Input
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      placeholder="PO / Ref"
                      className="h-10 text-sm font-mono"
                    />
                  </div>
                </div>
              </header>

              {/* ─── Save-status strip ─── */}
              <div className={cn(
                "px-10 py-2 border-b border-border/60",
                hasUnsavedChanges
                  ? "bg-amber-50/60 dark:bg-amber-950/20"
                  : "bg-muted/40"
              )}>
                {hasUnsavedChanges ? (
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      You have unsaved changes — Save to create a new revision
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                    <span className="text-xs text-muted-foreground">
                      All changes saved · {lastSavedLabel}
                    </span>
                  </div>
                )}
              </div>

              {/* ─── Line items ─── */}
              {/* Column header */}
              <div className="px-10 py-3 bg-muted/30 border-b border-border flex items-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span className="w-20 shrink-0">Category</span>
                <span className="flex-1 min-w-0">Description</span>
                <span className="w-32 text-right shrink-0">Amount</span>
                <span className="w-8 shrink-0" aria-hidden />
              </div>

              {itemCount === 0 ? (
                <div className="px-10 py-16 text-center">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                    <FileText className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-base font-semibold text-foreground mb-1">
                    No items yet
                  </p>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    Use the <span className="font-semibold text-foreground">{stepTitle}</span>{" "}
                    helper on the right to price items and add them to this quote.
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
                            "group flex items-center gap-4 px-10 py-3.5 hover:bg-secondary/30 transition-colors",
                            isActive && "bg-blue-50/50 dark:bg-blue-950/15"
                          )}
                        >
                          <span
                            className={cn(
                              "w-20 shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded text-center",
                              isActive
                                ? "bg-blue-600 text-white"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {getCategoryLabel(cat)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {item.label}
                            </p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {item.description.split("\n")[0]}
                              </p>
                            )}
                          </div>
                          <span className="w-32 text-right text-sm font-mono font-bold tabular-nums text-foreground shrink-0">
                            {formatCurrency(item.amount)}
                          </span>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="w-8 h-8 rounded-md text-muted-foreground/30 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center shrink-0"
                            title="Remove line"
                            aria-label={`Remove ${item.label}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      )
                    })
                  })}
                </ul>
              )}

              {/* ─── Total ─── */}
              {itemCount > 0 && (
                <div className="px-10 py-6 border-t-2 border-foreground/10 bg-muted/20">
                  <div className="flex items-center justify-end gap-8">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Quote Total
                    </span>
                    <span className="text-3xl font-bold font-mono tabular-nums text-foreground">
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>
              )}
            </article>

            {/* Save action - below the document, like a QB action bar */}
            {hasUnsavedChanges && itemCount > 0 && (
              <div className="mt-4 flex items-center justify-end gap-3">
                <span className="text-xs text-muted-foreground">
                  Saving creates a new revision snapshot
                </span>
                <Button
                  onClick={saveQuote}
                  disabled={isSaving}
                  className="gap-2 h-11 px-6 rounded-lg font-bold bg-green-600 hover:bg-green-700 text-white shadow-sm"
                >
                  {isSaving ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="h-4 w-4" /> Save Quote</>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════ RIGHT: STEP TOOL — the helper ═══════════ */}
      <aside className="hidden lg:flex flex-col w-[440px] xl:w-[480px] shrink-0 border-l border-border bg-card overflow-hidden">
        {/* Helper header - makes role very clear */}
        <header className="shrink-0 px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-1.5 mb-2">
            <Wrench className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Pricing Helper
            </span>
          </div>
          <div className="flex items-center gap-3">
            {stepIcon && (
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                {stepIcon}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{stepTitle}</p>
              {stepDescription && (
                <p className="text-[11px] text-muted-foreground truncate">
                  {stepDescription}
                </p>
              )}
            </div>
          </div>
        </header>

        {/* Tool content - only area that scrolls in the right column.
            The `data-pricing-helper` attribute triggers the normalization
            CSS scope in globals.css so every step's calculator looks
            consistent end-to-end when used as a helper. */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div data-pricing-helper className="p-4">
            {children}
          </div>
        </div>
      </aside>

      {/* ═══════════ MOBILE bottom save bar (when right aside is hidden) ═══ */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card/95 backdrop-blur-sm px-4 py-2 flex items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground leading-tight">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </p>
            <p className="text-sm font-bold font-mono tabular-nums truncate">
              {formatCurrency(total)}
            </p>
          </div>
        </div>
        {hasUnsavedChanges && itemCount > 0 && (
          <Button
            onClick={saveQuote}
            disabled={isSaving}
            size="sm"
            className="gap-1.5 h-8 rounded-lg font-bold bg-green-600 hover:bg-green-700 text-white shrink-0"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <><Save className="h-3.5 w-3.5" /> Save</>
            )}
          </Button>
        )}
      </div>

    </div>
  )
}
