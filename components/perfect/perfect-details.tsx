"use client"

import { CalcPriceCard, type CostLine, type PaperStat } from "@/components/calc-price-card"
import { formatCurrency } from "@/lib/pricing"
import type { PerfectCalcResult } from "@/lib/perfect-types"

interface PerfectDetailsProps {
  result: PerfectCalcResult
  onLevelChange?: (delta: number) => void
  onEffectiveTotalChange?: (total: number) => void
  onBrokerChange?: (value: boolean) => void
}

export function PerfectDetails({ result, onLevelChange, onEffectiveTotalChange, onBrokerChange }: PerfectDetailsProps) {
  const {
    coverResult, insideResult, insideSectionResults, finishedSheetsPerBook,
    totalPrintingCost, bindingPricePerBook, totalBindingPrice,
    laminationCostPerBook, totalLaminationCost,
    brokerDiscountAmount, bookQty, isBroker,
  } = result
  
  const usingSections = insideSectionResults && insideSectionResults.length > 0

  const stats: PaperStat[] = usingSections
    ? [
        { label: "Sections", value: String(insideSectionResults.length) },
        { label: "Total Sheets", value: insideSectionResults.reduce((sum, s) => sum + s.sheets, 0).toLocaleString() },
      ]
    : [
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
  const insidePaperCost = usingSections 
    ? insideSectionResults.reduce((sum, s) => sum + s.totalPaperCost, 0)
    : insideResult.totalPaperCost
  const insideClickCost = usingSections
    ? insideSectionResults.reduce((sum, s) => sum + s.totalClickCost, 0)
    : insideResult.totalClickCost
  const totalPaperCost = coverResult.totalPaperCost + insidePaperCost
  const totalClickCost = coverResult.totalClickCost + insideClickCost
  const totalMaterialCost = totalPaperCost + totalClickCost

  // Simple summary - detailed section info is now in the form
  const summaryTable = (
    <div className="text-xs space-y-1.5">
      <div className="flex justify-between items-center py-1 border-b border-muted/50">
        <span className="font-medium">Cover</span>
        <span className="text-muted-foreground">
          {coverResult.sheets.toLocaleString()} sht · {coverResult.sheetSize} · {coverResult.maxUps} up · <span className="font-semibold text-foreground">{formatCurrency(coverResult.cost)}</span>
        </span>
      </div>
      {usingSections ? (
        insideSectionResults.map((section, idx) => (
          <div key={idx} className="flex justify-between items-center py-1 border-b border-muted/50">
            <span className="font-medium">Sec {idx + 1}: {section.paper}</span>
            <span className="text-muted-foreground">
              {section.sheets.toLocaleString()} sht · {section.sheetSize} · {section.maxUps} up · <span className="font-semibold text-foreground">{formatCurrency(section.cost)}</span>
            </span>
          </div>
        ))
      ) : (
        <div className="flex justify-between items-center py-1 border-b border-muted/50">
          <span className="font-medium">Inside</span>
          <span className="text-muted-foreground">
            {insideResult.sheets.toLocaleString()} sht · {insideResult.sheetSize} · {insideResult.maxUps} up · <span className="font-semibold text-foreground">{formatCurrency(insideResult.cost)}</span>
          </span>
        </div>
      )}
    </div>
  )

  const expandedDetails = (
    <div className="flex flex-col gap-2">
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
            {usingSections ? (
              insideSectionResults.map((section, idx) => (
                <tr key={idx} className="border-b border-muted/50">
                  <td className="py-1">Sec {idx + 1}: {section.paper} ({section.sheets.toLocaleString()} sht)</td>
                  <td className="text-right">{formatCurrency(section.totalPaperCost)}</td>
                  <td className="text-right">{formatCurrency(section.totalClickCost)}</td>
                  <td className="text-right font-medium">{formatCurrency(section.totalPaperCost + section.totalClickCost)}</td>
                </tr>
              ))
            ) : (
              <tr className="border-b border-muted/50">
                <td className="py-1">Inside ({insideResult.sheets.toLocaleString()} sht)</td>
                <td className="text-right">{formatCurrency(insideResult.totalPaperCost)}</td>
                <td className="text-right">{formatCurrency(insideResult.totalClickCost)}</td>
                <td className="text-right font-medium">{formatCurrency(insideResult.totalPaperCost + insideResult.totalClickCost)}</td>
              </tr>
            )}
            <tr className="bg-primary/10 font-semibold">
              <td className="py-1.5">TOTAL</td>
              <td className="text-right">{formatCurrency(totalPaperCost)}</td>
              <td className="text-right">{formatCurrency(totalClickCost)}</td>
              <td className="text-right">{formatCurrency(totalMaterialCost)}</td>
            </tr>
          </tbody>
        </table>
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
          <div><span className="text-muted-foreground">Spine:</span> {result.spineWidth.toFixed(3)}{'"'}</div>
        </div>
      </div>
    </div>
  )

  return (
    <CalcPriceCard
      total={result.grandTotal}
      perUnitLabel="/ book"
      perUnitCost={result.pricePerBook}
      paperName={usingSections 
        ? `${coverResult.paper} / ${insideSectionResults.length} sections`
        : `${coverResult.paper} / ${insideResult.paper}`}
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
      summaryTable={summaryTable}
      details={expandedDetails}
      onEffectiveTotalChange={onEffectiveTotalChange}
      isBroker={isBroker}
      onBrokerChange={onBrokerChange}
    />
  )
}
