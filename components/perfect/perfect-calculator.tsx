"use client"

import { useState, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { PerfectForm } from "./perfect-form"
import { PerfectLayoutSvg } from "./perfect-layout-svg"
import { PerfectDetails } from "./perfect-details"
import { PaperStatsRow } from "@/components/calc-price-card"
import { calculatePerfect } from "@/lib/perfect-pricing"
import { defaultPerfectInputs } from "@/lib/perfect-types"
import type { PerfectInputs, PerfectCalcResult } from "@/lib/perfect-types"
import { useQuote } from "@/lib/quote-context"
import { formatCurrency } from "@/lib/pricing"
import { useGlobalChat } from "@/lib/chat-context"
import { perfectSpecsToChat } from "@/lib/specs-to-chat"
import { Plus, ArrowDown, Save, Pencil, ExternalLink, MessageCircle } from "lucide-react"
import { useMailing, PIECE_TYPE_META, type MailPiece } from "@/lib/mailing-context"

export function PerfectCalculator() {
  const quote = useQuote()
  const mailing = useMailing()
  const { sendToChat } = useGlobalChat()

  // Perfect-bound pieces from planner -- includes OHP so users can fill out full specs
  const perfectPieces = mailing.pieces.filter(
    (p) => p.type === "perfect_bound" && (p.production === "inhouse" || p.production === "both" || p.production === "ohp")
  )

  const [inputs, setInputs] = useState<PerfectInputs>(defaultPerfectInputs())
  const [calcResult, setCalcResult] = useState<PerfectCalcResult | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("cover")
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

  const handleBrokerChange = useCallback((val: boolean) => {
    const updated = { ...inputs, isBroker: val }
    setInputs(updated)
    if (calcResult) {
      const newResult = calculatePerfect(updated)
      if (!("error" in newResult)) setCalcResult(newResult)
    }
  }, [inputs, calcResult])

  // Change pricing level via the level bars
  const handleLevelChange = useCallback((delta: number) => {
    if (!calcResult) return
    const currentLevel = calcResult.insideResult.level
    const newLevel = Math.max(1, Math.min(10, currentLevel + delta))
    if (newLevel === currentLevel) return
    const updatedInputs = { ...inputs, customLevel: String(newLevel) }
    const newResult = calculatePerfect(updatedInputs)
    if ("error" in newResult) return
    setInputs(updatedInputs)
    setCalcResult(newResult)
  }, [calcResult, inputs])

  function resetForm() {
    setInputs(defaultPerfectInputs())
    setCalcResult(null)
    setValidationError(null)
  }

  const perfectPiece = perfectPieces.length > 0 ? perfectPieces[0] : null
  const [activePiece, setActivePiece] = useState<MailPiece | null>(null)
  const isOhpMode = activePiece?.production === "ohp"
  const [ohpSpecsSaved, setOhpSpecsSaved] = useState(false)

  const handleSaveOhpSpecs = useCallback(() => {
    if (!activePiece || !inputs.bookQty || !inputs.pagesPerBook || !inputs.pageWidth || !inputs.pageHeight) return
    const descLines: string[] = []
    const hasBleed = inputs.cover.bleed || inputs.inside.bleed
    const dimStr = `${inputs.pageWidth}x${inputs.pageHeight}"`
    descLines.push(hasBleed ? `${dimStr} + Bleed` : `${dimStr} - No Bleed`)
    descLines.push(`${inputs.pagesPerBook} Pages`)
    descLines.push(`Inside pages: ${inputs.inside.paperName} ${inputs.inside.sides}`)
    descLines.push(`Cover: ${inputs.cover.paperName}, ${inputs.cover.sides}`)
    if (inputs.laminationType !== "none") {
      descLines.push(`${inputs.laminationType.charAt(0).toUpperCase() + inputs.laminationType.slice(1)} Lamination`)
    }
    quote.addItem({
      category: "ohp",
      label: `${inputs.bookQty.toLocaleString()} - Perfect Bound Book`,
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
        coverPaper: inputs.cover.paperName,
        coverSides: inputs.cover.sides,
        hasBleed: inputs.cover.bleed || inputs.inside.bleed || undefined,
        laminationEnabled: inputs.laminationType !== "none" || undefined,
        laminationType: inputs.laminationType !== "none" ? inputs.laminationType : undefined,
      },
    })
    setOhpSpecsSaved(true)
  }, [inputs, activePiece, quote])

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
          {isOhpMode ? "Glue Bind Specs (OHP)" : "Perfect Binding Calculator"}
        </h2>

        {/* Piece selector -- auto-fill from planner */}
        {perfectPieces.length > 0 && (
          <div className="mb-4 rounded-xl border border-border bg-secondary/20 p-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Load from planner
            </p>
            <div className="flex flex-wrap gap-2">
              {perfectPieces.map((piece) => {
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
              <span className="px-2 py-1 rounded-md bg-sky-100 dark:bg-sky-900/40 text-[11px] font-medium text-sky-800 dark:text-sky-300">{inputs.pageWidth}" x {inputs.pageHeight}" {(inputs.cover.bleed || inputs.inside.bleed) ? "+ Bleed" : "- No Bleed"}</span>
              <span className="px-2 py-1 rounded-md bg-sky-100 dark:bg-sky-900/40 text-[11px] font-medium text-sky-800 dark:text-sky-300">{inputs.pagesPerBook} Pages</span>
              <span className="px-2 py-1 rounded-md bg-sky-100 dark:bg-sky-900/40 text-[11px] font-medium text-sky-800 dark:text-sky-300">Inside pages: {inputs.inside.paperName} {inputs.inside.sides}</span>
              <span className="px-2 py-1 rounded-md bg-sky-100 dark:bg-sky-900/40 text-[11px] font-medium text-sky-800 dark:text-sky-300">Cover: {inputs.cover.paperName} {inputs.cover.sides}</span>
              {inputs.laminationType !== "none" && <span className="px-2 py-1 rounded-md bg-sky-100 dark:bg-sky-900/40 text-[11px] font-medium text-sky-800 dark:text-sky-300">{inputs.laminationType.charAt(0).toUpperCase() + inputs.laminationType.slice(1)} Lamination</span>}
            </div>
          </div>
        )}

        {/* Form: show when NOT in saved OHP state */}
        {!(isOhpMode && ohpSpecsSaved) && (
          <>
        <PerfectForm
          inputs={inputs}
          onInputsChange={setInputs}
          onCalculate={isOhpMode ? handleSaveOhpSpecs : handleCalculate}
          onReset={() => { resetForm(); setOhpSpecsSaved(false) }}
          isEditing={false}
          validationError={validationError}
          ohpMode={isOhpMode}
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
                  {/* Paper stats under layout */}
                  {(() => {
                    const r = activeTab === "cover" ? calcResult.coverResult : calcResult.insideResult
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
                <PerfectDetails result={calcResult} onLevelChange={handleLevelChange} onEffectiveTotalChange={setEffectiveTotal} onBrokerChange={handleBrokerChange} />
              </div>
            </div>

            {/* Add to Quote + Compare with Chat */}
            <div className="flex gap-2 mt-4">
              <Button
                onClick={handleAddToQuote}
                className="flex-1 gap-2 rounded-full bg-foreground text-background hover:bg-foreground/90"
                size="lg"
              >
                <Plus className="h-4 w-4" />
                Add to Quote - {formatCurrency(effectiveTotal > 0 ? effectiveTotal : calcResult.grandTotal)}
              </Button>
              <Button
                onClick={() => sendToChat(perfectSpecsToChat({
                  bookQty: inputs.bookQty, pagesPerBook: inputs.pagesPerBook,
                  pageWidth: inputs.pageWidth, pageHeight: inputs.pageHeight,
                  coverPaper: inputs.cover.paperName, coverSides: inputs.cover.sides,
                  coverBleed: inputs.cover.bleed, insidePaper: inputs.inside.paperName,
                  insideSides: inputs.inside.sides, insideBleed: inputs.inside.bleed,
                  laminationType: inputs.laminationType, isBroker: inputs.isBroker,
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
