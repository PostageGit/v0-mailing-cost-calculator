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
import { Save } from "lucide-react"
import {
  getPaperNames,
  getAvailableSizes,
  getAvailableSides,
} from "@/lib/spiral-pricing"
import type { SpiralInputs, SpiralPartInputs } from "@/lib/spiral-types"
import { useFormValidation } from "@/hooks/use-form-validation"

interface SpiralFormProps {
  inputs: SpiralInputs
  onInputsChange: (inputs: SpiralInputs) => void
  onCalculate: () => void
  onAddToOrder: () => void
  onReset: () => void
  isEditing: boolean
  canAddToOrder: boolean
  validationError: string | null
  ohpMode?: boolean
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
  ohpMode,
}: SpiralFormProps) {
  const paperNames = getPaperNames()
  const v = useFormValidation()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    v.markAttempted()
    onCalculate()
  }

  function handleReset() {
    v.reset()
    onReset()
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
    const needsPaper = !part.paperName
    const needsSides = !part.sides

    return (
      <div className="grid grid-cols-1 md:grid-cols-[5rem_1fr_1fr_auto_1fr] gap-4 mb-4 items-end">
        <span className="text-sm font-medium text-foreground pb-2">{label}</span>
        <Select
          value={part.paperName}
          onValueChange={(val) => updatePart(partKey, { paperName: val, sheetSize: "cheapest", sides: "" })}
        >
          <SelectTrigger className={v.cls(needsPaper)}><SelectValue placeholder="Select Paper" /></SelectTrigger>
          <SelectContent>
            {paperNames.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={part.sides}
          onValueChange={(val) => updatePart(partKey, { sides: val })}
        >
          <SelectTrigger className={v.cls(needsSides)}><SelectValue placeholder="Sides" /></SelectTrigger>
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
          onValueChange={(val) => updatePart(partKey, { sheetSize: val })}
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
            Book Amount{v.req(!inputs.bookQty) && <span className="text-destructive text-xs ml-0.5">*</span>}
          </label>
          <Input
            id="spiral-book-qty"
            type="number" inputMode="numeric" min={1} autoComplete="off"
            placeholder="e.g. 50..."
            className={v.cls(!inputs.bookQty)}
            value={inputs.bookQty || ""}
            onChange={(e) => update({ bookQty: parseInt(e.target.value) || 0 })}
          />
          {v.attempted && !inputs.bookQty && <p className="text-[10px] text-destructive font-medium">Enter quantity</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="spiral-pages" className="text-sm font-medium text-foreground">
            Pages Per Book{v.req(!inputs.pagesPerBook) && <span className="text-destructive text-xs ml-0.5">*</span>}
          </label>
          <Input
            id="spiral-pages"
            type="number" inputMode="numeric" min={1} autoComplete="off"
            placeholder="e.g. 20..."
            className={v.cls(!inputs.pagesPerBook)}
            value={inputs.pagesPerBook || ""}
            onChange={(e) => update({ pagesPerBook: parseInt(e.target.value) || 0 })}
          />
          {v.attempted && !inputs.pagesPerBook && <p className="text-[10px] text-destructive font-medium">Enter page count</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="spiral-page-w" className="text-sm font-medium text-foreground">
            Page Width (in){v.req(!inputs.pageWidth) && <span className="text-destructive text-xs ml-0.5">*</span>}
          </label>
          <Input
            id="spiral-page-w"
            type="number" inputMode="decimal" step={0.01} min={1} autoComplete="off"
            placeholder="e.g. 8.5..."
            className={v.cls(!inputs.pageWidth)}
            value={inputs.pageWidth || ""}
            onChange={(e) => update({ pageWidth: parseFloat(e.target.value) || 0 })}
          />
          {v.attempted && !inputs.pageWidth && <p className="text-[10px] text-destructive font-medium">Enter width</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="spiral-page-h" className="text-sm font-medium text-foreground">
            Page Height (in){v.req(!inputs.pageHeight) && <span className="text-destructive text-xs ml-0.5">*</span>}
          </label>
          <Input
            id="spiral-page-h"
            type="number" inputMode="decimal" step={0.01} min={1} autoComplete="off"
            placeholder="e.g. 11..."
            className={v.cls(!inputs.pageHeight)}
            value={inputs.pageHeight || ""}
            onChange={(e) => update({ pageHeight: parseFloat(e.target.value) || 0 })}
          />
          {v.attempted && !inputs.pageHeight && <p className="text-[10px] text-destructive font-medium">Enter height</p>}
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

      {/* Broker toggle */}
      <div className="flex items-center gap-2 mb-4">
        <Checkbox
          id="spiral-broker"
          checked={inputs.isBroker || false}
          onCheckedChange={(checked) => update({ isBroker: checked === true })}
        />
        <label htmlFor="spiral-broker" className="text-sm font-medium text-foreground cursor-pointer">
          Broker Pricing
        </label>
        {inputs.isBroker && (
          <span className="text-[10px] text-muted-foreground">(Level 10 default)</span>
        )}
      </div>

      {/* Validation Error -- only show if there's a specific error message beyond field validation */}
      {validationError && v.attempted && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg mb-4">
          {validationError}
        </div>
      )}

      {v.attempted && (!inputs.bookQty || !inputs.pagesPerBook || !inputs.pageWidth || !inputs.pageHeight) && !validationError && (
        <div className="mb-3 rounded-lg bg-destructive/5 border border-destructive/20 px-3 py-2">
          <p className="text-[11px] text-destructive font-medium">
            Please fill in the highlighted fields above to calculate pricing.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        {ohpMode ? (
          <Button type="submit" className="flex-1 font-semibold gap-2 bg-sky-600 hover:bg-sky-700 text-white">
            <Save className="h-4 w-4" /> Save Specs
          </Button>
        ) : (
          <>
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
          </>
        )}
        <Button
          type="button"
          variant="secondary"
          onClick={handleReset}
          className="flex-1 font-semibold"
        >
          {isEditing ? "Cancel Edit" : "Reset"}
        </Button>
      </div>
    </form>
  )
}
