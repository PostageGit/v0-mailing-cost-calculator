"use client"

import { CalcPriceCard, type CostLine, type PaperStat } from "@/components/calc-price-card"
import { formatCurrency } from "@/lib/pricing"
import type { PadCalcResult } from "@/lib/pad-types"
import { calcSheetWeightOz } from "@/lib/paper-weights"

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

interface PadDetailsProps {
  result: PadCalcResult
  onLevelChange?: (delta: number) => void
  onEffectiveTotalChange?: (total: number) => void
  isBroker?: boolean
  onBrokerChange?: (value: boolean) => void
  compact?: boolean
}

export function PadDetails({ result, onLevelChange, onEffectiveTotalChange, isBroker, onBrokerChange, compact = false }: PadDetailsProps) {
  const {
    insideResult, sheetsPerPad,
    totalPrintingCost, paddingRate, totalPaddingCost,
    setupCharge, chipBoardCost, padQty,
  } = result

  const levelNum = parseLevelNum(result.levelName)
  const autoLevelNum = parseLevelNum(result.autoLevelName)

  // Calculate weight per pad (sheets + chipboard backing)
  const padWeightOz = (() => {
    const { pageWidth, pageHeight } = result
    if (!pageWidth || !pageHeight) return undefined
    let totalOz = 0
    
    // Paper sheets weight
    const sheetOz = calcSheetWeightOz(insideResult.paper, pageWidth, pageHeight)
    if (sheetOz !== null) {
      totalOz += sheetOz * sheetsPerPad
    }
    
    // Chipboard backing (approximate: ~0.5 oz for a typical 8.5x11 chipboard)
    // Scale by area ratio from 8.5x11
    const refArea = 8.5 * 11
    const padArea = pageWidth * pageHeight
    const chipboardOz = 0.5 * (padArea / refArea)
    totalOz += chipboardOz
    
    return totalOz > 0 ? Math.round(totalOz * 100) / 100 : undefined
  })()

  const stats: PaperStat[] = [
    { label: "Sheet", value: insideResult.sheetSize },
    { label: "Ups", value: String(insideResult.maxUps) },
    { label: "Sheets", value: insideResult.sheets.toLocaleString() },
  ]

  const costLines: CostLine[] = [
    { label: "Printing", value: totalPrintingCost },
    { label: `Padding (${padQty} x ${formatCurrency(paddingRate)})`, value: totalPaddingCost },
    { label: "Setup Charge", value: setupCharge },
  ]
  if (chipBoardCost > 0) {
    costLines.push({
      label: `Chip Board (${padQty} x ${formatCurrency(result.settings.chipBoardPerPad)})`,
      value: chipBoardCost,
    })
  }

  // Calculate totals for Production Material Cost section
  const hasMaterialCosts = insideResult.totalPaperCost > 0
  const totalMaterialCost = insideResult.totalPaperCost + insideResult.totalClickCost

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
                <td className="text-right font-medium">{formatCurrency(totalMaterialCost)}</td>
              </tr>
              <tr className="bg-primary/10 font-semibold">
                <td className="py-1.5">TOTAL</td>
                <td className="text-right">{formatCurrency(insideResult.totalPaperCost)}</td>
                <td className="text-right">{formatCurrency(insideResult.totalClickCost)}</td>
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
          <div className="text-[10px] font-semibold text-muted-foreground mb-1">Inside Pages</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div><span className="text-muted-foreground">Paper:</span> {insideResult.paper}</div>
            <div><span className="text-muted-foreground">Size:</span> {insideResult.sheetSize}</div>
            <div><span className="text-muted-foreground">Ups:</span> {insideResult.maxUps}</div>
            <div><span className="text-muted-foreground">$/sht:</span> {formatCurrency(insideResult.pricePerSheet, 4)}</div>
            <div><span className="text-muted-foreground">Sheets:</span> {insideResult.sheets.toLocaleString()}</div>
            <div><span className="text-muted-foreground">Total:</span> {formatCurrency(insideResult.cost)}</div>
          </div>
        </div>

        <div className="border-t border-muted pt-2 mt-2">
          <div className="text-[10px] font-semibold text-muted-foreground mb-1">Pad Finishing</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div><span className="text-muted-foreground">Sheets/Pad:</span> {sheetsPerPad}</div>
            <div><span className="text-muted-foreground">Rate:</span> {formatCurrency(paddingRate)}/pad</div>
            <div><span className="text-muted-foreground">Padding:</span> {formatCurrency(totalPaddingCost)}</div>
            <div><span className="text-muted-foreground">Setup:</span> {formatCurrency(setupCharge)}</div>
            {chipBoardCost > 0 && (
              <div><span className="text-muted-foreground">Chip Board:</span> {formatCurrency(chipBoardCost)}</div>
            )}
            <div><span className="text-muted-foreground">Print/Pad:</span> {formatCurrency(padQty > 0 ? totalPrintingCost / padQty : 0)}</div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <CalcPriceCard
      total={result.grandTotal}
      perUnitLabel="/ pad"
      perUnitCost={result.pricePerPad}
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
      details={compact ? undefined : expandedDetails}
      onEffectiveTotalChange={onEffectiveTotalChange}
      isBroker={isBroker}
      onBrokerChange={onBrokerChange}
      weightOz={compact ? undefined : padWeightOz}
      weightLabel="/ pad"
      compact={compact}
    />
  )
}
