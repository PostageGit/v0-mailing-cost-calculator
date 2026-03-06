"use client"

import { useState, useCallback, useEffect } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Loader2, Save, ArrowRight } from "lucide-react"
import { calculatePrintingCost, PAPER_OPTIONS, getAvailableSides } from "@/lib/printing-pricing" 
import { formatCurrency } from "@/lib/pricing"
import type { PrintingInputs, FullPrintingResult } from "@/lib/printing-types"
import { LAMINATION_DEFAULTS } from "@/lib/lamination-pricing"
import type { LaminationType, LaminationSides } from "@/lib/lamination-pricing"

// Chat quote type from dashboard
interface ChatQuote {
  id: string
  ref_number: number
  customer_name: string
  customer_email: string
  customer_phone: string
  project_name: string
  product_type: string
  total: number
  per_unit: number
  specs: Record<string, unknown>
  cost_breakdown: Record<string, unknown>
  parent_quote_id?: string
  revision_number?: number
}

interface ChatQuoteRevisionPanelProps {
  quote: ChatQuote | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRevisionSaved: () => void
}

// Helper to format the quote reference
function formatRef(refNumber: number, revision?: number): string {
  const base = `CQ-${refNumber}`
  return revision && revision > 0 ? `${base}-R${revision}` : base
}

