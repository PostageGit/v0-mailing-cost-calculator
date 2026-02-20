"use client"

import { useState, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { PerfectForm } from "./perfect-form"
import { PerfectLayoutSvg } from "./perfect-layout-svg"
import { PerfectDetails } from "./perfect-details"
import { calculatePerfect } from "@/lib/perfect-pricing"
import { defaultPerfectInputs } from "@/lib/perfect-types"
import type { PerfectInputs, PerfectCalcResult } from "@/lib/perfect-types"
import { useQuote } from "@/lib/quote-context"
import { formatCurrency } from "@/lib/pricing"
import { Plus, ArrowDown } from "lucide-react"
import { useMailing, PIECE_TYPE_META, type MailPiece } from "@/lib/mailing-context"

export function PerfectCalculator() {
  const quote = useQuote()
  const mailing = useMailing()

  // Perfect-bound pieces from planner that need in-house production
  const perfectPieces = mailing.pieces.filter(
    (p) => p.type === "perfect_bound" && (p.production === "inhouse" || p.production === "both")
  )

  const [inputs, setInputs] = useState<PerfectInputs>(defaultPerfectInputs())
  const [calcResult, setCalcResult] = useState<PerfectCalcResult | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("cover")
  const [effectiveTotal, setEffectiveTotal] = useState<number>(0)

  const loadPiece = useCallback((piece: MailPiece) => {
    setInputs((prev) => ({
      ...prev,
      bookQty: mailing.quantity || prev.bookQty,
      pageWidth: piece.width || prev.pageWidth,
      pageHeight: piece.height || prev.pageHeight,
    }))
    setCalcResult(null)
    setValidationError(null)
  }, [mailing.quantity])

  const isFormValid =
    inputs.bookQty > 0 &&
    inputs.pagesPerBook >= 40 &&
    inputs.pageWidth >= 2.5 &&
    inputs.pageHeight >= 2.5 &&
    inputs.cover.paperName !== "" &&
    inputs.cover.sides !== "" &&
    inputs.inside.paperName !== "" &&
    inputs.inside.sides !== ""

  const handleCalculate = useCallback(() => {
    setValidationError(null)
    if (!isFormValid) {
      setValidationError("Please fill in all required fields correctly. Page amount must be at least 40.")
      return
    }

    const result = calculatePerfect(inputs)
    if ("error" in result) {
      setValidationError(result.error)
      setCalcResult(null)
      return
    }

    setCalcResult(result)
    setActiveTab("cover")
  }, [inputs, isFormValid])

  function resetForm() {
    setInputs(defaultPerfectInputs())
    setCalcResult(null)
    setValidationError(null)
  }

  const perfectPiece = perfectPieces.length > 0 ? perfectPieces[0] : null

  const handleAddToQuote = useCallback(() => {
    if (!calcResult) return
    const extras: string[] = []
    if (calcResult.laminationType !== "none") {
      extras.push(`Lamination: ${calcResult.laminationType.charAt(0).toUpperCase() + calcResult.laminationType.slice(1)}`)
    }
    if (calcResult.isBroker) extras.push("Broker")
    const extrasStr = extras.length > 0 ? ` (${extras.join(", ")})` : ""
    const desc = `Cover: ${calcResult.coverResult.paper}, ${calcResult.coverResult.sides} | Pages: ${calcResult.insideResult.paper}, ${calcResult.insideResult.sides}${extrasStr}`
    quote.addItem({
      category: "perfect",
      label: `${inputs.bookQty.toLocaleString()} - ${inputs.pagesPerBook}pg Glue Bind ${inputs.pageWidth}x${inputs.pageHeight}`,
      description: desc,
      amount: effectiveTotal > 0 ? effectiveTotal : calcResult.grandTotal,
      metadata: {
        pieceType: perfectPiece?.type || "perfect_bound",
        pieceLabel: perfectPiece?.label || undefined,
        pieceDimensions: `${inputs.pageWidth}x${inputs.pageHeight}`,
        production: perfectPiece?.production || "inhouse",
        piecePosition: perfectPiece?.position || undefined,
        paperName: calcResult.insideResult.paper,
        sides: calcResult.insideResult.sides,
        pageCount: inputs.pagesPerBook,
        laminationEnabled: calcResult.laminationType !== "none" || undefined,
        laminationType: calcResult.laminationType !== "none" ? calcResult.laminationType : undefined,
      },
    })
  }, [calcResult, inputs, quote, effectiveTotal, perfectPiece])

  return (
    <div className="flex flex-col gap-5 min-h-0 flex-grow max-w-4xl">
      <div className="bg-card rounded-2xl border border-border p-6 flex flex-col">
        <h2 className="text-base font-semibold text-foreground mb-2">Perfect Binding Calculator</h2>

        {/* Piece selector -- auto-fill from planner */}
        {perfectPieces.length > 0 && (
          <div className="mb-4 rounded-xl border border-border bg-secondary/20 p-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Load from planner
            </p>
            <div className="flex flex-wrap gap-2">
              {perfectPieces.map((piece) => {
                const meta = PIECE_TYPE_META[piece.type]
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

        <PerfectForm
          inputs={inputs}
          onInputsChange={setInputs}
          onCalculate={handleCalculate}
          onAddToOrder={handleAddToQuote}
          onReset={resetForm}
          isEditing={false}
          canAddToOrder={calcResult !== null}
          validationError={validationError}
        />

        {/* Results */}
        {calcResult && (
          <div className="mt-6 pt-6 border-t border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* SVG Tabs */}
              <div className="flex flex-col">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full">
                    <TabsTrigger value="cover" className="flex-1">Cover</TabsTrigger>
                    <TabsTrigger value="inside" className="flex-1">Inside Pages</TabsTrigger>
                  </TabsList>

                  <TabsContent value="cover" className="mt-4">
                    <PerfectLayoutSvg
                      result={calcResult.coverResult}
                      pageWidth={calcResult.coverPageWidth}
                      pageHeight={calcResult.coverPageHeight}
                      label="Cover"
                      spineWidth={calcResult.spineWidth}
                    />
                  </TabsContent>

                  <TabsContent value="inside" className="mt-4">
                    <PerfectLayoutSvg
                      result={calcResult.insideResult}
                      pageWidth={inputs.pageWidth}
                      pageHeight={inputs.pageHeight}
                      label="Inside Pages"
                    />
                  </TabsContent>
                </Tabs>
              </div>

              {/* Price Details */}
              <div className="flex flex-col gap-4">
                <PerfectDetails result={calcResult} onEffectiveTotalChange={setEffectiveTotal} />
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
