"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/printing-pricing"
import type { FullPrintingResult } from "@/lib/printing-types"
import { Plus, Star, ChevronDown, ChevronUp, TrendingDown } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface MultiQtyRow {
  qty: number
  result: FullPrintingResult
}

interface MultiQtyComparisonTableProps {
  rows: MultiQtyRow[]
  onAddToQuote: (row: MultiQtyRow) => void
  onAddAll: () => void
  isLoading?: boolean
}

export function MultiQtyComparisonTable({
  rows,
  onAddToQuote,
  onAddAll,
  isLoading,
}: MultiQtyComparisonTableProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  if (!rows.length) return null

  // Find the best value (lowest cost per piece), ignoring free-minimum edge cases
  const bestValueQty = rows.reduce((best, row) => {
    const cpp = row.result.grandTotal / row.qty
    const bestCpp = best.result.grandTotal / best.qty
    return cpp < bestCpp ? row : best
  }, rows[0]).qty

  // Find highest savings vs smallest qty (to show "save X%" chips)
  const baseRow = rows[0]
  const baseTotal = baseRow.result.grandTotal

  return (
    <div className="mt-6 pt-5 border-t border-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Quantity Comparison</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">{rows.length} quantities · same specs, same sheet</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-8"
          onClick={onAddAll}
          disabled={isLoading}
        >
          <Plus className="h-3.5 w-3.5" />
          Add All to Quote
        </Button>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        <span>Quantity</span>
        <span className="text-right w-20">Total</span>
        <span className="text-right w-16">Per Piece</span>
        <span className="text-right w-14">Sheets</span>
        <span className="w-8" />
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-1.5">
        {rows.map((row, idx) => {
          const isBest = row.qty === bestValueQty
          const isExpanded = expandedIdx === idx
          const cpp = row.result.grandTotal / row.qty
          const savingsPct = row.qty !== baseRow.qty
            ? Math.round(((baseTotal / baseRow.qty) - cpp) / (baseTotal / baseRow.qty) * 100)
            : null

          return (
            <div
              key={`mqrow-${idx}-${row.qty}`}
              className={cn(
                "rounded-xl border transition-all duration-150 overflow-hidden",
                isBest
                  ? "border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/15"
                  : "border-border bg-card"
              )}
            >
              {/* Main row */}
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-x-4 px-3 py-3">
                {/* Qty + badges */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn(
                    "text-[13px] font-bold tabular-nums",
                    isBest ? "text-emerald-800 dark:text-emerald-200" : "text-foreground"
                  )}>
                    {row.qty.toLocaleString()}
                  </span>
                  {isBest && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 shrink-0">
                      <Star className="h-2.5 w-2.5 fill-current" />
                      BEST VALUE
                    </span>
                  )}
                  {savingsPct !== null && savingsPct > 0 && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 shrink-0">
                      <TrendingDown className="h-2.5 w-2.5" />
                      {savingsPct}% lower/pc
                    </span>
                  )}
                </div>

                {/* Total */}
                <span className={cn(
                  "text-[13px] font-bold tabular-nums text-right w-20",
                  isBest ? "text-emerald-800 dark:text-emerald-200" : "text-foreground"
                )}>
                  {formatCurrency(row.result.grandTotal)}
                </span>

                {/* Per piece */}
                <span className="text-[12px] tabular-nums text-right text-muted-foreground w-16">
                  {(cpp * 100).toFixed(1)}¢
                </span>

                {/* Sheets */}
                <span className="text-[11px] tabular-nums text-right text-muted-foreground/70 w-14">
                  {row.result.result.sheets.toLocaleString()}
                </span>

                {/* Expand + Add */}
                <div className="flex items-center gap-1 justify-end w-8">
                  <button
                    className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isExpanded
                      ? <ChevronUp className="h-3.5 w-3.5" />
                      : <ChevronDown className="h-3.5 w-3.5" />
                    }
                  </button>
                </div>
              </div>

              {/* Expanded breakdown */}
              {isExpanded && (
                <div className="border-t border-border/50 px-4 py-3 bg-secondary/20">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mb-3">
                    {/* Printing */}
                    <LineRow label="Printing" value={row.result.printingCostPlus10} />
                    {/* Cutting */}
                    {row.result.cuttingCost > 0 && (
                      <LineRow label="Cutting" value={row.result.cuttingCost} />
                    )}
                    {/* Finishing */}
                    {row.result.finishingCosts.map((f) => (
                      <LineRow key={f.id} label={f.name} value={f.cost} />
                    ))}
                    {/* Lamination */}
                    {row.result.laminationCost && row.result.laminationCost.cost > 0 && (
                      <LineRow label={`${row.result.laminationCost.type} Lam (${row.result.laminationCost.sides})`} value={row.result.laminationCost.cost} />
                    )}
                    {/* Fold/Score */}
                    {row.result.foldFinishCost && row.result.foldFinishCost.sellPrice > 0 && (
                      <LineRow label={`${row.result.foldFinishCost.finishType === "fold" ? "Fold" : "Score & Fold"}`} value={row.result.foldFinishCost.sellPrice} />
                    )}
                    {/* Add-on */}
                    {row.result.addOnCharge > 0 && (
                      <LineRow label={row.result.addOnDescription || "Add-on"} value={row.result.addOnCharge} />
                    )}
                    {/* Finishing calcs */}
                    {row.result.finishingCalcCosts?.map((fc) => (
                      <LineRow key={fc.id} label={fc.name} value={fc.cost} />
                    ))}
                    {/* Sheet info */}
                    <div className="col-span-2 mt-1 pt-2 border-t border-border/40 flex items-center gap-4 text-[10px] text-muted-foreground">
                      <span>Sheet: <strong className="text-foreground">{row.result.result.sheetSize}</strong></span>
                      <span>Ups: <strong className="text-foreground">{row.result.result.maxUps}</strong></span>
                      <span>Level: <strong className="text-foreground">{row.result.result.level}</strong></span>
                    </div>
                  </div>

                  {/* Subtotal + Grand total + Add button */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Subtotal</p>
                      <p className="text-[13px] font-semibold text-foreground tabular-nums">{formatCurrency(row.result.grandTotal)}</p>
                    </div>
                    <Button
                      size="sm"
                      className="gap-1.5 rounded-full bg-foreground text-background hover:bg-foreground/90 text-xs h-8 px-4"
                      onClick={() => onAddToQuote(row)}
                      disabled={isLoading}
                    >
                      <Plus className="h-3 w-3" />
                      Add {row.qty.toLocaleString()} to Quote
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add all footer */}
      <div className="mt-3 flex items-center justify-between px-1">
        <p className="text-[11px] text-muted-foreground">
          Total if all added: <span className="font-semibold text-foreground tabular-nums">
            {formatCurrency(rows.reduce((s, r) => s + r.result.grandTotal, 0))}
          </span>
        </p>
        <button
          className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
          onClick={onAddAll}
          disabled={isLoading}
        >
          Add all {rows.length} quantities
        </button>
      </div>
    </div>
  )
}

function LineRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-muted-foreground truncate">{label}</span>
      <span className="text-[11px] font-medium tabular-nums text-foreground shrink-0">{formatCurrency(value)}</span>
    </div>
  )
}
