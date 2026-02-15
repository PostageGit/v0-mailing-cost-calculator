"use client"

import { useState, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { BookletForm } from "./booklet-form"
import { BookletLayoutSvg } from "./booklet-layout-svg"
import { BookletDetails } from "./booklet-details"
import { BookletOrderSummary } from "./booklet-order-summary"
import { calculateBooklet } from "@/lib/booklet-pricing"
import type { BookletInputs, BookletCalcResult, BookletOrderItem } from "@/lib/booklet-types"
import { useQuote } from "@/lib/quote-context"
import { formatCurrency } from "@/lib/pricing"
import { AlertTriangle, Plus } from "lucide-react"

const EMPTY_INPUTS: BookletInputs = {
  bookQty: 0,
  pagesPerBook: 0,
  pageWidth: 0,
  pageHeight: 0,
  separateCover: true,
  coverPaper: "",
  coverSides: "",
  coverBleed: false,
  coverSheetSize: "cheapest",
  insidePaper: "",
  insideSides: "",
  insideBleed: false,
  insideSheetSize: "cheapest",
  laminationType: "none",
  customLevel: "auto",
  isBroker: false,
}

export function BookletCalculator() {
  const quote = useQuote()
  const [inputs, setInputs] = useState<BookletInputs>(EMPTY_INPUTS)
  const [calcResult, setCalcResult] = useState<BookletCalcResult | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("cover")

  // Order state
  const [orderItems, setOrderItems] = useState<BookletOrderItem[]>([])
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [preEditInputs, setPreEditInputs] = useState<BookletInputs | null>(null)

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

  const handleAddToOrder = useCallback(() => {
    if (!calcResult || !calcResult.isValid) return

    const coverDesc = inputs.separateCover ? `w/ ${calcResult.coverResult.paper} Cover` : "Self-Cover"
    const details: Record<string, string> = {
      line1: `${inputs.bookQty} - ${inputs.pagesPerBook}pg Saddle Stitch - ${inputs.pageWidth}x${inputs.pageHeight} ${coverDesc}`,
      line2: `Pages: ${calcResult.insideResult.paper}, ${calcResult.insideResult.sides}${calcResult.insideResult.bleed ? " +Bleed" : ""}`,
    }
    if (inputs.separateCover) {
      details.line3 = `Cover: ${calcResult.coverResult.paper}, ${calcResult.coverResult.sides}${calcResult.coverResult.bleed ? " +Bleed" : ""}`
    }
    if (inputs.laminationType !== "none") {
      details.line4 = `Lamination: ${inputs.laminationType.charAt(0).toUpperCase() + inputs.laminationType.slice(1)}`
    }
    if (inputs.isBroker) {
      details.line5 = "Broker Discount Applied"
    }

    const newItem: BookletOrderItem = {
      id: editingItemId || Date.now(),
      summary: {
        description: details.line1,
        details,
        subtotal: calcResult.subtotal,
        total: calcResult.grandTotal,
      },
      inputs: { ...inputs },
      result: calcResult,
    }

    if (editingItemId) {
      setOrderItems((prev) => prev.map((item) => (item.id === editingItemId ? newItem : item)))
      setEditingItemId(null)
      setPreEditInputs(null)
    } else {
      setOrderItems((prev) => [...prev, newItem])
    }

    resetForm()
  }, [calcResult, inputs, editingItemId])

  const handleEditItem = useCallback(
    (id: number) => {
      const item = orderItems.find((i) => i.id === id)
      if (!item) return
      setPreEditInputs({ ...inputs })
      setEditingItemId(id)
      setInputs({ ...item.inputs })
      setCalcResult(item.result)
      setActiveTab(item.inputs.separateCover ? "cover" : "inside")
    },
    [orderItems, inputs]
  )

  const handleDuplicateItem = useCallback(
    (id: number) => {
      const item = orderItems.find((i) => i.id === id)
      if (!item) return
      setOrderItems((prev) => [...prev, { ...item, id: Date.now() }])
    },
    [orderItems]
  )

  const handleRemoveItem = useCallback(
    (id: number) => {
      setOrderItems((prev) => prev.filter((item) => item.id !== id))
      if (editingItemId === id) {
        setEditingItemId(null)
        setPreEditInputs(null)
        resetForm()
      }
    },
    [editingItemId]
  )

  function resetForm() {
    if (editingItemId && preEditInputs) {
      setInputs(preEditInputs)
      setEditingItemId(null)
      setPreEditInputs(null)
    } else {
      setInputs(EMPTY_INPUTS)
    }
    setCalcResult(null)
    setValidationError(null)
  }

  const handleAddToQuote = useCallback(() => {
    if (!calcResult || !calcResult.isValid) return
    const coverDesc = inputs.separateCover ? `w/ ${calcResult.coverResult.paper} Cover` : "Self-Cover"
    const desc = `${inputs.insidePaper}, ${calcResult.insideResult.sides}${inputs.laminationType !== "none" ? `, ${inputs.laminationType} lam.` : ""}`
    quote.addItem({
      category: "booklet",
      label: `${inputs.bookQty.toLocaleString()} - ${inputs.pagesPerBook}pg Booklet ${inputs.pageWidth}x${inputs.pageHeight} ${coverDesc}`,
      description: desc,
      amount: calcResult.grandTotal,
    })
  }, [calcResult, inputs, quote])

  return (
    <div className="flex flex-col lg:flex-row gap-5 min-h-0 flex-grow">
      {/* Main Calculator Column */}
      <div className="flex-1 flex flex-col gap-0 overflow-y-auto">
        <div className="bg-card rounded-2xl border border-border p-6 flex flex-col">
          <h2 className="text-base font-semibold text-foreground mb-4">Saddle Stitch Booklet Calculator</h2>

          <BookletForm
            inputs={inputs}
            onInputsChange={setInputs}
            onCalculate={handleCalculate}
            onAddToOrder={handleAddToOrder}
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
                  />
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

      {/* Order Summary Sidebar */}
      <div className="lg:w-[26rem] flex-shrink-0">
        <BookletOrderSummary
          items={orderItems}
          editingItemId={editingItemId}
          onEdit={handleEditItem}
          onDuplicate={handleDuplicateItem}
          onRemove={handleRemoveItem}
        />
      </div>
    </div>
  )
}
