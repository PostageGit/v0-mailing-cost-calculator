"use client"

import { useState, useCallback } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { FlatRevisionCalculator } from "@/components/revision/flat-revision-calculator"
import { PerfectRevisionCalculator } from "@/components/revision/perfect-revision-calculator"
import { BookletRevisionCalculator } from "@/components/revision/booklet-revision-calculator"
import type { PrintingInputs, FullPrintingResult } from "@/lib/printing-types"
import type { PerfectInputs, PerfectCalcResult } from "@/lib/perfect-types"
import type { BookletInputs, BookletCalcResult } from "@/lib/booklet-types"

// Chat quote type from dashboard
interface ChatQuote {
  id: string
  ref_number: number
  customer_name: string
  customer_email: string
  customer_phone: string
  project_name: string
  product_type: string
  total: number
  per_unit: number
  specs: Record<string, unknown>
  cost_breakdown: Record<string, unknown>
  parent_quote_id?: string
  revision_number?: number
}

interface ChatQuoteRevisionPanelProps {
  quote: ChatQuote | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRevisionSaved: () => void
}

// Helper to format the quote reference
function formatRef(refNumber: number, revision?: number): string {
  const base = `CQ-${refNumber}`
  return revision && revision > 0 ? `${base}-R${revision}` : base
}

