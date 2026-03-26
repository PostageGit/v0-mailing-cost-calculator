"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/pricing"
import { Plus, Star, ChevronDown, ChevronUp, TrendingDown, BarChart2, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface GenericQtyRow<T = unknown> {
  qty: number
  total: number
  sheets?: number
  result: T
}

interface GenericMultiQtyTableProps<T> {
  rows: GenericQtyRow<T>[]
  onAddToQuote: (row: GenericQtyRow<T>) => void
  onAddAll: () => void
  renderDetail?: (row: GenericQtyRow<T>) => React.ReactNode
  isLoading?: boolean
  label?: string
  hideAddButtons?: boolean
}

export function GenericMultiQtyTable<T>({
  rows,
  onAddToQuote,
  onAddAll,
  renderDetail,
  isLoading,
  label,
  hideAddButtons = false,
}: GenericMultiQtyTableProps<T>) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  if (!rows.length) return null

  const uniqueRows = rows.filter(
    (row, i, arr) => arr.findIndex((r) => r.qty === row.qty) === i
  )

  const bestValueQty = uniqueRows.reduce((best, row) =>
    row.total / row.qty < best.total / best.qty ? row : best
  , uniqueRows[0]).qty

  const baseRow = uniqueRows[0]

  return (
    <div className="mt-6 pt-5 border-t border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-blue-500" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {label ?? "Quantity Comparison"}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {uniqueRows.length} quantities · same specs
            </p>
          </div>
        </div>
        {!hideAddButtons && (
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
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        <span>Quantity</span>
        <span className="text-right w-20">Total</span>
        <span className="text-right w-16">Per Piece</span>
        {uniqueRows.some((r) => r.sheets != null) && (
          <span className="text-right w-14">Sheets</span>
        )}
        <span className="w-8" />
      </div>

      <div className="flex flex-col gap-1.5">
        {uniqueRows.map((row, i) => {
          const isBest = row.qty === bestValueQty
          const isExpanded = expandedIdx === i
          const cpp = row.total / row.qty
          const baseCpp = baseRow.total / baseRow.qty
          const savingsPct =
            row.qty !== baseRow.qty && baseCpp > 0
              ? Math.round(((baseCpp - cpp) / baseCpp) * 100)
              : null

          return (
            <div
              key={i}
              className={cn(
                "rounded-xl border transition-all duration-150 overflow-hidden",
                isBest
                  ? "border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/15"
                  : "border-border bg-card"
              )}
            >
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-x-4 px-3 py-3">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <span className={cn("text-[13px] font-bold tabular-nums", isBest ? "text-emerald-800 dark:text-emerald-200" : "text-foreground")}>
                    {row.qty.toLocaleString()}
                  </span>
                  {isBest && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 shrink-0">
                      <Star className="h-2.5 w-2.5 fill-current" /> BEST VALUE
                    </span>
                  )}
                  {savingsPct != null && savingsPct > 0 && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 shrink-0">
                      <TrendingDown className="h-2.5 w-2.5" /> {savingsPct}% lower/pc
                    </span>
                  )}
                </div>
                <span className={cn("text-[13px] font-bold tabular-nums text-right w-20", isBest ? "text-emerald-800 dark:text-emerald-200" : "text-foreground")}>
                  {formatCurrency(row.total)}
                </span>
                <span className="text-[12px] tabular-nums text-right text-muted-foreground w-16">
                  {(cpp * 100).toFixed(1)}¢
                </span>
                {uniqueRows.some((r) => r.sheets != null) && (
                  <span className="text-[11px] tabular-nums text-right text-muted-foreground/70 w-14">
                    {row.sheets != null ? row.sheets.toLocaleString() : "—"}
                  </span>
                )}
                <div className="flex items-center gap-1 justify-end w-8">
                  {renderDetail && (
                    <button
                      className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      onClick={() => setExpandedIdx(isExpanded ? null : i)}
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && renderDetail && (
                <div className="border-t border-border/50 px-4 py-3 bg-secondary/20">
                  {renderDetail(row)}
                  {!hideAddButtons && (
                  <div className="flex justify-end pt-3 border-t border-border/40 mt-3">
                    <Button
                      size="sm"
                      className="gap-1.5 rounded-full bg-foreground text-background hover:bg-foreground/90 text-xs h-8 px-4"
                      onClick={() => onAddToQuote(row)}
                      disabled={isLoading}
                    >
                      <Plus className="h-3 w-3" /> Add {row.qty.toLocaleString()} to Quote
                    </Button>
                  </div>
                  )}
                </div>
              )}

              {!renderDetail && !hideAddButtons && (
                <div className="px-3 pb-3 flex justify-end -mt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-[11px] h-7 px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => onAddToQuote(row)}
                    disabled={isLoading}
                  >
                    <Plus className="h-3 w-3" /> Add to Quote
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex items-center justify-between px-1">
        <p className="text-[11px] text-muted-foreground">
          Total if all added:{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {formatCurrency(uniqueRows.reduce((s, r) => s + r.total, 0))}
          </span>
        </p>
        <button
          className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
          onClick={onAddAll}
          disabled={isLoading}
        >
          Add all {uniqueRows.length} quantities
        </button>
      </div>
    </div>
  )
}

// ── Qty toggle UI ─────────────────────────────────────────────────────────────
const QUICK_QTYS = [250, 500, 1000, 2500, 5000, 10000]

export interface MultiQtyState {
  enabled: boolean
  quantities: number[]
}

interface MultiQtyToggleProps {
  value: MultiQtyState
  onChange: (v: MultiQtyState) => void
  defaultBase?: number
  disabled?: boolean
}

export function MultiQtyToggle({
  value,
  onChange,
  defaultBase = 1000,
  disabled,
}: MultiQtyToggleProps) {
  function toggle() {
    if (value.enabled) {
      onChange({ enabled: false, quantities: [] })
    } else {
      const seed = Array.from(
        new Set([defaultBase, defaultBase * 2, defaultBase * 5].filter(Boolean))
      ).sort((a, b) => a - b)
      onChange({ enabled: true, quantities: seed })
    }
  }

  function addQty(qty: number) {
    if (!qty || value.quantities.includes(qty) || value.quantities.length >= 8) return
    const sorted = Array.from(new Set([...value.quantities, qty])).sort((a, b) => a - b)
    onChange({ ...value, quantities: sorted })
  }

  function removeQty(qty: number) {
    onChange({ ...value, quantities: value.quantities.filter((q) => q !== qty) })
  }

  function updateQty(idx: number, val: number) {
    const next = [...value.quantities]
    next[idx] = val
    onChange({ ...value, quantities: next })
  }

  function sortQtys() {
    const sorted = Array.from(new Set([...value.quantities].filter(Boolean))).sort((a, b) => a - b)
    onChange({ ...value, quantities: sorted })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Compare Quantities</span>
          {value.enabled && value.quantities.length > 0 && (
            <span className="text-xs text-muted-foreground">({value.quantities.length} qtys)</span>
          )}
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={toggle}
          className={cn(
            "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border font-semibold transition-colors shadow-sm disabled:opacity-40",
            value.enabled
              ? "bg-blue-500 text-white border-blue-600 hover:bg-blue-600"
              : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800"
          )}
        >
          {value.enabled ? "Comparing" : <><BarChart2 className="h-3.5 w-3.5" /> Compare</>}
        </button>
      </div>

      {value.enabled && (
        <div className="border rounded-lg p-3 bg-blue-50/40 dark:bg-blue-950/10 border-blue-200 dark:border-blue-800/50 flex flex-col gap-3">
          {value.quantities.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {value.quantities.map((qty, idx) => (
                <div key={idx} className="flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-background border border-blue-200 dark:border-blue-700">
                  <input
                    type="number"
                    min={1}
                    value={qty || ""}
                    onChange={(e) => updateQty(idx, parseInt(e.target.value) || 0)}
                    onBlur={sortQtys}
                    className="w-16 text-[12px] font-semibold text-foreground bg-transparent outline-none tabular-nums text-center"
                  />
                  <button
                    type="button"
                    onClick={() => removeQty(qty)}
                    className="h-5 w-5 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Quick add</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_QTYS.map((q) => {
                const already = value.quantities.includes(q)
                return (
                  <button
                    key={q}
                    type="button"
                    disabled={already || value.quantities.length >= 8}
                    onClick={() => addQty(q)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors",
                      already
                        ? "border-blue-200 bg-blue-100 text-blue-400 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-500 cursor-default"
                        : "border-border bg-background text-foreground hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                    )}
                  >
                    {q.toLocaleString()}
                  </button>
                )
              })}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/60">Up to 8 quantities. All settings apply to every quantity.</p>
        </div>
      )}
    </div>
  )
}
