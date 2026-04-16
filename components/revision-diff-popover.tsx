"use client"

import { useMemo } from "react"
import { GitCompare, ArrowRight, Plus, Minus, Pencil, CheckCircle2 } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatCurrency } from "@/lib/pricing"
import { cn } from "@/lib/utils"
import { getCategoryLabel } from "@/lib/quote-types"
import type { QuoteRevision } from "@/lib/quote-context"
import {
  diffRevisions,
  summarizeDiff,
  type LineChange,
} from "@/lib/quote-revision-diff"

type Props = {
  /** The revision being displayed. */
  after: QuoteRevision | null | undefined
  /** The revision to compare against (usually the one with N-1). */
  before: QuoteRevision | null | undefined
  /** Optional button label override. Defaults to "What changed?" */
  label?: string
}

/**
 * Single-button popover that shows a clean, at-a-glance diff between two
 * revisions. Designed to keep the quote header uncluttered — the button is
 * compact and only reveals detail on demand.
 *
 * Layout (inside popover):
 *   Header:  Rev N-1 → Rev N with total delta
 *   Field changes:  "Project name: A → B"
 *   Line changes:   grouped by added / removed / modified with amounts
 */
export function RevisionDiffPopover({ before, after, label = "What changed?" }: Props) {
  const diff = useMemo(() => diffRevisions(before, after), [before, after])

  if (!before || !after) return null

  const delta = diff.totalDelta
  const deltaColor =
    Math.abs(delta) < 0.005
      ? "text-muted-foreground"
      : delta > 0
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-red-600 dark:text-red-400"

  const added = diff.lineChanges.filter((c): c is Extract<LineChange, { kind: "added" }> => c.kind === "added")
  const removed = diff.lineChanges.filter((c): c is Extract<LineChange, { kind: "removed" }> => c.kind === "removed")
  const modified = diff.lineChanges.filter((c): c is Extract<LineChange, { kind: "modified" }> => c.kind === "modified")

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-[10px] font-semibold",
            "text-muted-foreground hover:text-foreground",
            "border border-border/60 hover:border-border hover:bg-muted/60 transition-colors",
          )}
          title={`Compare Rev ${before.revision_number} vs Rev ${after.revision_number}`}
        >
          <GitCompare className="h-3 w-3" />
          <span>{label}</span>
          {diff.hasAnyChange && (
            <span className="inline-flex items-center justify-center min-w-[16px] h-[14px] px-1 rounded-full bg-foreground text-background text-[9px] font-bold leading-none tabular-nums">
              {diff.fieldChanges.length + diff.lineChanges.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0 overflow-hidden">
        {/* Header: Rev A → Rev B with total delta */}
        <div className="px-4 py-3 border-b border-border/60 bg-muted/30">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            <GitCompare className="h-3 w-3" />
            <span>Compare revisions</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-bold text-muted-foreground">
              Rev {before.revision_number}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className="text-sm font-mono font-bold text-foreground">
              Rev {after.revision_number}
            </span>
            <span className={cn("ml-auto text-sm font-mono font-bold tabular-nums", deltaColor)}>
              {delta > 0 ? "+" : delta < 0 ? "" : ""}
              {formatCurrency(delta)}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            {summarizeDiff(diff)}
          </div>
        </div>

        {/* Empty state */}
        {!diff.hasAnyChange && (
          <div className="px-4 py-6 flex flex-col items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <p className="text-xs text-muted-foreground">
              These revisions have no differences
            </p>
          </div>
        )}

        {/* Field changes */}
        {diff.fieldChanges.length > 0 && (
          <section className="px-4 py-3 border-b border-border/40">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Details
            </h4>
            <ul className="space-y-1.5">
              {diff.fieldChanges.map((ch) => (
                <li key={ch.field} className="text-xs flex items-baseline gap-2">
                  <span className="text-muted-foreground shrink-0">{ch.label}:</span>
                  <span className="text-muted-foreground line-through truncate">
                    {String(ch.before)}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                  <span className="font-semibold text-foreground truncate">
                    {String(ch.after)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Line changes */}
        {diff.lineChanges.length > 0 && (
          <div className="max-h-[300px] overflow-y-auto">
            {added.length > 0 && (
              <section className="px-4 py-3 border-b border-border/40">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
                  <Plus className="h-3 w-3" />
                  Added ({added.length})
                </h4>
                <ul className="space-y-2">
                  {added.map((c) => (
                    <ChangeRow
                      key={`a-${c.item.id}`}
                      badge={getCategoryLabel(c.item.category)}
                      title={c.item.label}
                      amount={c.item.amount}
                      amountClass="text-emerald-600 dark:text-emerald-400"
                      accent="emerald"
                    />
                  ))}
                </ul>
              </section>
            )}
            {removed.length > 0 && (
              <section className="px-4 py-3 border-b border-border/40">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400 mb-2 flex items-center gap-1.5">
                  <Minus className="h-3 w-3" />
                  Removed ({removed.length})
                </h4>
                <ul className="space-y-2">
                  {removed.map((c) => (
                    <ChangeRow
                      key={`r-${c.item.id}`}
                      badge={getCategoryLabel(c.item.category)}
                      title={c.item.label}
                      amount={-c.item.amount}
                      amountClass="text-red-600 dark:text-red-400"
                      accent="red"
                      strike
                    />
                  ))}
                </ul>
              </section>
            )}
            {modified.length > 0 && (
              <section className="px-4 py-3">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                  <Pencil className="h-3 w-3" />
                  Modified ({modified.length})
                </h4>
                <ul className="space-y-2.5">
                  {modified.map((c) => {
                    const amtDelta = c.after.amount - c.before.amount
                    const labelChanged = c.before.label !== c.after.label
                    return (
                      <li key={`m-${c.after.id}`} className="text-xs">
                        <div className="flex items-baseline gap-2">
                          <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 leading-none">
                            {getCategoryLabel(c.after.category)}
                          </span>
                          <span className="font-medium text-foreground truncate flex-1">
                            {c.after.label}
                          </span>
                        </div>
                        <div className="mt-1 pl-2 ml-[1px] border-l-2 border-amber-500/30 space-y-0.5">
                          {labelChanged && (
                            <div className="text-[10px] text-muted-foreground">
                              <span className="line-through">{c.before.label}</span>
                              <ArrowRight className="inline h-2.5 w-2.5 mx-1 opacity-60" />
                              <span className="text-foreground">{c.after.label}</span>
                            </div>
                          )}
                          <div className="text-[11px] tabular-nums flex items-center gap-2">
                            <span className="text-muted-foreground line-through">
                              {formatCurrency(c.before.amount)}
                            </span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground/60" />
                            <span className="font-semibold text-foreground">
                              {formatCurrency(c.after.amount)}
                            </span>
                            <span
                              className={cn(
                                "ml-auto font-bold",
                                amtDelta > 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : amtDelta < 0
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-muted-foreground",
                              )}
                            >
                              {amtDelta > 0 ? "+" : ""}
                              {formatCurrency(amtDelta)}
                            </span>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

/** Compact single-line change row used for Added and Removed sections. */
function ChangeRow({
  badge,
  title,
  amount,
  amountClass,
  accent,
  strike,
}: {
  badge: string
  title: string
  amount: number
  amountClass: string
  accent: "emerald" | "red"
  strike?: boolean
}) {
  return (
    <li className="text-xs flex items-baseline gap-2">
      <span
        className={cn(
          "shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded leading-none",
          accent === "emerald"
            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
            : "bg-red-500/15 text-red-700 dark:text-red-400",
        )}
      >
        {badge}
      </span>
      <span
        className={cn(
          "flex-1 min-w-0 truncate",
          strike ? "text-muted-foreground line-through" : "text-foreground font-medium",
        )}
      >
        {title}
      </span>
      <span className={cn("font-mono font-bold tabular-nums shrink-0", amountClass)}>
        {amount > 0 ? "+" : ""}
        {formatCurrency(amount)}
      </span>
    </li>
  )
}
