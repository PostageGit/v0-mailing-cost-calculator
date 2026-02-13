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
import { PAPER_OPTIONS, getAvailableSides } from "@/lib/printing-pricing"
import type { PrintingInputs } from "@/lib/printing-types"

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
                min={1}
                required
                placeholder="e.g., 500"
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
                step="0.01"
                min={0}
                required
                placeholder="e.g., 4"
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
                step="0.01"
                min={0}
                required
                placeholder="e.g., 6"
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
              <label className="text-sm font-medium text-foreground">Paper Type</label>
              <Select value={inputs.paperName} onValueChange={handlePaperChange}>
                <SelectTrigger>
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
              <label className="text-sm font-medium text-foreground">Sides</label>
              <Select
                value={inputs.sidesValue}
                onValueChange={(v) => onInputsChange({ ...inputs, sidesValue: v })}
                disabled={!inputs.paperName}
              >
                <SelectTrigger>
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
              <label className="text-sm font-medium text-foreground">Bleed</label>
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

          {/* Row 3: Add-on */}
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
                placeholder="e.g., 10.00"
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
                placeholder="e.g., Graphic Design"
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
