"use client"

import { useState, useCallback, useEffect } from "react"
import { PrintingForm } from "./printing-form"
import { SheetOptionsTable } from "./sheet-options-table"
import { SheetLayoutSvg } from "./sheet-layout-svg"
import { PriceBreakdown } from "./price-breakdown"

import { Button } from "@/components/ui/button"
import {
  calculateAllSheetOptions,
  calculatePrintingCost,
  buildFullResult,
  formatCurrency,
} from "@/lib/printing-pricing"
import type {
  PrintingInputs,
  SheetOptionRow,
  FullPrintingResult,

} from "@/lib/printing-types"
import { useQuote } from "@/lib/quote-context"
import { SaveAsTemplateDialog } from "@/components/item-templates"
import { Plus, ArrowDown, Layers } from "lucide-react"
import useSWR from "swr"
import { useMailing, PIECE_TYPE_META, getFlatSize, type MailPiece } from "@/lib/mailing-context"
import type { FinishingCalculator, FinishingGlobalRates } from "@/lib/finishing-calculator-types"
import { computeFinishingCalcTotals } from "@/components/finishing-add-ons"

const swrFetcher = (url: string) => fetch(url).then((r) => r.json())

const EMPTY_INPUTS: PrintingInputs = {
  qty: 0,
  width: 0,
  height: 0,
  paperName: "20lb Offset",
  sidesValue: "S/S",
  hasBleed: false,
  addOnCharge: 0,
  addOnDescription: "",
  finishingIds: [],
  finishingCalcIds: [],
  isBroker: false,
  scoreFoldOperation: "",
  scoreFoldType: "",
  printingMarkupPct: 10,
  lamination: {
    enabled: false,
    type: "Gloss",
    sides: "S/S",
    markupPct: 225,
    brokerDiscountPct: 30,
  },
}

