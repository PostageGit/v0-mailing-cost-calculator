"use client"

import { useState, useEffect } from "react"
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
import { calculatePerfect } from "@/lib/perfect-pricing"
import {
  PAPER_OPTIONS,
  COVER_SIDES,
  INSIDE_SIDES,
  defaultPerfectInputs,
  type PerfectInputs,
  type PerfectCalcResult,
} from "@/lib/perfect-types"

const LAMINATION_OPTIONS = [
  { value: "none", label: "None" },
  { value: "gloss", label: "Gloss" },
  { value: "matte", label: "Matte" },
  { value: "silk", label: "Silk" },
] as const

interface MultiQtyResult {
  qty: number
  result: PerfectCalcResult
  inputs: PerfectInputs
}

interface PerfectRevisionCalculatorProps {
  initialSpecs: Record<string, unknown>
  originalTotal: number
  onSave: (result: PerfectCalcResult, inputs: PerfectInputs) => void
  onSaveMultiple?: (results: MultiQtyResult[]) => void
  saving?: boolean
}

export function PerfectRevisionCalculator({
  initialSpecs,
  originalTotal,
  onSave,
  onSaveMultiple,
  saving = false,
}: PerfectRevisionCalculatorProps) {
  const [inputs, setInputs] = useState<PerfectInputs>(() => mapSpecsToInputs(initialSpecs))
  const [result, setResult] = useState<PerfectCalcResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Multi-quantity mode
  const [multiQtyMode, setMultiQtyMode] = useState(false)
  const [additionalQtys, setAdditionalQtys] = useState<number[]>([])
  const [multiResults, setMultiResults] = useState<MultiQtyResult[]>([])

  // Calculate whenever inputs change
  useEffect(() => {
    if (!inputs.bookQty || !inputs.pagesPerBook || !inputs.pageWidth || !inputs.pageHeight) {
      setResult(null)
      setError(null)
      return
    }

    if (!inputs.cover.paperName || !inputs.cover.sides) {
      setResult(null)
      setError("Select cover paper and sides")
      return
    }

    if (!inputs.inside.paperName || !inputs.inside.sides) {
      setResult(null)
      setError("Select inside paper and sides")
      return
    }

    try {
      const calcResult = calculatePerfect(inputs)
      if ("error" in calcResult) {
        setError(calcResult.error)
        setResult(null)
      } else {
        setResult(calcResult)
        setError(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Calculation error")
      setResult(null)
    }
  }, [inputs])

  // Calculate multi-quantity results
  useEffect(() => {
    if (!multiQtyMode || !inputs.bookQty || !inputs.pagesPerBook || !inputs.pageWidth || !inputs.pageHeight) {
      setMultiResults([])
      return
    }

    const allQtys = [inputs.bookQty, ...additionalQtys].filter(q => q > 0)
    const results: MultiQtyResult[] = []

    for (const qty of allQtys) {
      try {
        const qtyInputs = { ...inputs, bookQty: qty }
        const calcResult = calculatePerfect(qtyInputs)
        if (!("error" in calcResult)) {
          results.push({ qty, result: calcResult, inputs: qtyInputs })
        }
      } catch {
        // Skip errors
      }
    }

    results.sort((a, b) => a.qty - b.qty)
    setMultiResults(results)
  }, [multiQtyMode, inputs, additionalQtys])

  function addQuantity() { setAdditionalQtys([...additionalQtys, 0]) }
  function removeQuantity(index: number) { setAdditionalQtys(additionalQtys.filter((_, i) => i !== index)) }
  function updateAdditionalQty(index: number, value: number) {
    const newQtys = [...additionalQtys]
    newQtys[index] = value
    setAdditionalQtys(newQtys)
  }

  // Get available sheet sizes for a paper
  function getSheetSizes(paperName: string): string[] {
    const paper = PAPER_OPTIONS.find((p) => p.name === paperName)
    return paper?.availableSizes || []
  }

  // Cover paper options (cardstock only for covers)
  const coverPapers = PAPER_OPTIONS.filter((p) => p.isCardstock)
  // Inside paper options (text/offset papers)
  const insidePapers = PAPER_OPTIONS.filter((p) => !p.isCardstock)

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

      {/* Error/Warning */}
      {error && (
        <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3">
          <div className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Book specs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Book Quantity</label>
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
            value={inputs.bookQty || ""}
            onChange={(e) => setInputs({ ...inputs, bookQty: parseInt(e.target.value) || 0 })}
            className="h-9"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Pages per Book</label>
          <Input
            type="number"
            min={40}
            step={2}
            value={inputs.pagesPerBook || ""}
            onChange={(e) => setInputs({ ...inputs, pagesPerBook: parseInt(e.target.value) || 0 })}
            className="h-9"
          />
        </div>
      </div>

      {/* Multi-qty mode */}
      {multiQtyMode && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Additional Quantities</span>
            <Button type="button" variant="ghost" size="sm" onClick={addQuantity} className="h-6 text-xs gap-1 text-blue-700 dark:text-blue-300">
              <Plus className="h-3 w-3" /> Add Qty
            </Button>
          </div>
          {additionalQtys.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {additionalQtys.map((qty, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Input type="number" min={1} value={qty || ""} onChange={(e) => updateAdditionalQty(i, parseInt(e.target.value) || 0)} className="h-7 w-24 text-sm" placeholder="Qty" />
                  <button type="button" onClick={() => removeQuantity(i)} className="p-1 text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}
          {multiResults.length > 1 && (
            <div className="mt-3 border-t border-blue-200 dark:border-blue-800 pt-3">
              <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 mb-2 uppercase">Price Comparison</p>
              <div className="space-y-1">
                {multiResults.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm bg-white dark:bg-background/50 rounded px-2 py-1.5">
                    <span className="font-medium">{r.qty.toLocaleString()} books</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground text-xs">${r.result.perBook.toFixed(2)}/ea</span>
                      <span className="font-bold">${r.result.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
              {onSaveMultiple && (
                <Button type="button" variant="outline" size="sm" onClick={() => onSaveMultiple(multiResults)} disabled={saving} className="w-full mt-2 text-xs gap-1 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300">
                  <Save className="h-3 w-3" /> Save All {multiResults.length} Options as Revisions
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Page Width (in)</label>
          <Input
            type="number"
            step="0.01"
            min={2.5}
            value={inputs.pageWidth || ""}
            onChange={(e) => setInputs({ ...inputs, pageWidth: parseFloat(e.target.value) || 0 })}
            className="h-9"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Page Height (in)</label>
          <Input
            type="number"
            step="0.01"
            min={2.5}
            value={inputs.pageHeight || ""}
            onChange={(e) => setInputs({ ...inputs, pageHeight: parseFloat(e.target.value) || 0 })}
            className="h-9"
          />
        </div>
      </div>

      {/* Cover section */}
      <div className="rounded-lg border border-border p-3 space-y-3">
        <h4 className="text-sm font-semibold">Cover</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Paper</label>
            <Select
              value={inputs.cover.paperName}
              onValueChange={(v) =>
                setInputs({ ...inputs, cover: { ...inputs.cover, paperName: v, sheetSize: "cheapest" } })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select Paper" />
              </SelectTrigger>
              <SelectContent>
                {coverPapers.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Sides</label>
            <Select
              value={inputs.cover.sides}
              onValueChange={(v) => setInputs({ ...inputs, cover: { ...inputs.cover, sides: v } })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Sides" />
              </SelectTrigger>
              <SelectContent>
                {COVER_SIDES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Sheet Size</label>
            <Select
              value={inputs.cover.sheetSize}
              onValueChange={(v) => setInputs({ ...inputs, cover: { ...inputs.cover, sheetSize: v } })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cheapest">Auto (Cheapest)</SelectItem>
                {getSheetSizes(inputs.cover.paperName).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 self-end h-9 cursor-pointer">
            <Checkbox
              checked={inputs.cover.hasBleed}
              onCheckedChange={(c) =>
                setInputs({ ...inputs, cover: { ...inputs.cover, hasBleed: c === true } })
              }
            />
            <span className="text-sm">Cover Bleed</span>
          </label>
        </div>
      </div>

      {/* Inside section */}
      <div className="rounded-lg border border-border p-3 space-y-3">
        <h4 className="text-sm font-semibold">Inside Pages</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Paper</label>
            <Select
              value={inputs.inside.paperName}
              onValueChange={(v) =>
                setInputs({ ...inputs, inside: { ...inputs.inside, paperName: v, sheetSize: "cheapest" } })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select Paper" />
              </SelectTrigger>
              <SelectContent>
                {insidePapers.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Sides</label>
            <Select
              value={inputs.inside.sides}
              onValueChange={(v) => setInputs({ ...inputs, inside: { ...inputs.inside, sides: v } })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Sides" />
              </SelectTrigger>
              <SelectContent>
                {INSIDE_SIDES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Sheet Size</label>
            <Select
              value={inputs.inside.sheetSize}
              onValueChange={(v) => setInputs({ ...inputs, inside: { ...inputs.inside, sheetSize: v } })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cheapest">Auto (Cheapest)</SelectItem>
                {getSheetSizes(inputs.inside.paperName).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 self-end h-9 cursor-pointer">
            <Checkbox
              checked={inputs.inside.hasBleed}
              onCheckedChange={(c) =>
                setInputs({ ...inputs, inside: { ...inputs.inside, hasBleed: c === true } })
              }
            />
            <span className="text-sm">Inside Bleed</span>
          </label>
        </div>
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Cover Lamination</label>
          <Select
            value={inputs.laminationType}
            onValueChange={(v) =>
              setInputs({ ...inputs, laminationType: v as PerfectInputs["laminationType"] })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LAMINATION_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 self-end h-9 cursor-pointer">
          <Checkbox
            checked={inputs.isBroker}
            onCheckedChange={(c) => setInputs({ ...inputs, isBroker: c === true })}
          />
          <span className="text-sm">Broker pricing</span>
        </label>
      </div>

      {/* Cost breakdown */}
      {result && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cover Printing:</span>
            <span className="font-medium">${result.coverResult.cost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Inside Printing:</span>
            <span className="font-medium">${result.insideResult.cost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Binding:</span>
            <span className="font-medium">${result.totalBindingPrice.toFixed(2)}</span>
          </div>
          {result.totalLaminationCost > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lamination:</span>
              <span className="font-medium">${result.totalLaminationCost.toFixed(2)}</span>
            </div>
          )}
          {result.brokerDiscountAmount > 0 && (
            <div className="flex justify-between text-green-600 dark:text-green-400">
              <span>Broker Discount:</span>
              <span>-${result.brokerDiscountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 mt-2">
            <span className="font-semibold">Total:</span>
            <span className="font-bold">${result.grandTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Per book:</span>
            <span>${result.pricePerBook.toFixed(2)}</span>
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

// Map chat quote specs to PerfectInputs
function mapSpecsToInputs(specs: Record<string, unknown>): PerfectInputs {
  const inputs = defaultPerfectInputs()

  // Book quantity
  const qtyVal = specs.quantity ?? specs.qty ?? specs.bookQty ?? specs.Qty
  if (qtyVal) inputs.bookQty = Number(qtyVal) || 0

  // Pages per book
  const pagesVal = specs.pagesPerBook ?? specs.pages ?? specs.contentPages ?? specs.physicalPages
  if (pagesVal) inputs.pagesPerBook = Number(pagesVal) || 0

  // Dimensions
  const widthVal = specs.width ?? specs.pageWidth ?? specs.Width
  const heightVal = specs.height ?? specs.pageHeight ?? specs.Height
  if (widthVal) inputs.pageWidth = Number(widthVal) || 0
  if (heightVal) inputs.pageHeight = Number(heightVal) || 0

  // Parse size string (e.g., "6x9")
  const sizeVal = specs.size ?? specs.Size ?? specs.pageSize
  if (sizeVal && typeof sizeVal === "string") {
    const parts = sizeVal.toLowerCase().replace(/\s/g, "").split("x")
    if (parts.length === 2) {
      inputs.pageWidth = parseFloat(parts[0]) || inputs.pageWidth
      inputs.pageHeight = parseFloat(parts[1]) || inputs.pageHeight
    }
  }

  // Cover paper
  const coverPaperVal = specs.coverPaper ?? specs.CoverPaper ?? specs.cover_paper
  if (coverPaperVal && typeof coverPaperVal === "string") {
    const match = PAPER_OPTIONS.find(
      (p) => p.isCardstock && (p.name.toLowerCase() === coverPaperVal.toLowerCase() || 
        p.name.toLowerCase().includes(coverPaperVal.toLowerCase()))
    )
    if (match) inputs.cover.paperName = match.name
  }

  // Cover sides
  const coverSidesVal = specs.coverSides ?? specs.CoverSides ?? specs.cover_sides
  if (coverSidesVal && typeof coverSidesVal === "string") {
    inputs.cover.sides = coverSidesVal
  }

  // Cover bleed
  const coverBleedVal = specs.coverBleed ?? specs.CoverBleed ?? specs.cover_bleed
  if (coverBleedVal !== undefined) {
    inputs.cover.hasBleed = coverBleedVal === true || coverBleedVal === "Yes" || coverBleedVal === "yes"
  }

  // Inside paper
  const insidePaperVal = specs.insidePaper ?? specs.InsidePaper ?? specs.inside_paper
  if (insidePaperVal && typeof insidePaperVal === "string") {
    const match = PAPER_OPTIONS.find(
      (p) => !p.isCardstock && (p.name.toLowerCase() === insidePaperVal.toLowerCase() ||
        p.name.toLowerCase().includes(insidePaperVal.toLowerCase()))
    )
    if (match) inputs.inside.paperName = match.name
  }

  // Inside sides
  const insideSidesVal = specs.insideSides ?? specs.InsideSides ?? specs.inside_sides
  if (insideSidesVal && typeof insideSidesVal === "string") {
    inputs.inside.sides = insideSidesVal
  }

  // Inside bleed
  const insideBleedVal = specs.insideBleed ?? specs.InsideBleed ?? specs.inside_bleed
  if (insideBleedVal !== undefined) {
    inputs.inside.hasBleed = insideBleedVal === true || insideBleedVal === "Yes" || insideBleedVal === "yes"
  }

  // Lamination
  const lamVal = specs.lamination ?? specs.Lamination ?? specs.coverLamination
  if (lamVal && typeof lamVal === "string") {
    const lamLower = lamVal.toLowerCase()
    if (lamLower.includes("gloss")) inputs.laminationType = "gloss"
    else if (lamLower.includes("matte")) inputs.laminationType = "matte"
    else if (lamLower.includes("silk")) inputs.laminationType = "silk"
    else if (lamLower !== "none" && lamLower !== "no") inputs.laminationType = "gloss"
  }

  // Broker
  const brokerVal = specs.isBroker ?? specs.broker ?? specs.Broker
  if (brokerVal !== undefined) {
    inputs.isBroker = brokerVal === true || brokerVal === "Yes" || brokerVal === "yes" || brokerVal === "No"
  }

  return inputs
}
