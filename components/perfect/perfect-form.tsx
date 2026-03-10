"use client"

import { useState } from "react"
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
import { Save, Plus, Trash2 } from "lucide-react"
import { canLaminate, getLaminationPrice } from "@/lib/perfect-pricing"
import { formatCurrency } from "@/lib/pricing"
import { COVER_SIDES, INSIDE_SIDES, createInsideSection } from "@/lib/perfect-types"
import { usePapersContext } from "@/lib/papers-context"
import type { PerfectInputs, PerfectPartInputs, PerfectInsideSection } from "@/lib/perfect-types"
import { useFormValidation } from "@/hooks/use-form-validation"

interface PerfectFormProps {
  inputs: PerfectInputs
  onInputsChange: (inputs: PerfectInputs) => void
  onCalculate: () => void
  onReset: () => void
  isEditing: boolean
  validationError: string | null
  ohpMode?: boolean
}

export function PerfectForm({
  inputs,
  onInputsChange,
  onCalculate,
  onReset,
  isEditing,
  validationError,
  ohpMode,
}: PerfectFormProps) {
  const [showAllCoverPapers, setShowAllCoverPapers] = useState(false)
  const [showAllInsidePapers, setShowAllInsidePapers] = useState(false)
  const [showAllSectionPapers, setShowAllSectionPapers] = useState<Record<string, boolean>>({})
  const { getPaperOptions, papers: allPapers } = usePapersContext()
  
  // Multiple sections mode
  const useSections = inputs.insideSections && inputs.insideSections.length > 0
  const totalSectionPages = inputs.insideSections?.reduce((sum, s) => sum + (s.pageCount || 0), 0) || 0
  const pagesRemaining = (inputs.pagesPerBook || 0) - totalSectionPages
  const allPaperOptions = allPapers.map((p) => ({ name: p.name, isCardstock: p.is_cardstock, thickness: p.thickness, availableSizes: p.available_sizes }))
  const coverPapers = showAllCoverPapers ? allPaperOptions : getPaperOptions("book_cover")
  const insidePapers = showAllInsidePapers ? allPaperOptions : getPaperOptions("book_inside")
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
    const paper = allPapers.find((p) => p.name === paperName)
    return paper?.available_sizes ?? []
  }

  // Section management
  function addSection() {
    const sections = [...(inputs.insideSections || [])]
    sections.push(createInsideSection(pagesRemaining > 0 ? pagesRemaining : 0))
    onInputsChange({ ...inputs, insideSections: sections })
  }

  function removeSection(id: string) {
    const sections = (inputs.insideSections || []).filter(s => s.id !== id)
    onInputsChange({ ...inputs, insideSections: sections })
  }

  function updateSection(id: string, partial: Partial<PerfectInsideSection>) {
    const sections = (inputs.insideSections || []).map(s => 
      s.id === id ? { ...s, ...partial } : s
    )
    onInputsChange({ ...inputs, insideSections: sections })
  }

  function toggleSectionMode() {
    if (useSections) {
      // Switch back to single inside
      onInputsChange({ ...inputs, insideSections: [] })
    } else {
      // Switch to sections - create first section with all pages
      const firstSection = createInsideSection(inputs.pagesPerBook || 0)
      firstSection.paperName = inputs.inside.paperName
      firstSection.sides = inputs.inside.sides
      firstSection.sheetSize = inputs.inside.sheetSize
      firstSection.hasBleed = inputs.inside.hasBleed
      onInputsChange({ ...inputs, insideSections: [firstSection] })
    }
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
        <div className="flex flex-col gap-1">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowAllCoverPapers(!showAllCoverPapers)}
              className={`text-xs px-2 py-1 rounded border font-medium transition-colors ${
                showAllCoverPapers 
                  ? "bg-primary text-primary-foreground border-primary" 
                  : "bg-secondary text-foreground border-border hover:bg-primary/10 hover:border-primary"
              }`}
            >
              {showAllCoverPapers ? "Filtered" : "Show All"}
            </button>
          </div>
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
        </div>
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

      {/* Inside Pages Header with Section Toggle */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-foreground">Inside Pages</span>
        <button
          type="button"
          onClick={toggleSectionMode}
          className={`text-xs px-2.5 py-1 rounded border font-medium transition-colors ${
            useSections 
              ? "bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200" 
              : "bg-secondary text-foreground border-border hover:bg-primary/10"
          }`}
        >
          {useSections ? "Using Sections" : "Add Sections"}
        </button>
      </div>

      {/* Single Inside Mode */}
      {!useSections && (
        <div className="grid grid-cols-1 md:grid-cols-[5rem_1fr_1fr_auto_1fr] gap-4 mb-4 items-end">
          <span className="text-sm font-medium text-foreground pb-2">Inside</span>
          <div className="flex flex-col gap-1">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowAllInsidePapers(!showAllInsidePapers)}
                className={`text-xs px-2 py-1 rounded border font-medium transition-colors ${
                  showAllInsidePapers 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-secondary text-foreground border-border hover:bg-primary/10 hover:border-primary"
                }`}
              >
                {showAllInsidePapers ? "Filtered" : "Show All"}
              </button>
            </div>
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
          </div>
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
      )}

      {/* Multiple Sections Mode */}
      {useSections && (
        <div className="border rounded-lg p-3 mb-4 bg-secondary/30">
          {/* Page count summary */}
          <div className={`text-xs mb-3 p-2 rounded ${
            pagesRemaining === 0 
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
              : pagesRemaining > 0 
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          }`}>
            <span className="font-semibold">{totalSectionPages}</span> of <span className="font-semibold">{inputs.pagesPerBook || 0}</span> pages assigned
            {pagesRemaining > 0 && <span className="ml-2">({pagesRemaining} remaining)</span>}
            {pagesRemaining < 0 && <span className="ml-2">({Math.abs(pagesRemaining)} over!)</span>}
          </div>

          {/* Section rows */}
          {inputs.insideSections?.map((section, idx) => (
            <div key={section.id} className="grid grid-cols-1 md:grid-cols-[4rem_5rem_1fr_1fr_auto_auto] gap-2 mb-3 items-end">
              <span className="text-xs font-medium text-muted-foreground pb-2">Sec {idx + 1}</span>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground">Pages</label>
                <Input
                  type="number"
                  min={1}
                  value={section.pageCount || ""}
                  onChange={(e) => updateSection(section.id, { pageCount: parseInt(e.target.value) || 0 })}
                  className="h-9 text-sm"
                  placeholder="0"
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-muted-foreground">Paper</label>
                  <button
                    type="button"
                    onClick={() => setShowAllSectionPapers(prev => ({ ...prev, [section.id]: !prev[section.id] }))}
                    className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                      showAllSectionPapers[section.id] 
                        ? "bg-primary text-primary-foreground" 
                        : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {showAllSectionPapers[section.id] ? "Filtered" : "All"}
                  </button>
                </div>
                <Select
                  value={section.paperName}
                  onValueChange={(val) => updateSection(section.id, { paperName: val, sheetSize: "cheapest", sides: "" })}
                >
                  <SelectTrigger className={`h-9 ${v.cls(!section.paperName)}`}><SelectValue placeholder="Paper" /></SelectTrigger>
                  <SelectContent>
                    {(showAllSectionPapers[section.id] ? allPaperOptions : insidePapers).map((p) => (
                      <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Select
                value={section.sides}
                onValueChange={(val) => updateSection(section.id, { sides: val })}
              >
                <SelectTrigger className={`h-9 ${v.cls(!section.sides)}`}><SelectValue placeholder="Sides" /></SelectTrigger>
                <SelectContent>
                  {INSIDE_SIDES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1.5 h-9">
                <Checkbox
                  id={`section-bleed-${section.id}`}
                  checked={section.hasBleed}
                  onCheckedChange={(checked) => updateSection(section.id, { hasBleed: checked === true })}
                />
                <label htmlFor={`section-bleed-${section.id}`} className="text-xs text-muted-foreground cursor-pointer">Bleed</label>
              </div>
              <button
                type="button"
                onClick={() => removeSection(section.id)}
                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors h-9"
                title="Remove section"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          {/* Add Section Button */}
          <button
            type="button"
            onClick={addSection}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium mt-2"
          >
            <Plus className="h-3.5 w-3.5" /> Add Section
          </button>
        </div>
      )}

      <Separator className="my-4" />

      {/* Lamination (on cover) */}
      {coverCanLaminate && (
        <div className="mb-4">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
            Lamination <span className="font-normal normal-case text-muted-foreground/70">on cover</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {(["none", "gloss", "matte", "silk", "leather"] as const).map((t) => {
              const selected = inputs.laminationType === t
              const isNone = t === "none"
              let price: number | null = null
              if (!isNone && inputs.bookQty > 0 && inputs.cover.paperName) {
                const estSheets = Math.max(inputs.bookQty, 1)
                price = getLaminationPrice(t, inputs.cover.paperName, estSheets, inputs.isBroker)
              }
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => update({ laminationType: t })}
                  className={`flex flex-col items-center rounded-xl border-2 px-4 py-2.5 transition-all min-w-[80px] ${
                    selected
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-foreground hover:border-foreground/30"
                  }`}
                >
                  <span className="text-[12px] font-bold">{isNone ? "None" : t.charAt(0).toUpperCase() + t.slice(1)}</span>
                  {price !== null && price > 0 && (
                    <span className={`text-[10px] font-mono font-semibold mt-0.5 ${selected ? "text-background/70" : "text-muted-foreground"}`}>
                      +{formatCurrency(price)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Section Pages Mismatch Error */}
      {useSections && pagesRemaining !== 0 && v.attempted && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg mb-4">
          Section pages must equal total page count. {pagesRemaining > 0 ? `${pagesRemaining} pages unassigned.` : `${Math.abs(pagesRemaining)} pages over.`}
        </div>
      )}

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
      <div className="flex gap-3">
        {ohpMode ? (
          <Button type="submit" className="flex-1 font-semibold gap-2 bg-sky-600 hover:bg-sky-700 text-white">
            <Save className="h-4 w-4" /> Save Specs
          </Button>
        ) : (
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
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={handleReset}
          className="text-muted-foreground hover:text-foreground font-medium"
        >
          Reset
        </Button>
      </div>
    </form>
  )
}
