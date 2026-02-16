"use client"

import { CalcPriceCard, type CostLine, type PaperStat } from "@/components/calc-price-card"
import { formatCurrency } from "@/lib/pricing"
import type { SpiralCalcResult } from "@/lib/spiral-types"

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

interface SpiralDetailsProps {
  result: SpiralCalcResult
  onLevelChange?: (delta: number) => void
  onEffectiveTotalChange?: (total: number) => void
}

export function SpiralDetails({ result, onLevelChange, onEffectiveTotalChange }: SpiralDetailsProps) {
  const {
    insideResult, frontResult, backResult, sheetsPerBook,
    totalPrintingCost, bindingPricePerBook, totalBindingPrice,
    extraCoversCostPerBook, totalExtrasCost, bookQty,
  } = result

  const levelNum = parseLevelNum(result.levelName)

  const stats: PaperStat[] = [
    { label: "Sheet", value: insideResult.sheetSize },
    { label: "Ups", value: String(insideResult.maxUps) },
    { label: "Sheets", value: insideResult.sheets.toLocaleString() },
  ]

  const costLines: CostLine[] = [
    { label: "Printing", value: totalPrintingCost },
    { label: "Binding", value: totalBindingPrice },
  ]
  if (totalExtrasCost > 0) {
    costLines.push({ label: "Cover Sets", value: totalExtrasCost })
  }

  const expandedDetails = (
    <div className="flex flex-col gap-1">
      <SectionHeader label="Inside Paper" />
      <div className="grid grid-cols-2 gap-x-6">
        <DetailRow label="Paper:" value={insideResult.paper} />
        <DetailRow label="Paper Size:" value={insideResult.sheetSize} />
        <DetailRow label="Max Ups:" value={String(insideResult.maxUps)} />
        <DetailRow label="Cost/Sheet:" value={formatCurrency(insideResult.pricePerSheet, 4)} />
        <DetailRow label="Total Sheets:" value={insideResult.sheets.toLocaleString()} />
        <DetailRow label="Total Printing:" value={formatCurrency(insideResult.cost)} />
      </div>

      {frontResult && (
        <>
          <SectionHeader label="Front Cover" />
          <div className="grid grid-cols-2 gap-x-6">
            <DetailRow label="Paper:" value={frontResult.paper} />
            <DetailRow label="Paper Size:" value={frontResult.sheetSize} />
            <DetailRow label="Max Ups:" value={String(frontResult.maxUps)} />
            <DetailRow label="Cost/Sheet:" value={formatCurrency(frontResult.pricePerSheet, 4)} />
            <DetailRow label="Total Sheets:" value={frontResult.sheets.toLocaleString()} />
            <DetailRow label="Total Printing:" value={formatCurrency(frontResult.cost)} />
          </div>
        </>
      )}

      {backResult && (
        <>
          <SectionHeader label="Back Cover" />
          <div className="grid grid-cols-2 gap-x-6">
            <DetailRow label="Paper:" value={backResult.paper} />
            <DetailRow label="Paper Size:" value={backResult.sheetSize} />
            <DetailRow label="Max Ups:" value={String(backResult.maxUps)} />
            <DetailRow label="Cost/Sheet:" value={formatCurrency(backResult.pricePerSheet, 4)} />
            <DetailRow label="Total Sheets:" value={backResult.sheets.toLocaleString()} />
            <DetailRow label="Total Printing:" value={formatCurrency(backResult.cost)} />
          </div>
        </>
      )}

      <SectionHeader label="Book Info" />
      <div className="grid grid-cols-2 gap-x-6">
        <DetailRow label="Sheets/Book:" value={String(sheetsPerBook)} />
        <DetailRow label="Printing/Book:" value={formatCurrency(bookQty > 0 ? totalPrintingCost / bookQty : 0)} />
        <DetailRow label="Binding/Book:" value={formatCurrency(bindingPricePerBook)} />
        {extraCoversCostPerBook > 0 && (
          <DetailRow label="Cover Set/Book:" value={formatCurrency(extraCoversCostPerBook)} />
        )}
      </div>
    </div>
  )

  return (
    <CalcPriceCard
      total={result.grandTotal}
      perUnitLabel="/ book"
      perUnitCost={result.pricePerBook}
      paperName={insideResult.paper}
      stats={stats}
      level={{
        level: levelNum,
        maxLevel: 10,
        markup: 0, // spiral doesn't expose a multiplier
        pricePerSheet: insideResult.pricePerSheet,
        onLevelChange,
      }}
      costLines={costLines}
      details={expandedDetails}
      onEffectiveTotalChange={onEffectiveTotalChange}
    />
  )
}
