"use client"

import { CalcPriceCard, type CostLine, type PaperStat } from "@/components/calc-price-card"
import { formatCurrency, formatDecimal } from "@/lib/booklet-pricing"
import type { BookletCalcResult, BookletInputs } from "@/lib/booklet-types"
import { calcSheetWeightOz } from "@/lib/paper-weights"

interface BookletDetailsProps {
  result: BookletCalcResult
  bookQty: number
  inputs: BookletInputs
  onLevelChange?: (delta: number) => void
  onEffectiveTotalChange?: (total: number) => void
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

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-foreground text-center bg-muted px-3 py-1 rounded-full mt-3 first:mt-0 mb-1">
      {label}
    </div>
  )
}

export function BookletDetails({ result, bookQty, inputs, onLevelChange, onEffectiveTotalChange, onBrokerChange }: BookletDetailsProps) {
  const {
    insideResult, coverResult, insertResults, totalSheetsPerBooklet,
    bindingPricePerBook, totalBindingPrice, insertFeeTotal,
    laminationCostPerBook, totalLaminationCost, brokerDiscountAmount,
    brokerMinimumApplied, totalPrintingCost,
  } = result

  const hasInserts = insertResults && insertResults.length > 0

  const hasCover = coverResult.paper !== "N/A" && coverResult.cost > 0
  const primaryPaper = hasCover ? coverResult.paper : insideResult.paper
  const primaryLevel = hasCover ? coverResult.level : insideResult.level
  // The "default" level should reflect the inside auto level because the cover is forced to match the inside level
  const primaryAutoLevel = insideResult.autoLevel ?? insideResult.level
  const primaryMarkup = hasCover ? coverResult.markup : insideResult.markup
  const primaryPPS = hasCover ? coverResult.pricePerSheet : insideResult.pricePerSheet

  // Calculate weight per booklet
  const bookletWeightOz = (() => {
    const { pageWidth, pageHeight, pagesPerBook } = inputs
    if (!pageWidth || !pageHeight) return undefined
    let totalOz = 0
    
    // Inside pages weight - saddle-stitch: each folded sheet = 4 pages
    const insideOz = calcSheetWeightOz(insideResult.paper, pageWidth * 2, pageHeight) // spread size
    if (insideOz !== null) {
      // Subtract cover pages (4) if separate cover, divide by 4 pages per sheet
      const insidePages = hasCover ? pagesPerBook - 4 : pagesPerBook
      const insideSheetsPerBook = Math.max(0, insidePages / 4)
      totalOz += insideOz * insideSheetsPerBook
    }
    
    // Cover weight (1 folded sheet = 4 cover pages: front, inside front, inside back, back)
    if (hasCover) {
      const coverOz = calcSheetWeightOz(coverResult.paper, pageWidth * 2, pageHeight) // cover spread
      if (coverOz !== null) {
        totalOz += coverOz
      }
    }
    
    return totalOz > 0 ? Math.round(totalOz * 100) / 100 : undefined
  })()

  const stats: PaperStat[] = [
    { label: "Sheet", value: insideResult.sheetSize },
    { label: "Ups", value: String(insideResult.maxUps) },
    { label: "Sheets", value: insideResult.sheets.toLocaleString() },
  ]

  const costLines: CostLine[] = [
    { label: "Printing", value: totalPrintingCost },
    { label: "Binding", value: totalBindingPrice },
  ]
  if (insertFeeTotal > 0) {
    costLines.push({ label: `Insert Fee (${insertResults?.length || 0} inserts)`, value: insertFeeTotal })
  }
  if (totalLaminationCost > 0) {
    costLines.push({ label: "Lamination", value: totalLaminationCost })
  }
  if (brokerDiscountAmount > 0) {
    costLines.push({ label: "Broker Discount", value: -brokerDiscountAmount })
  }

  // Calculate totals for Production Material Cost section
  const insertPaperCost = hasInserts ? insertResults.reduce((sum, r) => sum + r.totalPaperCost, 0) : 0
  const insertClickCost = hasInserts ? insertResults.reduce((sum, r) => sum + r.totalClickCost, 0) : 0
  const totalPaperCost = (hasCover ? coverResult.totalPaperCost : 0) + insideResult.totalPaperCost + insertPaperCost
  const totalClickCost = (hasCover ? coverResult.totalClickCost : 0) + insideResult.totalClickCost + insertClickCost
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
            {hasCover && (
              <tr className="border-b border-muted/50">
                <td className="py-1">Cover ({coverResult.sheets.toLocaleString()} sht)</td>
                <td className="text-right">{formatCurrency(coverResult.totalPaperCost)}</td>
                <td className="text-right">{formatCurrency(coverResult.totalClickCost)}</td>
                <td className="text-right font-medium">{formatCurrency(coverResult.totalPaperCost + coverResult.totalClickCost)}</td>
              </tr>
            )}
            <tr className="border-b border-muted/50">
              <td className="py-1">Inside ({insideResult.sheets.toLocaleString()} sht)</td>
              <td className="text-right">{formatCurrency(insideResult.totalPaperCost)}</td>
              <td className="text-right">{formatCurrency(insideResult.totalClickCost)}</td>
              <td className="text-right font-medium">{formatCurrency(insideResult.totalPaperCost + insideResult.totalClickCost)}</td>
            </tr>
            {hasInserts && insertResults.map((ins, idx) => (
              <tr key={idx} className="border-b border-muted/50">
                <td className="py-1">Insert {idx + 1} ({ins.sheets.toLocaleString()} sht)</td>
                <td className="text-right">{formatCurrency(ins.totalPaperCost)}</td>
                <td className="text-right">{formatCurrency(ins.totalClickCost)}</td>
                <td className="text-right font-medium">{formatCurrency(ins.totalPaperCost + ins.totalClickCost)}</td>
              </tr>
            ))}
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
        
        {hasCover && (
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
        )}
        
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
          <div className="text-[10px] font-semibold text-muted-foreground mb-1">Per Booklet</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div><span className="text-muted-foreground">Sheets:</span> {totalSheetsPerBooklet}</div>
            <div><span className="text-muted-foreground">Printing:</span> {formatCurrency(bookQty > 0 ? totalPrintingCost / bookQty : 0)}</div>
            <div><span className="text-muted-foreground">Binding:</span> {formatCurrency(bindingPricePerBook)}</div>
            {totalLaminationCost > 0 && (
              <div><span className="text-muted-foreground">Lamination:</span> {formatCurrency(laminationCostPerBook)}</div>
            )}
          </div>
        </div>
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
        defaultLevel: primaryAutoLevel,
        maxLevel: 10,
        markup: primaryMarkup,
        pricePerSheet: primaryPPS,
        onLevelChange,
      }}
      costLines={costLines}
      details={expandedDetails}
      onEffectiveTotalChange={onEffectiveTotalChange}
      isBroker={inputs.isBroker}
      onBrokerChange={onBrokerChange}
      weightOz={bookletWeightOz}
      weightLabel="/ booklet"
    />
  )
}
