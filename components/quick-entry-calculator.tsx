"use client"

import { useState, useCallback, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { Plus, ChevronRight, Calculator, Trash2, Check, Loader2 } from "lucide-react"
import { formatCurrency } from "@/lib/pricing"
import { useQuote } from "@/lib/quote-context"
import { usePapersContext } from "@/lib/papers-context"
import {
  calculateAllSheetOptions,
  calculatePrintingCost,
  buildFullResult,
  getAvailableSides,
} from "@/lib/printing-pricing"
import type { PrintingInputs, FullPrintingResult } from "@/lib/printing-types"

// ── Row Type ─────────────────────────────────────────────────────────────────
interface QuickEntryRow {
  id: string
  label: string
  qty: number
  width: number
  height: number
  paper: string
  sides: string
  hasBleed: boolean
  result: FullPrintingResult | null
  isCalculating: boolean
  addedToQuote: boolean
}

function createEmptyRow(): QuickEntryRow {
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label: "",
    qty: 0,
    width: 0,
    height: 0,
    paper: "20lb Offset",
    sides: "S/S",
    hasBleed: false,
    result: null,
    isCalculating: false,
    addedToQuote: false,
  }
}

// ── Quick Entry Calculator ───────────────────────────────────────────────────
export function QuickEntryCalculator() {
  const quote = useQuote()
  const { getPaperOptions, getPaperPrices } = usePapersContext()
  const paperOptions = getPaperOptions("flat_printing")
  const paperPrices = getPaperPrices()

  const [rows, setRows] = useState<QuickEntryRow[]>([createEmptyRow()])

  // Update a field in a row
  const updateRow = useCallback((id: string, updates: Partial<QuickEntryRow>) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, ...updates, result: updates.result ?? (updates.qty !== undefined || updates.width !== undefined || updates.height !== undefined || updates.paper !== undefined || updates.sides !== undefined ? null : r.result), addedToQuote: updates.addedToQuote ?? (updates.qty !== undefined || updates.width !== undefined || updates.height !== undefined || updates.paper !== undefined || updates.sides !== undefined ? false : r.addedToQuote) }
          : r
      )
    )
  }, [])

  // Calculate a single row
  const calculateRow = useCallback(
    async (id: string) => {
      const row = rows.find((r) => r.id === id)
      if (!row || !row.qty || !row.width || !row.height || !row.paper || !row.sides) return

      updateRow(id, { isCalculating: true })

      try {
        const inputs: PrintingInputs = {
          qty: row.qty,
          width: row.width,
          height: row.height,
          paperName: row.paper,
          sidesValue: row.sides,
          hasBleed: row.hasBleed,
          addOnCharge: 0,
          addOnDescription: "",
          finishingIds: [],
          finishingCalcIds: [],
          isBroker: false,
          printingMarkupPct: 0,
          lamination: { enabled: false, type: "Gloss", sides: "S/S", markupPct: 225, brokerDiscountPct: 30 },
        }

        const allSheetOpts = calculateAllSheetOptions(inputs, paperPrices)
        if (allSheetOpts.length === 0) {
          updateRow(id, { isCalculating: false })
          return
        }

        // Pick cheapest sheet
        const bestSheet = allSheetOpts.reduce((a, b) => (a.totalCost < b.totalCost ? a : b))
        const calcResult = calculatePrintingCost(inputs, bestSheet.size, paperPrices)
        const fullResult = buildFullResult(inputs, calcResult, { selectedSheet: bestSheet, fullSheetOptions: allSheetOpts })

        updateRow(id, { result: fullResult, isCalculating: false })
      } catch (error) {
        console.error("[v0] Quick calc error:", error)
        updateRow(id, { isCalculating: false })
      }
    },
    [rows, paperPrices, updateRow]
  )

  // Add row to quote
  const addRowToQuote = useCallback(
    (id: string) => {
      const row = rows.find((r) => r.id === id)
      if (!row?.result) return

      const label = row.label || `${row.qty.toLocaleString()} - ${row.width}x${row.height} Flat`
      quote.addItem({
        category: "flat",
        label,
        qty: row.qty,
        unitCost: row.result.grandTotal / row.qty,
        total: row.result.grandTotal,
        metadata: {
          pieceDimensions: `${row.width}x${row.height}`,
          paperName: row.paper,
          sides: row.sides,
          hasBleed: row.hasBleed,
          sheetSize: row.result.selectedSheet,
          calculatorInputs: {
            qty: row.qty,
            width: row.width,
            height: row.height,
            paperName: row.paper,
            sidesValue: row.sides,
            hasBleed: row.hasBleed,
          },
        },
      })

      updateRow(id, { addedToQuote: true })
    },
    [rows, quote, updateRow]
  )

  // Add new row
  const addRow = useCallback(() => {
    if (rows.length >= 10) return
    setRows((prev) => [...prev, createEmptyRow()])
  }, [rows.length])

  // Remove row
  const removeRow = useCallback((id: string) => {
    if (rows.length <= 1) return
    setRows((prev) => prev.filter((r) => r.id !== id))
  }, [rows.length])

  // Calculate all incomplete rows
  const calculateAll = useCallback(() => {
    rows.forEach((row) => {
      if (!row.result && row.qty > 0 && row.width > 0 && row.height > 0 && row.paper && row.sides) {
        calculateRow(row.id)
      }
    })
  }, [rows, calculateRow])

  // Get available sides for a paper
  const getSidesForPaper = useCallback((paperName: string) => {
    return getAvailableSides(paperName)
  }, [])

  // Summary stats
  const stats = useMemo(() => {
    const calculated = rows.filter((r) => r.result)
    const added = rows.filter((r) => r.addedToQuote)
    const total = calculated.reduce((sum, r) => sum + (r.result?.grandTotal || 0), 0)
    return { calculated: calculated.length, added: added.length, total }
  }, [rows])

  return (
    <div className="flex flex-col gap-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Quick Entry</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Fast batch pricing — fill basics, get instant quotes</p>
        </div>
        {rows.some((r) => !r.result && r.qty > 0 && r.width > 0 && r.height > 0) && (
          <Button size="sm" variant="outline" onClick={calculateAll} className="gap-1.5">
            <Calculator className="h-3.5 w-3.5" />
            Calculate All
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[1.5fr_80px_55px_55px_140px_70px_90px_70px_60px] gap-2 px-4 py-2.5 border-b border-border bg-muted/30 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          <span>Description</span>
          <span>Qty</span>
          <span>W</span>
          <span>H</span>
          <span>Paper</span>
          <span>Sides</span>
          <span className="text-right">Total</span>
          <span className="text-right">Per Pc</span>
          <span></span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border/50">
          {rows.map((row, idx) => (
            <QuickEntryRowItem
              key={row.id}
              row={row}
              index={idx}
              onUpdate={(updates) => updateRow(row.id, updates)}
              onCalculate={() => calculateRow(row.id)}
              onAddToQuote={() => addRowToQuote(row.id)}
              onRemove={rows.length > 1 ? () => removeRow(row.id) : undefined}
              paperOptions={paperOptions}
              getSidesForPaper={getSidesForPaper}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-border bg-muted/20 flex items-center justify-between">
          <button
            type="button"
            onClick={addRow}
            disabled={rows.length >= 10}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Add row
          </button>

          {stats.calculated > 0 && (
            <div className="flex items-center gap-4 text-xs">
              <span className="text-muted-foreground">
                {stats.calculated} calculated · {stats.added} added
              </span>
              <span className="font-semibold tabular-nums">{formatCurrency(stats.total)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Single Row ───────────────────────────────────────────────────────────────
interface QuickEntryRowItemProps {
  row: QuickEntryRow
  index: number
  onUpdate: (updates: Partial<QuickEntryRow>) => void
  onCalculate: () => void
  onAddToQuote: () => void
  onRemove?: () => void
  paperOptions: { name: string }[]
  getSidesForPaper: (paper: string) => string[]
}

function QuickEntryRowItem({
  row,
  index,
  onUpdate,
  onCalculate,
  onAddToQuote,
  onRemove,
  paperOptions,
  getSidesForPaper,
}: QuickEntryRowItemProps) {
  const hasResult = row.result !== null
  const canCalculate = row.qty > 0 && row.width > 0 && row.height > 0 && row.paper && row.sides
  const sidesOptions = getSidesForPaper(row.paper)

  return (
    <div
      className={cn(
        "grid grid-cols-[1.5fr_80px_55px_55px_140px_70px_90px_70px_60px] gap-2 px-4 py-2 items-center",
        "hover:bg-muted/30 transition-colors",
        row.addedToQuote && "bg-emerald-50/40 dark:bg-emerald-950/15"
      )}
    >
      {/* Label */}
      <Input
        value={row.label}
        onChange={(e) => onUpdate({ label: e.target.value })}
        placeholder={`Item ${index + 1}`}
        className="h-8 text-sm border-transparent bg-transparent hover:border-border focus:border-border"
      />

      {/* Qty */}
      <Input
        type="number"
        value={row.qty || ""}
        onChange={(e) => onUpdate({ qty: parseInt(e.target.value) || 0 })}
        placeholder="500"
        className="h-8 text-sm font-mono"
      />

      {/* Width */}
      <Input
        type="number"
        step="0.125"
        value={row.width || ""}
        onChange={(e) => onUpdate({ width: parseFloat(e.target.value) || 0 })}
        placeholder="W"
        className="h-8 text-sm font-mono"
      />

      {/* Height */}
      <Input
        type="number"
        step="0.125"
        value={row.height || ""}
        onChange={(e) => onUpdate({ height: parseFloat(e.target.value) || 0 })}
        placeholder="H"
        className="h-8 text-sm font-mono"
      />

      {/* Paper */}
      <Select value={row.paper} onValueChange={(v) => onUpdate({ paper: v })}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Paper..." />
        </SelectTrigger>
        <SelectContent>
          {paperOptions.map((p) => (
            <SelectItem key={p.name} value={p.name} className="text-xs">
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Sides */}
      <Select value={row.sides} onValueChange={(v) => onUpdate({ sides: v })}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="..." />
        </SelectTrigger>
        <SelectContent>
          {sidesOptions.map((s) => (
            <SelectItem key={s} value={s} className="text-xs">
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Total */}
      <div className="text-right">
        {row.isCalculating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-auto" />
        ) : hasResult ? (
          <span className="text-sm font-semibold tabular-nums">{formatCurrency(row.result!.grandTotal)}</span>
        ) : canCalculate ? (
          <button type="button" onClick={onCalculate} className="text-xs text-primary hover:underline">
            Calc
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* Per Piece */}
      <div className="text-right">
        {hasResult ? (
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {formatCurrency(row.result!.grandTotal / row.qty)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* Action */}
      <div className="flex justify-end gap-1">
        {row.addedToQuote ? (
          <span className="text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4" />
          </span>
        ) : hasResult ? (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onAddToQuote}>
            Add
          </Button>
        ) : onRemove ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
