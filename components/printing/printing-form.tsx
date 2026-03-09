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
import { Save } from "lucide-react"
import { getAvailableSides } from "@/lib/printing-pricing"
import { useFlatPrintingPapers, usePapers, papersToOptions } from "@/lib/use-papers"
import type { PrintingInputs, FullPrintingResult } from "@/lib/printing-types"

import { FinishingAddOns } from "@/components/finishing-add-ons"
import { FoldFinishSection } from "@/components/printing/fold-finish-section"
import { useFormValidation } from "@/hooks/use-form-validation"
import { LAMINATION_TYPES, LAMINATION_DEFAULTS, toLaminationPaperCategory } from "@/lib/lamination-pricing"
import type { LaminationType, LaminationSides } from "@/lib/lamination-pricing"

interface PrintingFormProps {
  inputs: PrintingInputs
  onInputsChange: (inputs: PrintingInputs) => void
  onCalculate: () => void
  onReset: () => void
  isEditing: boolean
  hasCalculated: boolean
  currentResult?: FullPrintingResult | null
  ohpMode?: boolean
}

export function PrintingForm({
  inputs,
  onInputsChange,
  onCalculate,
  onReset,
  isEditing,
  hasCalculated,
  currentResult,
  ohpMode,
}: PrintingFormProps) {
  const [showAllPapers, setShowAllPapers] = useState(false)
  const { papers: filteredPapers } = useFlatPrintingPapers()
  const { papers: allPapers } = usePapers()
  const papers = showAllPapers ? allPapers : filteredPapers
  const paperOptions = papersToOptions(papers)
  const availableSides = inputs.paperName ? getAvailableSides(inputs.paperName) : []
  const v = useFormValidation()

  function handlePaperChange(value: string) {
    const newSides = getAvailableSides(value)
    const keepSides = newSides.includes(inputs.sidesValue)
    onInputsChange({
      ...inputs,
      paperName: value,
      sidesValue: keepSides ? inputs.sidesValue : "",
    })
  }

  // Direct click handler - bypass form submission entirely
  function handleCalculateClick() {
    v.markAttempted()
    onCalculate()
  }

  function handleResetClick() {
    v.reset()
    onReset()
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Row 1: Qty, Width, Height */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="print-qty" className="text-sm font-medium text-foreground">
            Quantity{v.req(!inputs.qty) && <span className="text-destructive text-xs ml-0.5">*</span>}
          </label>
          <Input
            id="print-qty"
            type="number"
            inputMode="numeric"
            min={1}
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. 500..."
            className={v.cls(!inputs.qty)}
            value={inputs.qty || ""}
            onChange={(e) =>
              onInputsChange({ ...inputs, qty: parseInt(e.target.value) || 0 })
            }
          />
          {v.attempted && !inputs.qty && (
            <p className="text-[10px] text-destructive font-medium">Enter quantity</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="print-width" className="text-sm font-medium text-foreground">
            Width (in){v.req(!inputs.width) && <span className="text-destructive text-xs ml-0.5">*</span>}
          </label>
          <Input
            id="print-width"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            autoComplete="off"
            placeholder="e.g. 4..."
            className={v.cls(!inputs.width)}
            value={inputs.width || ""}
            onChange={(e) =>
              onInputsChange({ ...inputs, width: parseFloat(e.target.value) || 0 })
            }
          />
          {v.attempted && !inputs.width && (
            <p className="text-[10px] text-destructive font-medium">Enter width</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="print-height" className="text-sm font-medium text-foreground">
            Height (in){v.req(!inputs.height) && <span className="text-destructive text-xs ml-0.5">*</span>}
          </label>
          <Input
            id="print-height"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            autoComplete="off"
            placeholder="e.g. 6..."
            className={v.cls(!inputs.height)}
            value={inputs.height || ""}
            onChange={(e) =>
              onInputsChange({ ...inputs, height: parseFloat(e.target.value) || 0 })
            }
          />
          {v.attempted && !inputs.height && (
            <p className="text-[10px] text-destructive font-medium">Enter height</p>
          )}
        </div>
      </div>

      {/* Row 2: Paper Type, Sides, Bleed */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="print-paper" className="text-sm font-medium text-foreground">
              Paper Type{v.req(!inputs.paperName) && <span className="text-destructive text-xs ml-0.5">*</span>}
            </label>
            <button
              type="button"
              onClick={() => setShowAllPapers(!showAllPapers)}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                showAllPapers 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {showAllPapers ? "Filtered" : "Show All"}
            </button>
          </div>
          <Select value={inputs.paperName} onValueChange={handlePaperChange}>
            <SelectTrigger id="print-paper" className={v.cls(!inputs.paperName)}>
              <SelectValue placeholder="Select Paper" />
            </SelectTrigger>
            <SelectContent>
              {paperOptions.map((paper) => (
                <SelectItem key={paper.name} value={paper.name}>
                  {paper.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {v.attempted && !inputs.paperName && (
            <p className="text-[10px] text-destructive font-medium">Select a paper type</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="print-sides" className="text-sm font-medium text-foreground">
            Sides{v.req(!inputs.sidesValue) && <span className="text-destructive text-xs ml-0.5">*</span>}
          </label>
          <Select
            value={inputs.sidesValue}
            onValueChange={(val) => onInputsChange({ ...inputs, sidesValue: val })}
            disabled={!inputs.paperName}
          >
            <SelectTrigger id="print-sides" className={v.cls(!inputs.sidesValue)}>
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
          {v.attempted && !inputs.sidesValue && (
            <p className="text-[10px] text-destructive font-medium">Select sides</p>
          )}
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
      <FinishingsSection
        inputs={inputs}
        onInputsChange={onInputsChange}
        currentResult={currentResult}
      />

      {/* Row 4: Add-on (in-house only) */}
      {!ohpMode && (
        <div className="grid grid-cols-2 gap-4">
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
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-on-desc" className="text-sm font-medium text-foreground">
              Add on Description
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
      )}

      {/* Validation summary */}
      {v.attempted && (!inputs.qty || !inputs.width || !inputs.height || !inputs.paperName || !inputs.sidesValue) && (
        <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-3 py-2">
          <p className="text-[11px] text-destructive font-medium">
            Please fill in the highlighted fields above to calculate pricing.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 mt-2">
        {ohpMode ? (
          <Button
            type="button"
            onClick={handleCalculateClick}
            className="flex-1 font-semibold gap-2 bg-sky-600 hover:bg-sky-700 text-white"
          >
            <Save className="h-4 w-4" />
            Save Specs
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleCalculateClick}
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
          variant="secondary"
          onClick={handleResetClick}
          className="flex-1 font-semibold"
        >
          {isEditing ? "Cancel Edit" : "Reset"}
        </Button>
      </div>
    </div>
  )
}

// ---- Finishings section (extracted for clarity) ----
function FinishingsSection({
  inputs,
  onInputsChange,
  currentResult,
}: {
  inputs: PrintingInputs
  onInputsChange: (i: PrintingInputs) => void
  currentResult?: FullPrintingResult | null
}) {
  const lam = inputs.lamination || LAMINATION_DEFAULTS
  const [showLamSettings, setShowLamSettings] = useState(false)

  function updateLam(patch: Partial<typeof lam>) {
    onInputsChange({ ...inputs, lamination: { ...lam, ...patch } })
  }

  const paperCat = inputs.paperName ? toLaminationPaperCategory(inputs.paperName) : null
  const isTextPaper = paperCat === "100 Text/80 Cover"

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4 flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-foreground">Finishings</h3>

      {/* Lamination */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              id="lam-enabled"
              checked={lam.enabled}
              onCheckedChange={(checked) => updateLam({ enabled: checked === true })}
            />
            <label htmlFor="lam-enabled" className="text-[13px] font-semibold text-foreground cursor-pointer">
              Lamination
            </label>
          </div>
          {lam.enabled && (
            <button
              type="button"
              onClick={() => setShowLamSettings(!showLamSettings)}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              {showLamSettings ? "Hide settings" : "Settings"}
            </button>
          )}
        </div>

        {lam.enabled && (
          <div className="flex flex-col gap-3 pl-1">
            {/* Type selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">Type</label>
              <div className="flex flex-wrap gap-1.5">
                {LAMINATION_TYPES.map((t) => {
                  const selected = lam.type === t
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => updateLam({ type: t as LaminationType })}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${
                        selected
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-card text-foreground hover:border-foreground/40"
                      }`}
                    >
                      {t}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Sides */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">Sides</label>
              <div className="flex gap-1.5">
                {(["S/S", "D/S"] as LaminationSides[]).map((s) => {
                  const selected = lam.sides === s
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => updateLam({ sides: s })}
                      className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${
                        selected
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-card text-foreground hover:border-foreground/40"
                      }`}
                    >
                      {s === "S/S" ? "Single Side" : "Both Sides"}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Paper warning for text weight */}
            {isTextPaper && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                  Text-weight paper is harder to laminate. Consider card stock for best results.
                </p>
              </div>
            )}

            {/* Collapsible settings */}
            {showLamSettings && (
              <div className="rounded-lg border border-border bg-card p-3 flex flex-col gap-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Lamination Settings</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-muted-foreground">Markup %</label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={lam.markupPct}
                      onChange={(e) => updateLam({ markupPct: parseFloat(e.target.value) || 0 })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-muted-foreground">Broker Discount %</label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={5}
                      value={lam.brokerDiscountPct}
                      onChange={(e) => updateLam({ brokerDiscountPct: parseFloat(e.target.value) || 0 })}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Fold / Score Finishing */}
      <FoldFinishSection
        inputs={inputs}
        onInputsChange={onInputsChange}
        currentResult={currentResult}
      />

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Custom Finishing Calculators (from Settings) */}
      <FinishingAddOns
        target="flat"
        cutItems={inputs.qty}
        parentSheets={currentResult?.result.sheets ?? 0}
        isBroker={inputs.isBroker || false}
        selectedIds={inputs.finishingCalcIds || []}
        onSelectionChange={(ids) =>
          onInputsChange({ ...inputs, finishingCalcIds: ids })
        }
      />
    </div>
  )
}
