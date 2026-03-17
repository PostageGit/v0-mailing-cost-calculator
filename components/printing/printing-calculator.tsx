"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { PrintingForm } from "./printing-form"
import { SheetOptionsTable } from "./sheet-options-table"
import { SheetLayoutSvg } from "./sheet-layout-svg"
import { PriceBreakdown } from "./price-breakdown"
import { PaperStatsRow } from "@/components/calc-price-card"
import { MultiQtyComparisonTable } from "./multi-qty-comparison-table"
import type { MultiQtyRow } from "./multi-qty-comparison-table"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useGlobalChat } from "@/lib/chat-context"
import { flatSpecsToChat } from "@/lib/specs-to-chat"
import { MessageCircle } from "lucide-react"
import {
  parseSheetSize,
  calculateAllSheetOptions,
  calculatePrintingCost,
  buildFullResult,
  formatCurrency,
} from "@/lib/printing-pricing"
import { usePapersContext } from "@/lib/papers-context"
import type {
  PrintingInputs,
  SheetOptionRow,
  FullPrintingResult,

} from "@/lib/printing-types"
import { useQuote } from "@/lib/quote-context"
import { Plus, ArrowDown, Save, Pencil, ExternalLink, Truck, Lock } from "lucide-react"
import { ShippingCalcButton } from "@/components/shipping-calc-dialog"
import useSWR from "swr"
import { useMailing, PIECE_TYPE_META, getFlatSize, type MailPiece } from "@/lib/mailing-context"
import type { FinishingCalculator, FinishingGlobalRates } from "@/lib/finishing-calculator-types"
import { computeFinishingCalcTotals } from "@/components/finishing-add-ons"
import { mapPaperToFoldKey, mapFoldTypeToDataKey, DEFAULT_FOLD_SETTINGS } from "@/lib/finishing-fold-engine"
import type { FoldFinishCostLine } from "@/lib/printing-types"

const swrFetcher = (url: string) => fetch(url).then((r) => r.json())

