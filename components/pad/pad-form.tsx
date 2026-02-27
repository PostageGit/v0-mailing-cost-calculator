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
import type { PadInputs } from "@/lib/pad-types"
import type { PadSettings } from "@/lib/pad-types"
import type { SpiralPartInputs } from "@/lib/spiral-types"
import { useFormValidation } from "@/hooks/use-form-validation"
import { PadSettingsPanel } from "./pad-settings"

interface PadFormProps {
  inputs: PadInputs
  onInputsChange: (inputs: PadInputs) => void
  onCalculate: () => void
  onReset: () => void
  isEditing: boolean
  validationError: string | null
  settings: PadSettings
  onSettingsSave: (s: PadSettings) => void
}

export function PadForm({
  inputs,
  onInputsChange,
  onCalculate,
  onReset,
  isEditing,
  validationError,
  settings,
  onSettingsSave,
}: PadFormProps) {
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

  function update(partial: Partial<PadInputs>) {
    onInputsChange({ ...inputs, ...partial })
  }

  function updateInside(partial: Partial<SpiralPartInputs>) {
    onInputsChange({ ...inputs, inside: { ...inputs.inside, ...partial } })
  }

  const part = inputs.inside
  const sizes = part.paperName ? getAvailableSizes(part.paperName) : []
  const sides = part.paperName ? getAvailableSides(part.paperName, part.sheetSize !== "cheapest" ? part.sheetSize : undefined) : []

  return (
    <form onSubmit={handleSubmit}>
      {/* Settings */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Pad Details</h3>
        <PadSettingsPanel settings={settings} onSave={onSettingsSave} />
      </div>

      {/* Row 1: Pad qty, pages, dimensions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pad-qty" className="text-sm font-medium text-foreground">
            Pad Amount{v.req(!inputs.padQty) && <span className="text-destructive text-xs ml-0.5">*</span>}
          </label>
          <Input
            id="pad-qty"
            type="number" inputMode="numeric" min={1} autoComplete="off"
            placeholder="e.g. 50..."
            className={v.cls(!inputs.padQty)}
            value={inputs.padQty || ""}
            onChange={(e) => update({ padQty: parseInt(e.target.value) || 0 })}
          />
          {v.attempted && !inputs.padQty && <p className="text-[10px] text-destructive font-medium">Enter quantity</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pad-pages" className="text-sm font-medium text-foreground">
            Pages Per Pad{v.req(!inputs.pagesPerPad) && <span className="text-destructive text-xs ml-0.5">*</span>}
          </label>
          <Input
            id="pad-pages"
            type="number" inputMode="numeric" min={1} autoComplete="off"
            placeholder="e.g. 50..."
            className={v.cls(!inputs.pagesPerPad)}
            value={inputs.pagesPerPad || ""}
            onChange={(e) => update({ pagesPerPad: parseInt(e.target.value) || 0 })}
          />
          {v.attempted && !inputs.pagesPerPad && <p className="text-[10px] text-destructive font-medium">Enter page count</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pad-w" className="text-sm font-medium text-foreground">
            Page Width (in){v.req(!inputs.pageWidth) && <span className="text-destructive text-xs ml-0.5">*</span>}
          </label>
          <Input
            id="pad-w"
            type="number" inputMode="decimal" step={0.01} min={1} autoComplete="off"
            placeholder="e.g. 8.5..."
            className={v.cls(!inputs.pageWidth)}
            value={inputs.pageWidth || ""}
            onChange={(e) => update({ pageWidth: parseFloat(e.target.value) || 0 })}
          />
          {v.attempted && !inputs.pageWidth && <p className="text-[10px] text-destructive font-medium">Enter width</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pad-h" className="text-sm font-medium text-foreground">
            Page Height (in){v.req(!inputs.pageHeight) && <span className="text-destructive text-xs ml-0.5">*</span>}
          </label>
          <Input
            id="pad-h"
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

      {/* Inside Pages Paper Row */}
      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Inside Pages</p>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_1fr] gap-4 mb-4 items-end">
        <div className="flex flex-col gap-1.5">
          <Select
            value={part.paperName}
            onValueChange={(val) => updateInside({ paperName: val, sheetSize: "cheapest", sides: "" })}
          >
            <SelectTrigger className={v.cls(!part.paperName)}>
              <SelectValue placeholder="Select Paper" />
            </SelectTrigger>
            <SelectContent>
              {paperNames.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Select
            value={part.sides}
            onValueChange={(val) => updateInside({ sides: val })}
          >
            <SelectTrigger className={v.cls(!part.sides)}>
              <SelectValue placeholder="Sides" />
            </SelectTrigger>
            <SelectContent>
              {sides.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 h-9">
          <Checkbox
            id="pad-bleed"
            checked={part.hasBleed}
            onCheckedChange={(checked) => updateInside({ hasBleed: checked === true })}
          />
          <label htmlFor="pad-bleed" className="text-sm text-muted-foreground cursor-pointer whitespace-nowrap">
            Bleed
          </label>
        </div>
        <div className="flex flex-col gap-1.5">
          <Select
            value={part.sheetSize}
            onValueChange={(val) => updateInside({ sheetSize: val })}
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
      </div>

      <Separator className="my-4" />

      {/* Chip Board + Broker */}
      <div className="flex items-center gap-6 mb-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id="pad-chipboard"
            checked={inputs.useChipBoard}
            onCheckedChange={(checked) => update({ useChipBoard: checked === true })}
          />
          <label htmlFor="pad-chipboard" className="text-sm font-medium text-foreground cursor-pointer">
            Back Chip Board (${settings.chipBoardPerPad.toFixed(2)}/pad)
          </label>
        </div>

      </div>

      {/* Validation */}
      {validationError && v.attempted && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg mb-4">
          {validationError}
        </div>
      )}

      {v.attempted && (!inputs.padQty || !inputs.pagesPerPad || !inputs.pageWidth || !inputs.pageHeight) && !validationError && (
        <div className="mb-3 rounded-lg bg-destructive/5 border border-destructive/20 px-3 py-2">
          <p className="text-[11px] text-destructive font-medium">
            Please fill in the highlighted fields above to calculate pricing.
          </p>
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
