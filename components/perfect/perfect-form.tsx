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
import { getCoverPapers, getInsidePapers, canLaminate } from "@/lib/perfect-pricing"
import { PAPER_OPTIONS, COVER_SIDES, INSIDE_SIDES } from "@/lib/perfect-types"
import type { PerfectInputs, PerfectPartInputs } from "@/lib/perfect-types"
import { useFormValidation } from "@/hooks/use-form-validation"

interface PerfectFormProps {
  inputs: PerfectInputs
  onInputsChange: (inputs: PerfectInputs) => void
  onCalculate: () => void
  onAddToOrder: () => void
  onReset: () => void
  isEditing: boolean
  canAddToOrder: boolean
  validationError: string | null
  ohpMode?: boolean
}

export function PerfectForm({
  inputs,
  onInputsChange,
  onCalculate,
  onAddToOrder,
  onReset,
  isEditing,
  canAddToOrder,
  validationError,
  ohpMode,
}: PerfectFormProps) {
  const coverPapers = getCoverPapers()
  const insidePapers = getInsidePapers()
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

  function update(partial: Partial<PerfectInputs>) {
    onInputsChange({ ...inputs, ...partial })
  }

  function updatePart(partKey: "cover" | "inside", partial: Partial<PerfectPartInputs>) {
    const updated = { ...inputs, [partKey]: { ...inputs[partKey], ...partial } }
    if (partKey === "cover" && partial.paperName) {
      if (!canLaminate(partial.paperName) && updated.laminationType !== "none") {
        updated.laminationType = "none"
      }
    }
    onInputsChange(updated)
  }

  function getAvailableSizes(paperName: string): string[] {
    const paper = PAPER_OPTIONS.find((p) => p.name === paperName)
    return paper?.availableSizes ?? []
  }

  const coverCanLaminate = inputs.cover.paperName ? canLaminate(inputs.cover.paperName) : true

  return (
    <form onSubmit={handleSubmit}>
      {/* Row 1: General Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pb-book-qty" className="text-sm font-medium text-foreground">
            Book Amount{v.req(!inputs.bookQty) && <span className="text-destructive text-xs ml-0.5">*</span>}
          </label>
          <Input
            id="pb-book-qty" type="number" inputMode="numeric" min={1} autoComplete="off"
            placeholder="e.g. 50..."
            className={v.cls(!inputs.bookQty)}
            value={inputs.bookQty || ""}
            onChange={(e) => update({ bookQty: parseInt(e.target.value) || 0 })}
          />
          {v.attempted && !inputs.bookQty && <p className="text-[10px] text-destructive font-medium">Enter quantity</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pb-pages" className="text-sm font-medium text-foreground">
            Page Amount{v.req(!inputs.pagesPerBook) && <span className="text-destructive text-xs ml-0.5">*</span>}
          </label>
          <Input
            id="pb-pages" type="number" inputMode="numeric" min={40} autoComplete="off"
            placeholder="Min 40..."
            className={v.cls(!inputs.pagesPerBook)}
            value={inputs.pagesPerBook || ""}
            onChange={(e) => update({ pagesPerBook: parseInt(e.target.value) || 0 })}
          />
          {v.attempted && !inputs.pagesPerBook && <p className="text-[10px] text-destructive font-medium">Enter page count (min 40)</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pb-page-w" className="text-sm font-medium text-foreground">
            Page Width (in){v.req(!inputs.pageWidth) && <span className="text-destructive text-xs ml-0.5">*</span>}
          </label>
          <Input
            id="pb-page-w" type="number" inputMode="decimal" step={0.01} min={2.5} autoComplete="off"
            placeholder="e.g. 5.5..."
            className={v.cls(!inputs.pageWidth)}
            value={inputs.pageWidth || ""}
            onChange={(e) => update({ pageWidth: parseFloat(e.target.value) || 0 })}
          />
          {v.attempted && !inputs.pageWidth && <p className="text-[10px] text-destructive font-medium">Enter width</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pb-page-h" className="text-sm font-medium text-foreground">
            Page Height (in){v.req(!inputs.pageHeight) && <span className="text-destructive text-xs ml-0.5">*</span>}
          </label>
          <Input
            id="pb-page-h" type="number" inputMode="decimal" step={0.01} min={2.5} autoComplete="off"
            placeholder="e.g. 8.5..."
            className={v.cls(!inputs.pageHeight)}
            value={inputs.pageHeight || ""}
            onChange={(e) => update({ pageHeight: parseFloat(e.target.value) || 0 })}
          />
          {v.attempted && !inputs.pageHeight && <p className="text-[10px] text-destructive font-medium">Enter height</p>}
        </div>
      </div>

      <Separator className="my-4" />

      {/* Cover Row */}
      <div className="grid grid-cols-1 md:grid-cols-[5rem_1fr_1fr_auto_1fr] gap-4 mb-4 items-end">
        <span className="text-sm font-medium text-foreground pb-2">Cover</span>
        <Select
          value={inputs.cover.paperName}
          onValueChange={(val) => updatePart("cover", { paperName: val, sheetSize: "cheapest", sides: "" })}
        >
          <SelectTrigger className={v.cls(!inputs.cover.paperName)}><SelectValue placeholder="Select Paper" /></SelectTrigger>
          <SelectContent>
            {coverPapers.map((p) => (
              <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={inputs.cover.sides}
          onValueChange={(val) => updatePart("cover", { sides: val })}
        >
          <SelectTrigger className={v.cls(!inputs.cover.sides)}><SelectValue placeholder="Sides" /></SelectTrigger>
          <SelectContent>
            {COVER_SIDES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 h-9">
          <Checkbox
            id="cover-bleed"
            checked={inputs.cover.hasBleed}
            onCheckedChange={(checked) => updatePart("cover", { hasBleed: checked === true })}
          />
          <label htmlFor="cover-bleed" className="text-sm text-muted-foreground cursor-pointer whitespace-nowrap">Bleed</label>
        </div>
        <Select
          value={inputs.cover.sheetSize}
          onValueChange={(val) => updatePart("cover", { sheetSize: val })}
        >
          <SelectTrigger><SelectValue placeholder="Sheet Size" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cheapest">Cheapest</SelectItem>
            {inputs.cover.paperName &&
              getAvailableSizes(inputs.cover.paperName).filter((s) => s !== "13x26").map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            {inputs.cover.paperName && getAvailableSizes(inputs.cover.paperName).includes("13x26") && (
              <>
                <Separator className="my-1" />
                <SelectItem value="13x26" className="text-amber-600 dark:text-amber-400">13x26 (Large Format)</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Inside Pages Row */}
      <div className="grid grid-cols-1 md:grid-cols-[5rem_1fr_1fr_auto_1fr] gap-4 mb-4 items-end">
        <span className="text-sm font-medium text-foreground pb-2">Inside</span>
        <Select
          value={inputs.inside.paperName}
          onValueChange={(val) => updatePart("inside", { paperName: val, sheetSize: "cheapest", sides: "" })}
        >
          <SelectTrigger className={v.cls(!inputs.inside.paperName)}><SelectValue placeholder="Select Paper" /></SelectTrigger>
          <SelectContent>
            {insidePapers.map((p) => (
              <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={inputs.inside.sides}
          onValueChange={(val) => updatePart("inside", { sides: val })}
        >
          <SelectTrigger className={v.cls(!inputs.inside.sides)}><SelectValue placeholder="Sides" /></SelectTrigger>
          <SelectContent>
            {INSIDE_SIDES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 h-9">
          <Checkbox
            id="inside-bleed"
            checked={inputs.inside.hasBleed}
            onCheckedChange={(checked) => updatePart("inside", { hasBleed: checked === true })}
          />
          <label htmlFor="inside-bleed" className="text-sm text-muted-foreground cursor-pointer whitespace-nowrap">Bleed</label>
        </div>
        <Select
          value={inputs.inside.sheetSize}
          onValueChange={(val) => updatePart("inside", { sheetSize: val })}
        >
          <SelectTrigger><SelectValue placeholder="Sheet Size" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cheapest">Cheapest</SelectItem>
            {inputs.inside.paperName &&
              getAvailableSizes(inputs.inside.paperName).filter((s) => s !== "13x26").map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            {inputs.inside.paperName && getAvailableSizes(inputs.inside.paperName).includes("13x26") && (
              <>
                <Separator className="my-1" />
                <SelectItem value="13x26" className="text-amber-600 dark:text-amber-400">13x26 (Large Format)</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      <Separator className="my-4" />

      {/* Lamination, Custom Level, Broker */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 items-end">
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label htmlFor="pb-lamination" className="text-sm font-medium text-foreground">Lamination</label>
          <Select
            value={inputs.laminationType}
            onValueChange={(val) => update({ laminationType: val as PerfectInputs["laminationType"] })}
            disabled={!coverCanLaminate}
          >
            <SelectTrigger id="pb-lamination"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="gloss">Gloss</SelectItem>
              <SelectItem value="matte">Matte</SelectItem>
              <SelectItem value="silk">Silk</SelectItem>
              <SelectItem value="leather">Leather</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pb-custom-level" className="text-sm font-medium text-foreground">Custom Level</label>
          <Select
            value={inputs.customLevel}
            onValueChange={(val) => update({ customLevel: val })}
          >
            <SelectTrigger id="pb-custom-level"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto</SelectItem>
              {Array.from({ length: 10 }, (_, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>Level {i + 1}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 h-9">
          <Checkbox
            id="pb-broker"
            checked={inputs.isBroker}
            onCheckedChange={(checked) => update({ isBroker: checked === true })}
          />
          <label htmlFor="pb-broker" className="text-sm font-medium text-foreground cursor-pointer">Broker</label>
        </div>
      </div>

      {/* Validation Error */}
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
