"use client"

import { formatCurrency, formatDecimal } from "@/lib/booklet-pricing"
import type { BookletCalcResult } from "@/lib/booklet-types"

interface BookletDetailsProps {
  result: BookletCalcResult
  bookQty: number
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

export function BookletDetails({ result, bookQty }: BookletDetailsProps) {
  const {
    insideResult, coverResult, totalSheetsPerBooklet,
    bindingPricePerBook, totalBindingPrice, laminationCostPerBook,
    totalLaminationCost, brokerDiscountAmount, brokerMinimumApplied,
    totalPrintingCost,
  } = result

  const hasCover = coverResult.paper !== "N/A" && coverResult.cost > 0

  return (
    <div className="flex flex-col">
      {/* Grand Total Banner */}
      <div className="bg-foreground text-background p-3 rounded-lg text-center mb-3">
        <p className="text-2xl font-bold">{formatCurrency(result.grandTotal)}</p>
        {bookQty > 0 && (
          <p className="text-sm text-background/70 mt-0.5">
            {formatCurrency(result.pricePerBook)} / booklet
          </p>
        )}
      </div>

      {/* Details Grid */}
      <div className="border border-border rounded-lg p-4 pt-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">

          {/* Cover Section */}
          {hasCover && (
            <div className="col-span-full">
              <SectionHeader label="Cover" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                <DetailRow label="Paper Size:" value={coverResult.sheetSize} />
                <DetailRow label="Max Ups:" value={String(coverResult.maxUps)} />
                <DetailRow label="Spread Size:" value={`${formatDecimal(result.spreadWidth)}x${formatDecimal(result.spreadHeight)}"`} />
                <DetailRow label="Cost Per Sheet:" value={formatCurrency(coverResult.pricePerSheet, 4)} />
                <DetailRow label="Level / Markup:" value={`${coverResult.level} / ${coverResult.markup.toFixed(2)}x`} />
                <DetailRow label="Total Sheets:" value={coverResult.sheets.toLocaleString()} />
                <DetailRow label="Total Printing:" value={formatCurrency(coverResult.cost)} />
              </div>
            </div>
          )}

          {/* Inside Pages Section */}
          <div className="col-span-full">
            <SectionHeader label="Inside Paper" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <DetailRow label="Paper Size:" value={insideResult.sheetSize} />
              <DetailRow label="Max Ups:" value={String(insideResult.maxUps)} />
              <DetailRow label="Cost Per Sheet:" value={formatCurrency(insideResult.pricePerSheet, 4)} />
              <DetailRow label="Level / Markup:" value={`${insideResult.level} / ${insideResult.markup.toFixed(2)}x`} />
              <DetailRow label="Total Sheets:" value={insideResult.sheets.toLocaleString()} />
              <DetailRow label="Total Printing:" value={formatCurrency(insideResult.cost)} />
            </div>
          </div>

          {/* Booklet Info */}
          <div className="col-span-full">
            <SectionHeader label="Booklet Info" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <DetailRow label="Sheets Per Booklet:" value={String(totalSheetsPerBooklet)} />
              <DetailRow label="Printing Per Booklet:" value={formatCurrency(bookQty > 0 ? totalPrintingCost / bookQty : 0)} />
              <DetailRow label="Binding Per Booklet:" value={formatCurrency(bindingPricePerBook)} />
              {totalLaminationCost > 0 && (
                <DetailRow label="Lamination Per Booklet:" value={formatCurrency(laminationCostPerBook)} />
              )}
            </div>
          </div>

          {/* Job Details */}
          <div className="col-span-full">
            <SectionHeader label="Job Details" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <DetailRow label="Total Printing:" value={formatCurrency(totalPrintingCost)} />
              <DetailRow label="Total Binding:" value={formatCurrency(totalBindingPrice)} />
              {brokerMinimumApplied && (
                <DetailRow label="Broker Min:" value={brokerMinimumApplied} />
              )}
              {totalLaminationCost > 0 && (
                <DetailRow label="Total Lamination:" value={formatCurrency(totalLaminationCost)} />
              )}
              {brokerDiscountAmount > 0 && (
                <DetailRow label="Broker Discount:" value={`- ${formatCurrency(brokerDiscountAmount)}`} />
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
