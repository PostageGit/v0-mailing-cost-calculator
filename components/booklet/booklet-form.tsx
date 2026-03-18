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
import { MultiQtyToggle } from "@/components/qty-comparison-table"
import {
  getAvailableSizes,
  canPaperLaminate,
  ALL_SIDES,
  INSIDE_SIDES,
  getLaminationPrice,
} from "@/lib/booklet-pricing"
import { getLaminationTypes } from "@/lib/lamination-pricing"
import { usePapersContext } from "@/lib/papers-context"
import { formatCurrency } from "@/lib/pricing"
import type { BookletInputs, BookletInsertSection } from "@/lib/booklet-types"
import { createInsertSection } from "@/lib/booklet-types"
import { useFormValidation } from "@/hooks/use-form-validation"

interface BookletFormProps {
  inputs: BookletInputs
  onInputsChange: (inputs: BookletInputs) => void
  onCalculate: () => void
  onReset: () => void
  isEditing: boolean
  validationError: string | null
  ohpMode?: boolean
  disabled?: boolean
  compact?: boolean
}

export function BookletForm({
  inputs,
  onInputsChange,
  onCalculate,
  onReset,
  isEditing,
  validationError,
  ohpMode,
  disabled = false,
  compact = false,
}: BookletFormProps) {
  const [showAllCoverPapers, setShowAllCoverPapers] = useState(false)
  const [showAllInsidePapers, setShowAllInsidePapers] = useState(false)
  const [showAllInsertPapers, setShowAllInsertPapers] = useState<Record<string, boolean>>({})
  const { getPaperOptions, papers: allPapers } = usePapersContext()

  // Calculate total leaves from page count (pages / 4 for saddle stitch)
  const totalLeaves = inputs.pagesPerBook > 0 ? Math.ceil(inputs.pagesPerBook / 4) : 0
  const usesInserts = inputs.insertSections && inputs.insertSections.length > 0
  const insertLeafCount = usesInserts ? inputs.insertSections.reduce((sum, s) => sum + (s.leafCount || 0), 0) : 0
  const mainLeaves = totalLeaves - insertLeafCount
  const allPaperOptions = allPapers.map((p) => ({ name: p.name, isCardstock: p.is_cardstock, thickness: p.thickness, availableSizes: p.available_sizes }))
  const coverPapersFiltered = showAllCoverPapers ? allPaperOptions : getPaperOptions("book_cover")
  const coverPapers = coverPapersFiltered.some((p) => p.name === inputs.coverPaper)
    ? coverPapersFiltered
    : inputs.coverPaper
      ? [allPaperOptions.find((p) => p.name === inputs.coverPaper) ?? { name: inputs.coverPaper, isCardstock: true, thickness: 0, availableSizes: [] }, ...coverPapersFiltered]
      : coverPapersFiltered
  const insidePapersFiltered = showAllInsidePapers ? allPaperOptions : getPaperOptions("book_inside")
  const insidePapers = insidePapersFiltered.some((p) => p.name === inputs.insidePaper)
    ? insidePapersFiltered
    : inputs.insidePaper
      ? [allPaperOptions.find((p) => p.name === inputs.insidePaper) ?? { name: inputs.insidePaper, isCardstock: false, thickness: 0, availableSizes: [] }, ...insidePapersFiltered]
      : insidePapersFiltered
  const coverSizes = inputs.coverPaper ? getAvailableSizes(inputs.coverPaper) : []
  const insideSizes = inputs.insidePaper ? getAvailableSizes(inputs.insidePaper) : []
  const canLam = inputs.separateCover && inputs.coverPaper ? canPaperLaminate(inputs.coverPaper) : false
  const v = useFormValidation()

  const minPages = inputs.separateCover ? 4 : 8
  const pagesError = inputs.pagesPerBook > 0 && inputs.pagesPerBook % 4 !== 0
    ? `Must be a multiple of 4. Try ${Math.ceil(inputs.pagesPerBook / 4) * 4}.`
    : inputs.pagesPerBook > 172
      ? "Max 172 pages."
      : inputs.pagesPerBook > 0 && inputs.pagesPerBook < minPages
        ? `Minimum ${minPages} pages.`
        : null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    v.markAttempted()
    onCalculate()
  }

  function handleReset() {
    v.reset()
    onReset()
  }

  function updateInputs(partial: Partial<BookletInputs>) {
    onInputsChange({ ...inputs, ...partial })
  }

  // Insert section management
  function addInsert() {
    const sections = [...(inputs.insertSections || [])]
    sections.push(createInsertSection(1))
    onInputsChange({ ...inputs, insertSections: sections })
  }

  function removeInsert(id: string) {
    const sections = (inputs.insertSections || []).filter(s => s.id !== id)
    onInputsChange({ ...inputs, insertSections: sections })
  }

  function updateInsert(id: string, partial: Partial<BookletInsertSection>) {
    const sections = (inputs.insertSections || []).map(s => 
      s.id === id ? { ...s, ...partial } : s
    )
    onInputsChange({ ...inputs, insertSections: sections })
  }

  function toggleInsertsMode() {
    if (usesInserts) {
      // Switch back to no inserts
      onInputsChange({ ...inputs, insertSections: [] })
    } else {
      // Start with one insert
      onInputsChange({ ...inputs, insertSections: [createInsertSection(1)] })
    }
  }

  return (
    <form onSubmit={handleSubmit} className={compact ? "space-y-3" : ""}>
      <fieldset disabled={disabled} className={disabled ? "opacity-60 pointer-events-none" : ""}>
      {/* Row 1: General Info */}
      <div className={`grid grid-cols-2 md:grid-cols-4 ${compact ? "gap-2 mb-2" : "gap-4 mb-4"}`}>
        <div className={`flex flex-col ${compact ? "gap-0.5" : "gap-1.5"}`}>
          <label htmlFor="book-qty" className={`${compact ? "text-xs" : "text-sm"} font-medium text-foreground`}>
            Booklet Amount{v.req(!inputs.bookQty) && <span className="text-destructive text-xs ml-0.5">*</span>}
          </label>
          <Input
            id="book-qty" type="number" inputMode="numeric" min={1} autoComplete="off"
            placeholder="e.g. 50..."
            className={v.cls(!inputs.bookQty)}
            value={inputs.bookQty || ""}
            onChange={(e) => updateInputs({ bookQty: parseInt(e.target.value) || 0 })}
          />
          {v.attempted && !inputs.bookQty && <p className="text-[10px] text-destructive font-medium">Enter quantity</p>}
        </div>
        <div className="flex flex-col gap-1.5">
<label htmlFor="pages-per-book" className="text-sm font-medium text-foreground">
{inputs.separateCover ? "Inside Pages" : "Page Amount"}{v.req(!inputs.pagesPerBook) && <span className="text-destructive text-xs ml-0.5">*</span>}
</label>
          <Input
            id="pages-per-book" type="number" inputMode="numeric"
            min={8} max={172} step={4} autoComplete="off"
            placeholder="e.g. 16..."
            className={`${v.cls(!inputs.pagesPerBook)} ${pagesError ? "border-destructive" : ""}`}
            value={inputs.pagesPerBook || ""}
            onChange={(e) => updateInputs({ pagesPerBook: parseInt(e.target.value) || 0 })}
          />
          {pagesError && <p className="text-destructive text-xs">{pagesError}</p>}
          {v.attempted && !inputs.pagesPerBook && !pagesError && <p className="text-[10px] text-destructive font-medium">Enter page count</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="page-width" className="text-sm font-medium text-foreground">
            Page Width (in){v.req(!inputs.pageWidth) && <span className="text-destructive text-xs ml-0.5">*</span>}
          </label>
          <Input
            id="page-width" type="number" inputMode="decimal" step={0.01} min={2.5} autoComplete="off"
            placeholder="e.g. 5.5..."
            className={v.cls(!inputs.pageWidth)}
            value={inputs.pageWidth || ""}
            onChange={(e) => updateInputs({ pageWidth: parseFloat(e.target.value) || 0 })}
          />
          {v.attempted && !inputs.pageWidth && <p className="text-[10px] text-destructive font-medium">Enter width</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="page-height" className="text-sm font-medium text-foreground">
            Page Height (in){v.req(!inputs.pageHeight) && <span className="text-destructive text-xs ml-0.5">*</span>}
          </label>
          <Input
            id="page-height" type="number" inputMode="decimal" step={0.01} min={2.5} autoComplete="off"
            placeholder="e.g. 8.5..."
            className={v.cls(!inputs.pageHeight)}
            value={inputs.pageHeight || ""}
            onChange={(e) => updateInputs({ pageHeight: parseFloat(e.target.value) || 0 })}
          />
          {v.attempted && !inputs.pageHeight && <p className="text-[10px] text-destructive font-medium">Enter height</p>}
        </div>
      </div>

      {/* Multi-Qty Compare Toggle */}
      {!ohpMode && !disabled && (
        <MultiQtyToggle
          value={inputs.multiQty ?? { enabled: false, quantities: [] }}
          onChange={(v) => onInputsChange({ ...inputs, multiQty: v })}
          defaultBase={inputs.bookQty || 500}
        />
      )}

      <Separator className={compact ? "my-2" : "my-4"} />

      {/* Separate Cover Checkbox */}
      <div className={`flex items-center gap-2 ${compact ? "mb-2" : "mb-4"}`}
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
        <div className={`grid grid-cols-1 md:grid-cols-[5rem_1fr_1fr_auto_1fr] ${compact ? "gap-2 mb-2" : "gap-4 mb-4"} items-end`}>
          <span className={`${compact ? "text-xs" : "text-sm"} font-medium text-foreground pb-2`}>Cover</span>
          <div className="flex flex-col gap-1">
            {!compact && (
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
            )}
            <Select value={inputs.coverPaper} onValueChange={(val) => updateInputs({ coverPaper: val, coverSheetSize: "cheapest" })}>
              <SelectTrigger className={v.cls(!inputs.coverPaper)}><SelectValue placeholder="Select Paper" /></SelectTrigger>
              <SelectContent>
                {coverPapers.map((p) => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Select value={inputs.coverSides} onValueChange={(val) => updateInputs({ coverSides: val })}>
            <SelectTrigger className={v.cls(!inputs.coverSides)}><SelectValue placeholder="Sides" /></SelectTrigger>
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
          <Select value={inputs.coverSheetSize} onValueChange={(val) => updateInputs({ coverSheetSize: val })}>
            <SelectTrigger><SelectValue placeholder="Sheet Size" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cheapest">Cheapest</SelectItem>
              {coverSizes.filter((s) => s !== "13x26").map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              {coverSizes.includes("13x26") && (
                <>
                  <Separator className="my-1" />
                  <SelectItem value="13x26" className="text-amber-600 dark:text-amber-400">13x26 (Large Format)</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Inside Pages Row */}
      <div className={`grid grid-cols-1 md:grid-cols-[5rem_1fr_1fr_auto_1fr] ${compact ? "gap-2 mb-2" : "gap-4 mb-4"} items-end`}>
        <span className={`${compact ? "text-xs" : "text-sm"} font-medium text-foreground pb-2`}>Inside</span>
        <div className="flex flex-col gap-1">
          {!compact && (
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
          )}
          <Select value={inputs.insidePaper} onValueChange={(val) => updateInputs({ insidePaper: val, insideSheetSize: "cheapest" })}>
            <SelectTrigger className={v.cls(!inputs.insidePaper)}><SelectValue placeholder="Select Paper" /></SelectTrigger>
            <SelectContent>
              {insidePapers.map((p) => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Select value={inputs.insideSides} onValueChange={(val) => updateInputs({ insideSides: val })}>
          <SelectTrigger className={v.cls(!inputs.insideSides)}><SelectValue placeholder="Sides" /></SelectTrigger>
          <SelectContent>
            {INSIDE_SIDES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
        <Select value={inputs.insideSheetSize} onValueChange={(val) => updateInputs({ insideSheetSize: val })}>
          <SelectTrigger><SelectValue placeholder="Sheet Size" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cheapest">Cheapest</SelectItem>
            {insideSizes.filter((s) => s !== "13x26").map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            {insideSizes.includes("13x26") && (
              <>
                <Separator className="my-1" />
                <SelectItem value="13x26" className="text-amber-600 dark:text-amber-400">13x26 (Large Format)</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Insert Sections Toggle - hidden in compact mode */}
      {!compact && <div className="flex items-center justify-between mb-3 mt-4 pb-2 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">Leaf Inserts</span>
          {totalLeaves > 0 && (
            <span className="text-xs text-muted-foreground">({totalLeaves} leaves total)</span>
          )}
        </div>
        <button
          type="button"
          onClick={toggleInsertsMode}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border font-semibold transition-colors shadow-sm ${
            usesInserts 
              ? "bg-amber-500 text-white border-amber-600 hover:bg-amber-600" 
              : "bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200"
          }`}
        >
          {usesInserts ? (
            <>Using Inserts</>
          ) : (
            <><Plus className="h-3.5 w-3.5" /> Add Leaf Inserts</>
          )}
        </button>
      </div>}

      {/* Insert Sections UI - hidden in compact mode */}
      {!compact && usesInserts && (
        <div className="border rounded-lg p-3 mb-4 bg-secondary/30">
          {/* Leaf distribution summary */}
          <div className="flex flex-wrap gap-3 items-center mb-3">
            <div className={`flex-1 text-xs p-2 rounded ${
              mainLeaves > 0 
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                : mainLeaves === 0 
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            }`}>
              <span className="font-medium">Inserts: {insertLeafCount} leaves</span>
              <span className="mx-2">|</span>
              <span className="font-semibold">Main: {mainLeaves} leaves</span>
              {mainLeaves < 0 && <span className="ml-2 text-red-600 font-bold">(Too many insert leaves!)</span>}
            </div>
            {/* Insert fee input */}
            {inputs.insertSections && inputs.insertSections.length > 0 && (
              <div className="flex items-center gap-2 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 p-2 rounded">
                <label className="font-medium whitespace-nowrap">Insert Fee:</label>
                <span className="text-muted-foreground">$</span>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={inputs.insertFeePerSection ?? 25}
                  onChange={(e) => updateInputs({ insertFeePerSection: parseFloat(e.target.value) || 0 })}
                  className="w-16 h-7 text-xs text-center"
                />
                <span className="text-muted-foreground">x {inputs.insertSections.length} = </span>
                <span className="font-bold">{formatCurrency((inputs.insertFeePerSection ?? 25) * inputs.insertSections.length)}</span>
              </div>
            )}
          </div>

          {/* Insert section rows */}
          {inputs.insertSections?.map((insert, idx) => {
            const insertPapers = showAllInsertPapers[insert.id] ? allPaperOptions : insidePapers
            const insertSizes = insert.paperName ? getAvailableSizes(insert.paperName) : []
            const pagesInInsert = insert.leafCount * 4
            
            return (
              <div key={insert.id} className="mb-3 p-2 rounded bg-background/50 border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                      INSERT {idx + 1}
                    </span>
                    <span className="text-[10px] text-muted-foreground">({pagesInInsert} pages)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeInsert(insert.id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                    title="Remove insert"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-[4rem_1fr_1fr_auto_1fr] gap-2 items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-muted-foreground">Leaves</label>
                    <Input
                      type="number"
                      min={1}
                      max={totalLeaves - 1}
                      value={insert.leafCount || ""}
                      onChange={(e) => updateInsert(insert.id, { leafCount: parseInt(e.target.value) || 0 })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] text-muted-foreground">Paper</label>
                      <button
                        type="button"
                        onClick={() => setShowAllInsertPapers(prev => ({ ...prev, [insert.id]: !prev[insert.id] }))}
                        className={`text-[9px] px-1.5 py-0.5 rounded border font-medium transition-colors ${
                          showAllInsertPapers[insert.id] 
                            ? "bg-primary text-primary-foreground border-primary" 
                            : "bg-secondary text-foreground border-border hover:bg-primary/10 hover:border-primary"
                        }`}
                      >
                        {showAllInsertPapers[insert.id] ? "Filtered" : "All"}
                      </button>
                    </div>
                    <Select
                      value={insert.paperName}
                      onValueChange={(val) => updateInsert(insert.id, { paperName: val, sheetSize: "cheapest", sides: "" })}
                    >
                      <SelectTrigger className={`h-8 ${v.cls(!insert.paperName)}`}><SelectValue placeholder="Paper" /></SelectTrigger>
                      <SelectContent>
                        {insertPapers.map((p) => (
                          <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Select
                    value={insert.sides}
                    onValueChange={(val) => updateInsert(insert.id, { sides: val })}
                  >
                    <SelectTrigger className={`h-8 ${v.cls(!insert.sides)}`}><SelectValue placeholder="Sides" /></SelectTrigger>
                    <SelectContent>
                      {INSIDE_SIDES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1.5 h-8">
                    <Checkbox
                      id={`insert-bleed-${insert.id}`}
                      checked={insert.hasBleed}
                      onCheckedChange={(checked) => updateInsert(insert.id, { hasBleed: checked === true })}
                    />
                    <label htmlFor={`insert-bleed-${insert.id}`} className="text-xs text-muted-foreground cursor-pointer">Bleed</label>
                  </div>
                  <Select
                    value={insert.sheetSize}
                    onValueChange={(val) => updateInsert(insert.id, { sheetSize: val })}
                  >
                    <SelectTrigger className="h-8"><SelectValue placeholder="Sheet" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cheapest">Cheapest</SelectItem>
                      {insertSizes.filter((s) => s !== "13x26").map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )
          })}

          {/* Add Insert Button */}
          <button
            type="button"
            onClick={addInsert}
            className="w-full flex items-center justify-center gap-2 text-xs px-3 py-2 rounded-md border-2 border-dashed border-blue-400/40 text-blue-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 font-medium transition-colors mt-2"
          >
            <Plus className="h-3.5 w-3.5" /> Add Another Insert
          </button>

          {/* Helper text */}
          <p className="text-[10px] text-muted-foreground mt-3 italic">
            Each insert is a separate group of leaves with different paper. 1 leaf = 4 pages.
          </p>
        </div>
      )}

      <Separator className="my-4" />

      {/* Binding Type */}
      <div className="mb-6">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
          Binding Type
        </label>
        <div className="flex flex-wrap gap-2">
          {([
            { value: "staple", label: "Staple", desc: "saddle stitch" },
            { value: "fold", label: "Fold Only", desc: "no staple" },
            { value: "perfect", label: "Perfect Bind", desc: "glue spine" },
          ] as const).map((opt) => {
            const selected = (inputs.bindingType || "staple") === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateInputs({ bindingType: opt.value })}
                className={`flex flex-col items-center rounded-xl border-2 px-4 py-2.5 transition-all min-w-[100px] ${
                  selected
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-foreground hover:border-foreground/30"
                }`}
              >
                <span className="text-[12px] font-bold">{opt.label}</span>
                <span className={`text-[10px] font-mono mt-0.5 ${selected ? "text-background/70" : "text-muted-foreground"}`}>
                  {opt.desc}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Lamination (on cover) */}
      {inputs.separateCover && canLam && (
        <div className="mb-6">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
            Lamination <span className="font-normal normal-case text-muted-foreground/70">on cover</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {["none", ...getLaminationTypes()].map((t) => {
              const selected = inputs.laminationType === t.toLowerCase()
              const isNone = t === "none"
              // Compute live price for this lamination type (needs cover sheets from a quick calc)
              let price: number | null = null
              if (!isNone && inputs.bookQty > 0 && inputs.coverPaper) {
                // Estimate cover sheets: rough approximation (qty / 2 for saddle-stitch with UPS)
                const estSheets = Math.max(inputs.bookQty, 1)
                price = getLaminationPrice(t, inputs.coverPaper, estSheets, inputs.isBroker)
              }
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => updateInputs({ laminationType: t.toLowerCase() })}
                  className={`flex flex-col items-center rounded-xl border-2 px-4 py-2.5 transition-all min-w-[80px] ${
                    selected
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-foreground hover:border-foreground/30"
                  }`}
                >
                  <span className="text-[12px] font-bold">{isNone ? "None" : t}</span>
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
      </fieldset>
    </form>
  )
}
