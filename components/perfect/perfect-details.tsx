"use client"

import { CalcPriceCard, type CostLine, type PaperStat } from "@/components/calc-price-card"
import { formatCurrency } from "@/lib/pricing"
import type { PerfectCalcResult } from "@/lib/perfect-types"

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

interface PerfectDetailsProps {
  result: PerfectCalcResult
  onLevelChange?: (delta: number) => void
  onEffectiveTotalChange?: (total: number) => void
  onBrokerChange?: (value: boolean) => void
}

export function PerfectDetails({ result, onLevelChange, onEffectiveTotalChange, onBrokerChange }: PerfectDetailsProps) {
  const {
    coverResult, insideResult, finishedSheetsPerBook,
    totalPrintingCost, bindingPricePerBook, totalBindingPrice,
    laminationCostPerBook, totalLaminationCost,
    brokerDiscountAmount, bookQty, isBroker,
  } = result

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
  if (isBroker && brokerDiscountAmount > 0) {
    costLines.push({ label: "Broker Discount", value: -brokerDiscountAmount })
  }

  const expandedDetails = (
    <div className="flex flex-col gap-1">
      <SectionHeader label="Cover" />
      <div className="grid grid-cols-2 gap-x-6">
        <DetailRow label="Paper:" value={coverResult.paper} />
        <DetailRow label="Paper Size:" value={coverResult.sheetSize} />
        <DetailRow label="Level / Markup:" value={`${coverResult.level} / ${coverResult.markup.toFixed(2)}x`} />
        <DetailRow label="Max Ups:" value={String(coverResult.maxUps)} />
        <DetailRow label="Cost/Sheet:" value={formatCurrency(coverResult.pricePerSheet, 4)} />
        <DetailRow label="Total Sheets:" value={coverResult.sheets.toLocaleString()} />
        <DetailRow label="Total Printing:" value={formatCurrency(coverResult.cost)} />
      </div>
      <SectionHeader label="Cover P/L Breakdown" />
      <div className="grid grid-cols-2 gap-x-6 bg-muted/30 rounded p-2">
        <DetailRow label="Paper Cost/Sheet:" value={formatCurrency(coverResult.paperCostPerSheet, 4)} />
        <DetailRow label="Click Cost/Sheet:" value={formatCurrency(coverResult.clickCostPerSheet, 4)} />
        <DetailRow label="Total Paper Cost:" value={formatCurrency(coverResult.totalPaperCost)} />
        <DetailRow label="Total Click Cost:" value={formatCurrency(coverResult.totalClickCost)} />
      </div>

      <SectionHeader label="Inside Paper" />
      <div className="grid grid-cols-2 gap-x-6">
        <DetailRow label="Paper:" value={insideResult.paper} />
        <DetailRow label="Paper Size:" value={insideResult.sheetSize} />
        <DetailRow label="Level / Markup:" value={`${insideResult.level} / ${insideResult.markup.toFixed(2)}x`} />
        <DetailRow label="Max Ups:" value={String(insideResult.maxUps)} />
        <DetailRow label="Cost/Sheet:" value={formatCurrency(insideResult.pricePerSheet, 4)} />
        <DetailRow label="Total Sheets:" value={insideResult.sheets.toLocaleString()} />
        <DetailRow label="Total Printing:" value={formatCurrency(insideResult.cost)} />
      </div>
      <SectionHeader label="Inside P/L Breakdown" />
      <div className="grid grid-cols-2 gap-x-6 bg-muted/30 rounded p-2">
        <DetailRow label="Paper Cost/Sheet:" value={formatCurrency(insideResult.paperCostPerSheet, 4)} />
        <DetailRow label="Click Cost/Sheet:" value={formatCurrency(insideResult.clickCostPerSheet, 4)} />
        <DetailRow label="Total Paper Cost:" value={formatCurrency(insideResult.totalPaperCost)} />
        <DetailRow label="Total Click Cost:" value={formatCurrency(insideResult.totalClickCost)} />
      </div>

      <SectionHeader label="Book Info" />
      <div className="grid grid-cols-2 gap-x-6">
        <DetailRow label="Sheets/Book:" value={String(finishedSheetsPerBook)} />
        <DetailRow label="Printing/Book:" value={formatCurrency(bookQty > 0 ? totalPrintingCost / bookQty : 0)} />
        <DetailRow label="Binding/Book:" value={formatCurrency(bindingPricePerBook)} />
        {totalLaminationCost > 0 && (
          <DetailRow label="Lamination/Book:" value={formatCurrency(laminationCostPerBook)} />
        )}
        <DetailRow label="Spine Width:" value={`${result.spineWidth.toFixed(3)}"`} />
      </div>
    </div>
  )

  return (
    <CalcPriceCard
      total={result.grandTotal}
      perUnitLabel="/ book"
      perUnitCost={result.pricePerBook}
      paperName={`${coverResult.paper} / ${insideResult.paper}`}
      stats={stats}
      level={{
        level: insideResult.level,
        defaultLevel: insideResult.autoLevel ?? insideResult.level,
        maxLevel: 10,
        markup: insideResult.markup,
        pricePerSheet: insideResult.pricePerSheet,
        onLevelChange,
      }}
      costLines={costLines}
      details={expandedDetails}
      onEffectiveTotalChange={onEffectiveTotalChange}
      isBroker={isBroker}
      onBrokerChange={onBrokerChange}
    />
  )
}
