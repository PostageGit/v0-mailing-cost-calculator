"use client"

import { useState, useEffect, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Save, Loader2, AlertTriangle, Plus, X, List } from "lucide-react"
import {
  calculateAllSheetOptions,
  buildFullResult,
  PAPER_OPTIONS,
  getAvailableSides,
} from "@/lib/printing-pricing"
import { LAMINATION_TYPES, LAMINATION_DEFAULTS } from "@/lib/lamination-pricing"
import type { LaminationType, LaminationSides } from "@/lib/lamination-pricing"
import type { PrintingInputs, FullPrintingResult, SheetOptionRow } from "@/lib/printing-types"

// Default inputs for flat printing
function getDefaultInputs(): PrintingInputs {
  return {
    qty: 0,
    width: 0,
    height: 0,
    paperName: "",
    sidesValue: "",
    hasBleed: false,
    addOnCharge: 0,
    addOnDescription: "",
    isBroker: false,
    printingMarkupPct: 10,
    lamination: { ...LAMINATION_DEFAULTS },
  }
}

// Multi-quantity result type
interface MultiQtyResult {
  qty: number
  result: FullPrintingResult
  inputs: PrintingInputs
}

interface FlatRevisionCalculatorProps {
  initialSpecs: Record<string, unknown>
  originalTotal: number
  onSave: (result: FullPrintingResult, inputs: PrintingInputs) => void
  onSaveMultiple?: (results: MultiQtyResult[]) => void
  saving?: boolean
}

