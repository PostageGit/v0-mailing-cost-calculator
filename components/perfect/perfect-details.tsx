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

  // Calculate totals for Production Material Cost section
  const totalPaperCost = coverResult.totalPaperCost + insideResult.totalPaperCost
  const totalClickCost = coverResult.totalClickCost + insideResult.totalClickCost
  const totalMaterialCost = totalPaperCost + totalClickCost

  const expandedDetails = (
    <div className="flex flex-col gap-2">
      {/* PRODUCTION MATERIAL COST - P/L Section */}
      <div className="border-2 border-primary/20 rounded-lg p-3 bg-primary/5">
        <div className="text-xs font-bold uppercase tracking-wider text-primary text-center mb-2">
          Production Material Cost
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-primary/20">
              <th className="text-left py-1 font-medium text-muted-foreground">Item</th>
              <th className="text-right py-1 font-medium text-muted-foreground">Paper</th>
              <th className="text-right py-1 font-medium text-muted-foreground">Click</th>
              <th className="text-right py-1 font-medium text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-muted/50">
              <td className="py-1">Cover ({coverResult.sheets.toLocaleString()} sht)</td>
              <td className="text-right">{formatCurrency(coverResult.totalPaperCost)}</td>
              <td className="text-right">{formatCurrency(coverResult.totalClickCost)}</td>
              <td className="text-right font-medium">{formatCurrency(coverResult.totalPaperCost + coverResult.totalClickCost)}</td>
            </tr>
            <tr className="border-b border-muted/50">
              <td className="py-1">Inside ({insideResult.sheets.toLocaleString()} sht)</td>
              <td className="text-right">{formatCurrency(insideResult.totalPaperCost)}</td>
              <td className="text-right">{formatCurrency(insideResult.totalClickCost)}</td>
              <td className="text-right font-medium">{formatCurrency(insideResult.totalPaperCost + insideResult.totalClickCost)}</td>
            </tr>
            <tr className="bg-primary/10 font-semibold">
              <td className="py-1.5">TOTAL</td>
              <td className="text-right">{formatCurrency(totalPaperCost)}</td>
              <td className="text-right">{formatCurrency(totalClickCost)}</td>
              <td className="text-right">{formatCurrency(totalMaterialCost)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* CALCULATION DETAILS */}
      <div className="border rounded-lg p-3 bg-muted/20">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-center mb-2">
          Calculation Details
        </div>
        
        <div className="mb-2">
          <div className="text-[10px] font-semibold text-muted-foreground mb-1">Cover</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div><span className="text-muted-foreground">Paper:</span> {coverResult.paper}</div>
            <div><span className="text-muted-foreground">Size:</span> {coverResult.sheetSize}</div>
            <div><span className="text-muted-foreground">Ups:</span> {coverResult.maxUps}</div>
            <div><span className="text-muted-foreground">$/sht:</span> {formatCurrency(coverResult.pricePerSheet, 4)}</div>
            <div><span className="text-muted-foreground">Markup:</span> {coverResult.markup.toFixed(2)}x</div>
            <div><span className="text-muted-foreground">Total:</span> {formatCurrency(coverResult.cost)}</div>
          </div>
        </div>
        
        <div className="mb-2">
          <div className="text-[10px] font-semibold text-muted-foreground mb-1">Inside</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div><span className="text-muted-foreground">Paper:</span> {insideResult.paper}</div>
            <div><span className="text-muted-foreground">Size:</span> {insideResult.sheetSize}</div>
            <div><span className="text-muted-foreground">Ups:</span> {insideResult.maxUps}</div>
            <div><span className="text-muted-foreground">$/sht:</span> {formatCurrency(insideResult.pricePerSheet, 4)}</div>
            <div><span className="text-muted-foreground">Markup:</span> {insideResult.markup.toFixed(2)}x</div>
            <div><span className="text-muted-foreground">Total:</span> {formatCurrency(insideResult.cost)}</div>
          </div>
        </div>

        <div className="border-t border-muted pt-2 mt-2">
          <div className="text-[10px] font-semibold text-muted-foreground mb-1">Per Book</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div><span className="text-muted-foreground">Sheets:</span> {finishedSheetsPerBook}</div>
            <div><span className="text-muted-foreground">Printing:</span> {formatCurrency(bookQty > 0 ? totalPrintingCost / bookQty : 0)}</div>
            <div><span className="text-muted-foreground">Binding:</span> {formatCurrency(bindingPricePerBook)}</div>
            {totalLaminationCost > 0 && (
              <div><span className="text-muted-foreground">Lamination:</span> {formatCurrency(laminationCostPerBook)}</div>
            )}
            <div><span className="text-muted-foreground">Spine:</span> {result.spineWidth.toFixed(3)}"</div>
          </div>
        </div>
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