export function ChatQuoteRevisionPanel({
  quote,
  open,
  onOpenChange,
  onRevisionSaved,
}: ChatQuoteRevisionPanelProps) {
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<FullPrintingResult | null>(null)
  const [inputs, setInputs] = useState<PrintingInputs>(getDefaultInputs())

  // Initialize inputs from quote specs when quote changes
  useEffect(() => {
    if (quote && open) {
      const specs = quote.specs || {}
      setInputs(mapSpecsToInputs(specs))
      setResult(null)
    }
  }, [quote, open])

  // Calculate pricing whenever inputs change
  useEffect(() => {
    if (inputs.qty && inputs.width && inputs.height && inputs.paperName && inputs.sidesValue) {
      try {
        const calcResult = calculatePrintingCost(inputs)
        setResult(calcResult)
      } catch {
        setResult(null)
      }
    } else {
      setResult(null)
    }
  }, [inputs])

  const handleSaveRevision = useCallback(async () => {
    if (!quote || !result) return

    setSaving(true)
    try {
      const response = await fetch("/api/chat-quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentQuoteId: quote.parent_quote_id || quote.id,
          projectName: quote.project_name,
          productType: quote.product_type,
          total: result.result.grandTotal,
          perUnit: result.result.perPiece,
          specs: {
            quantity: inputs.qty,
            width: inputs.width,
            height: inputs.height,
            paper: inputs.paperName,
            sides: inputs.sidesValue,
            bleed: inputs.hasBleed,
            lamination: inputs.lamination?.enabled ? `${inputs.lamination.type} (${inputs.lamination.sides})` : "none",
            scoreFold: inputs.scoreFold || "none",
            isBroker: inputs.isBroker,
          },
          costBreakdown: {
            printing: result.result.printingCost,
            lamination: result.result.laminationCost || 0,
            scoreFold: result.result.scoreFoldCost || 0,
            addOn: result.result.addOnCharge || 0,
          },
          revisedBy: "Manual",
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Failed to save revision")
      }

      onRevisionSaved()
      onOpenChange(false)
    } catch (e) {
      console.error("[v0] Failed to save revision:", e)
      alert(e instanceof Error ? e.message : "Failed to save revision")
    } finally {
      setSaving(false)
    }
  }, [quote, result, inputs, onRevisionSaved, onOpenChange])

  if (!quote) return null

  const originalRef = formatRef(quote.ref_number, quote.revision_number)
  const priceDiff = result ? result.result.grandTotal - quote.total : 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
              REVISION
            </Badge>
            <SheetTitle className="text-lg">{originalRef}</SheetTitle>
          </div>
          <SheetDescription>
            {quote.project_name} | {quote.customer_name || "No customer"}
          </SheetDescription>
        </SheetHeader>

        {/* Original vs New Price Comparison */}
        <div className="rounded-lg border border-border bg-muted/30 p-3 mb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="text-center flex-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Original</p>
              <p className="text-lg font-bold text-muted-foreground line-through">{formatCurrency(quote.total)}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="text-center flex-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">New</p>
              <p className="text-lg font-bold text-foreground">
                {result ? formatCurrency(result.result.grandTotal) : "—"}
              </p>
            </div>
            {result && (
              <div className="text-center flex-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Change</p>
                <p className={`text-lg font-bold ${priceDiff > 0 ? "text-red-600" : priceDiff < 0 ? "text-green-600" : "text-muted-foreground"}`}>
                  {priceDiff > 0 ? "+" : ""}{formatCurrency(priceDiff)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Simplified Flat Printing Form */}
        <div className="space-y-4">
          {/* Row 1: Qty, Width, Height */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Quantity</label>
              <Input
                type="number"
                min={1}
                value={inputs.qty || ""}
                onChange={(e) => setInputs({ ...inputs, qty: parseInt(e.target.value) || 0 })}
                className="h-9"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Width (in)</label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={inputs.width || ""}
                onChange={(e) => setInputs({ ...inputs, width: parseFloat(e.target.value) || 0 })}
                className="h-9"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Height (in)</label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={inputs.height || ""}
                onChange={(e) => setInputs({ ...inputs, height: parseFloat(e.target.value) || 0 })}
                className="h-9"
              />
            </div>
          </div>

          {/* Row 2: Paper, Sides */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Paper</label>
              <Select
                value={inputs.paperName}
                onValueChange={(val) => {
                  const newSides = getAvailableSides(val)
                  setInputs({
                    ...inputs,
                    paperName: val,
                    sidesValue: newSides.includes(inputs.sidesValue) ? inputs.sidesValue : "",
                  })
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select paper" />
                </SelectTrigger>
                <SelectContent>
                  {PAPER_OPTIONS.map((p) => (
                    <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Sides</label>
              <Select
                value={inputs.sidesValue}
                onValueChange={(val) => setInputs({ ...inputs, sidesValue: val })}
                disabled={!inputs.paperName}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select sides" />
                </SelectTrigger>
                <SelectContent>
                  {(inputs.paperName ? getAvailableSides(inputs.paperName) : []).map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Bleed, Broker */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="rev-bleed"
                checked={inputs.hasBleed}
                onCheckedChange={(c) => setInputs({ ...inputs, hasBleed: c === true })}
              />
              <label htmlFor="rev-bleed" className="text-sm cursor-pointer">Bleed</label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="rev-broker"
                checked={inputs.isBroker}
                onCheckedChange={(c) => setInputs({ ...inputs, isBroker: c === true })}
              />
              <label htmlFor="rev-broker" className="text-sm cursor-pointer">Broker pricing</label>
            </div>
          </div>

          {/* Lamination */}
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Checkbox
                id="rev-lam"
                checked={inputs.lamination?.enabled}
                onCheckedChange={(c) =>
                  setInputs({
                    ...inputs,
                    lamination: { ...(inputs.lamination || LAMINATION_DEFAULTS), enabled: c === true },
                  })
                }
              />
              <label htmlFor="rev-lam" className="text-sm font-medium cursor-pointer">Lamination</label>
            </div>
            {inputs.lamination?.enabled && (
              <div className="flex gap-3 pl-6">
                <Select
                  value={inputs.lamination.type}
                  onValueChange={(v) =>
                    setInputs({
                      ...inputs,
                      lamination: { ...inputs.lamination!, type: v as LaminationType },
                    })
                  }
                >
                  <SelectTrigger className="h-8 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Gloss", "Matte", "Silk"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={inputs.lamination.sides}
                  onValueChange={(v) =>
                    setInputs({
                      ...inputs,
                      lamination: { ...inputs.lamination!, sides: v as LaminationSides },
                    })
                  }
                >
                  <SelectTrigger className="h-8 w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="S/S">Single</SelectItem>
                    <SelectItem value="D/S">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Cost breakdown */}
          {result && (
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Cost Breakdown</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Printing</span>
                  <span className="font-medium">{formatCurrency(result.result.printingCost)}</span>
                </div>
                {(result.result.laminationCost || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lamination</span>
                    <span className="font-medium">{formatCurrency(result.result.laminationCost || 0)}</span>
                  </div>
                )}
                {(result.result.scoreFoldCost || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Score/Fold</span>
                    <span className="font-medium">{formatCurrency(result.result.scoreFoldCost || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-border">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold">{formatCurrency(result.result.grandTotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Per piece</span>
                  <span>{formatCurrency(result.result.perPiece)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <Button
            onClick={handleSaveRevision}
            disabled={!result || saving}
            className="flex-1 gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Revision
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Default inputs
function getDefaultInputs(): PrintingInputs {
  return {
    qty: 0,
    width: 0,
    height: 0,
    paperName: "",
    sidesValue: "",
    hasBleed: false,
    isBroker: false,
    lamination: LAMINATION_DEFAULTS,
    scoreFold: "none",
    finishingCalcIds: [],
    addOnCharge: 0,
    addOnDescription: "",
  }
}

// Map chat quote specs to PrintingInputs
function mapSpecsToInputs(specs: Record<string, unknown>): PrintingInputs {
  const inputs = getDefaultInputs()

  // Handle various spec formats from AI
  if (specs.quantity) inputs.qty = Number(specs.quantity) || 0
  if (specs.qty) inputs.qty = Number(specs.qty) || 0

  if (specs.width) inputs.width = Number(specs.width) || 0
  if (specs.height) inputs.height = Number(specs.height) || 0

  // Size might be "8.5x11" format
  if (specs.size && typeof specs.size === "string") {
    const parts = specs.size.toLowerCase().replace(/\s/g, "").split("x")
    if (parts.length === 2) {
      inputs.width = parseFloat(parts[0]) || 0
      inputs.height = parseFloat(parts[1]) || 0
    }
  }

  // Paper - try to match to available options
  if (specs.paper && typeof specs.paper === "string") {
    const paperLower = specs.paper.toLowerCase()
    const match = PAPER_OPTIONS.find(
      (p) => p.name.toLowerCase().includes(paperLower) || paperLower.includes(p.name.toLowerCase())
    )
    if (match) inputs.paperName = match.name
  }

  // Sides
  if (specs.sides && typeof specs.sides === "string") {
    inputs.sidesValue = specs.sides
  }

  // Bleed
  if (specs.bleed) {
    inputs.hasBleed = specs.bleed === true || specs.bleed === "Yes" || specs.bleed === "yes"
  }

  // Broker
  if (specs.isBroker || specs.broker) {
    inputs.isBroker = specs.isBroker === true || specs.broker === true || specs.broker === "Yes"
  }

  // Lamination
  if (specs.lamination && typeof specs.lamination === "string" && specs.lamination !== "none") {
    inputs.lamination = {
      ...LAMINATION_DEFAULTS,
      enabled: true,
      type: specs.lamination.includes("Matte") ? "Matte" : specs.lamination.includes("Silk") ? "Silk" : "Gloss",
      sides: specs.lamination.includes("D/S") || specs.lamination.includes("Both") ? "D/S" : "S/S",
    }
  }

  return inputs
}