export function FlatRevisionCalculator({
  initialSpecs,
  originalTotal,
  onSave,
  onSaveMultiple,
  saving = false,
}: FlatRevisionCalculatorProps) {
  // Map initial specs to inputs
  const [inputs, setInputs] = useState<PrintingInputs>(() => mapSpecsToInputs(initialSpecs))
  const [result, setResult] = useState<FullPrintingResult | null>(null)
  const [sheetOptions, setSheetOptions] = useState<SheetOptionRow[]>([])
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0)
  const [warnings, setWarnings] = useState<string[]>([])
  
  // Multi-quantity mode
  const [multiQtyMode, setMultiQtyMode] = useState(false)
  const [additionalQtys, setAdditionalQtys] = useState<number[]>([])
  const [multiResults, setMultiResults] = useState<MultiQtyResult[]>([])

  // Get available sides for selected paper
  const availableSides = useMemo(
    () => (inputs.paperName ? getAvailableSides(inputs.paperName) : []),
    [inputs.paperName]
  )

  // Calculate whenever inputs change
  useEffect(() => {
    if (!inputs.qty || !inputs.width || !inputs.height || !inputs.paperName || !inputs.sidesValue) {
      setResult(null)
      setSheetOptions([])
      setWarnings([])
      return
    }

    try {
      // Get all valid sheet options
      const options = calculateAllSheetOptions(inputs)

      if (options.length === 0) {
        setWarnings(["No valid sheet sizes available for this paper/size combination. The piece may be too large."])
        setResult(null)
        setSheetOptions([])
        return
      }

      setSheetOptions(options)
      setWarnings([])

      // Use selected sheet option or default to cheapest
      const idx = Math.min(selectedSheetIndex, options.length - 1)
      const selected = options[idx]

      // Build full result
      const fullResult = buildFullResult(inputs, selected.result, [], null, null)
      setResult(fullResult)
    } catch (err) {
      console.error("[v0] Flat calc error:", err)
      setResult(null)
      setSheetOptions([])
      setWarnings([`Calculation error: ${err instanceof Error ? err.message : "Unknown error"}`])
    }
  }, [inputs, selectedSheetIndex])

  // Calculate multi-quantity results when in multi-qty mode
  useEffect(() => {
    if (!multiQtyMode || !inputs.width || !inputs.height || !inputs.paperName || !inputs.sidesValue) {
      setMultiResults([])
      return
    }

    const allQtys = [inputs.qty, ...additionalQtys].filter(q => q > 0)
    const results: MultiQtyResult[] = []

    for (const qty of allQtys) {
      try {
        const qtyInputs = { ...inputs, qty }
        const options = calculateAllSheetOptions(qtyInputs)
        if (options.length > 0) {
          // Use cheapest option for each qty
          const bestOption = options.reduce((best, opt) => 
            opt.result.perPiece < best.result.perPiece ? opt : best
          , options[0])
          const fullResult = buildFullResult(qtyInputs, bestOption.result, [], null, null)
          results.push({ qty, result: fullResult, inputs: qtyInputs })
        }
      } catch {
        // Skip quantities that error
      }
    }

    // Sort by quantity ascending
    results.sort((a, b) => a.qty - b.qty)
    setMultiResults(results)
  }, [multiQtyMode, inputs, additionalQtys])

  // Add a new quantity field
  function addQuantity() {
    setAdditionalQtys([...additionalQtys, 0])
  }

  // Remove a quantity field
  function removeQuantity(index: number) {
    setAdditionalQtys(additionalQtys.filter((_, i) => i !== index))
  }

  // Update an additional quantity
  function updateAdditionalQty(index: number, value: number) {
    const newQtys = [...additionalQtys]
    newQtys[index] = value
    setAdditionalQtys(newQtys)
  }

  // Handle paper change - update sides if needed
  function handlePaperChange(paperName: string) {
    const newSides = getAvailableSides(paperName)
    const keepSides = newSides.includes(inputs.sidesValue)
    setInputs({
      ...inputs,
      paperName,
      sidesValue: keepSides ? inputs.sidesValue : newSides[0] || "",
    })
  }

  // Handle lamination toggle
  function handleLaminationToggle(enabled: boolean) {
    setInputs({
      ...inputs,
      lamination: { ...(inputs.lamination || LAMINATION_DEFAULTS), enabled },
    })
  }

  // Update lamination settings
  function updateLam(patch: Partial<NonNullable<PrintingInputs["lamination"]>>) {
    setInputs({
      ...inputs,
      lamination: { ...(inputs.lamination || LAMINATION_DEFAULTS), ...patch },
    })
  }

  const lam = inputs.lamination || LAMINATION_DEFAULTS
  const priceDiff = result ? result.grandTotal - originalTotal : 0

  return (
    <div className="space-y-4">
      {/* Price comparison header */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
        <div className="text-center">
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Original</p>
          <p className="text-lg font-bold text-foreground">${originalTotal.toFixed(2)}</p>
        </div>
        <div className="text-muted-foreground">→</div>
        <div className="text-center">
          <p className="text-[10px] font-medium text-muted-foreground uppercase">New</p>
          <p className={`text-lg font-bold ${result ? "text-foreground" : "text-muted-foreground"}`}>
            {result ? `$${result.grandTotal.toFixed(2)}` : "—"}
          </p>
        </div>
        {result && priceDiff !== 0 && (
          <Badge variant={priceDiff > 0 ? "destructive" : "secondary"} className="text-xs">
            {priceDiff > 0 ? "+" : ""}${priceDiff.toFixed(2)}
          </Badge>
        )}
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Form */}
      <div className="grid grid-cols-3 gap-3">
        {/* Quantity with multi-qty toggle */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Quantity</label>
            <button
              type="button"
              onClick={() => setMultiQtyMode(!multiQtyMode)}
              className={`text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                multiQtyMode 
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-3 w-3" />
              Multi
            </button>
          </div>
          <Input
            type="number"
            min={1}
            value={inputs.qty || ""}
            onChange={(e) => setInputs({ ...inputs, qty: parseInt(e.target.value) || 0 })}
            className="h-9"
          />
        </div>
        {/* Width */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Width (in)</label>
          <Input
            type="number"
            step="0.01"
            min={0}
            value={inputs.width || ""}
            onChange={(e) => setInputs({ ...inputs, width: parseFloat(e.target.value) || 0 })}
            className="h-9"
          />
        </div>
        {/* Height */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Height (in)</label>
          <Input
            type="number"
            step="0.01"
            min={0}
            value={inputs.height || ""}
            onChange={(e) => setInputs({ ...inputs, height: parseFloat(e.target.value) || 0 })}
            className="h-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Paper */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Paper</label>
          <Select value={inputs.paperName} onValueChange={handlePaperChange}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select Paper" />
            </SelectTrigger>
            <SelectContent>
              {PAPER_OPTIONS.map((p) => (
                <SelectItem key={p.name} value={p.name}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Sides */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Sides</label>
          <Select
            value={inputs.sidesValue}
            onValueChange={(v) => setInputs({ ...inputs, sidesValue: v })}
            disabled={!inputs.paperName}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select Sides" />
            </SelectTrigger>
            <SelectContent>
              {availableSides.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Sheet size selector (if multiple options) */}
      {sheetOptions.length > 1 && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Sheet Size</label>
          <Select
            value={String(selectedSheetIndex)}
            onValueChange={(v) => setSelectedSheetIndex(parseInt(v))}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sheetOptions.map((opt, i) => (
                <SelectItem key={i} value={String(i)}>
                  {opt.size} — {opt.ups} up, {opt.sheets} sheets, ${opt.price.toFixed(2)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Options row */}
      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={inputs.hasBleed}
            onCheckedChange={(c) => setInputs({ ...inputs, hasBleed: c === true })}
          />
          <span className="text-sm">Bleed</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={inputs.isBroker}
            onCheckedChange={(c) => setInputs({ ...inputs, isBroker: c === true })}
          />
          <span className="text-sm">Broker pricing</span>
        </label>
      </div>

      {/* Additional quantities (multi-qty mode) */}
      {multiQtyMode && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Additional Quantities</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addQuantity}
              className="h-6 text-xs gap-1 text-blue-700 dark:text-blue-300"
            >
              <Plus className="h-3 w-3" /> Add Qty
            </Button>
          </div>
          {additionalQtys.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {additionalQtys.map((qty, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={1}
                    value={qty || ""}
                    onChange={(e) => updateAdditionalQty(i, parseInt(e.target.value) || 0)}
                    className="h-7 w-24 text-sm"
                    placeholder="Qty"
                  />
                  <button
                    type="button"
                    onClick={() => removeQuantity(i)}
                    className="p-1 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Multi-qty results table */}
          {multiResults.length > 1 && (
            <div className="mt-3 border-t border-blue-200 dark:border-blue-800 pt-3">
              <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 mb-2 uppercase">Price Comparison</p>
              <div className="space-y-1">
                {multiResults.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm bg-white dark:bg-background/50 rounded px-2 py-1.5">
                    <span className="font-medium">{r.qty.toLocaleString()} qty</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground text-xs">${(r.result.result?.perPiece ?? 0).toFixed(4)}/ea</span>
                      <span className="font-bold">${(r.result.grandTotal ?? 0).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
              {onSaveMultiple && multiResults.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onSaveMultiple(multiResults)}
                  disabled={saving}
                  className="w-full mt-2 text-xs gap-1 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300"
                >
                  <Save className="h-3 w-3" />
                  Save All {multiResults.length} Options as Revisions
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Lamination */}
      <div className="rounded-lg border border-border p-3 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={lam.enabled} onCheckedChange={handleLaminationToggle} />
          <span className="text-sm font-medium">Lamination</span>
        </label>
        {lam.enabled && (
          <div className="flex flex-wrap gap-2 pl-1">
            <div className="flex gap-1">
              {LAMINATION_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => updateLam({ type: t as LaminationType })}
                  className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                    lam.type === t
                      ? "border-foreground bg-foreground text-background"
                      : "border-border hover:border-foreground/50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {(["S/S", "D/S"] as LaminationSides[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => updateLam({ sides: s })}
                  className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                    lam.sides === s
                      ? "border-foreground bg-foreground text-background"
                      : "border-border hover:border-foreground/50"
                  }`}
                >
                  {s === "S/S" ? "Single" : "Both"}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cost breakdown */}
      {result && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Printing:</span>
            <span className="font-medium">${result.printingCost.toFixed(2)}</span>
          </div>
          {result.laminationCost && result.laminationCost.cost > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lamination:</span>
              <span className="font-medium">${result.laminationCost.cost.toFixed(2)}</span>
            </div>
          )}
          {result.cuttingCost > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cutting:</span>
              <span className="font-medium">${result.cuttingCost.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 mt-2">
            <span className="font-semibold">Total:</span>
            <span className="font-bold">${result.grandTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Per piece:</span>
            <span>${result.result.perPiece.toFixed(4)}</span>
          </div>
        </div>
      )}

      {/* Save button */}
      <Button
        onClick={() => result && onSave(result, inputs)}
        disabled={!result || saving}
        className="w-full gap-2"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save Revision
      </Button>
    </div>
  )
}

