"use client"

/**
 * QuoteFormLayout
 *
 * QuickBooks-style view — the QUOTE is the main document.
 *
 *  - LEFT (main):  QUOTE DOCUMENT — locked header + footer, only items scroll.
 *  - RIGHT (helper): current step's calculator — labeled as "Pricing Helper".
 *
 * No page-level scrolling. Each column only scrolls its own middle region so
 * the total, save action, and step header are always visible at a glance.
 */

import { useState, type ReactNode } from "react"
import { useQuote } from "@/lib/quote-context"
import { formatCurrency } from "@/lib/pricing"
import { getCategoryLabel, type QuoteCategory } from "@/lib/quote-types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  FileText, Check, Loader2, Save, AlertCircle, Trash2, Clock,
  Wrench, Plus, X, Mail, CheckCircle2, Layers,
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
  /** 1-based index of the current step in the workflow (for progress display) */
  stepNumber?: number
  /** Total visible steps in the workflow (for progress display) */
  totalSteps?: number
  /** Exit the workflow from the helper header (e.g. leave QB view) */
  onExit?: () => void
  /** Close the quote entirely and return to the Quotes board */
  onClose?: () => void
  /** Jump back to the Planner step (where customer/project/ref are set up) */
  onGoToPlanner?: () => void
}

