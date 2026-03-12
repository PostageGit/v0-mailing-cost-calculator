"use client"

import { useState, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { BookletForm } from "./booklet-form"
import { BookletLayoutSvg } from "./booklet-layout-svg"
import { BookletDetails } from "./booklet-details"
import { PaperStatsRow } from "@/components/calc-price-card"
import { calculateBooklet } from "@/lib/booklet-pricing"
import type { BookletInputs, BookletCalcResult } from "@/lib/booklet-types"
import { useQuote } from "@/lib/quote-context"
import { formatCurrency } from "@/lib/pricing"
import { useGlobalChat } from "@/lib/chat-context"
import { bookletSpecsToChat } from "@/lib/specs-to-chat"
import { AlertTriangle, Plus, ArrowDown, Save, Pencil, ExternalLink, MessageCircle, Truck } from "lucide-react"
import { ShippingCalcButton } from "@/components/shipping-calc-dialog"
import { calcSheetWeightOz } from "@/lib/paper-weights"
import { useMailing, PIECE_TYPE_META, type MailPiece } from "@/lib/mailing-context"

const EMPTY_INPUTS: BookletInputs = {
  bookQty: 0,
  pagesPerBook: 0,
  pageWidth: 0,
  pageHeight: 0,
  separateCover: true,
  coverPaper: "80 Gloss",
  coverSides: "4/4",
  coverBleed: false,
  coverSheetSize: "cheapest",
  insidePaper: "20lb Offset",
  insideSides: "D/S",
  insideBleed: false,
  insideSheetSize: "cheapest",
  insertSections: [],      // empty = no inserts, all leaves same paper
  insertFeePerSection: 25, // $25 per insert section
  bindingType: "staple",   // staple (default), fold, or perfect
  laminationType: "none",
  customLevel: "auto",
  isBroker: false,
  printingMarkupPct: 0,
}

export function BookletCalculator() {
  const quote = useQuote()
  const mailing = useMailing()
  const { sendToChat } = useGlobalChat()

  // Booklet pieces from planner -- includes OHP so users can fill out full specs
  const bookletPieces = mailing.pieces.filter(
    (p) => p.type === "booklet" && (p.production === "inhouse" || p.production === "both" || p.production === "ohp")
  )

  const [inputs, setInputs] = useState<BookletInputs>(EMPTY_INPUTS)
  const [calcResult, setCalcResult] = useState<BookletCalcResult | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("cover")

  const [editingItemId] = useState<number | null>(null)
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
    inputs.pagesPerBook >= 8 &&
    inputs.pagesPerBook % 4 === 0 &&
    inputs.pageWidth >= 2.5 &&
    inputs.pageHeight >= 2.5 &&
    inputs.insidePaper !== "" &&
    inputs.insideSides !== "" &&
    (!inputs.separateCover || (inputs.coverPaper !== "" && inputs.coverSides !== ""))

  const handleCalculate = useCallback(() => {
  setValidationError(null)
  if (!isFormValid) {
  setValidationError("Please fill in all required fields correctly.")
  return
  }

  const result = calculateBooklet(inputs)
    if (!result.isValid) {
      setValidationError(result.error || "Calculation error.")
      setCalcResult(null)
      return
    }

    setCalcResult(result)
    setActiveTab(inputs.separateCover ? "cover" : "inside")
  }, [inputs, isFormValid])

  // Auto-recalculate when broker toggles and result already exists
  const handleBrokerChange = useCallback((val: boolean) => {
    const updated = { ...inputs, isBroker: val }
    setInputs(updated)
    if (calcResult) {
      const newResult = calculateBooklet(updated)
      if (newResult.isValid) setCalcResult(newResult)
    }
  }, [inputs, calcResult])

  // Change pricing level via the level bars
  const handleLevelChange = useCallback((delta: number) => {
    if (!calcResult) return
    const currentLevel = calcResult.coverResult.level || calcResult.insideResult.level
    const newLevel = Math.max(1, Math.min(10, currentLevel + delta))
    if (newLevel === currentLevel) return
    const updatedInputs = { ...inputs, customLevel: String(newLevel) }
    const newResult = calculateBooklet(updatedInputs)
    if (!newResult.isValid) return
    setInputs(updatedInputs)
    setCalcResult(newResult)
  }, [calcResult, inputs])

  function resetForm() {
    setInputs(EMPTY_INPUTS)
    setCalcResult(null)
    setValidationError(null)
  }

  const bookletPiece = bookletPieces.length > 0 ? bookletPieces[0] : null
  const [activePiece, setActivePiece] = useState<MailPiece | null>(null)
  const isOhpMode = activePiece?.production === "ohp"
  const [ohpSpecsSaved, setOhpSpecsSaved] = useState(false)

  const handleSaveOhpSpecs = useCallback(() => {
    if (!activePiece || !inputs.bookQty || !inputs.pagesPerBook || !inputs.pageWidth || !inputs.pageHeight) return
    const descLines: string[] = []
    const hasBleed = inputs.coverBleed || inputs.insideBleed
    const dimStr = `${inputs.pageWidth}x${inputs.pageHeight}"`
    descLines.push(hasBleed ? `${dimStr} + Bleed` : `${dimStr} - No Bleed`)
    descLines.push(`${inputs.pagesPerBook} Pages`)
    descLines.push(inputs.separateCover ? `Inside pages: ${inputs.insidePaper} ${inputs.insideSides}` : `${inputs.insidePaper}`)
    if (inputs.separateCover) descLines.push(`Cover: ${inputs.coverPaper}, ${inputs.coverSides}`)
    if (!inputs.separateCover) descLines.push(inputs.insideSides)
    if (inputs.laminationType !== "none") {
      descLines.push(`${inputs.laminationType.charAt(0).toUpperCase() + inputs.laminationType.slice(1)} Lamination`)
    }
    quote.addItem({
      category: "ohp",
      label: `${inputs.bookQty.toLocaleString()} - Saddle Stitch Book`,
      description: descLines.join(", "),
      amount: 0,
      metadata: {
        pieceType: activePiece.type,
        pieceLabel: activePiece.label,
        pieceDimensions: `${inputs.pageWidth}x${inputs.pageHeight}`,
        production: "ohp",
        piecePosition: activePiece.position,
        paperName: inputs.insidePaper,
        sides: inputs.insideSides,
        pageCount: inputs.pagesPerBook,
        coverPaper: inputs.separateCover ? inputs.coverPaper : undefined,
        coverSides: inputs.separateCover ? inputs.coverSides : undefined,
        hasBleed: inputs.coverBleed || inputs.insideBleed || undefined,
        laminationEnabled: inputs.laminationType !== "none" || undefined,
        laminationType: inputs.laminationType !== "none" ? inputs.laminationType : undefined,
      },
    })
    setOhpSpecsSaved(true)
  }, [inputs, activePiece, quote])

  const handleAddToQuote = useCallback(() => {
    if (!calcResult || !calcResult.isValid) return
    const coverDesc = inputs.separateCover ? `w/ ${calcResult.coverResult.paper} Cover` : "Self-Cover"
    const desc = `${inputs.insidePaper}, ${calcResult.insideResult.sides}${inputs.laminationType !== "none" ? `, ${inputs.laminationType} lam.` : ""}`
    quote.addItem({
      category: "booklet",
      label: `${inputs.bookQty.toLocaleString()} - ${inputs.pagesPerBook}pg Booklet ${inputs.pageWidth}x${inputs.pageHeight} ${coverDesc}`,
      description: desc,
      amount: effectiveTotal > 0 ? effectiveTotal : calcResult.grandTotal,
      metadata: {
        pieceType: bookletPiece?.type || "booklet",
        pieceLabel: bookletPiece?.label || undefined,
        pieceDimensions: `${inputs.pageWidth}x${inputs.pageHeight}`,
        production: bookletPiece?.production || "inhouse",
        piecePosition: bookletPiece?.position || undefined,
        paperName: inputs.insidePaper,
        sides: calcResult.insideResult.sides,
        pageCount: inputs.pagesPerBook,
      },
    })
  }, [calcResult, inputs, quote, effectiveTotal, bookletPiece])

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
          {isOhpMode ? "Booklet Specs (OHP)" : "Saddle Stitch Booklet Calculator"}
        </h2>

          {/* Piece selector -- auto-fill from planner */}
          {bookletPieces.length > 0 && (
            <div className="mb-4 rounded-xl border border-border bg-secondary/20 p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Load from planner
              </p>
              <div className="flex flex-wrap gap-2">
                {bookletPieces.map((piece) => {
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
                          {piece.width && piece.height ? `${piece.width}" x ${piece.height}" closed` : "No size"}
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
                <span className="px-2 py-1 rounded-md bg-sky-100 dark:bg-sky-900/40 text-[11px] font-medium text-sky-800 dark:text-sky-300">{inputs.pageWidth}" x {inputs.pageHeight}" {(inputs.coverBleed || inputs.insideBleed) ? "+ Bleed" : "- No Bleed"}</span>
                <span className="px-2 py-1 rounded-md bg-sky-100 dark:bg-sky-900/40 text-[11px] font-medium text-sky-800 dark:text-sky-300">{inputs.pagesPerBook} Pages</span>
                <span className="px-2 py-1 rounded-md bg-sky-100 dark:bg-sky-900/40 text-[11px] font-medium text-sky-800 dark:text-sky-300">{inputs.separateCover ? `Inside pages: ${inputs.insidePaper} ${inputs.insideSides}` : inputs.insidePaper}</span>
                {inputs.separateCover && <span className="px-2 py-1 rounded-md bg-sky-100 dark:bg-sky-900/40 text-[11px] font-medium text-sky-800 dark:text-sky-300">Cover: {inputs.coverPaper} {inputs.coverSides}</span>}
                {!inputs.separateCover && <span className="px-2 py-1 rounded-md bg-sky-100 dark:bg-sky-900/40 text-[11px] font-medium text-sky-800 dark:text-sky-300">{inputs.insideSides}</span>}
                {inputs.laminationType !== "none" && <span className="px-2 py-1 rounded-md bg-sky-100 dark:bg-sky-900/40 text-[11px] font-medium text-sky-800 dark:text-sky-300">{inputs.laminationType.charAt(0).toUpperCase() + inputs.laminationType.slice(1)} Lamination</span>}
              </div>
            </div>
          )}

          {/* Form: show when NOT in saved OHP state */}
          {!(isOhpMode && ohpSpecsSaved) && (
            <>
          <BookletForm
            inputs={inputs}
            onInputsChange={setInputs}
            onCalculate={isOhpMode ? handleSaveOhpSpecs : handleCalculate}
            onReset={() => { resetForm(); setOhpSpecsSaved(false) }}
            isEditing={editingItemId !== null}
            validationError={validationError}
            ohpMode={isOhpMode}
          />
            </>
          )}

          {/* Results (in-house only) */}
          {!isOhpMode && calcResult && calcResult.isValid && (
            <div className="mt-6 pt-6 border-t border-border">
              {/* Warnings */}
              {calcResult.warnings.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-700 text-sm p-3 rounded-lg mb-4 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>{calcResult.warnings.join(" ")}</div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* SVG Tabs */}
                <div className="flex flex-col">
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="w-full">
                      {inputs.separateCover && (
                        <TabsTrigger value="cover" className="flex-1">Cover</TabsTrigger>
                      )}
                      <TabsTrigger value="inside" className="flex-1">Inside Pages</TabsTrigger>
                    </TabsList>

                    {inputs.separateCover && (
                      <TabsContent value="cover" className="mt-4">
                        <BookletLayoutSvg
                          result={calcResult.coverResult}
                          spreadWidth={calcResult.spreadWidth}
                          spreadHeight={calcResult.spreadHeight}
                          label="Cover"
                        />
                      </TabsContent>
                    )}

                    <TabsContent value="inside" className="mt-4">
                      <BookletLayoutSvg
                        result={calcResult.insideResult}
                        spreadWidth={calcResult.spreadWidth}
                        spreadHeight={calcResult.spreadHeight}
                        label="Inside Pages"
                      />
                    </TabsContent>
                  </Tabs>
                  {/* Paper stats under layout */}
                  {(() => {
                    const r = activeTab === "cover" && calcResult.coverResult.paper !== "N/A" ? calcResult.coverResult : calcResult.insideResult
                    return (
                      <div className="mt-3">
                        <p className="text-center text-xs font-semibold text-foreground mb-1.5">{r.paper}</p>
                        <PaperStatsRow stats={[
                          { label: "Sheet", value: r.sheetSize },
                          { label: "Ups", value: String(r.maxUps) },
                          { label: "Sheets", value: r.sheets.toLocaleString() },
                        ]} />
                      </div>
                    )
                  })()}
                </div>

                {/* Price Details */}
                <div className="flex flex-col gap-4">
                  <BookletDetails
                    result={calcResult}
                    bookQty={inputs.bookQty}
                    inputs={inputs}
                    onLevelChange={handleLevelChange}
                    onEffectiveTotalChange={setEffectiveTotal}
                    onBrokerChange={handleBrokerChange}
                  />
                </div>
              </div>

              {/* Add to Quote + Shipping + Compare with Chat */}
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={handleAddToQuote}
                  className="flex-1 gap-2 rounded-full bg-foreground text-background hover:bg-foreground/90"
                  size="lg"
                >
                  <Plus className="h-4 w-4" />
                  Add to Quote - {formatCurrency(effectiveTotal > 0 ? effectiveTotal : calcResult.grandTotal)}
                </Button>
                <ShippingCalcButton
                  pieceWidth={inputs.pageWidth}
                  pieceHeight={inputs.pageHeight}
                  quantity={inputs.bookQty}
                  paperName={inputs.insidePaper}
                  sheetsPerPiece={Math.ceil(inputs.pagesPerBook / 2) + (inputs.separateCover ? 1 : 0)}
                  itemLabel={`${inputs.bookQty.toLocaleString()} - ${inputs.pagesPerBook}pg Booklet`}
                  perPieceWeightOz={(() => {
                    // Calculate accurate booklet weight using finish size (after bleed trim)
                    // Inside pages: pagesPerBook / 2 = sheets (each sheet has 2 pages)
                    const insideSheets = Math.ceil(inputs.pagesPerBook / 2)
                    const insideOzPerSheet = calcSheetWeightOz(inputs.insidePaper, inputs.pageWidth, inputs.pageHeight)
                    const insideTotalOz = insideOzPerSheet ? insideOzPerSheet * insideSheets : 0
                    
                    // Cover: 1 sheet of cover stock (covers front + back)
                    // Cover sheet spans 2x width when open (wraps around spine)
                    const coverOzPerSheet = inputs.separateCover 
                      ? calcSheetWeightOz(inputs.coverPaper, inputs.pageWidth * 2, inputs.pageHeight)
                      : 0
                    const coverTotalOz = coverOzPerSheet || 0
                    
                    return insideTotalOz + coverTotalOz
                  })()}
                />
                <Button
                  onClick={() => sendToChat(bookletSpecsToChat(inputs))}
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
