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
import { Badge } from "@/components/ui/badge"
import { PAPER_OPTIONS, getAvailableSides } from "@/lib/printing-pricing"
import { getActiveConfig } from "@/lib/pricing-config"
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
  onAddToOrder: () => void
  onReset: () => void
  isEditing: boolean
  canAddToOrder: boolean
  hasCalculated: boolean
  /** Pass the current result so we can show real finishing prices */
  currentResult?: FullPrintingResult | null
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
  currentResult,
}: PrintingFormProps) {
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    v.markAttempted()
    onCalculate()
  }

  return (
        <form onSubmit={handleSubmit}>
          {/* Row 1: Qty, Width, Height */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
            </div>
          </div>

          {/* Row 2: Paper Type, Sides, Bleed */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="print-paper" className="text-sm font-medium text-foreground">
                Paper Type{v.req(!inputs.paperName) && <span className="text-destructive text-xs ml-0.5">*</span>}
              </label>
              <Select value={inputs.paperName} onValueChange={handlePaperChange}>
                <SelectTrigger id="print-paper" className={v.cls(!inputs.paperName)}>
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

          {/* Row 4: Printing Markup + Add-on */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="print-markup-pct" className="text-sm font-medium text-foreground">
                Printing Markup %
              </label>
              <Input
                id="print-markup-pct"
                type="number"
                step="1"
                min={0}
                max={100}
                autoComplete="off"
                placeholder="10"
                value={inputs.printingMarkupPct ?? 10}
                onChange={(e) =>
                  onInputsChange({ ...inputs, printingMarkupPct: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
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

          {/* Broker toggle */}
          <div className="flex items-center gap-2 mb-4">
            <Checkbox
              id="print-broker"
              checked={inputs.isBroker || false}
              onCheckedChange={(checked) =>
                onInputsChange({ ...inputs, isBroker: checked === true })
              }
            />
            <label htmlFor="print-broker" className="text-sm font-medium text-foreground cursor-pointer">
              Broker Pricing
            </label>
            {inputs.isBroker && (
              <span className="text-[10px] text-muted-foreground">(Level 10 default)</span>
            )}
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
              onClick={() => { v.reset(); onReset() }}
              className="flex-1 font-semibold"
            >
              {isEditing ? "Cancel Edit" : "Reset"}
            </Button>
          </div>
        </form>
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
    <div className="mb-5 rounded-lg border border-border bg-muted/20 p-4 flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-foreground">Finishings</h3>

      {/* ── Lamination ── */}
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
            {/* Type selector -- pill buttons */}
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


