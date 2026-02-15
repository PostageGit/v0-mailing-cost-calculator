"use client"

import { useState } from "react"
import useSWR from "swr"
import { Badge } from "@/components/ui/badge"
import { Check, Calculator } from "lucide-react"
import { formatCurrency } from "@/lib/pricing"
import type {
  FinishingCalculator,
  FinishingGlobalRates,
  CalculatorTarget,
} from "@/lib/finishing-calculator-types"
import { calculateFinishingTotal } from "@/lib/finishing-calculator-types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export interface SelectedFinishingCalc {
  id: string
  name: string
  total: number
  breakdown: { material: number; labor: number; setup: number; running: number }
}

interface FinishingAddOnsProps {
  /** Which calculator page is this? */
  target: CalculatorTarget
  /** Quantity -- cut items or parent sheets depending on finishing.apply_per */
  cutItems: number
  parentSheets: number
  isBroker: boolean
  /** Currently selected finishing calc IDs */
  selectedIds: string[]
  /** Called when selection changes */
  onSelectionChange: (ids: string[]) => void
  /** Called with computed totals whenever selection or quantity changes */
  onTotalsChange?: (finishings: SelectedFinishingCalc[]) => void
}

export function FinishingAddOns({
  target,
  cutItems,
  parentSheets,
  isBroker,
  selectedIds,
  onSelectionChange,
  onTotalsChange,
}: FinishingAddOnsProps) {
  const { data: allCalcs } = useSWR<FinishingCalculator[]>("/api/finishing-calculators", fetcher)
  const { data: rates } = useSWR<FinishingGlobalRates>("/api/finishing-global-rates", fetcher)

  // Filter to only finishings pushed to this calculator
  const available = (allCalcs || []).filter(
    (c) => c.is_active && (c.enabled_calculators || []).includes(target),
  )

  const toggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id]
    onSelectionChange(next)

    // Compute totals for all selected
    if (onTotalsChange && rates) {
      const selected = (allCalcs || []).filter((c) => next.includes(c.id))
      const totals = selected.map((c) => {
        const qty = c.apply_per === "cut_item" ? cutItems : parentSheets
        const result = calculateFinishingTotal(c, rates, qty, isBroker)
        return {
          id: c.id,
          name: c.name,
          total: result.total,
          breakdown: {
            material: result.material,
            labor: result.labor,
            setup: result.setup,
            running: result.running,
          },
        }
      })
      onTotalsChange(totals)
    }
  }

  if (available.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Calculator className="h-3 w-3 text-muted-foreground" />
        <label className="text-xs font-medium text-muted-foreground">Finishing Add-Ons</label>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {available.map((fc) => {
          const selected = selectedIds.includes(fc.id)
          const qty = fc.apply_per === "cut_item" ? cutItems : parentSheets
          const price =
            rates && qty > 0
              ? formatCurrency(calculateFinishingTotal(fc, rates, qty, isBroker).total)
              : null

          return (
            <button
              key={fc.id}
              type="button"
              onClick={() => toggle(fc.id)}
              className={`relative flex flex-col items-start rounded-lg border p-2.5 text-left transition-all ${
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              {selected && (
                <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-2.5 w-2.5 text-primary-foreground" />
                </div>
              )}
              <span
                className={`text-xs font-semibold ${selected ? "text-primary" : "text-foreground"}`}
              >
                {fc.name}
              </span>
              <Badge
                variant="outline"
                className="text-[9px] px-1 mt-1 border-0 bg-muted/50"
              >
                {fc.apply_per === "cut_item" ? "Per item" : "Per sheet"}
              </Badge>
              {price && (
                <span
                  className={`text-[10px] mt-1 font-mono ${selected ? "text-primary/80" : "text-muted-foreground"}`}
                >
                  {price}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Utility: compute finishing totals for given selections.
 * Use this in buildFullResult to include finishing calc costs.
 */
export function computeFinishingCalcTotals(
  allCalcs: FinishingCalculator[],
  rates: FinishingGlobalRates,
  selectedIds: string[],
  cutItems: number,
  parentSheets: number,
  isBroker: boolean,
): SelectedFinishingCalc[] {
  return allCalcs
    .filter((c) => selectedIds.includes(c.id) && c.is_active)
    .map((c) => {
      const qty = c.apply_per === "cut_item" ? cutItems : parentSheets
      const result = calculateFinishingTotal(c, rates, qty, isBroker)
      return {
        id: c.id,
        name: c.name,
        total: result.total,
        breakdown: {
          material: result.material,
          labor: result.labor,
          setup: result.setup,
          running: result.running,
        },
      }
    })
}
