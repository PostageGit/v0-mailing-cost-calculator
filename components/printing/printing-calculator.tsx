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
import { formatCurrency } from "@/lib/pricing"
import { Plus, ArrowDown } from "lucide-react"
import useSWR from "swr"
import { useMailing, PIECE_TYPE_META, getFlatSize, type MailPiece } from "@/lib/mailing-context"
import type { FinishingCalculator, FinishingGlobalRates } from "@/lib/finishing-calculator-types"
import { computeFinishingCalcTotals } from "@/components/finishing-add-ons"

const swrFetcher = (url: string) => fetch(url).then((r) => r.json())

const EMPTY_INPUTS: PrintingInputs = {
  qty: 0,
  width: 0,
  height: 0,
  paperName: "",
  sidesValue: "",
  hasBleed: false,
  addOnCharge: 0,
  addOnDescription: "",
  finishingIds: [],
  finishingCalcIds: [],
  isBroker: false,
  scoreFoldOperation: "",
  scoreFoldType: "",
  printingMarkupPct: 10,
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

  // Load a planner piece into the form
  const loadPiece = useCallback((piece: MailPiece) => {
    const flat = getFlatSize(piece)
    setInputs((prev) => ({
      ...prev,
      qty: mailing.quantity || prev.qty,
      width: flat.w || piece.width || prev.width,
      height: flat.h || piece.height || prev.height,
    }))
    // Reset calculation state since inputs changed
    setSheetOptions([])
    setSelectedOption(null)
    setFullResult(null)
    setHasCalculated(false)
    setShowResults(false)
  }, [mailing.quantity])

  // Helper to compute finishing calculator costs
  const getFinCalcCosts = useCallback(
    (qty: number, sheets: number, broker: boolean) => {
      const ids = inputs.finishingCalcIds || []
      if (!finCalcs || !finRates || ids.length === 0) return []
      return computeFinishingCalcTotals(finCalcs, finRates, ids, qty, sheets, broker).map((c) => ({
        id: c.id,
        name: c.name,
        cost: c.total,
      }))
    },
    [finCalcs, finRates, inputs.finishingCalcIds],
  )

  // Validation
  const isFormValid =
    inputs.qty > 0 &&
    inputs.width > 0 &&
    inputs.height > 0 &&
    inputs.paperName !== "" &&
    inputs.sidesValue !== ""

  // Calculate
  const handleCalculate = useCallback(() => {
    if (!isFormValid) return

    const options = calculateAllSheetOptions(inputs)
    if (options.length === 0) return

    setSheetOptions(options)
    setSelectedOption(null)
    setFullResult(null)
    setShowResults(false)
    setHasCalculated(true)
  }, [inputs, isFormValid])

  // Reactively rebuild result when inputs change while a sheet is selected
  // (e.g. user toggles lamination or score/fold after picking a sheet)
  useEffect(() => {
    if (selectedOption && showResults) {
      const fcCosts = getFinCalcCosts(inputs.qty, selectedOption.result.sheets, inputs.isBroker || false)
      const result = buildFullResult(inputs, selectedOption.result, fcCosts)
      setFullResult(result)
    }
  }, [
    inputs.finishingIds?.join(","),
    inputs.finishingCalcIds?.join(","),
    inputs.scoreFoldOperation,
    inputs.scoreFoldType,
    inputs.addOnCharge,
    inputs.addOnDescription,
    inputs.isBroker,
    selectedOption,
    showResults,
    getFinCalcCosts,
  ])

  // Select a sheet size from the table
  const handleSelectSheet = useCallback(
    (option: SheetOptionRow) => {
      setSelectedOption(option)
      const fcCosts = getFinCalcCosts(inputs.qty, option.result.sheets, inputs.isBroker || false)
      const result = buildFullResult(inputs, option.result, fcCosts)
      setFullResult(result)
      setShowResults(true)
    },
    [inputs, getFinCalcCosts]
  )

  // Change pricing level override
  const handleLevelChange = useCallback((delta: number) => {
    if (!fullResult || !selectedOption) return
    const currentLevel = fullResult.result.level
    const newLevel = Math.max(1, Math.min(8, currentLevel + delta))
    if (newLevel === currentLevel) return
    const updatedInputs = { ...inputs, levelOverride: newLevel }
    const newCalcResult = calculatePrintingCost(updatedInputs, selectedOption.size)
    if (!newCalcResult) return
    const fcCosts = getFinCalcCosts(inputs.qty, newCalcResult.sheets, inputs.isBroker || false)
    const result = buildFullResult(updatedInputs, newCalcResult, fcCosts)
    setInputs(updatedInputs)
    setFullResult(result)
  }, [fullResult, selectedOption, inputs, getFinCalcCosts])

  // Change sheet size (go back to table)
  const handleChangeSheet = useCallback(() => {
  setShowResults(false)
  setSelectedOption(null)
  setFullResult(null)
  }, [])

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
    quote.addItem({
      category: "flat",
      label: `${inputs.qty.toLocaleString()} - ${inputs.width}x${inputs.height} Flat Prints`,
      description: desc,
      amount: fullResult.grandTotal,
    })
  }, [fullResult, inputs, quote])

  return (
    <div className="flex flex-col gap-5 min-h-0 flex-grow max-w-4xl">
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
                  <PriceBreakdown data={fullResult} onChangeSheet={handleChangeSheet} onLevelChange={handleLevelChange} />
                  <Button
                    onClick={handleAddToQuote}
                    className="w-full gap-2 rounded-full bg-foreground text-background hover:bg-foreground/90"
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                    Add to Quote - {formatCurrency(fullResult.grandTotal)}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
    </div>
  )
}
