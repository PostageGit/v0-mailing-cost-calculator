"use client"

import { useState, useCallback, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { SpiralForm } from "./spiral-form"
import { SpiralLayoutSvg } from "./spiral-layout-svg"
import { SpiralDetails } from "./spiral-details"
import { PaperStatsRow } from "@/components/calc-price-card"
import { calculateSpiral } from "@/lib/spiral-pricing"
import { defaultSpiralInputs } from "@/lib/spiral-types"
import type { SpiralInputs, SpiralCalcResult } from "@/lib/spiral-types"
import { useQuote } from "@/lib/quote-context"
import { formatCurrency } from "@/lib/pricing"
import { Plus, ArrowDown, Save, Pencil, ExternalLink, Truck } from "lucide-react"
import { GenericMultiQtyTable } from "@/components/qty-comparison-table"
import type { GenericQtyRow } from "@/components/qty-comparison-table"
import { ShippingCalcButton } from "@/components/shipping-calc-dialog"
import { useMailing, PIECE_TYPE_META, type MailPiece } from "@/lib/mailing-context"
import { usePapersContext } from "@/lib/papers-context"

interface SpiralCalculatorResult {
  cost: number
  price: number
  description: string
  inputs: SpiralInputs
}

interface SpiralCalculatorProps {
  viewMode?: "detailed" | "compact"
  standalone?: boolean
  /** When provided, shows "Use This Price" button instead of "Add to Quote" and calls this with result */
  onResult?: (result: SpiralCalculatorResult) => void
  /** Initial inputs to load (for editing saved calculations) */
  initialInputs?: SpiralInputs
}

export function SpiralCalculator({ viewMode = "detailed", standalone = false, onResult, initialInputs }: SpiralCalculatorProps) {
  const quote = useQuote()
  const mailing = useMailing()
  const { paperDataLookup } = usePapersContext()

  // Spiral pieces from planner -- includes OHP so users can fill out full specs
  const spiralPieces = mailing.pieces.filter(
    (p) => p.type === "spiral_book" && (p.production === "inhouse" || p.production === "both" || p.production === "ohp")
  )

  const [inputs, setInputs] = useState<SpiralInputs>(initialInputs || defaultSpiralInputs())
  
  // Reset to initialInputs when it changes
  useEffect(() => {
    if (initialInputs) {
      setInputs(initialInputs)
    }
  }, [initialInputs])
  const [calcResult, setCalcResult] = useState<SpiralCalcResult | null>(null)
  const [multiQtyResults, setMultiQtyResults] = useState<GenericQtyRow<SpiralCalcResult>[]>([])
  const [validationError, setValidationError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("inside")
  const [effectiveTotal, setEffectiveTotal] = useState<number>(0)

  const loadPiece = useCallback((piece: MailPiece) => {
    setActivePiece(piece)
    setInputs((prev) => ({
      ...prev,
      bookQty: mailing.printQty || prev.bookQty,
      pageWidth: piece.width || prev.pageWidth,
      pageHeight: piece.height || prev.pageHeight,
    }))
    setCalcResult(null)
    setValidationError(null)
    setOhpSpecsSaved(false)
  }, [mailing.printQty])

  const isFormValid =
    inputs.bookQty > 0 &&
    inputs.pagesPerBook > 0 &&
    inputs.pageWidth > 0 &&
    inputs.pageHeight > 0 &&
    inputs.inside.paperName !== "" &&
    inputs.inside.sides !== "" &&
    (!inputs.useFrontCover || (inputs.front.paperName !== "" && inputs.front.sides !== "")) &&
    (!inputs.useBackCover || (inputs.back.paperName !== "" && inputs.back.sides !== ""))

  const handleCalculate = useCallback(() => {
    setValidationError(null)
    if (!isFormValid) {
      setValidationError("Please fill in all required fields correctly.")
      return
    }

    const result = calculateSpiral(inputs, paperDataLookup)
    if ("error" in result) {
      setValidationError(result.error)
      setCalcResult(null)
      return
    }

    setCalcResult(result)
    setActiveTab("inside")

    // Multi-qty comparison
    const mq = inputs.multiQty
    if (mq?.enabled && mq.quantities.length > 0) {
      const rows: GenericQtyRow<SpiralCalcResult>[] = mq.quantities
        .filter((q) => q > 0)
        .map((q) => {
          const r = calculateSpiral({ ...inputs, bookQty: q }, paperDataLookup)
          if ("error" in r) return null
          return { qty: q, total: r.grandTotal, result: r }
        })
        .filter((r): r is GenericQtyRow<SpiralCalcResult> => r !== null)
      setMultiQtyResults(rows)
    } else {
      setMultiQtyResults([])
    }
  }, [inputs, isFormValid, paperDataLookup])

  const handleBrokerChange = useCallback((val: boolean) => {
    const updated = { ...inputs, isBroker: val }
    setInputs(updated)
    if (calcResult) {
      const newResult = calculateSpiral(updated, paperDataLookup)
      if (!("error" in newResult)) setCalcResult(newResult)
    }
  }, [inputs, calcResult, paperDataLookup])

  // Change pricing level override
  const handleLevelChange = useCallback((delta: number) => {
    if (!calcResult) return
    const currentNum = parseInt(calcResult.levelName.replace("Level ", ""), 10) || 5
    const newLevel = Math.max(2, Math.min(10, currentNum + delta))
    if (newLevel === currentNum) return
    const updatedInputs = { ...inputs, customLevel: `Level ${newLevel}` }
    const newResult = calculateSpiral(updatedInputs, paperDataLookup)
    if ("error" in newResult) return
    setInputs(updatedInputs)
    setCalcResult(newResult)
  }, [calcResult, inputs, paperDataLookup])

  function resetForm() {
    setInputs(defaultSpiralInputs())
    setCalcResult(null)
    setMultiQtyResults([])
    setValidationError(null)
  }

  const handleAddMultiQtyToQuote = useCallback((row: GenericQtyRow<SpiralCalcResult>) => {
    const desc = `${row.result.insideResult.paper}, ${row.result.insideResult.sides}`
    quote.addItem({
      category: "spiral",
      label: `${row.qty.toLocaleString()} - ${inputs.pagesPerBook}pg Spiral Book ${inputs.pageWidth}x${inputs.pageHeight}`,
      description: desc,
      amount: row.total,
      metadata: { paperName: row.result.insideResult.paper, pageCount: inputs.pagesPerBook },
    })
  }, [inputs, quote])

  const handleAddAllMultiQty = useCallback(() => {
    multiQtyResults.forEach((row) => handleAddMultiQtyToQuote(row))
  }, [multiQtyResults, handleAddMultiQtyToQuote])

  const spiralPiece = spiralPieces.length > 0 ? spiralPieces[0] : null
  const [activePiece, setActivePiece] = useState<MailPiece | null>(null)
  const isOhpMode = activePiece?.production === "ohp"
  const [ohpSpecsSaved, setOhpSpecsSaved] = useState(false)

  const handleSaveOhpSpecs = useCallback(() => {
    if (!activePiece || !inputs.bookQty || !inputs.pagesPerBook || !inputs.pageWidth || !inputs.pageHeight) return
    const descLines: string[] = []
    const dimStr = `${inputs.pageWidth}x${inputs.pageHeight}"`
    descLines.push(`${dimStr} - No Bleed`)
    descLines.push(`${inputs.pagesPerBook} Pages`)
    descLines.push(inputs.inside.paperName)
    descLines.push(inputs.inside.sides)
    if (inputs.useFrontCover && inputs.front.paperName) descLines.push(`Front: ${inputs.front.paperName}`)
    if (inputs.useBackCover && inputs.back.paperName) descLines.push(`Back: ${inputs.back.paperName}`)
    if (inputs.clearPlastic) descLines.push("Clear Plastic")
    if (inputs.blackVinyl) descLines.push("Black Vinyl")
    quote.addItem({
      category: "ohp",
      label: `${inputs.bookQty.toLocaleString()} - Spiral Book`,
      description: descLines.join(", "),
      amount: 0,
      metadata: {
        pieceType: activePiece.type,
        pieceLabel: activePiece.label,
        pieceDimensions: `${inputs.pageWidth}x${inputs.pageHeight}`,
        production: "ohp",
        piecePosition: activePiece.position,
        paperName: inputs.inside.paperName,
        sides: inputs.inside.sides,
        pageCount: inputs.pagesPerBook,
      },
    })
    setOhpSpecsSaved(true)
  }, [inputs, activePiece, quote])

  const handleAddToQuote = useCallback(() => {
    if (!calcResult) return
    const extras: string[] = []
    if (calcResult.hasClearPlastic) extras.push("Clear Plastic")
    if (calcResult.hasBlackVinyl) extras.push("Black Vinyl")
    if (calcResult.frontResult) extras.push("Printed Front Cover")
    if (calcResult.backResult) extras.push("Printed Back Cover")
    const extrasStr = extras.length > 0 ? ` (${extras.join(", ")})` : ""
    const desc = `${calcResult.insideResult.paper}, ${calcResult.insideResult.sides}${extrasStr}`
    const totalPrice = effectiveTotal > 0 ? effectiveTotal : calcResult.grandTotal
    
    // If onResult callback provided, call it instead of adding to quote
    if (onResult) {
      onResult({
        cost: calcResult.totalCost || totalPrice * 0.7,
        price: totalPrice,
        description: `${inputs.bookQty.toLocaleString()} - ${inputs.pagesPerBook}pg Spiral Book ${inputs.pageWidth}x${inputs.pageHeight}, ${desc}`,
        inputs: inputs
      })
      return
    }
    
    quote.addItem({
      category: "spiral",
      label: `${inputs.bookQty.toLocaleString()} - ${inputs.pagesPerBook}pg Spiral Book ${inputs.pageWidth}x${inputs.pageHeight}`,
      description: desc,
      amount: effectiveTotal > 0 ? effectiveTotal : calcResult.grandTotal,
      metadata: {
        pieceType: spiralPiece?.type || "spiral_book",
        pieceLabel: spiralPiece?.label || undefined,
        pieceDimensions: `${inputs.pageWidth}x${inputs.pageHeight}`,
        production: spiralPiece?.production || "inhouse",
        piecePosition: spiralPiece?.position || undefined,
        paperName: calcResult.insideResult.paper,
        sides: calcResult.insideResult.sides,
        pageCount: inputs.pagesPerBook,
      },
    })
  }, [calcResult, inputs, quote, effectiveTotal, spiralPiece])

  // Determine which tabs to show
  const hasFront = calcResult?.frontResult != null
  const hasBack = calcResult?.backResult != null

  return (
    <div className="flex flex-col gap-5 min-h-0 flex-grow max-w-4xl">
      <div className={`bg-card rounded-2xl border p-6 flex flex-col ${isOhpMode ? "border-sky-200 dark:border-sky-800/50" : "border-border"}`}>
        {isOhpMode && (
          <div className="flex items-center gap-2 mb-3 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/40 px-3 py-2">
            <ExternalLink className="h-3.5 w-3.5 text-sky-600 shrink-0" />
            <span className="text-xs font-medium text-sky-800 dark:text-sky-300">
              OHP Spec Builder -- Fill in print specs for vendor quote. No cost calculation.
            </span>
          </div>
        )}
        <h2 className="text-base font-semibold text-foreground mb-2">
          {isOhpMode ? "Spiral Book Specs (OHP)" : "Spiral Binding Calculator"}
        </h2>

        {/* Piece selector -- auto-fill from planner */}
        {spiralPieces.length > 0 && (
          <div className="mb-4 rounded-xl border border-border bg-secondary/20 p-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Load from planner
            </p>
            <div className="flex flex-wrap gap-2">
              {spiralPieces.map((piece) => {
                const meta = PIECE_TYPE_META[piece.type]
                const isOhpOnly = piece.production === "ohp"
                return (
                  <button
                    key={piece.id}
                    type="button"
                    onClick={() => loadPiece(piece)}
                    className={`flex items-center gap-2 rounded-xl border bg-card hover:border-foreground/30 hover:shadow-sm px-3 py-2 text-left transition-all group ${isOhpOnly ? "border-sky-300 dark:border-sky-700/50" : "border-border"}`}
                  >
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${meta.color}`}>{meta.short}</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        {piece.label}
                        {isOhpOnly && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">OHP</span>}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {piece.width && piece.height ? `${piece.width}" x ${piece.height}"` : "No size"}
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
              <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs gap-1.5" onClick={() => setOhpSpecsSaved(false)}>
                <Pencil className="h-3 w-3" /> Edit Specs
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2 py-1 rounded-md bg-sky-100 dark:bg-sky-900/40 text-[11px] font-medium text-sky-800 dark:text-sky-300">{inputs.bookQty.toLocaleString()} qty</span>
              <span className="px-2 py-1 rounded-md bg-sky-100 dark:bg-sky-900/40 text-[11px] font-medium text-sky-800 dark:text-sky-300">{inputs.pageWidth}" x {inputs.pageHeight}" - No Bleed</span>
              <span className="px-2 py-1 rounded-md bg-sky-100 dark:bg-sky-900/40 text-[11px] font-medium text-sky-800 dark:text-sky-300">{inputs.pagesPerBook} Pages</span>
              <span className="px-2 py-1 rounded-md bg-sky-100 dark:bg-sky-900/40 text-[11px] font-medium text-sky-800 dark:text-sky-300">{inputs.inside.paperName}</span>
              <span className="px-2 py-1 rounded-md bg-sky-100 dark:bg-sky-900/40 text-[11px] font-medium text-sky-800 dark:text-sky-300">{inputs.inside.sides}</span>
              {inputs.useFrontCover && <span className="px-2 py-1 rounded-md bg-sky-100 dark:bg-sky-900/40 text-[11px] font-medium text-sky-800 dark:text-sky-300">Front: {inputs.front.paperName}</span>}
              {inputs.useBackCover && <span className="px-2 py-1 rounded-md bg-sky-100 dark:bg-sky-900/40 text-[11px] font-medium text-sky-800 dark:text-sky-300">Back: {inputs.back.paperName}</span>}
            </div>
          </div>
        )}

        {/* Form: show when NOT in saved OHP state */}
        {!(isOhpMode && ohpSpecsSaved) && (
          <>
        <SpiralForm
          inputs={inputs}
          onInputsChange={setInputs}
          onCalculate={isOhpMode ? handleSaveOhpSpecs : handleCalculate}
          onReset={() => { resetForm(); setOhpSpecsSaved(false) }}
          isEditing={false}
          validationError={validationError}
          ohpMode={isOhpMode}
          compact={viewMode === "compact"}
        />
          </>
        )}

        {/* Results (in-house only) */}
        {!isOhpMode && calcResult && (
          <div className="mt-6 pt-6 border-t border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* SVG Tabs */}
              <div className="flex flex-col">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full">
                    <TabsTrigger value="inside" className="flex-1">Inside Pages</TabsTrigger>
                    {hasFront && <TabsTrigger value="front" className="flex-1">Front Cover</TabsTrigger>}
                    {hasBack && <TabsTrigger value="back" className="flex-1">Back Cover</TabsTrigger>}
                  </TabsList>

                  <TabsContent value="inside" className="mt-4">
                    <SpiralLayoutSvg
                      result={calcResult.insideResult}
                      pageWidth={inputs.pageWidth}
                      pageHeight={inputs.pageHeight}
                      label="Inside Pages"
                    />
                  </TabsContent>

                  {hasFront && calcResult.frontResult && (
                    <TabsContent value="front" className="mt-4">
                      <SpiralLayoutSvg
                        result={calcResult.frontResult}
                        pageWidth={inputs.pageWidth}
                        pageHeight={inputs.pageHeight}
                        label="Front Cover"
                      />
                    </TabsContent>
                  )}

                  {hasBack && calcResult.backResult && (
                    <TabsContent value="back" className="mt-4">
                      <SpiralLayoutSvg
                        result={calcResult.backResult}
                        pageWidth={inputs.pageWidth}
                        pageHeight={inputs.pageHeight}
                        label="Back Cover"
                      />
                    </TabsContent>
                  )}
                </Tabs>
                  {/* Paper stats under layout */}
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
                <SpiralDetails result={calcResult} onLevelChange={handleLevelChange} onEffectiveTotalChange={setEffectiveTotal} isBroker={inputs.isBroker} onBrokerChange={handleBrokerChange} compact={viewMode === "compact"} />
              </div>
            </div>

            {/* Multi-Qty Comparison Table */}
            {multiQtyResults.length > 0 && (
              <GenericMultiQtyTable
                rows={multiQtyResults}
                onAddToQuote={handleAddMultiQtyToQuote}
                onAddAll={handleAddAllMultiQty}
                label="Spiral Binding Quantity Comparison"
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
              {!standalone && (
              <ShippingCalcButton
                pieceWidth={inputs.pageWidth}
                pieceHeight={inputs.pageHeight}
                quantity={inputs.bookQty}
                paperName={inputs.inside.paperName}
                sheetsPerPiece={Math.ceil(inputs.pagesPerBook / 2) + (inputs.useFrontCover ? 1 : 0) + (inputs.useBackCover ? 1 : 0)}
                itemLabel={`${inputs.bookQty.toLocaleString()} - ${inputs.pagesPerBook}pg Spiral Book`}
                productType="spiralBinding"
              />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
