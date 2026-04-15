"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { PadForm } from "./pad-form"
import { SpiralLayoutSvg } from "@/components/spiral/spiral-layout-svg"
import { PadDetails } from "./pad-details"
import { PaperStatsRow } from "@/components/calc-price-card"
import { calculatePad } from "@/lib/pad-pricing"
import { defaultPadInputs } from "@/lib/pad-types"
import type { PadInputs, PadCalcResult, PadSettings } from "@/lib/pad-types"
import { DEFAULT_PAD_SETTINGS } from "@/lib/pad-types"
import { useQuote } from "@/lib/quote-context"
import { formatCurrency } from "@/lib/pricing"
import { Plus, Truck } from "lucide-react"
import { GenericMultiQtyTable } from "@/components/qty-comparison-table"
import type { GenericQtyRow } from "@/components/qty-comparison-table"
import { ShippingCalcButton } from "@/components/shipping-calc-dialog"
import useSWR from "swr"
import { usePapersContext } from "@/lib/papers-context"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface PadCalculatorResult {
  cost: number
  price: number
  description: string
}

interface PadCalculatorProps {
  viewMode?: "detailed" | "compact"
  standalone?: boolean
  /** When provided, shows "Use This Price" button instead of "Add to Quote" and calls this with result */
  onResult?: (result: PadCalculatorResult) => void
}

