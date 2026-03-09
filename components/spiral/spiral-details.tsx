"use client"

import { CalcPriceCard, type CostLine, type PaperStat } from "@/components/calc-price-card"
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

function parseLevelNum(levelName: string): number {
  const num = parseInt(levelName.replace("Level ", ""), 10)
  return isNaN(num) ? 5 : num
}

interface SpiralDetailsProps {
  result: SpiralCalcResult
  onLevelChange?: (delta: number) => void
  onEffectiveTotalChange?: (total: number) => void
  isBroker?: boolean
  onBrokerChange?: (value: boolean) => void
}

export function SpiralDetails({ result, onLevelChange, onEffectiveTotalChange, isBroker, onBrokerChange }: SpiralDetailsProps) {
  const {
    insideResult, frontResult, backResult, sheetsPerBook,
    totalPrintingCost, bindingPricePerBook, totalBindingPrice,
    extraCoversCostPerBook, totalExtrasCost, bookQty,
  } = result

  const levelNum = parseLevelNum(result.levelName)
  const autoLevelNum = parseLevelNum(result.autoLevelName)

  const stats: PaperStat[] = [
    { label: "Sheet", value: insideResult.sheetSize },
    { label: "Ups", value: String(insideResult.maxUps) },
    { label: "Sheets", value: insideResult.sheets.toLocaleString() },
  ]

  const costLines: CostLine[] = [
    { label: "Printing", value: totalPrintingCost },
    { label: "Binding", value: totalBindingPrice },
  ]
  if (totalExtrasCost > 0) {
    costLines.push({ label: "Cover Sets", value: totalExtrasCost })
  }

  // Calculate totals for Production Material Cost section
  const totalPaperCost = insideResult.totalPaperCost + (frontResult?.totalPaperCost || 0) + (backResult?.totalPaperCost || 0)
  const totalClickCost = insideResult.totalClickCost + (frontResult?.totalClickCost || 0) + (backResult?.totalClickCost || 0)
  const totalMaterialCost = totalPaperCost + totalClickCost
  const hasMaterialCosts = totalMaterialCost > 0

  const expandedDetails = (
    <div className="flex flex-col gap-2">
      {/* PRODUCTION MATERIAL COST - P/L Section (only if data available) */}
      {hasMaterialCosts && (
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
                <td className="py-1">Inside ({insideResult.sheets.toLocaleString()} sht)</td>
                <td className="text-right">{formatCurrency(insideResult.totalPaperCost)}</td>
                <td className="text-right">{formatCurrency(insideResult.totalClickCost)}</td>
                <td className="text-right font-medium">{formatCurrency(insideResult.totalPaperCost + insideResult.totalClickCost)}</td>
              </tr>
              {frontResult && (
                <tr className="border-b border-muted/50">
                  <td className="py-1">Front ({frontResult.sheets.toLocaleString()} sht)</td>
                  <td className="text-right">{formatCurrency(frontResult.totalPaperCost)}</td>
                  <td className="text-right">{formatCurrency(frontResult.totalClickCost)}</td>
                  <td className="text-right font-medium">{formatCurrency(frontResult.totalPaperCost + frontResult.totalClickCost)}</td>
                </tr>
              )}
              {backResult && (
                <tr className="border-b border-muted/50">
                  <td className="py-1">Back ({backResult.sheets.toLocaleString()} sht)</td>
                  <td className="text-right">{formatCurrency(backResult.totalPaperCost)}</td>
                  <td className="text-right">{formatCurrency(backResult.totalClickCost)}</td>
                  <td className="text-right font-medium">{formatCurrency(backResult.totalPaperCost + backResult.totalClickCost)}</td>
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
      )}

      {/* CALCULATION DETAILS */}
      <div className="border rounded-lg p-3 bg-muted/20">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-center mb-2">
          Calculation Details
        </div>
        
        <div className="mb-2">
          <div className="text-[10px] font-semibold text-muted-foreground mb-1">Inside</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div><span className="text-muted-foreground">Paper:</span> {insideResult.paper}</div>
            <div><span className="text-muted-foreground">Size:</span> {insideResult.sheetSize}</div>
            <div><span className="text-muted-foreground">Ups:</span> {insideResult.maxUps}</div>
            <div><span className="text-muted-foreground">$/sht:</span> {formatCurrency(insideResult.pricePerSheet, 4)}</div>
            <div><span className="text-muted-foreground">Sheets:</span> {insideResult.sheets.toLocaleString()}</div>
            <div><span className="text-muted-foreground">Total:</span> {formatCurrency(insideResult.cost)}</div>
          </div>
        </div>

        {frontResult && (
          <div className="mb-2">
            <div className="text-[10px] font-semibold text-muted-foreground mb-1">Front Cover</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><span className="text-muted-foreground">Paper:</span> {frontResult.paper}</div>
              <div><span className="text-muted-foreground">Size:</span> {frontResult.sheetSize}</div>
              <div><span className="text-muted-foreground">Ups:</span> {frontResult.maxUps}</div>
              <div><span className="text-muted-foreground">$/sht:</span> {formatCurrency(frontResult.pricePerSheet, 4)}</div>
              <div><span className="text-muted-foreground">Sheets:</span> {frontResult.sheets.toLocaleString()}</div>
              <div><span className="text-muted-foreground">Total:</span> {formatCurrency(frontResult.cost)}</div>
            </div>
          </div>
        )}

        {backResult && (
          <div className="mb-2">
            <div className="text-[10px] font-semibold text-muted-foreground mb-1">Back Cover</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><span className="text-muted-foreground">Paper:</span> {backResult.paper}</div>
              <div><span className="text-muted-foreground">Size:</span> {backResult.sheetSize}</div>
              <div><span className="text-muted-foreground">Ups:</span> {backResult.maxUps}</div>
              <div><span className="text-muted-foreground">$/sht:</span> {formatCurrency(backResult.pricePerSheet, 4)}</div>
              <div><span className="text-muted-foreground">Sheets:</span> {backResult.sheets.toLocaleString()}</div>
              <div><span className="text-muted-foreground">Total:</span> {formatCurrency(backResult.cost)}</div>
            </div>
          </div>
        )}

        <div className="border-t border-muted pt-2 mt-2">
          <div className="text-[10px] font-semibold text-muted-foreground mb-1">Per Book</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div><span className="text-muted-foreground">Sheets:</span> {sheetsPerBook}</div>
            <div><span className="text-muted-foreground">Printing:</span> {formatCurrency(bookQty > 0 ? totalPrintingCost / bookQty : 0)}</div>
            <div><span className="text-muted-foreground">Binding:</span> {formatCurrency(bindingPricePerBook)}</div>
            {extraCoversCostPerBook > 0 && (
              <div><span className="text-muted-foreground">Cover Set:</span> {formatCurrency(extraCoversCostPerBook)}</div>
            )}
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
      paperName={insideResult.paper}
      stats={stats}
      level={{
        level: levelNum,
        defaultLevel: autoLevelNum,
        maxLevel: 10,
        markup: 0,
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