export function PrintingCalculator() {
  const quote = useQuote()
  const mailing = useMailing()

  // Flat pieces from planner that need in-house printing
  const flatPieces = mailing.pieces.filter(
    (p) => ["postcard", "flat_card", "folded_card", "self_mailer", "letter"].includes(p.type) &&
           (p.production === "inhouse" || p.production === "both")
  )

  // Finishing calculators from DB
  const { data: finCalcs } = useSWR<FinishingCalculator[]>("/api/finishing-calculators", swrFetcher)
  const { data: finRates } = useSWR<FinishingGlobalRates>("/api/finishing-global-rates", swrFetcher)

  // Form state
  const [inputs, setInputs] = useState<PrintingInputs>(EMPTY_INPUTS)

  // Calculation state
  const [sheetOptions, setSheetOptions] = useState<SheetOptionRow[]>([])
  const [selectedOption, setSelectedOption] = useState<SheetOptionRow | null>(null)
  const [fullResult, setFullResult] = useState<FullPrintingResult | null>(null)
  const [hasCalculated, setHasCalculated] = useState(false)
  const [showResults, setShowResults] = useState(false)

  // Order state
  const [editingItemId] = useState<number | null>(null)
  const [effectiveTotal, setEffectiveTotal] = useState<number>(0)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [levelOverride, setLevelOverride] = useState<number>(0)

  // Load a piece from the mailing planner into the form
  function loadPiece(piece: MailPiece) {
    const flat = getFlatSize(piece)
    setInputs((prev) => ({
      ...prev,
      qty: mailing.quantity || prev.qty,
      width: flat.w || piece.width || prev.width,
      height: flat.h || piece.height || prev.height,
    }))
    setSheetOptions([])
    setSelectedOption(null)
    setFullResult(null)
    setHasCalculated(false)
    setShowResults(false)
  }

  // Calculate all sheet options for the given inputs
  const handleCalculate = useCallback(() => {
    if (inputs.qty <= 0 || inputs.width <= 0 || inputs.height <= 0) return
    const options = calculateAllSheetOptions(inputs)
    setSheetOptions(options)
    setHasCalculated(true)
    setShowResults(false)
    setSelectedOption(null)
    setFullResult(null)
    setLevelOverride(0)

    // Auto-select if only one option
    if (options.length === 1) {
      selectSheet(options[0])
    }
  }, [inputs])

  function selectSheet(option: SheetOptionRow) {
    setSelectedOption(option)
    const result = calculatePrintingCost(inputs, option.size)
    if (result) {
      // Compute finishing calculator costs
      let finCalcCosts: { id: string; name: string; cost: number }[] = []
      if (finCalcs && finRates && inputs.finishingCalcIds?.length) {
        finCalcCosts = computeFinishingCalcTotals(finCalcs, finRates, inputs.finishingCalcIds, inputs.qty)
      }
      const full = buildFullResult(inputs, result, finCalcCosts)
      setFullResult(full)
      setShowResults(true)
    }
  }

  const handleSelectSheet = useCallback((option: SheetOptionRow) => {
    selectSheet(option)
  }, [inputs, finCalcs, finRates])

  const handleChangeSheet = useCallback(() => {
    setShowResults(false)
    setSelectedOption(null)
    setFullResult(null)
  }, [])

  const handleLevelChange = useCallback((delta: number) => {
    if (!selectedOption) return
    const newOverride = levelOverride + delta
    setLevelOverride(newOverride)
    // Re-calculate with adjusted inputs
    const adjusted = { ...inputs, qty: Math.max(1, inputs.qty + (delta > 0 ? 500 : -500)) }
    const result = calculatePrintingCost(adjusted, selectedOption.size)
    if (result) {
      let finCalcCosts: { id: string; name: string; cost: number }[] = []
      if (finCalcs && finRates && inputs.finishingCalcIds?.length) {
        finCalcCosts = computeFinishingCalcTotals(finCalcs, finRates, inputs.finishingCalcIds, adjusted.qty)
      }
      const full = buildFullResult(adjusted, result, finCalcCosts)
      setFullResult(full)
    }
  }, [inputs, selectedOption, levelOverride, finCalcs, finRates])

  // Add to order
  function resetForm() {
    setInputs(EMPTY_INPUTS)
    setSheetOptions([])
    setSelectedOption(null)
    setFullResult(null)
    setHasCalculated(false)
    setShowResults(false)
  }

  const handleAddToQuote = useCallback(() => {
    if (!fullResult) return
    const desc = `${inputs.paperName}, ${inputs.sidesValue}${inputs.hasBleed ? ", Bleed" : ""}`
    const finalAmount = effectiveTotal > 0 ? effectiveTotal : fullResult.grandTotal
    quote.addItem({
      category: "flat",
      label: `${inputs.qty.toLocaleString()} - ${inputs.width}x${inputs.height} Flat Prints`,
      description: desc,
      amount: finalAmount,
    })
  }, [fullResult, inputs, quote, effectiveTotal])

  return (
    <div className="flex flex-col gap-5 w-full">
      <div className="bg-card rounded-2xl border border-border p-6 flex flex-col">
          <h2 className="text-base font-semibold text-foreground mb-2">Flat Printing Calculator</h2>

          {/* Piece selector -- auto-fill from planner */}
          {flatPieces.length > 0 && (
            <div className="mb-4 rounded-xl border border-border bg-secondary/20 p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Load from planner
              </p>
              <div className="flex flex-wrap gap-2">
                {flatPieces.map((piece) => {
                  const meta = PIECE_TYPE_META[piece.type]
                  const flat = getFlatSize(piece)
                  return (
                    <button
                      key={piece.id}
                      type="button"
                      onClick={() => loadPiece(piece)}
                      className="flex items-center gap-2 rounded-xl border border-border bg-card hover:border-foreground/30 hover:shadow-sm px-3 py-2 text-left transition-all group"
                    >
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${meta.color}`}>{meta.short}</span>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-foreground">{piece.label}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {flat.w && flat.h ? `${flat.w}" x ${flat.h}" flat` : piece.width && piece.height ? `${piece.width}" x ${piece.height}"` : "No size"}
                        </span>
                      </div>
                      <ArrowDown className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors ml-1" />
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <PrintingForm
            inputs={inputs}
            onInputsChange={setInputs}
            onCalculate={handleCalculate}
            onAddToOrder={handleAddToQuote}
            onReset={resetForm}
            isEditing={editingItemId !== null}
            canAddToOrder={fullResult !== null}
            hasCalculated={hasCalculated}
            currentResult={fullResult}
          />

          {/* Sheet Options Table */}
          {hasCalculated && sheetOptions.length > 0 && !showResults && (
            <SheetOptionsTable
              options={sheetOptions}
              onSelectSheet={handleSelectSheet}
              selectedSize={selectedOption?.size}
            />
          )}

          {/* Results: SVG + Breakdown */}
          {showResults && fullResult && (
            <div className="mt-6 pt-6 border-t border-border">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <SheetLayoutSvg
                  result={fullResult.result}
                  pageWidth={inputs.width}
                  pageHeight={inputs.height}
                />
                <div className="flex flex-col gap-4">
                  <PriceBreakdown data={fullResult} onChangeSheet={handleChangeSheet} onLevelChange={handleLevelChange} onEffectiveTotalChange={setEffectiveTotal} />
                  <Button
                    onClick={handleAddToQuote}
                    className="w-full gap-2 rounded-full bg-foreground text-background hover:bg-foreground/90"
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                    Add to Quote - {formatCurrency(effectiveTotal > 0 ? effectiveTotal : fullResult.grandTotal)}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 rounded-full text-xs"
                    onClick={() => setShowSaveTemplate(true)}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Save as Template
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
        <SaveAsTemplateDialog
          open={showSaveTemplate}
          onClose={() => setShowSaveTemplate(false)}
          defaults={{
            name: `${inputs.qty.toLocaleString()} - ${inputs.width}x${inputs.height} Flat Prints`,
            category: "flat",
            description: `${inputs.paperName}, ${inputs.sidesValue}${inputs.hasBleed ? ", Bleed" : ""}`,
            specs: { qty: inputs.qty, width: inputs.width, height: inputs.height, paper: inputs.paperName, sides: inputs.sidesValue, bleed: inputs.hasBleed ? "Yes" : "No" },
            amount: effectiveTotal > 0 ? effectiveTotal : (fullResult?.grandTotal ?? 0),
          }}
        />
    </div>
  )
}
