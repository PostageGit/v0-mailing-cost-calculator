"use client"

import { formatCurrency, formatVariableDecimal } from "@/lib/printing-pricing"
import type { FullPrintingResult } from "@/lib/printing-types"
import { ChevronDown, ChevronUp } from "lucide-react"

interface PriceBreakdownProps {
  data: FullPrintingResult
  onChangeSheet: () => void
  /** When provided the user can override the level (1-8) */
  onLevelChange?: (delta: number) => void
}

export function PriceBreakdown({ data, onChangeSheet, onLevelChange }: PriceBreakdownProps) {
  const {
    result, inputs, printingCostPlus10, cuttingCost,
    addOnCharge, addOnDescription,
    finishingCosts, scoreFoldCost, finishingCalcCosts,
    subtotal, grandTotal,
  } = data

  const pricePerPage = subtotal > 0 && inputs.qty > 0 ? subtotal / inputs.qty : 0
  const totalJobCuts = result.cuts.total > 0 ? result.cuts.total * result.numberOfStacks : 0

  // Collect ALL finishing into one flat list
  const allFinishing: { label: string; cost: number; color: string }[] = []
  if (finishingCosts?.length) {
    for (const fc of finishingCosts) {
      allFinishing.push({ label: fc.name, cost: fc.cost, color: "text-foreground" })
    }
  }
  if (scoreFoldCost) {
    allFinishing.push({
      label: `${scoreFoldCost.operation} (${scoreFoldCost.foldType})${scoreFoldCost.isMinApplied ? " min." : ""}`,
      cost: scoreFoldCost.cost,
      color: "text-foreground",
    })
  }
  if (finishingCalcCosts?.length) {
    for (const fc of finishingCalcCosts) {
      allFinishing.push({ label: fc.name, cost: fc.cost, color: "text-foreground" })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ── Hero total ── */}
      <div className="bg-foreground text-background rounded-2xl px-5 py-4 flex items-baseline justify-between">
        <div>
          <p className="text-3xl font-bold font-mono tracking-tight">{formatCurrency(subtotal)}</p>
          <p className="text-xs opacity-60 mt-0.5">{formatCurrency(pricePerPage, 4)} / page</p>
        </div>
        <button
          type="button"
          onClick={onChangeSheet}
          className="text-xs font-medium underline underline-offset-2 opacity-70 hover:opacity-100 transition-opacity"
        >
          Change Size
        </button>
      </div>

      {/* ── Paper + Level row ── */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Paper</span>
          <span className="text-sm font-semibold text-foreground">{inputs.paperName}</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Sheet" value={result.sheetSize} />
          <Stat label="Ups" value={String(result.maxUps)} />
          <Stat label="Sheets" value={result.sheets.toLocaleString()} />
        </div>
      </div>

      {/* ── Level control ── */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Level</span>
            <span className="ml-2 text-lg font-bold text-foreground font-mono">{result.level}</span>
            <span className="ml-1.5 text-xs text-muted-foreground">/ {result.markup.toFixed(2)}x markup</span>
          </div>
          {onLevelChange && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onLevelChange(-1)}
                disabled={result.level <= 1}
                className="h-8 w-8 rounded-lg border border-border bg-background flex items-center justify-center hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Decrease level"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onLevelChange(1)}
                disabled={result.level >= 8}
                className="h-8 w-8 rounded-lg border border-border bg-background flex items-center justify-center hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Increase level"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        <div className="mt-2 flex gap-1">
          {Array.from({ length: 8 }, (_, i) => i + 1).map((lvl) => (
            <div
              key={lvl}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                lvl <= result.level ? "bg-foreground" : "bg-border"
              }`}
            />
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          {formatVariableDecimal(result.pricePerSheet)} / sheet
        </p>
      </div>

      {/* ── Cost lines ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
        {/* Printing */}
        <CostRow
          label={result.wasPrintingMinApplied ? "Printing (min.)" : "Printing +10%"}
          value={printingCostPlus10}
        />

        {/* Cutting */}
        <CostRow
          label={`Cutting (${totalJobCuts} cuts)`}
          value={cuttingCost}
          sub={result.wasCuttingMinApplied ? "min. applied" : undefined}
        />

        {/* Each finishing on its own row */}
        {allFinishing.map((f, i) => (
          <CostRow key={i} label={f.label} value={f.cost} accent />
        ))}

        {/* Suggestion */}
        {scoreFoldCost?.suggestion && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/20">
            <p className="text-[10px] text-amber-700 dark:text-amber-400 italic">
              {scoreFoldCost.suggestion}
            </p>
          </div>
        )}

        {/* Add-on */}
        {addOnCharge > 0 && (
          <CostRow
            label={addOnDescription || "Add on"}
            value={addOnCharge}
          />
        )}

        {/* Grand Total */}
        <div className="px-4 py-3 bg-secondary/30 flex items-center justify-between">
          <span className="text-sm font-bold text-foreground">Total</span>
          <span className="text-sm font-bold text-foreground font-mono">{formatCurrency(grandTotal)}</span>
        </div>
      </div>
    </div>
  )
}

/* ── Small helpers ── */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-secondary/30 py-2 px-1">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-sm font-bold text-foreground font-mono leading-tight">{value}</span>
    </div>
  )
}

function CostRow({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent?: boolean }) {
  return (
    <div className="px-4 py-2.5 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <span className={`text-xs ${accent ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
          {label}
        </span>
        {sub && <span className="text-[10px] text-muted-foreground ml-1.5">({sub})</span>}
      </div>
      <span className={`text-xs font-semibold font-mono whitespace-nowrap ${accent ? "text-foreground" : "text-foreground"}`}>
        {accent ? "+" : ""}{formatCurrency(value)}
      </span>
    </div>
  )
}