export function QuoteFormLayout({
  children, stepTitle, stepDescription, stepIcon, stepId,
  stepNumber, totalSteps, onClose, onGoToPlanner,
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
    addItem,
  } = useQuote()

  // Inline custom-line editor state
  const [customDraft, setCustomDraft] = useState<{ label: string; amount: string } | null>(null)

  // Email copy feedback state
  const [emailCopied, setEmailCopied] = useState(false)

  /** Build a plain-text email body representing the current quote.
   *  Format is deliberately simple so it pastes cleanly into Gmail/Outlook. */
  const buildQuoteEmail = () => {
    const total = getTotal()
    const header = projectName || "Quote"
    const quoteRef = quoteNumber ? `Quote #${quoteNumber}` : "New Quote"
    const revLabel = currentRevision ? ` (Revision ${currentRevision})` : ""
    const lines: string[] = []
    lines.push(`${header} — ${quoteRef}${revLabel}`)
    if (contactName) lines.push(`Customer: ${contactName}`)
    if (referenceNumber) lines.push(`Reference: ${referenceNumber}`)
    lines.push("")
    lines.push("LINE ITEMS")
    lines.push("─".repeat(48))
    if (orderedItems.length === 0) {
      lines.push("(no items)")
    } else {
      for (const it of orderedItems) {
        const cat = getCategoryLabel(it.category)
        const label = it.label || "—"
        const amt = formatCurrency(it.amount)
        lines.push(`• [${cat}] ${label}  —  ${amt}`)
        if (it.description) {
          const firstDescLine = it.description.split("\n")[0].trim()
          if (firstDescLine) lines.push(`    ${firstDescLine}`)
        }
      }
    }
    lines.push("─".repeat(48))
    lines.push(`TOTAL: ${formatCurrency(total)}`)
    lines.push("")
    lines.push("Please let us know if you'd like to proceed or adjust any of the above.")
    return lines.join("\n")
  }

  const handleCopyForEmail = async () => {
    try {
      const text = buildQuoteEmail()
      await navigator.clipboard.writeText(text)
      setEmailCopied(true)
      setTimeout(() => setEmailCopied(false), 2000)
    } catch (err) {
      console.log("[v0] Copy to clipboard failed:", err)
    }
  }

  const commitCustomLine = () => {
    if (!customDraft) return
    const label = customDraft.label.trim()
    const amount = parseFloat(customDraft.amount) || 0
    if (label.length === 0) {
      setCustomDraft(null)
      return
    }
    addItem({
      category: "item",
      label,
      description: "",
      amount,
    })
    setCustomDraft(null)
  }

  const total = getTotal()
  const itemCount = items.length
  const activeCategories = stepId ? STEP_CATEGORY_HINTS[stepId] || [] : []

  const lastSavedLabel = (() => {
    if (!lastSavedAt) return "Not saved"
    const seconds = Math.floor((Date.now() - lastSavedAt) / 1000)
    if (seconds < 10) return "just now"
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return new Date(lastSavedAt).toLocaleDateString()
  })()

  // Flatten items in category order (nothing rendered if empty).
  const orderedItems = CATEGORY_ORDER.flatMap((cat) =>
    items.filter((i) => i.category === cat)
  )

  return (
    // Full-height, no page-level scroll.
    <div className="flex h-full overflow-hidden bg-muted/30">
      {/* ═══════════ LEFT: QUOTE DOCUMENT ═══════════ */}
      <section className="flex-1 min-w-0 flex flex-col overflow-hidden p-4 lg:p-6">
        <article className="flex-1 min-h-0 flex flex-col bg-card border border-border rounded-xl shadow-sm overflow-hidden mx-auto w-full max-w-4xl">

          {/* ─── LOCKED HEADER ─── */}
          <header className="shrink-0 border-b border-border/60">
            {/* Row 1: title + quote number + rev + date  (single compact row) */}
            <div className="flex items-baseline justify-between gap-4 px-6 pt-5 pb-3">
              <div className="flex items-baseline gap-3 min-w-0">
                <h1 className="text-xl font-bold tracking-tight text-foreground leading-none">
                  Quote
                </h1>
                {quoteNumber && (
                  <span className="text-sm font-mono font-semibold text-muted-foreground">
                    Q-{quoteNumber}
                  </span>
                )}
                {currentRevision > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <Clock className="h-2.5 w-2.5 text-amber-600" />
                    <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                      R{currentRevision}
                      {revisions.length > 1 && `/${revisions.length}`}
                    </span>
                  </span>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground shrink-0">
                {itemCount} {itemCount === 1 ? "line" : "lines"}
              </span>
            </div>

            {/* Row 2: Project / Customer / Ref summary — READ-ONLY in QB mode.
                The Planner is the single source of truth for these fields
                (it has the richer database-backed customer lookup + contact
                picker + quantity). This strip just reflects that data and
                offers a one-click jump back to the Planner to edit. */}
            <div className="px-6 pb-4 flex items-center gap-2">
              <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-[1.4fr_1fr_0.8fr] gap-3">
                <SummaryField label="Project" value={projectName} emptyText="Not set" />
                <SummaryField label="Customer" value={contactName} emptyText="No customer" />
                <SummaryField label="Ref" value={referenceNumber} emptyText="—" mono />
              </div>
              {onGoToPlanner && stepId !== "planner" && (
                <button
                  type="button"
                  onClick={onGoToPlanner}
                  className="shrink-0 flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent hover:border-border transition-all"
                  title="Edit customer, project and job details in the Planner"
                >
                  <Layers className="h-3 w-3" />
                  Edit in Planner
                </button>
              )}
            </div>

            {/* Row 3: Table column header */}
            <div className="px-6 py-2 bg-muted/40 border-t border-border/60 flex items-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <span className="w-20 shrink-0">Category</span>
              <span className="flex-1 min-w-0">Description</span>
              <span className="w-28 text-right shrink-0">Amount</span>
              <span className="w-7 shrink-0" aria-hidden />
            </div>
          </header>

          {/* ─── SCROLLING LINE-ITEM BODY (the only thing that scrolls) ─── */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {itemCount === 0 && !customDraft ? (
              <div className="h-full flex items-center justify-center px-6 py-10">
                <div className="text-center max-w-xs">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                    <FileText className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-1">
                    No items yet
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Use the <span className="font-semibold text-foreground">{stepTitle}</span>{" "}
                    helper on the right to price items, or add a custom line below.
                  </p>
                  <button
                    onClick={() => setCustomDraft({ label: "", amount: "" })}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-foreground bg-muted hover:bg-muted/70 border border-border transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add custom line
                  </button>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-border/40">
                {orderedItems.map((item) => {
                  const isActive = activeCategories.includes(item.category)
                  return (
                    <li
                      key={item.id}
                      className={cn(
                        "group flex items-center gap-3 px-6 py-2.5 hover:bg-secondary/40 transition-colors",
                        isActive && "bg-blue-50/40 dark:bg-blue-950/10"
                      )}
                    >
                      <span
                        className={cn(
                          "w-20 shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded text-center",
                          isActive
                            ? "bg-blue-600 text-white"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {getCategoryLabel(item.category)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate leading-tight">
                          {item.label}
                        </p>
                        {item.description && (
                          <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                            {item.description.split("\n")[0]}
                          </p>
                        )}
                      </div>
                      <span className="w-28 text-right text-sm font-mono font-bold tabular-nums text-foreground shrink-0">
                        {formatCurrency(item.amount)}
                      </span>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="w-7 h-7 rounded-md text-muted-foreground/30 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center shrink-0"
                        title="Remove line"
                        aria-label={`Remove ${item.label}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  )
                })}

                {/* Inline custom-line editor - commits on Enter or the green check */}
                {customDraft && (
                  <li className="flex items-center gap-3 px-6 py-2 bg-amber-50/40 dark:bg-amber-950/10">
                    <span className="w-20 shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded text-center bg-foreground text-background">
                      Custom
                    </span>
                    <Input
                      autoFocus
                      value={customDraft.label}
                      onChange={(e) => setCustomDraft({ ...customDraft, label: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitCustomLine()
                        if (e.key === "Escape") setCustomDraft(null)
                      }}
                      placeholder="Line description…"
                      className="flex-1 min-w-0 h-8 text-sm font-semibold bg-background"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      value={customDraft.amount}
                      onChange={(e) => setCustomDraft({ ...customDraft, amount: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitCustomLine()
                        if (e.key === "Escape") setCustomDraft(null)
                      }}
                      placeholder="0.00"
                      className="w-28 h-8 text-sm font-mono tabular-nums text-right bg-background"
                    />
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={commitCustomLine}
                        className="w-7 h-7 rounded-md text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 flex items-center justify-center"
                        title="Save line (Enter)"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setCustomDraft(null)}
                        className="w-7 h-7 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center"
                        title="Cancel (Esc)"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                )}

                {/* Add custom line button - always at end of list */}
                {!customDraft && (
                  <li className="px-6 py-2">
                    <button
                      onClick={() => setCustomDraft({ label: "", amount: "" })}
                      className="w-full inline-flex items-center gap-2 px-2 py-2 rounded-md text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-dashed border-border hover:border-foreground/40 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add custom line
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* ─── LOCKED FOOTER: total + save action + status ─── */}
          <footer className="shrink-0 border-t border-border bg-card">
            {/* Status strip */}
            <div className={cn(
              "px-6 py-1.5 border-b border-border/40 flex items-center gap-1.5 text-[11px]",
              hasUnsavedChanges
                ? "bg-amber-50/70 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300"
                : "bg-muted/30 text-muted-foreground"
            )}>
              {hasUnsavedChanges ? (
                <>
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span className="font-medium">Unsaved changes — save to create a new revision</span>
                </>
              ) : (
                <>
                  <Check className="h-3 w-3 text-green-600 shrink-0" />
                  <span>Saved · {lastSavedLabel}</span>
                </>
              )}
            </div>

            {/* Total + action cluster. Visual priority flips based on state:
                - Unsaved work: Save is the bold green primary.
                - Clean/saved: Close becomes the bold primary ("all done, exit"). */}
            <div className="px-6 py-3 flex items-center justify-between gap-3">
              <div className="flex items-baseline gap-3 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Quote Total
                </span>
                <span className="text-2xl font-bold font-mono tabular-nums text-foreground leading-none">
                  {formatCurrency(total)}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Copy-for-email: secondary, always available when there are items. */}
                <Button
                  variant="outline"
                  onClick={handleCopyForEmail}
                  disabled={itemCount === 0}
                  className={cn(
                    "gap-2 h-9 px-3 rounded-lg font-semibold text-xs border-border",
                    emailCopied && "border-green-500 text-green-700 dark:text-green-400"
                  )}
                  title="Copy a plain-text quote summary for email"
                >
                  {emailCopied ? (
                    <><CheckCircle2 className="h-4 w-4" /> Copied</>
                  ) : (
                    <><Mail className="h-4 w-4" /> Copy for Email</>
                  )}
                </Button>

                {/* Save: primary when there are unsaved changes, muted otherwise. */}
                <Button
                  onClick={saveQuote}
                  disabled={isSaving || !hasUnsavedChanges || itemCount === 0}
                  className={cn(
                    "gap-2 h-9 px-4 rounded-lg font-bold shadow-sm",
                    hasUnsavedChanges && itemCount > 0
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted"
                  )}
                >
                  {isSaving ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                  ) : (
                    <><Save className="h-4 w-4" /> Save</>
                  )}
                </Button>

                {/* Close & Finish: becomes the prominent primary once everything
                    is saved, giving the user a clear "done, exit" path. */}
                {onClose && (
                  <Button
                    onClick={onClose}
                    className={cn(
                      "gap-2 h-9 px-4 rounded-lg font-bold shadow-sm",
                      !hasUnsavedChanges && itemCount > 0
                        ? "bg-foreground text-background hover:bg-foreground/90"
                        : "bg-card text-foreground border border-border hover:bg-secondary"
                    )}
                    title={
                      hasUnsavedChanges
                        ? "Close without saving"
                        : "Close quote and return to Quotes"
                    }
                  >
                    <X className="h-4 w-4" />
                    {!hasUnsavedChanges && itemCount > 0 ? "Finish" : "Close"}
                  </Button>
                )}
              </div>
            </div>
          </footer>
        </article>
      </section>

      {/* ═══════════ RIGHT: STEP TOOL — "Pricing Helper" ═══════════ */}
      <aside className="hidden lg:flex flex-col w-[440px] xl:w-[500px] 2xl:w-[560px] shrink-0 border-l border-border bg-card overflow-hidden">
        {/* Helper header - substantial, clear "you are here" indicator.
            Keyed on stepId so only THIS strip animates when the step changes
            (the quote document beside it stays rock-stable). */}
        <header
          key={stepId}
          className="shrink-0 border-b-2 border-border bg-gradient-to-b from-muted/40 to-card animate-in fade-in slide-in-from-right-2 duration-300"
        >
          {/* Top strip: "Pricing Helper" label + step progress */}
          <div className="px-5 pt-3 pb-1.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <Wrench className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Pricing Helper
              </span>
            </div>
            {typeof stepNumber === "number" && typeof totalSteps === "number" && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span className="tabular-nums">Step {stepNumber} / {totalSteps}</span>
              </div>
            )}
          </div>

          {/* Main: big numbered badge + bold title + description */}
          <div className="px-5 pb-3 flex items-center gap-3">
            {typeof stepNumber === "number" ? (
              <div className="h-11 w-11 rounded-xl bg-foreground text-background flex items-center justify-center shrink-0 shadow-sm font-bold text-lg tabular-nums">
                {stepNumber}
              </div>
            ) : stepIcon ? (
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                {stepIcon}
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold text-foreground truncate leading-tight">
                {stepTitle}
              </p>
              {stepDescription && (
                <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">
                  {stepDescription}
                </p>
              )}
            </div>
          </div>

          {/* Progress bar - fills proportionally to step position */}
          {typeof stepNumber === "number" && typeof totalSteps === "number" && totalSteps > 0 && (
            <div className="h-1 w-full bg-border/50 overflow-hidden">
              <div
                className="h-full bg-foreground transition-all duration-500 ease-out"
                style={{ width: `${(stepNumber / totalSteps) * 100}%` }}
              />
            </div>
          )}
        </header>

        {/* Tool content — only area that scrolls in the right column.
            `data-pricing-helper` triggers the normalization CSS scope. */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div data-pricing-helper className="p-4">
            {children}
          </div>
        </div>
      </aside>

      {/* ═══════════ MOBILE bottom save bar ═══════════ */}
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

/** Read-only summary field for the document header row.
 *  Replaces the old LabeledField inputs now that customer/project/ref are
 *  entered solely in the Planner (single source of truth). */
function SummaryField({
  label, value, emptyText, mono,
}: { label: string; value: string; emptyText: string; mono?: boolean }) {
  const isEmpty = !value || value.trim().length === 0
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-0.5">
        {label}
      </div>
      <div
        className={cn(
          "text-sm leading-tight truncate",
          isEmpty
            ? "text-muted-foreground/60 italic font-normal"
            : "text-foreground font-semibold",
          mono && !isEmpty && "font-mono"
        )}
        title={isEmpty ? emptyText : value}
      >
        {isEmpty ? emptyText : value}
      </div>
    </div>
  )
}
