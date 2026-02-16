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
  getCoverPapers,
  getInsidePapers,
  getAvailableSizes,
  canPaperLaminate,
  ALL_SIDES,
} from "@/lib/booklet-pricing"
import type { BookletInputs } from "@/lib/booklet-types"

interface BookletFormProps {
  inputs: BookletInputs
  onInputsChange: (inputs: BookletInputs) => void
  onCalculate: () => void
  onAddToOrder: () => void
  onReset: () => void
  isEditing: boolean
  canAddToOrder: boolean
  validationError: string | null
}

export function BookletForm({
  inputs,
  onInputsChange,
  onCalculate,
  onAddToOrder,
  onReset,
  isEditing,
  canAddToOrder,
  validationError,
}: BookletFormProps) {
  const coverPapers = getCoverPapers()
  const insidePapers = getInsidePapers()
  const coverSizes = inputs.coverPaper ? getAvailableSizes(inputs.coverPaper) : []
  const insideSizes = inputs.insidePaper ? getAvailableSizes(inputs.insidePaper) : []
  const canLam = inputs.separateCover && inputs.coverPaper ? canPaperLaminate(inputs.coverPaper) : false

  const pagesError = inputs.pagesPerBook > 0 && inputs.pagesPerBook % 4 !== 0
    ? `Must be a multiple of 4. Try ${Math.ceil(inputs.pagesPerBook / 4) * 4}.`
    : inputs.pagesPerBook > 172
      ? "Max 172 pages."
      : inputs.pagesPerBook > 0 && inputs.pagesPerBook < 8
        ? "Minimum 8 pages."
        : null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onCalculate()
  }

  function updateInputs(partial: Partial<BookletInputs>) {
    onInputsChange({ ...inputs, ...partial })
  }

  return (
        <form onSubmit={handleSubmit}>
          {/* Row 1: General Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="book-qty" className="text-sm font-medium text-foreground">Booklet Amount</label>
              <Input
                id="book-qty"
                type="number"
                inputMode="numeric"
                min={1}
                required
                autoComplete="off"
                placeholder="e.g. 50..."
                value={inputs.bookQty || ""}
                onChange={(e) => updateInputs({ bookQty: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="pages-per-book" className="text-sm font-medium text-foreground">Page Amount</label>
              <Input
                id="pages-per-book"
                type="number"
                inputMode="numeric"
                min={8}
                max={172}
                step={4}
                required
                autoComplete="off"
                placeholder="e.g. 16..."
                value={inputs.pagesPerBook || ""}
                onChange={(e) => updateInputs({ pagesPerBook: parseInt(e.target.value) || 0 })}
                className={pagesError ? "border-destructive" : ""}
              />
              {pagesError && <p className="text-destructive text-xs">{pagesError}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="page-width" className="text-sm font-medium text-foreground">Page Width (in)</label>
              <Input
                id="page-width"
                type="number"
                inputMode="decimal"
                step={0.01}
                min={2.5}
                required
                autoComplete="off"
                placeholder="e.g. 5.5..."
                value={inputs.pageWidth || ""}
                onChange={(e) => updateInputs({ pageWidth: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="page-height" className="text-sm font-medium text-foreground">Page Height (in)</label>
              <Input
                id="page-height"
                type="number"
                inputMode="decimal"
                step={0.01}
                min={2.5}
                required
                autoComplete="off"
                placeholder="e.g. 8.5..."
                value={inputs.pageHeight || ""}
                onChange={(e) => updateInputs({ pageHeight: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <Separator className="my-4" />

          {/* Separate Cover Checkbox */}
          <div className="flex items-center gap-2 mb-4">
            <Checkbox
              id="separate-cover"
              checked={inputs.separateCover}
              onCheckedChange={(checked) =>
                updateInputs({
                  separateCover: checked === true,
                  laminationType: checked ? inputs.laminationType : "none",
                })
              }
            />
            <label htmlFor="separate-cover" className="text-sm font-medium text-foreground cursor-pointer">
              Use Separate Cover Stock
            </label>
          </div>

          {/* Cover Row */}
          {inputs.separateCover && (
            <div className="grid grid-cols-1 md:grid-cols-[5rem_1fr_1fr_auto_1fr] gap-4 mb-4 items-end">
              <span className="text-sm font-medium text-foreground pb-2">Cover</span>
              <Select value={inputs.coverPaper} onValueChange={(v) => updateInputs({ coverPaper: v, coverSheetSize: "cheapest" })}>
                <SelectTrigger><SelectValue placeholder="Select Paper" /></SelectTrigger>
                <SelectContent>
                  {coverPapers.map((p) => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={inputs.coverSides} onValueChange={(v) => updateInputs({ coverSides: v })}>
                <SelectTrigger><SelectValue placeholder="Sides" /></SelectTrigger>
                <SelectContent>
                  {ALL_SIDES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 h-9">
                <Checkbox
                  id="cover-bleed"
                  checked={inputs.coverBleed}
                  onCheckedChange={(checked) => updateInputs({ coverBleed: checked === true })}
                />
                <label htmlFor="cover-bleed" className="text-sm text-muted-foreground cursor-pointer whitespace-nowrap">Bleed</label>
              </div>
              <Select value={inputs.coverSheetSize} onValueChange={(v) => updateInputs({ coverSheetSize: v })}>
                <SelectTrigger><SelectValue placeholder="Sheet Size" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cheapest">Cheapest</SelectItem>
                  {coverSizes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Inside Pages Row */}
          <div className="grid grid-cols-1 md:grid-cols-[5rem_1fr_1fr_auto_1fr] gap-4 mb-4 items-end">
            <span className="text-sm font-medium text-foreground pb-2">Inside</span>
            <Select value={inputs.insidePaper} onValueChange={(v) => updateInputs({ insidePaper: v, insideSheetSize: "cheapest" })}>
              <SelectTrigger><SelectValue placeholder="Select Paper" /></SelectTrigger>
              <SelectContent>
                {insidePapers.map((p) => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={inputs.insideSides} onValueChange={(v) => updateInputs({ insideSides: v })}>
              <SelectTrigger><SelectValue placeholder="Sides" /></SelectTrigger>
              <SelectContent>
                {ALL_SIDES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 h-9">
              <Checkbox
                id="inside-bleed"
                checked={inputs.insideBleed}
                onCheckedChange={(checked) => updateInputs({ insideBleed: checked === true })}
              />
              <label htmlFor="inside-bleed" className="text-sm text-muted-foreground cursor-pointer whitespace-nowrap">Bleed</label>
            </div>
            <Select value={inputs.insideSheetSize} onValueChange={(v) => updateInputs({ insideSheetSize: v })}>
              <SelectTrigger><SelectValue placeholder="Sheet Size" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cheapest">Cheapest</SelectItem>
                {insideSizes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Separator className="my-4" />

          {/* Lamination, Level, Markup, Broker */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 items-end">
            <div className="flex flex-col gap-1.5 md:col-span-1">
              <label className="text-sm font-medium text-foreground">Lamination</label>
              <Select
                value={inputs.laminationType}
                onValueChange={(v) => updateInputs({ laminationType: v as BookletInputs["laminationType"] })}
                disabled={!inputs.separateCover || !canLam}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Lamination</SelectItem>
                  <SelectItem value="gloss">Gloss</SelectItem>
                  <SelectItem value="matte">Matte</SelectItem>
                  <SelectItem value="silk">Silk</SelectItem>
                  <SelectItem value="leather">Leather</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Level Override</label>
              <Select value={inputs.customLevel} onValueChange={(v) => updateInputs({ customLevel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Default Level</SelectItem>
                  {Array.from({ length: 10 }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>Level {i + 1}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Markup %</label>
              <Input
                type="number"
                step="1"
                min={0}
                max={100}
                value={inputs.printingMarkupPct ?? 10}
                onChange={(e) => updateInputs({ printingMarkupPct: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center gap-2 h-9">
              <Checkbox
                id="broker"
                checked={inputs.isBroker}
                onCheckedChange={(checked) => updateInputs({ isBroker: checked === true })}
              />
              <label htmlFor="broker" className="text-sm font-medium text-foreground cursor-pointer">Broker</label>
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
