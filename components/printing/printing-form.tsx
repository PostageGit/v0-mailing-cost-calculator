"use client"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PAPER_OPTIONS, getAvailableSides } from "@/lib/printing-pricing"
import { getActiveConfig, validateScoreFold, mapDimensionsToFoldSize, mapPaperToScoreFoldCategory } from "@/lib/pricing-config"
import type { PrintingInputs } from "@/lib/printing-types"
import { AlertTriangle, Info } from "lucide-react"

interface PrintingFormProps {
  inputs: PrintingInputs
  onInputsChange: (inputs: PrintingInputs) => void
  onCalculate: () => void
  onAddToOrder: () => void
  onReset: () => void
  isEditing: boolean
  canAddToOrder: boolean
  hasCalculated: boolean
}

export function PrintingForm({
  inputs,
  onInputsChange,
  onCalculate,
  onAddToOrder,
  onReset,
  isEditing,
  canAddToOrder,
  hasCalculated,
}: PrintingFormProps) {
  const availableSides = inputs.paperName ? getAvailableSides(inputs.paperName) : []

  function handlePaperChange(value: string) {
    const newSides = getAvailableSides(value)
    const keepSides = newSides.includes(inputs.sidesValue)
    onInputsChange({
      ...inputs,
      paperName: value,
      sidesValue: keepSides ? inputs.sidesValue : "",
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onCalculate()
  }

  return (
        <form onSubmit={handleSubmit}>
          {/* Row 1: Qty, Width, Height */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="print-qty" className="text-sm font-medium text-foreground">
                Quantity
              </label>
              <Input
                id="print-qty"
                type="number"
                inputMode="numeric"
                min={1}
                required
                autoComplete="off"
                spellCheck={false}
                placeholder="e.g. 500..."
                value={inputs.qty || ""}
                onChange={(e) =>
                  onInputsChange({ ...inputs, qty: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="print-width" className="text-sm font-medium text-foreground">
                Width (in)
              </label>
              <Input
                id="print-width"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                required
                autoComplete="off"
                placeholder="e.g. 4..."
                value={inputs.width || ""}
                onChange={(e) =>
                  onInputsChange({ ...inputs, width: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="print-height" className="text-sm font-medium text-foreground">
                Height (in)
              </label>
              <Input
                id="print-height"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                required
                autoComplete="off"
                placeholder="e.g. 6..."
                value={inputs.height || ""}
                onChange={(e) =>
                  onInputsChange({ ...inputs, height: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
          </div>

          {/* Row 2: Paper Type, Sides, Bleed */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="print-paper" className="text-sm font-medium text-foreground">Paper Type</label>
              <Select value={inputs.paperName} onValueChange={handlePaperChange}>
                <SelectTrigger id="print-paper">
                  <SelectValue placeholder="Select Paper" />
                </SelectTrigger>
                <SelectContent>
                  {PAPER_OPTIONS.map((paper) => (
                    <SelectItem key={paper.name} value={paper.name}>
                      {paper.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="print-sides" className="text-sm font-medium text-foreground">Sides</label>
              <Select
                value={inputs.sidesValue}
                onValueChange={(v) => onInputsChange({ ...inputs, sidesValue: v })}
                disabled={!inputs.paperName}
              >
                <SelectTrigger id="print-sides">
                  <SelectValue placeholder="Select Sides" />
                </SelectTrigger>
                <SelectContent>
                  {availableSides.map((side) => (
                    <SelectItem key={side} value={side}>
                      {side}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="bleed-checkbox" className="text-sm font-medium text-foreground">Bleed</label>
              <div className="flex items-center gap-2 h-9">
                <Checkbox
                  id="bleed-checkbox"
                  checked={inputs.hasBleed}
                  onCheckedChange={(checked) =>
                    onInputsChange({ ...inputs, hasBleed: checked === true })
                  }
                />
                <label htmlFor="bleed-checkbox" className="text-sm text-muted-foreground cursor-pointer">
                  Add bleed margins
                </label>
              </div>
            </div>
          </div>

          {/* Finishings Section */}
          <div className="mb-5 rounded-lg border border-border bg-muted/20 p-4 flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-foreground">Add Finishings</h3>

            {/* Sheet Finishings (per parent sheet) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Sheet Finishings
                </label>
                <span className="text-[10px] text-muted-foreground">(applied per printer sheet)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {getActiveConfig().finishings.map((f) => {
                  const selected = (inputs.finishingIds || []).includes(f.id)
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        const current = inputs.finishingIds || []
                        const updated = selected
                          ? current.filter((id) => id !== f.id)
                          : [...current, f.id]
                        onInputsChange({ ...inputs, finishingIds: updated })
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {f.name}
                      {selected && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                          ON
                        </Badge>
                      )}
                    </button>
                  )
                })}
                {getActiveConfig().finishings.length === 0 && (
                  <span className="text-xs text-muted-foreground">No sheet finishings configured.</span>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Piece Finishings (per cut piece) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Piece Finishings
                </label>
                <span className="text-[10px] text-muted-foreground">(applied per cut piece)</span>
              </div>

              {/* Score & Fold */}
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-foreground">Operation</label>
                    <Select
                      value={inputs.scoreFoldOperation || "none"}
                      onValueChange={(v) =>
                        onInputsChange({
                          ...inputs,
                          scoreFoldOperation: v === "none" ? "" : (v as "folding" | "scoring"),
                          scoreFoldType: v === "none" ? "" : (inputs.scoreFoldType || ""),
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="folding">Folding</SelectItem>
                        <SelectItem value="scoring">Score & Fold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-foreground">Fold Type</label>
                    <Select
                      value={inputs.scoreFoldType || "none"}
                      onValueChange={(v) =>
                        onInputsChange({ ...inputs, scoreFoldType: v === "none" ? "" : (v as "foldInHalf" | "foldIn3" | "foldIn4" | "gateFold") })
                      }
                      disabled={!inputs.scoreFoldOperation}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select fold" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="foldInHalf">Fold in Half</SelectItem>
                        <SelectItem value="foldIn3">Fold in 3</SelectItem>
                        <SelectItem value="foldIn4">Fold in 4</SelectItem>
                        <SelectItem value="gateFold">Gate Fold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Validation / Info messages */}
                <ScoreFoldValidationMessage
                  operation={inputs.scoreFoldOperation || ""}
                  paperName={inputs.paperName}
                  width={inputs.width}
                  height={inputs.height}
                  foldType={inputs.scoreFoldType || ""}
                />
              </div>
            </div>
          </div>

          {/* Row 4: Add-on */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="add-on-charge" className="text-sm font-medium text-foreground">
                Add on ($)
              </label>
              <Input
                id="add-on-charge"
                type="number"
                step="0.01"
                min={0}
                autoComplete="off"
                placeholder="e.g. 10.00..."
                value={inputs.addOnCharge || ""}
                onChange={(e) =>
                  onInputsChange({ ...inputs, addOnCharge: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label htmlFor="add-on-desc" className="text-sm font-medium text-foreground">
                Description
              </label>
              <Input
                id="add-on-desc"
                type="text"
                placeholder="e.g. Graphic Design..."
                value={inputs.addOnDescription}
                onChange={(e) =>
                  onInputsChange({ ...inputs, addOnDescription: e.target.value })
                }
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="submit"
              className={`flex-1 font-semibold ${
                isEditing
                  ? "bg-amber-500 hover:bg-amber-600 text-foreground"
                  : "bg-primary hover:bg-primary/90 text-primary-foreground"
              }`}
            >
              {isEditing ? "Recalculate" : "Calculate"}
            </Button>
            <Button
              type="button"
              onClick={onAddToOrder}
              disabled={!canAddToOrder}
              className="flex-1 font-semibold bg-accent hover:bg-accent/90 text-accent-foreground disabled:opacity-50"
            >
              {isEditing ? "Update Order" : "Add to Order"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onReset}
              className="flex-1 font-semibold"
            >
              {isEditing ? "Cancel Edit" : "Reset"}
            </Button>
          </div>
        </form>
  )
}

// Validation message for Score & Fold
function ScoreFoldValidationMessage({
  operation,
  paperName,
  width,
  height,
  foldType,
}: {
  operation: string
  paperName: string
  width: number
  height: number
  foldType: string
}) {
  // Nothing selected yet
  if (!operation) return null

  // Show detected size info
  const foldSize = width > 0 && height > 0 ? mapDimensionsToFoldSize(width, height) : null
  const paperCat = paperName ? mapPaperToScoreFoldCategory(paperName) : null

  // If fold type not yet chosen, show helpful info
  if (!foldType) {
    const infoParts: string[] = []
    if (paperCat) infoParts.push(`Paper: ${paperCat}`)
    if (foldSize) infoParts.push(`Detected size: ${foldSize}`)
    else if (width > 0 && height > 0) infoParts.push(`Size ${width}" x ${height}" is non-standard`)

    if (infoParts.length > 0) {
      return (
        <div className="flex items-start gap-2 rounded-md bg-muted/50 border border-border px-3 py-2">
          <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <span className="text-[11px] text-muted-foreground">{infoParts.join(" | ")} -- select a fold type to continue.</span>
        </div>
      )
    }
    return null
  }

  // Full validation
  const validation = validateScoreFold(operation, paperName, width, height, foldType)
  if (validation.valid) {
    return (
      <div className="flex items-start gap-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
        <Info className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
        <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
          {operation === "folding" ? "Folding" : "Score & Fold"} is available for {paperCat} at {foldSize}.
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2">
      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
      <span className="text-[11px] text-amber-700 dark:text-amber-300">{validation.message}</span>
    </div>
  )
}
