"use client"

/**
 * QuoteFormLayout
 *
 * App-wide QuickBooks-style quote form view. Wraps any step's tool/calculator
 * in a layout where the QUOTE DOCUMENT is the main focus (center) and the
 * current step's options live in a side panel on the right.
 *
 * This is OPTIONAL - toggled globally via the header button. The classic
 * calculator views still work as before when the toggle is off.
 *
 * Active across ALL pricing steps: envelope, postage, printing, booklet,
 * spiral, perfect, pad, labor, ohp.
 */

import type { ReactNode } from "react"
import { useQuote } from "@/lib/quote-context"
import { formatCurrency } from "@/lib/pricing"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  FileText, Check, Loader2, Save, AlertCircle, Trash2,
  Calendar, Hash, ChevronLeft, Clock,
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

// Which quote categories are primarily affected by each step - used to highlight
// the category rows that the current step is adding/editing.
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
  /** The current step's calculator/tool that renders inside the right side panel */
  children: ReactNode
  /** Display name of the current step (e.g., "USPS Postage") */
  stepTitle: string
  /** Short tagline describing what the step does */
  stepDescription?: string
  /** Icon to show next to the step title in the side panel header */
  stepIcon?: ReactNode
  /** Current step id - used to highlight the active category in the quote */
  stepId?: string
  /** Exit handler - turns quote form view off */
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

  // "Saved X ago" label
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
    year: "numeric",
    month: "short",
    day: "numeric",
  })

  return (
    <div className="flex h-full overflow-hidden bg-muted/30">
      {/* ═══════════ LEFT: QUOTE DOCUMENT (center stage, QuickBooks style) ═══════════ */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6">
          {/* Top bar: exit + save status */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onExit}
              className="gap-1.5 text-xs h-8"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back to Classic View
            </Button>

            <div className="flex items-center gap-2">
              {hasUnsavedChanges ? (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <AlertCircle className="h-3 w-3 text-amber-600" />
                  <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">Unsaved changes</span>
                </div>
              ) : lastSavedAt ? (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                  <Check className="h-3 w-3 text-green-600" />
                  <span className="text-[11px] font-medium text-green-700 dark:text-green-300">Saved {lastSavedLabel}</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* ═══ Quote Document ═══ */}
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            {/* Document header */}
            <div className="px-8 py-6 border-b border-border bg-gradient-to-br from-secondary/40 to-transparent">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">QUOTE</h1>
                  </div>
                  <p className="text-sm text-muted-foreground">Postage Plus</p>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  {quoteNumber && (
                    <div className="flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-mono font-bold text-foreground">Q-{quoteNumber}</span>
                    </div>
                  )}
                  {currentRevision > 0 && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
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

              {/* Project details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Project Name
                  </label>
                  <Input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Enter project name"
                    className="h-9 bg-background text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Customer / Contact
                  </label>
                  <Input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Customer name"
                    className="h-9 bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Reference #
                  </label>
                  <Input
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="Optional"
                    className="h-9 bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Items
                  </label>
                  <div className="h-9 px-3 flex items-center rounded-md border border-border bg-muted/30 text-sm font-semibold text-foreground">
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </div>
                </div>
              </div>
            </div>

            {/* Line items table */}
            <div className="px-8 py-6">
              <div className="flex items-center gap-3 px-3 py-2 border-b-2 border-foreground/10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span className="w-24">Category</span>
                <span className="flex-1">Description</span>
                <span className="w-20 text-right">Qty</span>
                <span className="w-24 text-right">Amount</span>
                <span className="w-8" />
              </div>

              {itemCount === 0 ? (
                <div className="py-16 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No items on this quote yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
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
                            "flex items-center gap-3 px-3 py-3 group hover:bg-secondary/30 transition-colors",
                            isActive && "bg-blue-50/40 dark:bg-blue-950/10"
                          )}
                        >
                          <span className={cn(
                            "w-24 shrink-0 text-[10px] font-bold uppercase tracking-wide",
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
                          <span className="w-20 text-right text-xs font-mono tabular-nums text-muted-foreground">
                            {item.metadata?.quantity ? item.metadata.quantity.toLocaleString() : "—"}
                          </span>
                          <span className="w-24 text-right text-sm font-mono font-bold tabular-nums text-foreground">
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
                <div className="mt-4 pt-4 border-t-2 border-foreground/10">
                  <div className="flex items-center justify-end gap-6">
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Quote Total
                      </div>
                      <div className="text-3xl font-bold font-mono tabular-nums text-foreground">
                        {formatCurrency(total)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Save action footer */}
            {hasUnsavedChanges && itemCount > 0 && (
              <div className="px-8 py-5 border-t border-border bg-amber-50/40 dark:bg-amber-950/10">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">You have unsaved changes</p>
                      <p className="text-xs text-muted-foreground">Save to create a new revision of this quote</p>
                    </div>
                  </div>
                  <Button
                    onClick={saveQuote}
                    disabled={isSaving}
                    className="gap-2 h-10 px-5 rounded-lg font-bold bg-green-600 hover:bg-green-700 text-white shadow-sm"
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

      {/* ═══════════ RIGHT: STEP TOOL (side panel) ═══════════ */}
      <aside className="hidden lg:flex flex-col w-[420px] xl:w-[480px] shrink-0 border-l border-border bg-background overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-card shrink-0">
          {stepIcon && (
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
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
          {children}
        </div>
      </aside>
    </div>
  )
}
