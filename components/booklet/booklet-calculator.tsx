"use client"

import { useState, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { BookletForm } from "./booklet-form"
import { BookletLayoutSvg } from "./booklet-layout-svg"
import { BookletDetails } from "./booklet-details"
import { calculateBooklet } from "@/lib/booklet-pricing"
import type { BookletInputs, BookletCalcResult } from "@/lib/booklet-types"
import { useQuote } from "@/lib/quote-context"
import { formatCurrency } from "@/lib/pricing"
import { AlertTriangle, Plus, ArrowDown } from "lucide-react"
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
  insideSides: "S/S",
  insideBleed: false,
  insideSheetSize: "cheapest",
  laminationType: "none",
  customLevel: "auto",
  isBroker: false,
  printingMarkupPct: 10,
}

export function BookletCalculator() {
  const quote = useQuote()
  const mailing = useMailing()

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
    setInputs((prev) => ({
      ...prev,
      bookQty: mailing.printQty || prev.bookQty,
      pageWidth: piece.width || prev.pageWidth,
      pageHeight: piece.height || prev.pageHeight,
    }))
    setCalcResult(null)
    setValidationError(null)
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

  function resetForm() {
    setInputs(EMPTY_INPUTS)
    setCalcResult(null)
    setValidationError(null)
  }

  const bookletPiece = bookletPieces.length > 0 ? bookletPieces[0] : null

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
      <div className="bg-card rounded-2xl border border-border p-6 flex flex-col">
        <h2 className="text-base font-semibold text-foreground mb-2">Saddle Stitch Booklet Calculator</h2>

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

          <BookletForm
            inputs={inputs}
            onInputsChange={setInputs}
            onCalculate={handleCalculate}
            onAddToOrder={handleAddToQuote}
            onReset={resetForm}
            isEditing={editingItemId !== null}
            canAddToOrder={calcResult !== null && calcResult.isValid}
            validationError={validationError}
          />

          {/* Results */}
          {calcResult && calcResult.isValid && (
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
                </div>

                {/* Price Details */}
                <div className="flex flex-col gap-4">
              <BookletDetails
                result={calcResult}
                bookQty={inputs.bookQty}
                inputs={inputs}
                onEffectiveTotalChange={setEffectiveTotal}
              />
                  <Button
                    onClick={handleAddToQuote}
                    className="w-full gap-2 rounded-full bg-foreground text-background hover:bg-foreground/90"
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                    Add to Quote - {formatCurrency(effectiveTotal > 0 ? effectiveTotal : calcResult.grandTotal)}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
    </div>
  )
}
