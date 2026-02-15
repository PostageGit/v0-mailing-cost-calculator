"use client"

import { useState, useCallback, useEffect } from "react"
import { PrintingForm } from "./printing-form"
import { SheetOptionsTable } from "./sheet-options-table"
import { SheetLayoutSvg } from "./sheet-layout-svg"
import { PriceBreakdown } from "./price-breakdown"
import { OrderSummary } from "./order-summary"
import { Button } from "@/components/ui/button"
import {
  calculateAllSheetOptions,
  buildFullResult,
} from "@/lib/printing-pricing"
import type {
  PrintingInputs,
  SheetOptionRow,
  FullPrintingResult,
  OrderItem,
} from "@/lib/printing-types"
import { useQuote } from "@/lib/quote-context"
import { formatCurrency } from "@/lib/pricing"
import { Plus } from "lucide-react"

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
  isBroker: false,
  scoreFoldOperation: "",
  scoreFoldType: "",
}

export function PrintingCalculator() {
  const quote = useQuote()

  // Form state
  const [inputs, setInputs] = useState<PrintingInputs>(EMPTY_INPUTS)

  // Calculation state
  const [sheetOptions, setSheetOptions] = useState<SheetOptionRow[]>([])
  const [selectedOption, setSelectedOption] = useState<SheetOptionRow | null>(null)
  const [fullResult, setFullResult] = useState<FullPrintingResult | null>(null)
  const [hasCalculated, setHasCalculated] = useState(false)
  const [showResults, setShowResults] = useState(false)

  // Order state
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [preEditInputs, setPreEditInputs] = useState<PrintingInputs | null>(null)

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
      const result = buildFullResult(inputs, selectedOption.result)
      setFullResult(result)
    }
  }, [
    inputs.finishingIds?.join(","),
    inputs.scoreFoldOperation,
    inputs.scoreFoldType,
    inputs.addOnCharge,
    inputs.addOnDescription,
    inputs.isBroker,
    selectedOption,
    showResults,
  ])

  // Select a sheet size from the table
  const handleSelectSheet = useCallback(
    (option: SheetOptionRow) => {
      setSelectedOption(option)
      const result = buildFullResult(inputs, option.result)
      setFullResult(result)
      setShowResults(true)
    },
    [inputs]
  )

  // Change sheet size (go back to table)
  const handleChangeSheet = useCallback(() => {
    setShowResults(false)
    setSelectedOption(null)
    setFullResult(null)
  }, [])

  // Add to order
  const handleAddToOrder = useCallback(() => {
    if (!fullResult) return

    const description = `${inputs.qty} - ${inputs.width}x${inputs.height} Flat Prints`
    const details: string[] = []
    details.push(`${inputs.paperName} - ${fullResult.result.sheetSize}`)
    const bleedText = inputs.hasBleed ? "+Bleed" : "No Bleed"
    details.push(`${inputs.sidesValue}, ${bleedText}`)
    if (inputs.addOnCharge > 0 && inputs.addOnDescription) {
      details.push(`${inputs.addOnDescription}: $${inputs.addOnCharge.toFixed(2)}`)
    }

    const newItem: OrderItem = {
      id: editingItemId || Date.now(),
      summary: {
        description,
        details: details.join("\n"),
        subtotal: fullResult.subtotal,
        total: fullResult.grandTotal,
      },
      inputs: { ...inputs },
      fullResult,
    }

    if (editingItemId) {
      setOrderItems((prev) => prev.map((item) => (item.id === editingItemId ? newItem : item)))
      setEditingItemId(null)
      setPreEditInputs(null)
    } else {
      setOrderItems((prev) => [...prev, newItem])
    }

    // Reset form
    resetForm()
  }, [fullResult, inputs, editingItemId])

  // Edit an order item
  const handleEditItem = useCallback(
    (id: number) => {
      const item = orderItems.find((i) => i.id === id)
      if (!item) return

      setPreEditInputs({ ...inputs })
      setEditingItemId(id)
      setInputs({ ...item.inputs })

      // Recalculate to show options
      const options = calculateAllSheetOptions(item.inputs)
      setSheetOptions(options)
      setHasCalculated(true)

      // Find and select the matching sheet
      const matchingOption = options.find((o) => o.size === item.fullResult.result.sheetSize)
      if (matchingOption) {
        setSelectedOption(matchingOption)
        setFullResult(item.fullResult)
        setShowResults(true)
      }
    },
    [orderItems, inputs]
  )

  // Duplicate an order item
  const handleDuplicateItem = useCallback(
    (id: number) => {
      const item = orderItems.find((i) => i.id === id)
      if (!item) return
      const newItem: OrderItem = {
        ...item,
        id: Date.now(),
      }
      setOrderItems((prev) => [...prev, newItem])
    },
    [orderItems]
  )

  // Remove an order item
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

  // Reset form
  function resetForm() {
    if (editingItemId && preEditInputs) {
      // Cancel edit: restore previous state
      setInputs(preEditInputs)
      setEditingItemId(null)
      setPreEditInputs(null)
    } else {
      setInputs(EMPTY_INPUTS)
    }
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
    <div className="flex flex-col lg:flex-row gap-6 min-h-0 flex-grow">
      {/* Main Calculator Column */}
      <div className="flex-1 flex flex-col gap-0 overflow-y-auto">
        <div className="bg-card rounded-xl border border-border shadow-sm p-6 flex flex-col">
          <h2 className="text-lg font-semibold text-foreground mb-4">Flat Printing Calculator</h2>

          <PrintingForm
            inputs={inputs}
            onInputsChange={setInputs}
            onCalculate={handleCalculate}
            onAddToOrder={handleAddToOrder}
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
                  <PriceBreakdown data={fullResult} onChangeSheet={handleChangeSheet} />
                  <Button
                    onClick={handleAddToQuote}
                    className="w-full gap-2"
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

      {/* Order Summary Sidebar */}
      <div className="lg:w-[26rem] flex-shrink-0">
        <OrderSummary
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