export function ChatQuoteRevisionPanel({
  quote,
  open,
  onOpenChange,
  onRevisionSaved,
}: ChatQuoteRevisionPanelProps) {
  const [saving, setSaving] = useState(false)

  // Determine product type
  const productType = quote?.product_type?.toLowerCase() || "flat"
  const isFlat = productType === "flat" || !quote?.product_type
  const isPerfect = productType === "perfect"
  const isBooklet = productType === "booklet" || productType === "saddle"

  // Handle saving multiple flat revisions at once (multi-qty mode)
  const handleSaveMultipleFlat = useCallback(
    async (results: Array<{ qty: number; result: FullPrintingResult; inputs: PrintingInputs }>) => {
      if (!quote || results.length === 0) return

      setSaving(true)
      try {
        // Save each quantity option as a separate revision
        for (const { result, inputs } of results) {
          const response = await fetch("/api/chat-quotes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              parentQuoteId: quote.parent_quote_id || quote.id,
              projectName: quote.project_name,
              productType: "FLAT",
              total: result.grandTotal,
              perUnit: result.result.perPiece,
              specs: {
                quantity: inputs.qty,
                width: inputs.width,
                height: inputs.height,
                paper: inputs.paperName,
                sides: inputs.sidesValue,
                bleed: inputs.hasBleed,
                lamination: inputs.lamination?.enabled
                  ? `${inputs.lamination.type} (${inputs.lamination.sides})`
                  : "none",
                isBroker: inputs.isBroker,
              },
              costBreakdown: {
                printing: result.printingCost,
                lamination: result.laminationCost?.cost || 0,
                scoreFold: result.scoreFoldCost?.cost || 0,
                cutting: result.cuttingCost || 0,
              },
              revisedBy: "Multi-Qty",
            }),
          })

          if (!response.ok) {
            const err = await response.json()
            throw new Error(err.error || "Failed to save revision")
          }
        }

        onRevisionSaved()
        onOpenChange(false)
      } catch (e) {
        console.error("[v0] Failed to save multi-qty revisions:", e)
        alert(e instanceof Error ? e.message : "Failed to save revisions")
      } finally {
        setSaving(false)
      }
    },
    [quote, onRevisionSaved, onOpenChange]
  )

  // Handle saving a flat revision
  const handleSaveFlat = useCallback(
    async (result: FullPrintingResult, inputs: PrintingInputs) => {
      if (!quote) return

      setSaving(true)
      try {
        const response = await fetch("/api/chat-quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parentQuoteId: quote.parent_quote_id || quote.id,
            projectName: quote.project_name,
            productType: "FLAT",
            total: result.grandTotal,
            perUnit: result.result.perPiece,
            specs: {
              quantity: inputs.qty,
              width: inputs.width,
              height: inputs.height,
              paper: inputs.paperName,
              sides: inputs.sidesValue,
              bleed: inputs.hasBleed,
              lamination: inputs.lamination?.enabled
                ? `${inputs.lamination.type} (${inputs.lamination.sides})`
                : "none",
              isBroker: inputs.isBroker,
            },
            costBreakdown: {
              printing: result.printingCost,
              lamination: result.laminationCost?.cost || 0,
              scoreFold: result.scoreFoldCost?.cost || 0,
              cutting: result.cuttingCost || 0,
            },
            revisedBy: "Manual",
          }),
        })

        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || "Failed to save revision")
        }

        onRevisionSaved()
        onOpenChange(false)
      } catch (e) {
        console.error("[v0] Failed to save flat revision:", e)
        alert(e instanceof Error ? e.message : "Failed to save revision")
      } finally {
        setSaving(false)
      }
    },
    [quote, onRevisionSaved, onOpenChange]
  )

  // Handle saving multiple perfect revisions (multi-qty)
  const handleSaveMultiplePerfect = useCallback(
    async (results: Array<{ qty: number; result: PerfectCalcResult; inputs: PerfectInputs }>) => {
      if (!quote || results.length === 0) return
      setSaving(true)
      try {
        for (const { result, inputs } of results) {
          const response = await fetch("/api/chat-quotes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              parentQuoteId: quote.parent_quote_id || quote.id,
              projectName: quote.project_name,
              productType: "PERFECT",
              total: result.grandTotal,
              perUnit: result.perBook,
              specs: {
                quantity: inputs.bookQty,
                pagesPerBook: inputs.pagesPerBook,
                width: inputs.pageWidth,
                height: inputs.pageHeight,
                coverPaper: inputs.cover.paperName,
                coverSides: inputs.cover.sides,
                insidePaper: inputs.inside.paperName,
                insideSides: inputs.inside.sides,
                lamination: inputs.laminationType,
                isBroker: inputs.isBroker,
              },
              revisedBy: "Multi-Qty",
            }),
          })
          if (!response.ok) throw new Error("Failed to save revision")
        }
        onRevisionSaved()
        onOpenChange(false)
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to save revisions")
      } finally {
        setSaving(false)
      }
    },
    [quote, onRevisionSaved, onOpenChange]
  )

  // Handle saving a perfect-bound revision
  const handleSavePerfect = useCallback(
    async (result: PerfectCalcResult, inputs: PerfectInputs) => {
      if (!quote) return

      setSaving(true)
      try {
        const response = await fetch("/api/chat-quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parentQuoteId: quote.parent_quote_id || quote.id,
            projectName: quote.project_name,
            productType: "PERFECT",
            total: result.grandTotal,
            perUnit: result.pricePerBook,
            specs: {
              quantity: inputs.bookQty,
              pagesPerBook: inputs.pagesPerBook,
              width: inputs.pageWidth,
              height: inputs.pageHeight,
              coverPaper: inputs.cover.paperName,
              coverSides: inputs.cover.sides,
              coverBleed: inputs.cover.hasBleed,
              insidePaper: inputs.inside.paperName,
              insideSides: inputs.inside.sides,
              insideBleed: inputs.inside.hasBleed,
              lamination: inputs.laminationType,
              isBroker: inputs.isBroker,
            },
            costBreakdown: {
              coverPrinting: result.coverResult.cost,
              insidePrinting: result.insideResult.cost,
              binding: result.totalBindingPrice,
              lamination: result.totalLaminationCost,
              brokerDiscount: result.brokerDiscountAmount,
            },
            revisedBy: "Manual",
          }),
        })

        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || "Failed to save revision")
        }

        onRevisionSaved()
        onOpenChange(false)
      } catch (e) {
        console.error("[v0] Failed to save perfect revision:", e)
        alert(e instanceof Error ? e.message : "Failed to save revision")
      } finally {
        setSaving(false)
      }
    },
    [quote, onRevisionSaved, onOpenChange]
  )

  // Handle saving multiple booklet revisions (multi-qty)
  const handleSaveMultipleBooklet = useCallback(
    async (results: Array<{ qty: number; result: BookletCalcResult; inputs: BookletInputs }>) => {
      if (!quote || results.length === 0) return
      setSaving(true)
      try {
        for (const { result, inputs } of results) {
          const response = await fetch("/api/chat-quotes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              parentQuoteId: quote.parent_quote_id || quote.id,
              projectName: quote.project_name,
              productType: "BOOKLET",
              total: result.grandTotal,
              perUnit: result.perBooklet,
              specs: {
                quantity: inputs.bookQty,
                pagesPerBook: inputs.pagesPerBook,
                width: inputs.pageWidth,
                height: inputs.pageHeight,
                separateCover: inputs.separateCover,
                coverPaper: inputs.coverPaper,
                coverSides: inputs.coverSides,
                insidePaper: inputs.insidePaper,
                insideSides: inputs.insideSides,
                lamination: inputs.laminationType,
                isBroker: inputs.isBroker,
              },
              revisedBy: "Multi-Qty",
            }),
          })
          if (!response.ok) throw new Error("Failed to save revision")
        }
        onRevisionSaved()
        onOpenChange(false)
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to save revisions")
      } finally {
        setSaving(false)
      }
    },
    [quote, onRevisionSaved, onOpenChange]
  )

  // Handle saving a booklet revision
  const handleSaveBooklet = useCallback(
    async (result: BookletCalcResult, inputs: BookletInputs) => {
      if (!quote) return

      setSaving(true)
      try {
        const response = await fetch("/api/chat-quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parentQuoteId: quote.parent_quote_id || quote.id,
            projectName: quote.project_name,
            productType: "BOOKLET",
            total: result.grandTotal,
            perUnit: result.perBooklet,
            specs: {
              quantity: inputs.bookQty,
              pagesPerBook: inputs.pagesPerBook,
              width: inputs.pageWidth,
              height: inputs.pageHeight,
              separateCover: inputs.separateCover,
              coverPaper: inputs.coverPaper,
              coverSides: inputs.coverSides,
              coverBleed: inputs.coverBleed,
              insidePaper: inputs.insidePaper,
              insideSides: inputs.insideSides,
              insideBleed: inputs.insideBleed,
              lamination: inputs.laminationType,
              isBroker: inputs.isBroker,
            },
            costBreakdown: {
              coverPrinting: result.coverResult?.cost || 0,
              insidePrinting: result.insideResult.cost,
              binding: result.totalBindingPrice,
              lamination: result.totalLaminationCost,
              brokerDiscount: result.brokerDiscountAmount,
            },
            revisedBy: "Manual",
          }),
        })

        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || "Failed to save revision")
        }

        onRevisionSaved()
        onOpenChange(false)
      } catch (e) {
        console.error("[v0] Failed to save booklet revision:", e)
        alert(e instanceof Error ? e.message : "Failed to save revision")
      } finally {
        setSaving(false)
      }
    },
    [quote, onRevisionSaved, onOpenChange]
  )

  if (!quote) return null

  const originalRef = formatRef(quote.ref_number, quote.revision_number)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
            >
              REVISION
            </Badge>
            <Badge variant="secondary" className="text-xs uppercase">
              {productType}
            </Badge>
            <SheetTitle className="text-lg">{originalRef}</SheetTitle>
          </div>
          <SheetDescription>
            {quote.project_name} | {quote.customer_name || "No customer"}
          </SheetDescription>
        </SheetHeader>

        {/* Product-specific calculator */}
        {isFlat && (
<FlatRevisionCalculator
  initialSpecs={quote.specs || {}}
  originalTotal={quote.total}
  onSave={handleSaveFlat}
  onSaveMultiple={handleSaveMultipleFlat}
  saving={saving}
  />
        )}

        {isPerfect && (
          <PerfectRevisionCalculator
            initialSpecs={quote.specs || {}}
            originalTotal={quote.total}
            onSave={handleSavePerfect}
            onSaveMultiple={handleSaveMultiplePerfect}
            saving={saving}
          />
        )}

        {isBooklet && (
          <BookletRevisionCalculator
            initialSpecs={quote.specs || {}}
            originalTotal={quote.total}
            onSave={handleSaveBooklet}
            onSaveMultiple={handleSaveMultipleBooklet}
            saving={saving}
          />
        )}

        {/* Unknown product type message */}
        {!isFlat && !isPerfect && !isBooklet && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 p-4">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
              Unknown product type: {quote.product_type}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              This quote cannot be revised in this panel. Please create a new quote using the
              appropriate calculator.
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="mt-4 w-full">
              Close
            </Button>
          </div>
        )}

        {/* Loading overlay when saving */}
        {saving && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
            <div className="flex items-center gap-2 bg-card p-4 rounded-lg shadow-lg">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm font-medium">Saving revision...</span>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
