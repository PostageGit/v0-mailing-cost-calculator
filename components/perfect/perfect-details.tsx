"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { CalcPriceCard, type CostLine, type PaperStat } from "@/components/calc-price-card"
import { formatCurrency } from "@/lib/pricing"
import type { PerfectCalcResult, PerfectPartResult } from "@/lib/perfect-types"

interface PerfectDetailsProps {
  result: PerfectCalcResult
  onLevelChange?: (delta: number) => void
  onEffectiveTotalChange?: (total: number) => void
  onBrokerChange?: (value: boolean) => void
}

// Expandable row component for section details
function SectionDetailRow({ section, label }: { section: PerfectPartResult; label: string }) {
  const [expanded, setExpanded] = useState(false)
  
  return (
    <>
      <tr 
        className="border-b border-muted/50 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="py-1.5 px-1 font-medium">
          <span className="inline-flex items-center gap-1">
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {label}
          </span>
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
      {expanded && (
        <tr className="bg-muted/20">
          <td colSpan={7} className="py-2 px-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-background rounded p-2 border">
                <div className="text-muted-foreground text-[10px] uppercase">Sheets</div>
                <div className="font-semibold">{section.sheets.toLocaleString()}</div>
              </div>
              <div className="bg-background rounded p-2 border">
                <div className="text-muted-foreground text-[10px] uppercase">Ups</div>
                <div className="font-semibold">{section.maxUps} up</div>
              </div>
              <div className="bg-background rounded p-2 border">
                <div className="text-muted-foreground text-[10px] uppercase">Sheet Size</div>
                <div className="font-semibold">{section.sheetSize}</div>
              </div>
              <div className="bg-background rounded p-2 border">
                <div className="text-muted-foreground text-[10px] uppercase">Level</div>
                <div className="font-semibold">{section.level} <span className="text-muted-foreground">({section.markup.toFixed(2)}x)</span></div>
              </div>
              <div className="bg-background rounded p-2 border">
                <div className="text-muted-foreground text-[10px] uppercase">Paper Cost</div>
                <div className="font-semibold">{formatCurrency(section.totalPaperCost)}</div>
              </div>
              <div className="bg-background rounded p-2 border">
                <div className="text-muted-foreground text-[10px] uppercase">Click Cost</div>
                <div className="font-semibold">{formatCurrency(section.totalClickCost)}</div>
              </div>
              <div className="bg-background rounded p-2 border">
                <div className="text-muted-foreground text-[10px] uppercase">$/Sheet</div>
                <div className="font-semibold">{formatCurrency(section.pricePerSheet, 4)}</div>
              </div>
              <div className="bg-background rounded p-2 border border-primary/30 bg-primary/5">
                <div className="text-muted-foreground text-[10px] uppercase">Total</div>
                <div className="font-bold text-primary">{formatCurrency(section.cost)}</div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
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

  // Summary table - always visible section breakdown (like old system)
  const summaryTable = (
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
            <th className="text-right py-1.5 px-1 font-semibold">Pgs</th>
          </tr>
        </thead>
        <tbody>
          {/* Hint row */}
          <tr className="bg-blue-50/50 dark:bg-blue-950/20">
            <td colSpan={7} className="py-1 px-2 text-[10px] text-muted-foreground text-center italic">
              Click any row to expand details
            </td>
          </tr>
          {/* Cover - expandable */}
          <SectionDetailRow section={coverResult} label="Cover" />
          
          {/* Inside sections - expandable */}
          {usingSections ? (
            insideSectionResults.map((section, idx) => (
              <SectionDetailRow 
                key={idx} 
                section={section} 
                label={idx === 0 ? "Inside" : `+ Sec ${idx + 1}`} 
              />
            ))
          ) : (
            <SectionDetailRow section={insideResult} label="Inside" />
          )}
        </tbody>
      </table>
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
