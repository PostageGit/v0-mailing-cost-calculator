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
            {usingSections ? (
              // Show each section separately
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

      {/* CALCULATION DETAILS - Clean Table View */}
      <div className="border rounded-lg p-3 bg-muted/20">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-center mb-3">
          Calculation Details
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-primary/30">
                <th className="text-left py-1.5 px-1 font-semibold">Part</th>
                <th className="text-left py-1.5 px-1 font-semibold">Sides</th>
                <th className="text-left py-1.5 px-1 font-semibold">Paper</th>
                <th className="text-center py-1.5 px-1 font-semibold">Sheets / Size / Ups</th>
                <th className="text-center py-1.5 px-1 font-semibold">Level</th>
                <th className="text-right py-1.5 px-1 font-semibold">Price</th>
                <th className="text-right py-1.5 px-1 font-semibold">Pages</th>
              </tr>
            </thead>
            <tbody>
              {/* Cover Row */}
              <tr className="border-b border-muted/50 bg-blue-50 dark:bg-blue-950/30">
                <td className="py-1.5 px-1 font-medium">Cover</td>
                <td className="py-1.5 px-1">{coverResult.sides || "4/0"}</td>
                <td className="py-1.5 px-1">{coverResult.paper}</td>
                <td className="py-1.5 px-1 text-center">
                  <span className="font-mono">{coverResult.sheets.toLocaleString()}</span>
                  <span className="text-muted-foreground mx-1">{coverResult.sheetSize}</span>
                  <span className="text-muted-foreground">/ {coverResult.maxUps} Up</span>
                </td>
                <td className="py-1.5 px-1 text-center">
                  <span className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded font-medium">{coverResult.level}</span>
                </td>
                <td className="py-1.5 px-1 text-right font-semibold">{formatCurrency(coverResult.cost)}</td>
                <td className="py-1.5 px-1 text-right text-muted-foreground">-</td>
              </tr>
              
              {/* Inside Rows */}
              {usingSections ? (
                insideSectionResults.map((section, idx) => (
                  <tr key={idx} className={`border-b border-muted/50 ${idx % 2 === 0 ? 'bg-secondary/20' : ''}`}>
                    <td className="py-1.5 px-1 font-medium">
                      {idx === 0 ? "Inside" : "+ Section"}
                    </td>
                    <td className="py-1.5 px-1">{section.sides || "D/S"}</td>
                    <td className="py-1.5 px-1">{section.paper}</td>
                    <td className="py-1.5 px-1 text-center">
                      <span className="font-mono">{section.sheets.toLocaleString()}</span>
                      <span className="text-muted-foreground mx-1">{section.sheetSize}</span>
                      <span className="text-muted-foreground">/ {section.maxUps} Up</span>
                    </td>
                    <td className="py-1.5 px-1 text-center">
                      <span className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded font-medium">{section.level}</span>
                    </td>
                    <td className="py-1.5 px-1 text-right font-semibold">{formatCurrency(section.cost)}</td>
                    <td className="py-1.5 px-1 text-right">{section.pagesInSection || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr className="border-b border-muted/50 bg-secondary/20">
                  <td className="py-1.5 px-1 font-medium">Inside</td>
                  <td className="py-1.5 px-1">{insideResult.sides || "D/S"}</td>
                  <td className="py-1.5 px-1">{insideResult.paper}</td>
                  <td className="py-1.5 px-1 text-center">
                    <span className="font-mono">{insideResult.sheets.toLocaleString()}</span>
                    <span className="text-muted-foreground mx-1">{insideResult.sheetSize}</span>
                    <span className="text-muted-foreground">/ {insideResult.maxUps} Up</span>
                  </td>
                  <td className="py-1.5 px-1 text-center">
                    <span className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded font-medium">{insideResult.level}</span>
                  </td>
                  <td className="py-1.5 px-1 text-right font-semibold">{formatCurrency(insideResult.cost)}</td>
                  <td className="py-1.5 px-1 text-right text-muted-foreground">-</td>
                </tr>
              )}
            </tbody>
          </table>
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
      details={expandedDetails}
      onEffectiveTotalChange={onEffectiveTotalChange}
      isBroker={isBroker}
      onBrokerChange={onBrokerChange}
    />
  )
}