const EMPTY_INPUTS: PrintingInputs = {
  qty: 0,
  width: 0,
  height: 0,
  paperName: "10pt Gloss",
  sidesValue: "S/S",
  hasBleed: false,
  addOnCharge: 0,
  addOnDescription: "",
  finishingIds: [],
  finishingCalcIds: [],
  isBroker: false,
  printingMarkupPct: 0,
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
  const { sendToChat } = useGlobalChat()
  const { getPaperOptions, getPaperPrices } = usePapersContext()
  const flatPaperOptions = getPaperOptions("flat_printing")

  // Flat pieces from planner -- includes OHP so users can fill out full specs
  const flatPieces = mailing.pieces.filter(
    (p) => ["postcard", "flat_card", "folded_card", "self_mailer", "letter"].includes(p.type) &&
           (p.production === "inhouse" || p.production === "both" || p.production === "ohp")
  )
  // Finishing calculators from DB
  const { data: finCalcs } = useSWR<FinishingCalculator[]>("/api/finishing-calculators", swrFetcher)
  const { data: finRates } = useSWR<FinishingGlobalRates>("/api/finishing-global-rates", swrFetcher)
  // Fold finishing settings
  const { data: appSettings } = useSWR("/api/app-settings", swrFetcher)
  const foldSettings = appSettings?.fold_finishing_settings || DEFAULT_FOLD_SETTINGS

  // ── Saved quote detection ──
  const savedFlatItem = quote.items.find(item => item.category === "flat")
  const hasSavedFlat = !!(quote.savedId && savedFlatItem)
  
  // Build saved inputs from metadata - computed every render
  const savedFlatInputs = useMemo<PrintingInputs | null>(() => {
    if (!hasSavedFlat || !savedFlatItem?.metadata) return null
    const meta = savedFlatItem.metadata
    if (meta.calculatorInputs) {
      return { ...EMPTY_INPUTS, ...(meta.calculatorInputs as PrintingInputs) }
    }
    const restored: Partial<PrintingInputs> = {}
    const dims = meta.pieceDimensions?.split("x")
    if (dims?.length === 2) {
      restored.width = parseFloat(dims[0]) || 8.5
      restored.height = parseFloat(dims[1]) || 11
    }
    const label = savedFlatItem.label || ""
    const qtyMatch = label.match(/^([\d,]+)\s*-/)
    if (qtyMatch) restored.qty = parseInt(qtyMatch[1].replace(/,/g, "")) || 500
    if (meta.paperName) restored.paperName = meta.paperName
    if (meta.sides === "D/S") restored.sidesValue = "ds"
    else if (meta.sides === "S/S") restored.sidesValue = "ss"
    if (meta.hasBleed !== undefined) restored.hasBleed = meta.hasBleed
    return { ...EMPTY_INPUTS, ...restored }
  }, [hasSavedFlat, savedFlatItem])

  // Local form state
  const [localInputs, setLocalInputs] = useState<PrintingInputs>(EMPTY_INPUTS)
  
  // Calculation state
  const [sheetOptions, setSheetOptions] = useState<SheetOptionRow[]>([])
  const [selectedOption, setSelectedOption] = useState<SheetOptionRow | null>(null)
  const [fullResult, setFullResult] = useState<FullPrintingResult | null>(null)
  const [multiQtyResults, setMultiQtyResults] = useState<MultiQtyRow[]>([])
  const [hasCalculated, setHasCalculated] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [calcError, setCalcError] = useState<{
    message: string
    suggestions: { name: string; largestSheet: string }[]
  } | null>(null)

  // Order state
  const [editingItemId] = useState<number | null>(null)
  const [effectiveTotal, setEffectiveTotal] = useState<number>(0)
  
  // Frozen = user hasn't clicked "Revise" on a saved quote
  const [userUnfroze, setUserUnfroze] = useState(false)
  const isFrozen = hasSavedFlat && !userUnfroze
  
  // THE KEY: inputs are derived at render time
  const inputs = isFrozen && savedFlatInputs ? savedFlatInputs : localInputs
  const setInputs = useCallback((val: PrintingInputs | ((prev: PrintingInputs) => PrintingInputs)) => {
    if (typeof val === "function") {
      setLocalInputs(val)
    } else {
      setLocalInputs(val)
    }
  }, [])
  
  // When user clicks "Revise", copy saved values into local state
  const handleUnfreeze = useCallback(() => {
    if (savedFlatInputs) {
      setLocalInputs(savedFlatInputs)
    }
    setUserUnfroze(true)
  }, [savedFlatInputs])

  // Bridge: get fold cost from the HTML calculator via /api/fold-calc
  const foldBridgeBody = useMemo(() => {
    const ff = inputs.foldFinish
    if (!ff?.enabled || !ff.finishType || !ff.foldType || !inputs.width || !inputs.height) return null
    const cat: "folding" | "sf" = ff.finishType === "fold" ? "folding" : "sf"
    const paperMap = mapPaperToFoldKey(inputs.paperName)
    const paperKey = cat === "folding" ? paperMap.foldKey : paperMap.sfKey
    if (!paperKey) return null
    const dataFoldKey = mapFoldTypeToDataKey(ff.foldType)
    const finishDataKey = cat === "sf" ? `Score & ${dataFoldKey}` : dataFoldKey
    const s = foldSettings
    return {
      cat, paperKey, w: inputs.width, h: inputs.height,
      finish: finishDataKey, qty: inputs.qty || 1,
      axis: (ff.orientation || "width") === "width" ? "w" : "h",
      settings: {
        labor: s.hourlyRate, run: s.runRate || s.hourlyRate,
        markup: s.markupPercent, bdisc: s.brokerDiscountPercent,
        longSetup: s.longSheetSetupFee,
        lv: Object.fromEntries(s.setupLevels.map((sl: { label: string; minutes: number }, i: number) => [i + 1, sl.minutes])),
      },
    }
  }, [inputs, foldSettings])

  const foldBridgeKey = foldBridgeBody
    ? ["/api/fold-calc", JSON.stringify(foldBridgeBody)]
    : null

  const { data: foldBridgeData } = useSWR(
    foldBridgeKey,
    ([url, body]: [string, string]) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body }).then((r) => r.json()),
    { revalidateOnFocus: false, dedupingInterval: 300 }
  )

  // Transform bridge response into FoldFinishCostLine for buildFullResult
  const precomputedFoldCost: FoldFinishCostLine | null = useMemo(() => {
    const ff = inputs.foldFinish
    if (!ff?.enabled || !foldBridgeData?.price) return null
    const p = foldBridgeData.price
    const sellPrice = inputs.isBroker ? p.broker : p.retail
    const finalPrice = Math.max(sellPrice, foldSettings.minimumJobPrice)
    return {
      finishType: ff.finishType!,
      foldType: ff.foldType!,
      baseCost: p.base,
      setupCost: (p.setupCost || 0) + (p.longFee || 0),
      sellPrice: finalPrice,
      isMinApplied: finalPrice === foldSettings.minimumJobPrice && sellPrice < foldSettings.minimumJobPrice,
      isLongSheet: foldBridgeData.isLong || false,
      warnings: [],
      suggestion: null,
      foldedDimensions: null,
    }
  }, [inputs, foldBridgeData, foldSettings])

  // Load a planner piece into the form
  const loadPiece = useCallback((piece: MailPiece) => {
    // Don't override inputs if we're viewing a frozen saved quote
    if (isFrozen) {
      setActivePiece(piece)
      return
    }
    const flat = getFlatSize(piece)
    setActivePiece(piece)
    setInputs((prev) => ({
      ...prev,
      qty: mailing.printQty || prev.qty,
      width: flat.w || piece.width || prev.width,
      height: flat.h || piece.height || prev.height,
    }))
    // Reset calculation state since inputs changed
    setSheetOptions([])
    setSelectedOption(null)
    setFullResult(null)
    setHasCalculated(false)
    setShowResults(false)
    setOhpSpecsSaved(false)
  }, [mailing.printQty, isFrozen])

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
    // Check form validity inline to avoid stale closure issues
    const formValid = inputs.qty > 0 && inputs.width > 0 && inputs.height > 0 && inputs.paperName !== "" && inputs.sidesValue !== ""
    if (!formValid) {
      return
    }

    setCalcError(null)
    const options = calculateAllSheetOptions(inputs)
    if (options.length === 0) {
      const paper = flatPaperOptions.find((p) => p.name === inputs.paperName)
      const largest = paper?.availableSizes[paper.availableSizes.length - 1] ?? "13x19"

      // Find other papers where this piece WOULD fit (trying both orientations)
      const pw = inputs.width
      const ph = inputs.height
      const suggestions = flatPaperOptions
        .filter((p) => p.name !== inputs.paperName)
        .filter((p) => {
          return p.availableSizes.some((sizeStr) => {
            const parsed = parseSheetSize(sizeStr)
            const sw = parsed.w
            const sh = parsed.h
            // Portrait: piece fits within sheet
            const portrait = pw <= sw && ph <= sh
            // Rotated: piece rotated 90 degrees
            const rotated = ph <= sw && pw <= sh
            return portrait || rotated
          })
        })
        .map((p) => ({
          name: p.name,
          largestSheet: p.availableSizes[p.availableSizes.length - 1],
        }))

      setCalcError({
        message: `${inputs.width}" x ${inputs.height}" does not fit on any available ${inputs.paperName} sheet size (largest: ${largest}).`,
        suggestions,
      })
      setSheetOptions([])
      setSelectedOption(null)
      setFullResult(null)
      setHasCalculated(false)
      setShowResults(false)
      return
    }

    setSheetOptions(options)
    setSelectedOption(null)
    setMultiQtyResults([])
    setFullResult(null)
    setShowResults(false)
    setHasCalculated(true)
  }, [inputs, flatPaperOptions])

  // Reactively rebuild result when inputs change while a sheet is selected
  // (e.g. user toggles lamination or score/fold after picking a sheet)
  // If levelOverride is set, we must re-run calculatePrintingCost to honor it.
  useEffect(() => {
    if (selectedOption && showResults) {
      const calcResult = inputs.levelOverride
        ? calculatePrintingCost(inputs, selectedOption.size) || selectedOption.result
        : selectedOption.result
      const fcCosts = getFinCalcCosts(inputs.qty, calcResult.sheets, inputs.isBroker || false)
      const result = buildFullResult(inputs, calcResult, fcCosts, foldSettings, precomputedFoldCost)
      setFullResult(result)

      // Re-compute multi-qty rows whenever settings change
      const mq = inputs.multiQty
      if (mq?.enabled && mq.quantities.length > 0) {
        const rows: MultiQtyRow[] = mq.quantities
          .filter((q) => q > 0)
          .map((q) => {
            const qInputs = { ...inputs, qty: q }
            const qCalc = calculatePrintingCost(qInputs, selectedOption.size)
            if (!qCalc) return null
            const qFcCosts = getFinCalcCosts(q, qCalc.sheets, inputs.isBroker || false)
            const qResult = buildFullResult(qInputs, qCalc, qFcCosts, foldSettings, precomputedFoldCost)
            return { qty: q, result: qResult }
          })
          .filter((r): r is MultiQtyRow => r !== null)
        setMultiQtyResults(rows)
      } else {
        setMultiQtyResults([])
      }
    }
  }, [
  inputs.finishingIds?.join(","),
  inputs.finishingCalcIds?.join(","),
    inputs.addOnCharge,
    inputs.addOnDescription,
    inputs.isBroker,
    JSON.stringify(inputs.lamination),
    JSON.stringify(inputs.foldFinish),
    JSON.stringify(inputs.multiQty),
    foldSettings,
    precomputedFoldCost,
    selectedOption,
    showResults,
    getFinCalcCosts,
  ])

  // Select a sheet size from the table
  const handleSelectSheet = useCallback(
    (option: SheetOptionRow) => {
      setSelectedOption(option)
      const fcCosts = getFinCalcCosts(inputs.qty, option.result.sheets, inputs.isBroker || false)
      const result = buildFullResult(inputs, option.result, fcCosts, foldSettings, precomputedFoldCost)
      setFullResult(result)
      setShowResults(true)

      // Build multi-qty comparison rows if enabled
      const mq = inputs.multiQty
      if (mq?.enabled && mq.quantities.length > 0) {
        const rows: MultiQtyRow[] = mq.quantities
          .filter((q) => q > 0)
          .map((q) => {
            const qInputs = { ...inputs, qty: q }
            const qCalc = calculatePrintingCost(qInputs, option.size)
            if (!qCalc) return null
            const qFcCosts = getFinCalcCosts(q, qCalc.sheets, inputs.isBroker || false)
            const qResult = buildFullResult(qInputs, qCalc, qFcCosts, foldSettings, precomputedFoldCost)
            return { qty: q, result: qResult }
          })
          .filter((r): r is MultiQtyRow => r !== null)
        setMultiQtyResults(rows)
      } else {
        setMultiQtyResults([])
      }
    },
    [inputs, getFinCalcCosts, foldSettings, precomputedFoldCost]
  )

  const handleBrokerChange = useCallback((val: boolean) => {
    const updated = { ...inputs, isBroker: val }
    setInputs(updated)
    if (fullResult && selectedOption) {
      const newCalcResult = calculatePrintingCost(updated, selectedOption.size)
      if (newCalcResult) {
        const fcCosts = getFinCalcCosts(updated.qty, newCalcResult.sheets, val)
        const result = buildFullResult(updated, newCalcResult, fcCosts, foldSettings, precomputedFoldCost)
        setFullResult(result)
      }
    }
  }, [inputs, fullResult, selectedOption, getFinCalcCosts, foldSettings, precomputedFoldCost])

  // Change pricing level override
  const handleLevelChange = useCallback((delta: number) => {
    if (!fullResult || !selectedOption) return
    const currentLevel = fullResult.result.level
    const newLevel = Math.max(1, Math.min(10, currentLevel + delta))
    if (newLevel === currentLevel) return
    const updatedInputs = { ...inputs, levelOverride: newLevel }
    const newCalcResult = calculatePrintingCost(updatedInputs, selectedOption.size)
    if (!newCalcResult) return
      const fcCosts = getFinCalcCosts(inputs.qty, newCalcResult.sheets, inputs.isBroker || false)
    const result = buildFullResult(updatedInputs, newCalcResult, fcCosts, foldSettings, precomputedFoldCost)
    setInputs(updatedInputs)
    setFullResult(result)
  }, [fullResult, selectedOption, inputs, getFinCalcCosts, foldSettings, precomputedFoldCost])

  // Change sheet size (go back to table)
  const handleChangeSheet = useCallback(() => {
    setShowResults(false)
    setSelectedOption(null)
    setFullResult(null)
    setMultiQtyResults([])
  }, [])

  // Add a single multi-qty row to the quote
  const handleAddMultiQtyToQuote = useCallback((row: MultiQtyRow) => {
    const desc = `${inputs.paperName}, ${inputs.sidesValue}${inputs.hasBleed ? ", Bleed" : ""}`
    quote.addItem({
      category: "flat",
      label: `${row.qty.toLocaleString()} - ${inputs.width}x${inputs.height} Flat Prints`,
      description: desc,
      amount: row.result.grandTotal,
      metadata: {
        pieceDimensions: `${inputs.width}x${inputs.height}`,
        paperName: inputs.paperName,
        sides: inputs.sidesValue,
        hasBleed: inputs.hasBleed || undefined,
        production: activePiece?.production || "inhouse",
        calculatorInputs: { ...inputs, qty: row.qty },
      },
    })
  }, [inputs, quote, activePiece])

  // Add all multi-qty rows to the quote
  const handleAddAllMultiQty = useCallback(() => {
    multiQtyResults.forEach((row) => handleAddMultiQtyToQuote(row))
  }, [multiQtyResults, handleAddMultiQtyToQuote])

  // Add to order
  function resetForm() {
    setInputs(EMPTY_INPUTS)
    setSheetOptions([])
    setSelectedOption(null)
    setFullResult(null)
    setMultiQtyResults([])
    setHasCalculated(false)
    setShowResults(false)
  }

  // Track which planner piece was loaded so we can pass its metadata along
  const [activePiece, setActivePiece] = useState<MailPiece | null>(null)
  const isOhpMode = activePiece?.production === "ohp"
  const [ohpSpecsSaved, setOhpSpecsSaved] = useState(false)

  // OHP Spec Builder: save specs as a quote item with amount=0
  const handleSaveOhpSpecs = useCallback(() => {
    if (!isFormValid || !activePiece) return
    const ff = inputs.foldFinish
    const lam = inputs.lamination
    const typeLabel = PIECE_TYPE_META[activePiece.type]?.label || "Flat Print"
    const descLines: string[] = []
    const dimStr = `${inputs.width}x${inputs.height}"`
    descLines.push(inputs.hasBleed ? `${dimStr} + Bleed` : `${dimStr} - No Bleed`)
    descLines.push(inputs.paperName)
    descLines.push(inputs.sidesValue)
    if (ff?.enabled && ff.finishType && ff.foldType) {
      const opMap: Record<string, string> = { fold: "Fold", score_and_fold: "Score & Fold", score_only: "Score Only" }
      const foldMap: Record<string, string> = { half: "in Half", tri: "Tri-Fold", z: "Z-Fold", gate: "Gate Fold", roll: "Roll Fold", accordion: "Accordion Fold" }
      descLines.push(`${opMap[ff.finishType] || ff.finishType} ${foldMap[ff.foldType] || ff.foldType}`)
    }
    if (lam?.enabled) {
      const lamSides = lam.sides === "both" ? "both sides" : "one side"
      descLines.push(`${lam.type} Lamination (${lamSides})`)
    }
    quote.addItem({
      category: "ohp",
      label: `${inputs.qty.toLocaleString()} - ${typeLabel}`,
      description: descLines.join(", "),
      amount: 0,
      metadata: {
        pieceType: activePiece.type,
        pieceLabel: activePiece.label,
        pieceDimensions: `${inputs.width}x${inputs.height}`,
        production: "ohp",
        piecePosition: activePiece.position,
        paperName: inputs.paperName,
        sides: inputs.sidesValue,
        hasBleed: inputs.hasBleed || undefined,
        scoreFoldEnabled: ff?.enabled || undefined,
        scoreFoldFinishType: ff?.enabled ? ff.finishType : undefined,
        scoreFoldFoldType: ff?.enabled ? ff.foldType : undefined,
        scoreFoldOrientation: ff?.enabled ? ff.orientation : undefined,
        laminationEnabled: lam?.enabled || undefined,
        laminationType: lam?.enabled ? lam.type : undefined,
        laminationSides: lam?.enabled ? lam.sides : undefined,
      },
    })
    setOhpSpecsSaved(true)
  }, [inputs, isFormValid, activePiece, quote])

  const handleAddToQuote = useCallback(() => {
    if (!fullResult) return
    const desc = `${inputs.paperName}, ${inputs.sidesValue}${inputs.hasBleed ? ", Bleed" : ""}`
    const finalAmount = effectiveTotal > 0 ? effectiveTotal : fullResult.grandTotal
    // Build finishing metadata
    const ff = inputs.foldFinish
    const lam = inputs.lamination
    quote.addItem({
      category: "flat",
      label: `${inputs.qty.toLocaleString()} - ${inputs.width}x${inputs.height} Flat Prints`,
      description: desc,
      amount: finalAmount,
      metadata: {
        pieceType: activePiece?.type || undefined,
        pieceLabel: activePiece?.label || undefined,
        pieceDimensions: `${inputs.width}x${inputs.height}`,
        foldType: activePiece?.foldType || undefined,
        production: activePiece?.production || "inhouse",
        piecePosition: activePiece?.position || undefined,
        paperName: inputs.paperName,
        sides: inputs.sidesValue,
        hasBleed: inputs.hasBleed || undefined,
        // Score / Fold finishing
        scoreFoldEnabled: ff?.enabled || undefined,
        scoreFoldFinishType: ff?.enabled ? ff.finishType : undefined,
        scoreFoldFoldType: ff?.enabled ? ff.foldType : undefined,
        scoreFoldOrientation: ff?.enabled ? ff.orientation : undefined,
        // Lamination
        laminationEnabled: lam?.enabled || undefined,
        laminationType: lam?.enabled ? lam.type : undefined,
        laminationSides: lam?.enabled ? lam.sides : undefined,
        // Store full calculator inputs for restoration
        calculatorInputs: {
          qty: inputs.qty,
          width: inputs.width,
          height: inputs.height,
          paperName: inputs.paperName,
          sidesValue: inputs.sidesValue,
          hasBleed: inputs.hasBleed,
          addOnCharge: inputs.addOnCharge,
          addOnDescription: inputs.addOnDescription,
          finishingIds: inputs.finishingIds,
          finishingCalcIds: inputs.finishingCalcIds,
          isBroker: inputs.isBroker,
          printingMarkupPct: inputs.printingMarkupPct,
          lamination: inputs.lamination,
          foldFinish: inputs.foldFinish,
        },
      },
    })
  }, [fullResult, inputs, quote, effectiveTotal, activePiece])

  return (
    <div className="flex flex-col gap-5 min-h-0 flex-grow max-w-4xl">
      <div className={cn("bg-card rounded-2xl border p-6 flex flex-col", isOhpMode ? "border-sky-200 dark:border-sky-800/50" : "border-border")}>
          {isOhpMode && (
            <div className="flex items-center gap-2 mb-3 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/40 px-3 py-2">
              <ExternalLink className="h-3.5 w-3.5 text-sky-600 shrink-0" />
              <span className="text-xs font-medium text-sky-800 dark:text-sky-300">
                OHP Spec Builder -- Fill in print specs for vendor quote. No cost calculation.
              </span>
            </div>
          )}
          <h2 className="text-base font-semibold text-foreground mb-2">
            {isOhpMode ? "Flat Print Specs (OHP)" : "Flat Printing Calculator"}
          </h2>

        {/* Frozen Quote Banner - shows when viewing a saved quote */}
        {isFrozen && (
          <div className="mb-4 rounded-xl border-2 border-amber-300 dark:border-amber-600/50 bg-amber-50 dark:bg-amber-950/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                  <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Viewing Saved Quote</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">Fields are locked. Click Revise to make changes.</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1.5 border-amber-300 dark:border-amber-600 bg-white dark:bg-amber-950 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300"
                onClick={handleUnfreeze}
              >
                <Pencil className="h-3.5 w-3.5" />
                Revise Quote
              </Button>
            </div>
          </div>
        )}

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
                  const isOhpOnly = piece.production === "ohp"
                  return (
                    <button
                      key={piece.id}
                      type="button"
                      onClick={() => loadPiece(piece)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border bg-card hover:border-foreground/30 hover:shadow-sm px-3 py-2 text-left transition-all group",
                        isOhpOnly ? "border-sky-300 dark:border-sky-700/50" : "border-border"
                      )}
                    >
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${meta.color}`}>{meta.short}</span>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          {piece.label}
                          {isOhpOnly && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">OHP</span>}
                        </span>
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

          {/* OHP Spec Saved Summary */}
          {isOhpMode && ohpSpecsSaved && (
            <div className="rounded-xl border border-sky-200 dark:border-sky-800/50 bg-sky-50/50 dark:bg-sky-950/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Specs Saved</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2.5 text-xs gap-1.5"
                  onClick={() => setOhpSpecsSaved(false)}
                >
                  <Pencil className="h-3 w-3" />
                  Edit Specs
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2 py-1 rounded-md bg-sky-100 dark:bg-sky-900/40 text-[11px] font-medium text-sky-800 dark:text-sky-300">{inputs.qty.toLocaleString()} qty</span>
                <span className="px-2 py-1 rounded-md bg-sky-100 dark:bg-sky-900/40 text-[11px] font-medium text-sky-800 dark:text-sky-300">{inputs.width}" x {inputs.height}" {inputs.hasBleed ? "+ Bleed" : "- No Bleed"}</span>
                <span className="px-2 py-1 rounded-md bg-sky-100 dark:bg-sky-900/40 text-[11px] font-medium text-sky-800 dark:text-sky-300">{inputs.paperName}</span>
                <span className="px-2 py-1 rounded-md bg-sky-100 dark:bg-sky-900/40 text-[11px] font-medium text-sky-800 dark:text-sky-300">{inputs.sidesValue}</span>
                {inputs.foldFinish?.enabled && inputs.foldFinish.foldType && (
                  <span className="px-2 py-1 rounded-md bg-sky-100 dark:bg-sky-900/40 text-[11px] font-medium text-sky-800 dark:text-sky-300">
                    {inputs.foldFinish.finishType === "score_and_fold" ? "Score & Fold" : inputs.foldFinish.finishType === "score_only" ? "Score Only" : "Fold"} {inputs.foldFinish.foldType === "half" ? "in Half" : inputs.foldFinish.foldType === "tri" ? "Tri-Fold" : inputs.foldFinish.foldType}
                  </span>
                )}
                {inputs.lamination?.enabled && (
                  <span className="px-2 py-1 rounded-md bg-sky-100 dark:bg-sky-900/40 text-[11px] font-medium text-sky-800 dark:text-sky-300">
                    {inputs.lamination.type} Lamination ({inputs.lamination.sides === "both" ? "both sides" : "one side"})
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Form: show when NOT in saved OHP state */}
          {!(isOhpMode && ohpSpecsSaved) && (
            <>
          <PrintingForm
            inputs={inputs}
            onInputsChange={setInputs}
            onCalculate={isOhpMode ? handleSaveOhpSpecs : handleCalculate}
            onReset={() => { resetForm(); setOhpSpecsSaved(false) }}
  isEditing={editingItemId !== null}
  hasCalculated={hasCalculated}
  currentResult={isOhpMode ? null : fullResult}
  ohpMode={isOhpMode}
  disabled={isFrozen}
  />
            </>
          )}

          {/* No-fit error (in-house only) */}
          {!isOhpMode && calcError && (
            <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-destructive/10 flex items-center justify-center">
                  <span className="text-destructive text-xs font-bold">!</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-destructive">Size Not Available</p>
                  <p className="text-xs text-muted-foreground mt-1">{calcError.message}</p>
                </div>
              </div>
              {calcError.suggestions.length > 0 && (
                <div className="border-t border-destructive/10 pt-3">
                  <p className="text-xs font-medium text-foreground mb-2">
                    This size fits on these paper types:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {calcError.suggestions.map((s) => (
                      <button
                        key={s.name}
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:border-primary/30"
                        onClick={() => {
                          setInputs((prev) => ({ ...prev, paperName: s.name }))
                          setCalcError(null)
                        }}
                      >
                        <span>{s.name}</span>
                        <span className="text-muted-foreground">({s.largestSheet})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {calcError.suggestions.length === 0 && (
                <div className="border-t border-destructive/10 pt-3">
                  <p className="text-xs text-muted-foreground">
                    No available paper type can accommodate this size. Check your dimensions.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Sheet Options Table (in-house only) */}
          {!isOhpMode && hasCalculated && sheetOptions.length > 0 && !showResults && (
            <SheetOptionsTable
              options={sheetOptions}
              onSelectSheet={handleSelectSheet}
              selectedSize={selectedOption?.size}
            />
          )}

          {/* Results: SVG + Breakdown (in-house only) */}
          {!isOhpMode && showResults && fullResult && (
            <div className="mt-6 pt-6 border-t border-border">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col">
                  <SheetLayoutSvg
                    result={fullResult.result}
                    pageWidth={inputs.width}
                    pageHeight={inputs.height}
                  />
                  <div className="mt-3">
                    <p className="text-center text-xs font-semibold text-foreground mb-1.5">{inputs.paperName}</p>
                    <PaperStatsRow stats={[
                      { label: "Sheet", value: fullResult.result.sheetSize },
                      { label: "Ups", value: String(fullResult.result.maxUps) },
                      { label: "Sheets", value: fullResult.result.sheets.toLocaleString() },
                    ]} />
                  </div>
                </div>
                <div className="flex flex-col gap-4">
                  <PriceBreakdown data={fullResult} onChangeSheet={handleChangeSheet} onLevelChange={handleLevelChange} onEffectiveTotalChange={setEffectiveTotal} isBroker={inputs.isBroker} onBrokerChange={handleBrokerChange} />
                </div>
              </div>

              {/* Multi-Qty Comparison Table */}
              {multiQtyResults.length > 0 && (
                <MultiQtyComparisonTable
                  rows={multiQtyResults}
                  onAddToQuote={handleAddMultiQtyToQuote}
                  onAddAll={handleAddAllMultiQty}
                />
              )}

              {/* Add to Quote + Compare with Chat + Shipping */}
              <div className="flex gap-2 mt-4">
              <Button
                onClick={handleAddToQuote}
                className="flex-1 gap-2 rounded-full bg-foreground text-background hover:bg-foreground/90"
                size="lg"
              >
                <Plus className="h-4 w-4" />
                Add to Quote - {formatCurrency(effectiveTotal > 0 ? effectiveTotal : fullResult.grandTotal)}
              </Button>
              <ShippingCalcButton
                pieceWidth={inputs.width}
                pieceHeight={inputs.height}
                quantity={inputs.qty}
                paperName={inputs.paperName}
                sheetsPerPiece={1}
                itemLabel={`${inputs.qty.toLocaleString()} - ${inputs.width}x${inputs.height} Flat Prints`}
              />
              <Button
                onClick={() => sendToChat(flatSpecsToChat({
                  qty: inputs.qty, width: inputs.width, height: inputs.height,
                  paper: inputs.paperName, sides: inputs.sides,
                  hasBleed: inputs.hasBleed, isBroker: inputs.isBroker,
                }))}
                variant="outline"
                className="gap-1.5 rounded-full border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
                size="lg"
                title="Send these exact specs to the chat AI for a price comparison"
              >
                <MessageCircle className="h-4 w-4" />
                Chat Check
              </Button>
              </div>
            </div>
          )}
        </div>
    </div>
  )
}
