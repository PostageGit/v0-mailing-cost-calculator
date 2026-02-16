"use client"

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

function formatPriceByLevel(price: number, levelName: string): string {
  const num = parseInt(levelName.replace("Level ", ""), 10)
  if (isNaN(num) || num <= 6) return price.toFixed(2)
  if (num === 7) return price.toFixed(3)
  return price.toFixed(4)
}

interface SpiralDetailsProps {
  result: SpiralCalcResult
}

export function SpiralDetails({ result }: SpiralDetailsProps) {
  const {
    insideResult, frontResult, backResult, sheetsPerBook,
    totalPrintingCost, bindingPricePerBook, totalBindingPrice,
    extraCoversCostPerBook, totalExtrasCost, bookQty,
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

          {/* Inside Paper */}
          <div className="col-span-full">
            <SectionHeader label="Inside Paper" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <DetailRow label="Paper:" value={insideResult.paper} />
              <DetailRow label="Paper Size:" value={insideResult.sheetSize} />
              <DetailRow label="Max Ups:" value={String(insideResult.maxUps)} />
              <DetailRow label="Cost Per Sheet:" value={`$${formatPriceByLevel(insideResult.pricePerSheet, insideResult.levelName)}`} />
              <DetailRow label="Total Sheets:" value={insideResult.sheets.toLocaleString()} />
              <DetailRow label="Total Printing:" value={formatCurrency(insideResult.cost)} />
            </div>
          </div>

          {/* Front Cover */}
          {frontResult && (
            <div className="col-span-full">
              <SectionHeader label="Front Cover" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                <DetailRow label="Paper:" value={frontResult.paper} />
                <DetailRow label="Paper Size:" value={frontResult.sheetSize} />
                <DetailRow label="Max Ups:" value={String(frontResult.maxUps)} />
                <DetailRow label="Cost Per Sheet:" value={`$${formatPriceByLevel(frontResult.pricePerSheet, frontResult.levelName)}`} />
                <DetailRow label="Total Sheets:" value={frontResult.sheets.toLocaleString()} />
                <DetailRow label="Total Printing:" value={formatCurrency(frontResult.cost)} />
              </div>
            </div>
          )}

          {/* Back Cover */}
          {backResult && (
            <div className="col-span-full">
              <SectionHeader label="Back Cover" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                <DetailRow label="Paper:" value={backResult.paper} />
                <DetailRow label="Paper Size:" value={backResult.sheetSize} />
                <DetailRow label="Max Ups:" value={String(backResult.maxUps)} />
                <DetailRow label="Cost Per Sheet:" value={`$${formatPriceByLevel(backResult.pricePerSheet, backResult.levelName)}`} />
                <DetailRow label="Total Sheets:" value={backResult.sheets.toLocaleString()} />
                <DetailRow label="Total Printing:" value={formatCurrency(backResult.cost)} />
              </div>
            </div>
          )}

          {/* Book Info */}
          <div className="col-span-full">
            <SectionHeader label="Book Info" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <DetailRow label="Sheets Per Book:" value={String(sheetsPerBook)} />
              <DetailRow label="Printing Per Book:" value={formatCurrency(bookQty > 0 ? totalPrintingCost / bookQty : 0)} />
              <DetailRow label="Binding Per Book:" value={formatCurrency(bindingPricePerBook)} />
              {extraCoversCostPerBook > 0 && (
                <DetailRow label="Cover Set Per Book:" value={formatCurrency(extraCoversCostPerBook)} />
              )}
            </div>
          </div>

          {/* Job Details */}
          <div className="col-span-full">
            <SectionHeader label="Job Details" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <DetailRow label="Level:" value={result.levelName} />
              <DetailRow label="Total Printing:" value={formatCurrency(totalPrintingCost)} />
              <DetailRow label="Total Binding:" value={formatCurrency(totalBindingPrice)} />
              {totalExtrasCost > 0 && (
                <DetailRow label="Total Cover Sets:" value={formatCurrency(totalExtrasCost)} />
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
