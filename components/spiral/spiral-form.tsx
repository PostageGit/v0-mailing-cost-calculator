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
import { Separator } from "@/components/ui/separator"
import {
  getPaperNames,
  getAvailableSizes,
  getAvailableSides,
} from "@/lib/spiral-pricing"
import type { SpiralInputs, SpiralPartInputs } from "@/lib/spiral-types"

interface SpiralFormProps {
  inputs: SpiralInputs
  onInputsChange: (inputs: SpiralInputs) => void
  onCalculate: () => void
  onAddToOrder: () => void
  onReset: () => void
  isEditing: boolean
  canAddToOrder: boolean
  validationError: string | null
}

export function SpiralForm({
  inputs,
  onInputsChange,
  onCalculate,
  onAddToOrder,
  onReset,
  isEditing,
  canAddToOrder,
  validationError,
}: SpiralFormProps) {
  const paperNames = getPaperNames()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onCalculate()
  }

  function update(partial: Partial<SpiralInputs>) {
    onInputsChange({ ...inputs, ...partial })
  }

  function updatePart(partKey: "inside" | "front" | "back", partial: Partial<SpiralPartInputs>) {
    onInputsChange({ ...inputs, [partKey]: { ...inputs[partKey], ...partial } })
  }

  function PartRow({ partKey, label }: { partKey: "inside" | "front" | "back"; label: string }) {
    const part = inputs[partKey]
    const sizes = part.paperName ? getAvailableSizes(part.paperName) : []
    const sides = part.paperName ? getAvailableSides(part.paperName, part.sheetSize !== "cheapest" ? part.sheetSize : undefined) : []

    return (
      <div className="grid grid-cols-1 md:grid-cols-[5rem_1fr_1fr_auto_1fr] gap-4 mb-4 items-end">
        <span className="text-sm font-medium text-foreground pb-2">{label}</span>
        <Select
          value={part.paperName}
          onValueChange={(v) => updatePart(partKey, { paperName: v, sheetSize: "cheapest", sides: "" })}
        >
          <SelectTrigger><SelectValue placeholder="Select Paper" /></SelectTrigger>
          <SelectContent>
            {paperNames.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={part.sides}
          onValueChange={(v) => updatePart(partKey, { sides: v })}
        >
          <SelectTrigger><SelectValue placeholder="Sides" /></SelectTrigger>
          <SelectContent>
            {sides.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 h-9">
          <Checkbox
            id={`${partKey}-bleed`}
            checked={part.hasBleed}
            onCheckedChange={(checked) => updatePart(partKey, { hasBleed: checked === true })}
          />
          <label htmlFor={`${partKey}-bleed`} className="text-sm text-muted-foreground cursor-pointer whitespace-nowrap">
            Bleed
          </label>
        </div>
        <Select
          value={part.sheetSize}
          onValueChange={(v) => updatePart(partKey, { sheetSize: v })}
        >
          <SelectTrigger><SelectValue placeholder="Sheet Size" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cheapest">Cheapest</SelectItem>
            {sizes.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Row 1: General Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="spiral-book-qty" className="text-sm font-medium text-foreground">
            Book Amount
          </label>
          <Input
            id="spiral-book-qty"
            type="number"
            inputMode="numeric"
            min={1}
            required
            autoComplete="off"
            placeholder="e.g. 50..."
            value={inputs.bookQty || ""}
            onChange={(e) => update({ bookQty: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="spiral-pages" className="text-sm font-medium text-foreground">
            Pages Per Book
          </label>
          <Input
            id="spiral-pages"
            type="number"
            inputMode="numeric"
            min={1}
            required
            autoComplete="off"
            placeholder="e.g. 20..."
            value={inputs.pagesPerBook || ""}
            onChange={(e) => update({ pagesPerBook: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="spiral-page-w" className="text-sm font-medium text-foreground">
            Page Width (in)
          </label>
          <Input
            id="spiral-page-w"
            type="number"
            inputMode="decimal"
            step={0.01}
            min={1}
            required
            autoComplete="off"
            placeholder="e.g. 8.5..."
            value={inputs.pageWidth || ""}
            onChange={(e) => update({ pageWidth: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="spiral-page-h" className="text-sm font-medium text-foreground">
            Page Height (in)
          </label>
          <Input
            id="spiral-page-h"
            type="number"
            inputMode="decimal"
            step={0.01}
            min={1}
            required
            autoComplete="off"
            placeholder="e.g. 11..."
            value={inputs.pageHeight || ""}
            onChange={(e) => update({ pageHeight: parseFloat(e.target.value) || 0 })}
          />
        </div>
      </div>

      <Separator className="my-4" />

      {/* Inside Pages Row */}
      <PartRow partKey="inside" label="Inside" />

      <Separator className="my-4" />

      {/* Front Cover */}
      <div className="flex items-center gap-2 mb-3">
        <Checkbox
          id="use-front-cover"
          checked={inputs.useFrontCover}
          onCheckedChange={(checked) => update({ useFrontCover: checked === true })}
        />
        <label htmlFor="use-front-cover" className="text-sm font-medium text-foreground cursor-pointer">
          Front Cover (Printed)
        </label>
      </div>
      {inputs.useFrontCover && <PartRow partKey="front" label="Front" />}

      {/* Back Cover */}
      <div className="flex items-center gap-2 mb-3">
        <Checkbox
          id="use-back-cover"
          checked={inputs.useBackCover}
          onCheckedChange={(checked) => update({ useBackCover: checked === true })}
        />
        <label htmlFor="use-back-cover" className="text-sm font-medium text-foreground cursor-pointer">
          Back Cover (Printed)
        </label>
      </div>
      {inputs.useBackCover && <PartRow partKey="back" label="Back" />}

      <Separator className="my-4" />

      {/* Extra Cover Options */}
      <div className="flex items-center gap-6 mb-6">
        <div className="flex items-center gap-2">
          <Checkbox
            id="clear-plastic"
            checked={inputs.clearPlastic}
            onCheckedChange={(checked) => update({ clearPlastic: checked === true })}
          />
          <label htmlFor="clear-plastic" className="text-sm font-medium text-foreground cursor-pointer">
            Clear Plastic Cover ($0.50/book)
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="black-vinyl"
            checked={inputs.blackVinyl}
            onCheckedChange={(checked) => update({ blackVinyl: checked === true })}
          />
          <label htmlFor="black-vinyl" className="text-sm font-medium text-foreground cursor-pointer">
            Black Vinyl Cover ($0.50/book)
          </label>
        </div>
      </div>

      {/* Validation Error */}
      {validationError && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg mb-4">
          {validationError}
        </div>
      )}

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
