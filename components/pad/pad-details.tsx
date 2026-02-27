"use client"

import { CalcPriceCard, type CostLine, type PaperStat } from "@/components/calc-price-card"
import { formatCurrency } from "@/lib/pricing"
import type { PadCalcResult } from "@/lib/pad-types"

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold text-foreground">{value}</span>
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-foreground text-center bg-muted px-3 py-1 rounded-full mt-3 first:mt-0 mb-1">
      {label}
    </div>
  )
}

function parseLevelNum(levelName: string): number {
  const num = parseInt(levelName.replace("Level ", ""), 10)
  return isNaN(num) ? 5 : num
}

interface PadDetailsProps {
  result: PadCalcResult
  onLevelChange?: (delta: number) => void
  onEffectiveTotalChange?: (total: number) => void
}

export function PadDetails({ result, onLevelChange, onEffectiveTotalChange }: PadDetailsProps) {
  const {
    insideResult, sheetsPerPad,
    totalPrintingCost, paddingRate, totalPaddingCost,
    setupCharge, chipBoardCost, padQty,
  } = result

  const levelNum = parseLevelNum(result.levelName)

  const stats: PaperStat[] = [
    { label: "Sheet", value: insideResult.sheetSize },
    { label: "Ups", value: String(insideResult.maxUps) },
    { label: "Sheets", value: insideResult.sheets.toLocaleString() },
  ]

  const costLines: CostLine[] = [
    { label: "Printing", value: totalPrintingCost },
    { label: `Padding (${padQty} x ${formatCurrency(paddingRate)})`, value: totalPaddingCost },
    { label: "Setup Charge", value: setupCharge },
  ]
  if (chipBoardCost > 0) {
    costLines.push({
      label: `Chip Board (${padQty} x ${formatCurrency(result.settings.chipBoardPerPad)})`,
      value: chipBoardCost,
    })
  }

  const expandedDetails = (
    <div className="flex flex-col gap-1">
      <SectionHeader label="Inside Pages" />
      <div className="grid grid-cols-2 gap-x-6">
        <DetailRow label="Paper:" value={insideResult.paper} />
        <DetailRow label="Paper Size:" value={insideResult.sheetSize} />
        <DetailRow label="Max Ups:" value={String(insideResult.maxUps)} />
        <DetailRow label="Cost/Sheet:" value={formatCurrency(insideResult.pricePerSheet, 4)} />
        <DetailRow label="Total Sheets:" value={insideResult.sheets.toLocaleString()} />
        <DetailRow label="Total Printing:" value={formatCurrency(insideResult.cost)} />
      </div>

      <SectionHeader label="Pad Finishing" />
      <div className="grid grid-cols-2 gap-x-6">
        <DetailRow label="Sheets/Pad:" value={String(sheetsPerPad)} />
        <DetailRow label="Padding Rate:" value={`${formatCurrency(paddingRate)}/pad`} />
        <DetailRow label="Total Padding:" value={formatCurrency(totalPaddingCost)} />
        <DetailRow label="Setup:" value={formatCurrency(setupCharge)} />
        {chipBoardCost > 0 && (
          <>
            <DetailRow label="Chip Board/Pad:" value={formatCurrency(result.settings.chipBoardPerPad)} />
            <DetailRow label="Total Chip Board:" value={formatCurrency(chipBoardCost)} />
          </>
        )}
        <DetailRow label="Printing/Pad:" value={formatCurrency(padQty > 0 ? totalPrintingCost / padQty : 0)} />
      </div>
    </div>
  )

  return (
    <CalcPriceCard
      total={result.grandTotal}
      perUnitLabel="/ pad"
      perUnitCost={result.pricePerPad}
      paperName={insideResult.paper}
      stats={stats}
      level={{
        level: levelNum,
        defaultLevel: levelNum, // pad auto-calculates
        maxLevel: 10,
        markup: 0,
        pricePerSheet: insideResult.pricePerSheet,
        onLevelChange,
      }}
      costLines={costLines}
      details={expandedDetails}
      onEffectiveTotalChange={onEffectiveTotalChange}
    />
  )
}
