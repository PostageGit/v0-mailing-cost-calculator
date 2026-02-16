"use client"

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

function formatPriceByLevel(price: number, level: number): string {
  if (level <= 6) return price.toFixed(2)
  if (level === 7) return price.toFixed(3)
  return price.toFixed(4)
}

interface PerfectDetailsProps {
  result: PerfectCalcResult
}

export function PerfectDetails({ result }: PerfectDetailsProps) {
  const {
    coverResult, insideResult, finishedSheetsPerBook,
    totalPrintingCost, bindingPricePerBook, totalBindingPrice,
    laminationCostPerBook, totalLaminationCost,
    brokerDiscountAmount, bookQty, isBroker,
  } = result

  return (
    <div className="flex flex-col">
      {/* Grand Total Banner */}
      <div className="bg-foreground text-background p-3 rounded-lg text-center mb-3">
        <p className="text-2xl font-bold">{formatCurrency(result.grandTotal)}</p>
        {bookQty > 0 && (
          <p className="text-sm text-background/70 mt-0.5">
            {formatCurrency(result.pricePerBook)} / book
          </p>
        )}
      </div>

      {/* Details Grid */}
      <div className="border border-border rounded-lg p-4 pt-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">

          {/* Cover Details */}
          <div className="col-span-full">
            <SectionHeader label="Cover" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <DetailRow label="Level / Markup:" value={`${coverResult.level} / ${coverResult.markup.toFixed(2)}x`} />
              <DetailRow label="Max Ups:" value={String(coverResult.maxUps)} />
              <DetailRow label="Cost Per Sheet:" value={`$${formatPriceByLevel(coverResult.pricePerSheet, coverResult.level)}`} />
              <DetailRow label="Total Sheets:" value={coverResult.sheets.toLocaleString()} />
              <DetailRow label="Total Printing:" value={formatCurrency(coverResult.cost)} />
            </div>
          </div>

          {/* Inside Paper Details */}
          <div className="col-span-full">
            <SectionHeader label="Inside Paper" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <DetailRow label="Level / Markup:" value={`${insideResult.level} / ${insideResult.markup.toFixed(2)}x`} />
              <DetailRow label="Max Ups:" value={String(insideResult.maxUps)} />
              <DetailRow label="Cost Per Sheet:" value={`$${formatPriceByLevel(insideResult.pricePerSheet, insideResult.level)}`} />
              <DetailRow label="Total Sheets:" value={insideResult.sheets.toLocaleString()} />
              <DetailRow label="Total Printing:" value={formatCurrency(insideResult.cost)} />
            </div>
          </div>

          {/* Book Info */}
          <div className="col-span-full">
            <SectionHeader label="Book Info" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <DetailRow label="Sheets Per Book:" value={String(finishedSheetsPerBook)} />
              <DetailRow label="Printing Per Book:" value={formatCurrency(bookQty > 0 ? totalPrintingCost / bookQty : 0)} />
              <DetailRow label="Binding Per Book:" value={formatCurrency(bindingPricePerBook)} />
              {totalLaminationCost > 0 && (
                <DetailRow label="Lamination Per Book:" value={formatCurrency(laminationCostPerBook)} />
              )}
            </div>
          </div>

          {/* Job Details */}
          <div className="col-span-full">
            <SectionHeader label="Job Details" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <DetailRow label="Total Printing:" value={formatCurrency(totalPrintingCost)} />
              <DetailRow label="Total Binding:" value={formatCurrency(totalBindingPrice)} />
              {totalLaminationCost > 0 && (
                <DetailRow label="Total Lamination:" value={formatCurrency(totalLaminationCost)} />
              )}
              {isBroker && brokerDiscountAmount > 0 && (
                <DetailRow label="Broker Discount:" value={`- ${formatCurrency(brokerDiscountAmount)}`} />
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
