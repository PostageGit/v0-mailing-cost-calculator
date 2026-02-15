"use client"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { formatCurrency, formatVariableDecimal } from "@/lib/printing-pricing"
import type { FullPrintingResult } from "@/lib/printing-types"

interface PriceBreakdownProps {
  data: FullPrintingResult
  onChangeSheet: () => void
}

function DetailRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-0.5 ${bold ? "font-bold" : ""}`}>
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-semibold text-foreground text-xs font-mono">{value}</span>
    </div>
  )
}

export function PriceBreakdown({ data, onChangeSheet }: PriceBreakdownProps) {
  const { result, inputs, printingCostPlus10, cuttingCost, addOnCharge, addOnDescription, finishingCosts, totalFinishing, scoreFoldCost, subtotal, grandTotal } = data
  const totalJobCuts = result.cuts.total > 0 ? result.cuts.total * result.numberOfStacks : 0
  const pricePerPage = subtotal > 0 && inputs.qty > 0 ? subtotal / inputs.qty : 0

  return (
    <div className="flex flex-col gap-4">
      {/* Change Sheet Size */}
      <div className="flex justify-end">
        <Button variant="link" size="sm" onClick={onChangeSheet} className="text-primary text-xs px-0">
          Change Sheet Size
        </Button>
      </div>

      {/* Grand Total Hero */}
      <div className="bg-foreground text-background p-4 rounded-lg text-center">
        <p className="text-3xl font-bold font-mono">{formatCurrency(subtotal)}</p>
        <p className="text-sm opacity-70 mt-1">{formatCurrency(pricePerPage, 4)} / page</p>
      </div>

      {/* Details Sections */}
      <div className="border border-border rounded-lg p-4 flex flex-col gap-3">
        {/* Paper Details */}
        <div>
          <h3 className="text-xs font-semibold text-foreground text-center bg-muted rounded px-2 py-1 mb-2">
            Paper Details
          </h3>
          <div className="grid grid-cols-2 gap-x-5">
            <DetailRow label="Paper:" value={inputs.paperName} />
            <DetailRow label="Paper Size:" value={result.sheetSize} />
            <DetailRow label="Max Ups:" value={String(result.maxUps)} />
            <DetailRow label="Total Sheets:" value={result.sheets.toLocaleString()} />
            <DetailRow label="Cost / Sheet:" value={formatVariableDecimal(result.pricePerSheet)} />
            <DetailRow
              label="Level / Markup:"
              value={`${result.level} / ${result.markup.toFixed(2)}x`}
            />
          </div>
        </div>

        <Separator />

        {/* Cutting Details */}
        <div>
          <h3 className="text-xs font-semibold text-foreground text-center bg-muted rounded px-2 py-1 mb-2">
            Cutting Details
          </h3>
          <div className="grid grid-cols-2 gap-x-5">
            <DetailRow label="Cuts / Sheet:" value={String(result.cuts.total)} />
            <DetailRow label="Stacks:" value={String(result.numberOfStacks)} />
            <DetailRow label="Total Cuts:" value={String(totalJobCuts)} />
          </div>
        </div>

        <Separator />

        {/* Totals */}
        <div>
          <h3 className="text-xs font-semibold text-foreground text-center bg-muted rounded px-2 py-1 mb-2">
            Totals
          </h3>
          <div className="grid grid-cols-2 gap-x-5">
            <DetailRow
              label={result.wasPrintingMinApplied ? "Total Printing:" : "Total Printing +10%:"}
              value={
                formatCurrency(printingCostPlus10) +
                (result.wasPrintingMinApplied ? " (min.)" : "")
              }
            />
            <DetailRow
              label="Total Cutting:"
              value={
                formatCurrency(cuttingCost) +
                (result.wasCuttingMinApplied ? " (min.)" : "")
              }
            />
            {finishingCosts && finishingCosts.length > 0 && finishingCosts.map((fc) => (
              <DetailRow
                key={fc.id}
                label={`${fc.name}:`}
                value={formatCurrency(fc.cost)}
              />
            ))}
            {scoreFoldCost && (
              <DetailRow
                label={`${scoreFoldCost.operation} (${scoreFoldCost.foldType}):`}
                value={
                  formatCurrency(scoreFoldCost.cost) +
                  (scoreFoldCost.isMinApplied ? " (min.)" : "")
                }
              />
            )}
            {scoreFoldCost?.suggestion && (
              <div className="col-span-2 text-[10px] text-amber-600 dark:text-amber-400 italic py-0.5">
                {scoreFoldCost.suggestion}
              </div>
            )}
            <DetailRow
              label={addOnDescription ? `${addOnDescription}:` : "Add on:"}
              value={formatCurrency(addOnCharge)}
            />
            <DetailRow label="Subtotal:" value={formatCurrency(subtotal)} />
            <DetailRow label="Grand Total:" value={formatCurrency(grandTotal)} bold />
          </div>
        </div>
      </div>
    </div>
  )
}