export function PadCalculator({ viewMode = "detailed", standalone = false, onResult }: PadCalculatorProps) {
  const quote = useQuote()
  const { paperDataLookup } = usePapersContext()

  // Load pad settings from app_settings
  const { data: settingsData } = useSWR<Record<string, unknown>>("/api/app-settings", fetcher)
  const [padSettings, setPadSettings] = useState<PadSettings>(DEFAULT_PAD_SETTINGS)

  useEffect(() => {
    if (settingsData?.pad_finishing_settings) {
      const saved = settingsData.pad_finishing_settings as PadSettings
      // Restore Infinity for last tier max
      if (saved.tiers?.length) {
        saved.tiers[saved.tiers.length - 1].max = Infinity
      }
      setPadSettings(saved)
    }
  }, [settingsData])

  const [inputs, setInputs] = useState<PadInputs>(defaultPadInputs())
  const [calcResult, setCalcResult] = useState<PadCalcResult | null>(null)
  const [multiQtyResults, setMultiQtyResults] = useState<GenericQtyRow<PadCalcResult>[]>([])
  const [validationError, setValidationError] = useState<string | null>(null)
  const [effectiveTotal, setEffectiveTotal] = useState<number>(0)

  const isFormValid =
    inputs.padQty > 0 &&
    inputs.pagesPerPad > 0 &&
    inputs.pageWidth > 0 &&
    inputs.pageHeight > 0 &&
    inputs.inside.paperName !== "" &&
    inputs.inside.sides !== ""

  const handleCalculate = useCallback(() => {
    setValidationError(null)
    if (!isFormValid) {
      setValidationError("Please fill in all required fields correctly.")
      return
    }

    const result = calculatePad(inputs, padSettings, paperDataLookup)
    if ("error" in result) {
      setValidationError(result.error)
      setCalcResult(null)
      return
    }

    setCalcResult(result)

    // Multi-qty comparison
    const mq = inputs.multiQty
    if (mq?.enabled && mq.quantities.length > 0) {
      const rows: GenericQtyRow<PadCalcResult>[] = mq.quantities
        .filter((q) => q > 0)
        .map((q) => {
          const r = calculatePad({ ...inputs, padQty: q }, padSettings, paperDataLookup)
          if ("error" in r) return null
          return { qty: q, total: r.grandTotal, result: r }
        })
        .filter((r): r is GenericQtyRow<PadCalcResult> => r !== null)
      setMultiQtyResults(rows)
    } else {
      setMultiQtyResults([])
    }
  }, [inputs, isFormValid, padSettings, paperDataLookup])

  const handleBrokerChange = useCallback((val: boolean) => {
    const updated: PadInputs = { ...inputs, isBroker: val }
    setInputs(updated)
    if (calcResult) {
      const newResult = calculatePad(updated, padSettings, paperDataLookup)
      if (!("error" in newResult)) setCalcResult(newResult)
    }
  }, [inputs, calcResult, padSettings, paperDataLookup])

  const handleLevelChange = useCallback((delta: number) => {
    if (!calcResult) return
    const currentNum = parseInt(calcResult.levelName.replace("Level ", ""), 10) || 5
    const newLevel = Math.max(2, Math.min(10, currentNum + delta))
    if (newLevel === currentNum) return
    const updatedInputs: PadInputs = { ...inputs, customLevel: `Level ${newLevel}` }
    const newResult = calculatePad(updatedInputs, padSettings, paperDataLookup)
    if ("error" in newResult) return
    setInputs(updatedInputs)
    setCalcResult(newResult)
  }, [calcResult, inputs, padSettings, paperDataLookup])

  function resetForm() {
    setInputs(defaultPadInputs())
    setCalcResult(null)
    setMultiQtyResults([])
    setValidationError(null)
  }

  const handleAddMultiQtyToQuote = useCallback((row: GenericQtyRow<PadCalcResult>) => {
    const desc = `${row.result.insideResult.paper}, ${row.result.insideResult.sides}${inputs.useChipBoard ? ", Chip Board" : ""}`
    quote.addItem({
      category: "pad",
      label: `${row.qty.toLocaleString()} pads - ${inputs.pagesPerPad}sh ${inputs.pageWidth}x${inputs.pageHeight}`,
      description: desc,
      amount: row.total,
      metadata: { paperName: row.result.insideResult.paper },
    })
  }, [inputs, quote])

  const handleAddAllMultiQty = useCallback(() => {
    multiQtyResults.forEach((row) => handleAddMultiQtyToQuote(row))
  }, [multiQtyResults, handleAddMultiQtyToQuote])

  const handleAddToQuote = useCallback(() => {
    if (!calcResult) return
    const desc = `${calcResult.insideResult.paper}, ${calcResult.insideResult.sides}${inputs.useChipBoard ? ", Chip Board" : ""}`
    const totalPrice = effectiveTotal > 0 ? effectiveTotal : calcResult.grandTotal
    
    // If onResult callback provided, call it instead of adding to quote
    if (onResult) {
      onResult({
        cost: calcResult.totalCost || totalPrice * 0.7,
        price: totalPrice,
        description: `${inputs.padQty.toLocaleString()} - ${inputs.pagesPerPad}pg Pad ${inputs.pageWidth}x${inputs.pageHeight}, ${desc}`
      })
      return
    }
    
    quote.addItem({
      category: "pad",
      label: `${inputs.padQty.toLocaleString()} - ${inputs.pagesPerPad}pg Pad ${inputs.pageWidth}x${inputs.pageHeight}`,
      description: desc,
      amount: effectiveTotal > 0 ? effectiveTotal : calcResult.grandTotal,
      metadata: {
        pieceType: "pad",
        pieceDimensions: `${inputs.pageWidth}x${inputs.pageHeight}`,
        production: "inhouse",
        paperName: calcResult.insideResult.paper,
        sides: calcResult.insideResult.sides,
        pageCount: inputs.pagesPerPad,
      },
    })
  }, [calcResult, inputs, quote, effectiveTotal])

  return (
    <div className="flex flex-col gap-5 min-h-0 flex-grow max-w-4xl">
      <div className="bg-card rounded-2xl border border-border p-6 flex flex-col">
        <h2 className="text-base font-semibold text-foreground mb-2">Pad Calculator</h2>

        <PadForm
          inputs={inputs}
          onInputsChange={setInputs}
          onCalculate={handleCalculate}
          onReset={resetForm}
          isEditing={false}
          validationError={validationError}
          settings={padSettings}
          onSettingsSave={setPadSettings}
          compact={viewMode === "compact"}
        />

        {/* Results */}
        {calcResult && (
          <div className="mt-6 pt-6 border-t border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Layout SVG */}
              <div className="flex flex-col">
                <SpiralLayoutSvg
                  result={calcResult.insideResult}
                  pageWidth={inputs.pageWidth}
                  pageHeight={inputs.pageHeight}
                  label="Inside Pages"
                />
                  <div className="mt-3">
                    <p className="text-center text-xs font-semibold text-foreground mb-1.5">{calcResult.insideResult.paper}</p>
                    <PaperStatsRow stats={[
                      { label: "Sheet", value: calcResult.insideResult.sheetSize },
                      { label: "Ups", value: String(calcResult.insideResult.maxUps) },
                      { label: "Sheets", value: calcResult.insideResult.sheets.toLocaleString() },
                    ]} />
                  </div>
              </div>

              {/* Price Details */}
              <div className="flex flex-col gap-4">
                <PadDetails
                  result={calcResult}
                  onLevelChange={handleLevelChange}
                  onEffectiveTotalChange={setEffectiveTotal}
                  isBroker={inputs.isBroker}
                  onBrokerChange={handleBrokerChange}
                  compact={viewMode === "compact"}
                />
              </div>
            </div>

            {/* Multi-Qty Comparison Table */}
            {multiQtyResults.length > 0 && (
              <GenericMultiQtyTable
                rows={multiQtyResults}
                onAddToQuote={handleAddMultiQtyToQuote}
                onAddAll={handleAddAllMultiQty}
                label="Pad Quantity Comparison"
                hideAddButtons={standalone}
              />
            )}

            {/* Add to Quote + Shipping -- below results */}
            <div className="flex gap-2 mt-4">
              {!standalone && (
              <Button
                onClick={handleAddToQuote}
                className="flex-1 gap-2 rounded-full bg-foreground text-background hover:bg-foreground/90"
                size="lg"
              >
                  <Plus className="h-4 w-4" />
                  {onResult 
                    ? `Use This Price - ${formatCurrency(effectiveTotal > 0 ? effectiveTotal : calcResult.grandTotal)}`
                    : `Add to Quote - ${formatCurrency(effectiveTotal > 0 ? effectiveTotal : calcResult.grandTotal)}`
                  }
                </Button>
              )}
              {!standalone && !onResult && (
                <ShippingCalcButton
                pieceWidth={inputs.pageWidth}
                pieceHeight={inputs.pageHeight}
                quantity={inputs.padQty}
                paperName={inputs.inside.paperName}
                sheetsPerPiece={inputs.pagesPerPad + (inputs.useChipBoard ? 1 : 0)}
                itemLabel={`${inputs.padQty.toLocaleString()} - ${inputs.pagesPerPad}pg Pad`}
              />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