// Map chat quote specs to PrintingInputs
function mapSpecsToInputs(specs: Record<string, unknown>): PrintingInputs {
  const inputs = getDefaultInputs()

  // Quantity
  const qtyVal = specs.quantity ?? specs.qty ?? specs.Quantity ?? specs.Qty
  if (qtyVal) inputs.qty = Number(qtyVal) || 0

  // Dimensions
  const widthVal = specs.width ?? specs.Width ?? specs.pageWidth
  const heightVal = specs.height ?? specs.Height ?? specs.pageHeight
  if (widthVal) inputs.width = Number(widthVal) || 0
  if (heightVal) inputs.height = Number(heightVal) || 0

  // Size string parsing (e.g., "8.5x11")
  const sizeVal = specs.size ?? specs.Size ?? specs.pageSize
  if (sizeVal && typeof sizeVal === "string" && (!inputs.width || !inputs.height)) {
    const parts = sizeVal.toLowerCase().replace(/\s/g, "").split("x")
    if (parts.length === 2) {
      inputs.width = parseFloat(parts[0]) || inputs.width
      inputs.height = parseFloat(parts[1]) || inputs.height
    }
  }

  // Paper
  const paperVal = specs.paper ?? specs.Paper ?? specs.paperStock
  if (paperVal && typeof paperVal === "string") {
    const match = PAPER_OPTIONS.find(
      (p) => p.name.toLowerCase() === paperVal.toLowerCase() ||
        p.name.toLowerCase().includes(paperVal.toLowerCase())
    )
    if (match) inputs.paperName = match.name
    else if (PAPER_OPTIONS.length > 0) inputs.paperName = PAPER_OPTIONS[0].name
  } else if (PAPER_OPTIONS.length > 0) {
    inputs.paperName = PAPER_OPTIONS[0].name
  }

  // Sides
  const sidesVal = specs.sides ?? specs.Sides
  if (sidesVal && typeof sidesVal === "string") {
    inputs.sidesValue = sidesVal
  } else {
    const availSides = inputs.paperName ? getAvailableSides(inputs.paperName) : []
    inputs.sidesValue = availSides.includes("4/4") ? "4/4" : availSides[0] || ""
  }

  // Bleed
  const bleedVal = specs.bleed ?? specs.Bleed ?? specs.hasBleed
  if (bleedVal !== undefined) {
    inputs.hasBleed = bleedVal === true || bleedVal === "Yes" || bleedVal === "yes"
  }

  // Broker
  const brokerVal = specs.isBroker ?? specs.broker ?? specs.Broker
  if (brokerVal !== undefined) {
    inputs.isBroker = brokerVal === true || brokerVal === "Yes" || brokerVal === "yes"
  }

  // Lamination
  const lamVal = specs.lamination ?? specs.Lamination
  if (lamVal && typeof lamVal === "string" && lamVal.toLowerCase() !== "none") {
    inputs.lamination = {
      ...LAMINATION_DEFAULTS,
      enabled: true,
      type: lamVal.toLowerCase().includes("matte") ? "Matte" : lamVal.toLowerCase().includes("silk") ? "Silk" : "Gloss",
      sides: lamVal.toLowerCase().includes("d/s") || lamVal.toLowerCase().includes("both") ? "D/S" : "S/S",
    }
  }

  return inputs
}
