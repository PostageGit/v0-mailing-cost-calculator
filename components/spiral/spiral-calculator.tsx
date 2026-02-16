"use client"

import { useState, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { SpiralForm } from "./spiral-form"
import { SpiralLayoutSvg } from "./spiral-layout-svg"
import { SpiralDetails } from "./spiral-details"
import { calculateSpiral } from "@/lib/spiral-pricing"
import { defaultSpiralInputs } from "@/lib/spiral-types"
import type { SpiralInputs, SpiralCalcResult } from "@/lib/spiral-types"
import { useQuote } from "@/lib/quote-context"
import { formatCurrency } from "@/lib/pricing"
import { Plus, ArrowDown } from "lucide-react"
import { useMailing, PIECE_TYPE_META, type MailPiece } from "@/lib/mailing-context"

export function SpiralCalculator() {
  const quote = useQuote()
  const mailing = useMailing()

  // Spiral pieces from planner that need in-house production
  const spiralPieces = mailing.pieces.filter(
    (p) => p.type === "spiral_book" && (p.production === "inhouse" || p.production === "both")
  )

  const [inputs, setInputs] = useState<SpiralInputs>(defaultSpiralInputs())
  const [calcResult, setCalcResult] = useState<SpiralCalcResult | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("inside")

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

    const result = calculateSpiral(inputs)
    if ("error" in result) {
      setValidationError(result.error)
      setCalcResult(null)
      return
    }

    setCalcResult(result)
    setActiveTab("inside")
  }, [inputs, isFormValid])

  function resetForm() {
    setInputs(defaultSpiralInputs())
    setCalcResult(null)
    setValidationError(null)
  }

  const handleAddToQuote = useCallback(() => {
    if (!calcResult) return
    const extras: string[] = []
    if (calcResult.hasClearPlastic) extras.push("Clear Plastic")
    if (calcResult.hasBlackVinyl) extras.push("Black Vinyl")
    if (calcResult.frontResult) extras.push("Printed Front Cover")
    if (calcResult.backResult) extras.push("Printed Back Cover")
    const extrasStr = extras.length > 0 ? ` (${extras.join(", ")})` : ""
    const desc = `${calcResult.insideResult.paper}, ${calcResult.insideResult.sides}${extrasStr}`
    quote.addItem({
      category: "spiral",
      label: `${inputs.bookQty.toLocaleString()} - ${inputs.pagesPerBook}pg Spiral Book ${inputs.pageWidth}x${inputs.pageHeight}`,
      description: desc,
      amount: calcResult.grandTotal,
    })
  }, [calcResult, inputs, quote])

  // Determine which tabs to show
  const hasFront = calcResult?.frontResult != null
  const hasBack = calcResult?.backResult != null

  return (
    <div className="flex flex-col gap-5 min-h-0 flex-grow max-w-4xl">
      <div className="bg-card rounded-2xl border border-border p-6 flex flex-col">
        <h2 className="text-base font-semibold text-foreground mb-2">Spiral Binding Calculator</h2>

        {/* Piece selector -- auto-fill from planner */}
        {spiralPieces.length > 0 && (
          <div className="mb-4 rounded-xl border border-border bg-secondary/20 p-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Load from planner
            </p>
            <div className="flex flex-wrap gap-2">
              {spiralPieces.map((piece) => {
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

        <SpiralForm
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
              </div>

              {/* Price Details */}
              <div className="flex flex-col gap-4">
                <SpiralDetails result={calcResult} />
                <Button
                  onClick={handleAddToQuote}
                  className="w-full gap-2 rounded-full bg-foreground text-background hover:bg-foreground/90"
                  size="sm"
                >
                  <Plus className="h-4 w-4" />
                  Add to Quote - {formatCurrency(calcResult.grandTotal)}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
