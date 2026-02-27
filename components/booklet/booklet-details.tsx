"use client"

import { CalcPriceCard, type CostLine, type PaperStat } from "@/components/calc-price-card"
import { formatCurrency, formatDecimal } from "@/lib/booklet-pricing"
import type { BookletCalcResult, BookletInputs } from "@/lib/booklet-types"

interface BookletDetailsProps {
  result: BookletCalcResult
  bookQty: number
  inputs: BookletInputs
  onLevelChange?: (delta: number) => void
  onEffectiveTotalChange?: (total: number) => void
}

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

export function BookletDetails({ result, bookQty, inputs, onLevelChange, onEffectiveTotalChange }: BookletDetailsProps) {
  const {
    insideResult, coverResult, totalSheetsPerBooklet,
    bindingPricePerBook, totalBindingPrice, laminationCostPerBook,
    totalLaminationCost, brokerDiscountAmount, brokerMinimumApplied,
    totalPrintingCost,
  } = result

  const hasCover = coverResult.paper !== "N/A" && coverResult.cost > 0
  const primaryPaper = hasCover ? coverResult.paper : insideResult.paper
  const primaryLevel = hasCover ? coverResult.level : insideResult.level
  const primaryMarkup = hasCover ? coverResult.markup : insideResult.markup
  const primaryPPS = hasCover ? coverResult.pricePerSheet : insideResult.pricePerSheet

  const stats: PaperStat[] = [
    { label: "Sheet", value: insideResult.sheetSize },
    { label: "Ups", value: String(insideResult.maxUps) },
    { label: "Sheets", value: insideResult.sheets.toLocaleString() },
  ]

  const costLines: CostLine[] = [
    { label: "Printing", value: totalPrintingCost },
    { label: "Binding", value: totalBindingPrice },
  ]
  if (totalLaminationCost > 0) {
    costLines.push({ label: "Lamination", value: totalLaminationCost })
  }
  if (brokerDiscountAmount > 0) {
    costLines.push({ label: "Broker Discount", value: -brokerDiscountAmount })
  }

  const expandedDetails = (
    <div className="flex flex-col gap-1">
      {hasCover && (
        <>
          <SectionHeader label="Cover" />
          <div className="grid grid-cols-2 gap-x-6">
            <DetailRow label="Paper:" value={coverResult.paper} />
            <DetailRow label="Paper Size:" value={coverResult.sheetSize} />
            <DetailRow label="Max Ups:" value={String(coverResult.maxUps)} />
            <DetailRow label="Level / Markup:" value={`${coverResult.level} / ${coverResult.markup.toFixed(2)}x`} />
            <DetailRow label="Spread:" value={`${formatDecimal(result.spreadWidth)}x${formatDecimal(result.spreadHeight)}"`} />
            <DetailRow label="Total Sheets:" value={coverResult.sheets.toLocaleString()} />
            <DetailRow label="Cost/Sheet:" value={formatCurrency(coverResult.pricePerSheet, 4)} />
            <DetailRow label="Total Printing:" value={formatCurrency(coverResult.cost)} />
          </div>
        </>
      )}
      <SectionHeader label="Inside Paper" />
      <div className="grid grid-cols-2 gap-x-6">
        <DetailRow label="Paper:" value={insideResult.paper} />
        <DetailRow label="Paper Size:" value={insideResult.sheetSize} />
        <DetailRow label="Max Ups:" value={String(insideResult.maxUps)} />
        <DetailRow label="Level / Markup:" value={`${insideResult.level} / ${insideResult.markup.toFixed(2)}x`} />
        <DetailRow label="Cost/Sheet:" value={formatCurrency(insideResult.pricePerSheet, 4)} />
        <DetailRow label="Total Sheets:" value={insideResult.sheets.toLocaleString()} />
        <DetailRow label="Total Printing:" value={formatCurrency(insideResult.cost)} />
      </div>
      <SectionHeader label="Booklet Info" />
      <div className="grid grid-cols-2 gap-x-6">
        <DetailRow label="Sheets/Book:" value={String(totalSheetsPerBooklet)} />
        <DetailRow label="Printing/Book:" value={formatCurrency(bookQty > 0 ? totalPrintingCost / bookQty : 0)} />
        <DetailRow label="Binding/Book:" value={formatCurrency(bindingPricePerBook)} />
        {totalLaminationCost > 0 && (
          <DetailRow label="Lamination/Book:" value={formatCurrency(laminationCostPerBook)} />
        )}
        {brokerMinimumApplied && (
          <DetailRow label="Broker Min:" value={brokerMinimumApplied} />
        )}
      </div>
    </div>
  )

  return (
    <CalcPriceCard
      total={result.grandTotal}
      perUnitLabel="/ booklet"
      perUnitCost={result.pricePerBook}
      paperName={primaryPaper}
      stats={stats}
      level={{
        level: primaryLevel,
        maxLevel: 10,
        markup: primaryMarkup,
        pricePerSheet: primaryPPS,
        onLevelChange,
      }}
      costLines={costLines}
      details={expandedDetails}
      onEffectiveTotalChange={onEffectiveTotalChange}
    />
  )
}
