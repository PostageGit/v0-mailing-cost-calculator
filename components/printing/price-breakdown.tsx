"use client"

import { CalcPriceCard, type CostLine, type PaperStat } from "@/components/calc-price-card"
import { formatCurrency } from "@/lib/printing-pricing"
import type { FullPrintingResult } from "@/lib/printing-types"
import { calcSheetWeightOz } from "@/lib/paper-weights"

interface PriceBreakdownProps {
  data: FullPrintingResult
  onChangeSheet: () => void
  onLevelChange?: (delta: number) => void
  onEffectiveTotalChange?: (total: number) => void
  isBroker?: boolean
  onBrokerChange?: (value: boolean) => void
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold text-foreground">{value}</span>
    </div>
  )
}

export function PriceBreakdown({ data, onChangeSheet, onLevelChange, onEffectiveTotalChange, isBroker, onBrokerChange }: PriceBreakdownProps) {
  const {
    result, inputs, printingCostPlus10, cuttingCost,
    addOnCharge, addOnDescription,
    finishingCosts, scoreFoldCost, laminationCost, finishingCalcCosts,
    subtotal, grandTotal,
  } = data

  const pricePerPage = subtotal > 0 && inputs.qty > 0 ? subtotal / inputs.qty : 0
  const totalJobCuts = result.cuts.total > 0 ? result.cuts.total * result.numberOfStacks : 0

  // Calculate weight per piece
  const pieceWeightOz = calcSheetWeightOz(inputs.paperName, inputs.width, inputs.height)

  const stats: PaperStat[] = [
    { label: "Sheet", value: result.sheetSize },
    { label: "Ups", value: String(result.maxUps) },
    { label: "Sheets", value: result.sheets.toLocaleString() },
  ]

  const costLines: CostLine[] = [
    {
      label: result.wasPrintingMinApplied ? "Printing (min.)" : "Printing",
      value: printingCostPlus10,
    },
    {
      label: `Cutting (${totalJobCuts} cuts)`,
      value: cuttingCost,
      sub: result.wasCuttingMinApplied ? "min. applied" : undefined,
    },
  ]

  // Finishing costs
  if (finishingCosts?.length) {
    for (const fc of finishingCosts) {
      costLines.push({ label: fc.name, value: fc.cost, accent: true })
    }
  }
  if (scoreFoldCost) {
    costLines.push({
      label: `${scoreFoldCost.operation} (${scoreFoldCost.foldType})${scoreFoldCost.isMinApplied ? " min." : ""}`,
      value: scoreFoldCost.cost,
      accent: true,
    })
  }
  const ffc = data.foldFinishCost
  if (ffc && ffc.sellPrice > 0) {
    const ftLabel = ffc.finishType === "fold" ? "Fold" : ffc.finishType === "score_and_fold" ? "Score & Fold" : "Score Only"
    costLines.push({
      label: `${ftLabel} (${ffc.foldType})${ffc.isMinApplied ? " min." : ""}${ffc.isLongSheet ? " +long" : ""}`,
      value: ffc.sellPrice,
      accent: true,
    })
  }
  if (laminationCost) {
    costLines.push({
      label: `${laminationCost.type} Lamination (${laminationCost.sides})${laminationCost.isMinimumApplied ? " min." : ""}`,
      value: laminationCost.cost,
      accent: true,
    })
  }
  if (finishingCalcCosts?.length) {
    for (const fc of finishingCalcCosts) {
      costLines.push({ label: fc.name, value: fc.cost, accent: true })
    }
  }
  if (addOnCharge > 0) {
    costLines.push({ label: addOnDescription || "Add on", value: addOnCharge })
  }

  // Expanded details
  const expandedDetails = (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-2 gap-x-6">
        <DetailRow label="Paper:" value={inputs.paperName} />
        <DetailRow label="Sides:" value={inputs.sidesValue} />
        <DetailRow label="Bleed:" value={inputs.hasBleed ? "Yes" : "No"} />
        <DetailRow label="Sheet Size:" value={result.sheetSize} />
        <DetailRow label="Max Ups:" value={String(result.maxUps)} />
        <DetailRow label="Total Sheets:" value={result.sheets.toLocaleString()} />
        <DetailRow label="Level:" value={String(result.level)} />
        <DetailRow label="Markup:" value={`${result.markup.toFixed(2)}x`} />
        <DetailRow label="Stacks:" value={String(result.numberOfStacks)} />
        {totalJobCuts > 0 && <DetailRow label="Total Cuts:" value={String(totalJobCuts)} />}
      </div>
      {scoreFoldCost?.suggestion && (
        <div className="mt-2 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-2">
          <p className="text-[10px] text-amber-700 dark:text-amber-400 italic">
            {scoreFoldCost.suggestion}
          </p>
        </div>
      )}
      {data.paperUpgradeSuggestion && (
        <div className="mt-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-2">
          <p className="text-[10px] text-emerald-700 dark:text-emerald-400 italic">
            Total job would be ${formatCurrency(data.paperUpgradeSuggestion.savings)} cheaper on{" "}
            {data.paperUpgradeSuggestion.paperName} (${formatCurrency(data.paperUpgradeSuggestion.upgradedTotal)} vs ${formatCurrency(data.paperUpgradeSuggestion.currentTotal)} -- includes printing + finishing)
          </p>
        </div>
      )}
      {ffc?.warnings && ffc.warnings.length > 0 && (
        <div className="mt-2 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-2 space-y-0.5">
          {ffc.warnings.map((w: string, i: number) => (
            <p key={i} className="text-[10px] text-amber-700 dark:text-amber-400 italic">{w}</p>
          ))}
        </div>
      )}
      {ffc?.foldedDimensions && (
        <div className="mt-1">
          <DetailRow label="Folded Size:" value={`${ffc.foldedDimensions.w.toFixed(2)}" x ${ffc.foldedDimensions.h.toFixed(2)}"`} />
        </div>
      )}
    </div>
  )

  return (
    <CalcPriceCard
      total={grandTotal}
      perUnitLabel="/ page"
      perUnitCost={pricePerPage}
      paperName={inputs.paperName}
      stats={stats}
      level={{
        level: result.level,
        defaultLevel: result.autoLevel,
        maxLevel: 10,
        markup: result.markup,
        pricePerSheet: result.pricePerSheet,
        onLevelChange,
      }}
      costLines={costLines}
      details={expandedDetails}
      onChangeSize={onChangeSheet}
      onEffectiveTotalChange={onEffectiveTotalChange}
      isBroker={isBroker}
      onBrokerChange={onBrokerChange}
      weightOz={pieceWeightOz ?? undefined}
      weightLabel="/ piece"
    />
  )
}
