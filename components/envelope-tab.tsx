"use client"

import { useState, useCallback, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { useQuote } from "@/lib/quote-context"
import { useMailing } from "@/lib/mailing-context"
import { formatCurrency } from "@/lib/pricing"
import { CalcPriceCard, type CostLine, type PaperStat } from "@/components/calc-price-card"
import { useFormValidation } from "@/hooks/use-form-validation"
import {
  calculateEnvelope,
  DEFAULT_ENVELOPE_SETTINGS,
  defaultEnvelopeInputs,
  getInkJetPrintTypes,
  getLaserPrintTypes,
  type EnvelopeInputs,
  type EnvelopeCalcResult,
  type EnvelopeSettings,
  type InkType,
  type InkJetPrintType,
  type LaserPrintType,
} from "@/lib/envelope-pricing"
import { Plus, RotateCcw, Settings2, ChevronDown, ChevronUp, AlertTriangle, Package, CalendarDays } from "lucide-react"
import useSWR from "swr"
import type { Vendor } from "@/lib/vendor-types"

const vendorFetcher = (url: string) => fetch(url).then((r) => r.json())

import { STANDARD_ENVELOPES } from "@/lib/mailing-context"

/** Match a planner envelope piece to the best envelope pricing item name */
function matchPlannerEnvelope(
  envelopeId: string | undefined,
  width: number | null,
  height: number | null,
  items: { name: string }[]
): string | null {
  if (!envelopeId && !width) return null

  // Build a map of standard envelope id -> dimensions
  const stdEnv = STANDARD_ENVELOPES.find((e) => e.id === envelopeId)
  const w = width ?? stdEnv?.width ?? 0
  const h = height ?? stdEnv?.height ?? 0
  if (!w || !h) return null

  // Dimension-based matching patterns for settings item names
  const dimPatterns = [
    `${w}x${h}`,                           // "9x12"
    `${h}x${w}`,                           // "12x9"
    `${w} x ${h}`,                         // not common in names but check
    `${w}"x${h}"`,                         // with quotes
  ]

  // Also match by standard envelope name patterns
  const namePatterns: string[] = []
  if (stdEnv) {
    // e.g. "#10" for no10/no10win, "A-7" for a7, "6x9" for 6x9
    const stdName = stdEnv.name.replace(/\s/g, "").toLowerCase()
    namePatterns.push(stdName)
    // Map specific standard IDs to settings item names
    if (envelopeId === "no10") namePatterns.push("#10 no window", "#10")
    if (envelopeId === "no10win") namePatterns.push("#10 with window", "#10 win")
    if (envelopeId === "6.5") namePatterns.push("#6")
    if (envelopeId === "a7") namePatterns.push("a-7")
    if (envelopeId === "a2") namePatterns.push("a-2")
  }

  for (const item of items) {
    const lower = item.name.toLowerCase().replace(/\s/g, "")
    // Check dimension patterns
    for (const dp of dimPatterns) {
      if (lower.includes(dp.toLowerCase().replace(/\s/g, ""))) return item.name
    }
    // Check name patterns
    for (const np of namePatterns) {
      if (lower.includes(np.toLowerCase().replace(/\s/g, ""))) return item.name
    }
  }
  return null
}

export function EnvelopeTab() {
  const quote = useQuote()
  const mailing = useMailing()
  const v = useFormValidation()

  const [inputs, setInputs] = useState<EnvelopeInputs>(() => {
    const def = defaultEnvelopeInputs()
    // Pre-fill amount from planner quantity
    if (mailing.quantity > 0) def.amount = mailing.quantity
    // Pre-select envelope from planner's envelope piece
    const envPiece = mailing.pieces.find((p) => p.type === "envelope")
    if (envPiece) {
      const matched = matchPlannerEnvelope(
        envPiece.envelopeId,
        envPiece.width,
        envPiece.height,
        DEFAULT_ENVELOPE_SETTINGS.items
      )
      if (matched) def.itemName = matched
    }
    return def
  })
  const [calcResult, setCalcResult] = useState<EnvelopeCalcResult | null>(null)
  const [error, setError] = useState("")
  const [effectiveTotal, setEffectiveTotal] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<EnvelopeSettings>(() => structuredClone(DEFAULT_ENVELOPE_SETTINGS))

  // Customer Provided state
  const [customerProvided, setCustomerProvided] = useState(false)
  const [providerVendor, setProviderVendor] = useState("")
  const [providerCustomVendor, setProviderCustomVendor] = useState("")
  const [providerDate, setProviderDate] = useState("")
  const { data: vendors } = useSWR<Vendor[]>(customerProvided ? "/api/vendors" : null, vendorFetcher)
  const resolvedVendor = providerVendor === "__custom__" ? providerCustomVendor : (vendors?.find(v2 => v2.id === providerVendor)?.company_name || "")

  // Auto-calculate on input change
  useEffect(() => {
    if (inputs.amount > 0 && inputs.itemName && inputs.printType) {
      const result = calculateEnvelope(inputs, settings)
      if ("error" in result) {
        setError(result.error)
        setCalcResult(null)
      } else {
        setError("")
        setCalcResult(result)
      }
    } else {
      setCalcResult(null)
      setError("")
    }
  }, [inputs, settings])

  const update = useCallback((patch: Partial<EnvelopeInputs>) => {
    setInputs((prev) => ({ ...prev, ...patch }))
  }, [])

  // When ink type changes, reset print type to first option of new type
  const handleInkChange = useCallback((ink: InkType) => {
    const newPrint = ink === "InkJet" ? "Text + Logo" : "BW"
    update({ inkType: ink, printType: newPrint as never, hasBleed: false })
  }, [update])

  // Handle item change -- uncheck bleed if item doesn't support it
  const handleItemChange = useCallback((name: string) => {
    const item = settings.items.find((i) => i.name === name)
    update({
      itemName: name,
      hasBleed: item?.bleed && inputs.inkType === "InkJet" ? inputs.hasBleed : false,
    })
  }, [settings.items, inputs.inkType, inputs.hasBleed, update])

  const handleCalculate = useCallback(() => {
    v.markAttempted()
    if (inputs.amount <= 0 || !inputs.itemName || !inputs.printType) return
    const result = calculateEnvelope(inputs, settings)
    if ("error" in result) {
      setError(result.error)
      setCalcResult(null)
    } else {
      setError("")
      setCalcResult(result)
    }
  }, [inputs, settings, v])

  const handleAddToQuote = useCallback(() => {
    if (!calcResult) return
    const finalAmount = effectiveTotal > 0 ? effectiveTotal : calcResult.price
    const descParts = [`${inputs.inkType} ${inputs.printType}${inputs.hasBleed ? " + Bleed" : ""}, ${inputs.customerType}`]
    if (customerProvided) {
      descParts.push("Customer Provides Envelopes")
      if (resolvedVendor) descParts.push(`From: ${resolvedVendor}`)
      if (providerDate) descParts.push(`Expected: ${new Date(providerDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`)
    }
    quote.addItem({
      category: "envelope",
      label: `${calcResult.quantity.toLocaleString()} Envelopes - ${inputs.itemName}`,
      description: descParts.join(" | "),
      amount: finalAmount,
      ...(customerProvided && {
        metadata: {
          customerProvided: true,
          providerVendor: resolvedVendor || undefined,
          providerExpectedDate: providerDate || undefined,
        },
      }),
    })
  }, [calcResult, inputs, quote, effectiveTotal, customerProvided, resolvedVendor, providerDate])

  const handleReset = useCallback(() => {
    v.reset()
    const def = defaultEnvelopeInputs()
    if (mailing.quantity > 0) def.amount = mailing.quantity
    // Re-match planner envelope on reset too
    const envPiece = mailing.pieces.find((p) => p.type === "envelope")
    if (envPiece) {
      const matched = matchPlannerEnvelope(envPiece.envelopeId, envPiece.width, envPiece.height, DEFAULT_ENVELOPE_SETTINGS.items)
      if (matched) def.itemName = matched
    }
    setInputs(def)
    setCalcResult(null)
    setError("")
    setSettings(structuredClone(DEFAULT_ENVELOPE_SETTINGS))
    setCustomerProvided(false)
    setProviderVendor("")
    setProviderCustomVendor("")
    setProviderDate("")
  }, [mailing.quantity, mailing.pieces, v])

  // Current item's bleed capability
  const currentItem = settings.items.find((i) => i.name === inputs.itemName)
  const bleedEnabled = currentItem?.bleed === true && inputs.inkType === "InkJet"

  // Print type options based on ink type
  const printOptions = inputs.inkType === "InkJet" ? getInkJetPrintTypes() : getLaserPrintTypes()

  // Laser cheaper warning for custom inkjet
  const laserColorCost = settings.laser["Color"]
  const showLaserCheaper = inputs.inkType === "InkJet" && inputs.printType === "Custom" && inputs.customPrintCost > laserColorCost

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* ─── LEFT: Form ─── */}
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground tracking-tight">Envelope Calculator</h2>
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Settings
            </button>
          </div>

          {/* Amount */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Amount{v.req(!inputs.amount) && <span className="text-destructive text-xs ml-0.5">*</span>}
            </label>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="e.g. 1200"
              className={v.cls(!inputs.amount)}
              value={inputs.amount || ""}
              onChange={(e) => update({ amount: parseInt(e.target.value) || 0 })}
            />
            {inputs.amount > 0 && (
              <span className="text-[10px] text-muted-foreground">
                Rounds to {(Math.ceil(inputs.amount / 50) * 50).toLocaleString()} (nearest 50)
              </span>
            )}
          </div>

          {/* Item selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Envelope{v.req(!inputs.itemName) && <span className="text-destructive text-xs ml-0.5">*</span>}
            </label>
            <Select value={inputs.itemName} onValueChange={handleItemChange}>
              <SelectTrigger className={v.cls(!inputs.itemName)}>
                <SelectValue placeholder="Select envelope" />
              </SelectTrigger>
              <SelectContent>
                {settings.items.map((item) => (
                  <SelectItem key={item.name} value={item.name}>
                    <div className="flex items-center justify-between w-full gap-3">
                      <span>{item.name}</span>
                      <span className="text-muted-foreground text-xs font-mono">
                        {item.costPer1000 > 0 ? `$${item.costPer1000}/M` : ""}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom env cost (for Provided stock) */}
          {inputs.itemName === "Provided stock" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Envelope Cost / 1000{v.req(!inputs.customEnvCost) && <span className="text-destructive text-xs ml-0.5">*</span>}
              </label>
              <Input
                type="number"
                step="0.01"
                min={0}
                placeholder="Cost per 1000"
                className={v.cls(!inputs.customEnvCost)}
                value={inputs.customEnvCost || ""}
                onChange={(e) => update({ customEnvCost: parseFloat(e.target.value) || 0 })}
              />
            </div>
          )}

          {/* Ink + Print row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Ink</label>
              <Select value={inputs.inkType} onValueChange={(v) => handleInkChange(v as InkType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="InkJet">InkJet</SelectItem>
                  <SelectItem value="Laser">Laser</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Print{v.req(!inputs.printType) && <span className="text-destructive text-xs ml-0.5">*</span>}
              </label>
              <Select value={inputs.printType} onValueChange={(val) => update({ printType: val as never })}>
                <SelectTrigger className={v.cls(!inputs.printType)}>
                  <SelectValue placeholder="Select print" />
                </SelectTrigger>
                <SelectContent>
                  {printOptions.map((pt) => (
                    <SelectItem key={pt} value={pt}>{pt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Custom print cost */}
          {inputs.printType === "Custom" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Custom Click Cost / 1000{v.req(!inputs.customPrintCost) && <span className="text-destructive text-xs ml-0.5">*</span>}
              </label>
              <Input
                type="number"
                step="0.01"
                min={0}
                placeholder="Click cost per 1000"
                className={v.cls(!inputs.customPrintCost)}
                value={inputs.customPrintCost || ""}
                onChange={(e) => update({ customPrintCost: parseFloat(e.target.value) || 0 })}
              />
              {showLaserCheaper && (
                <div className="flex items-center gap-1.5 text-xs text-destructive font-medium">
                  <AlertTriangle className="h-3 w-3" />
                  Laser is cheaper at ${laserColorCost}/M
                </div>
              )}
            </div>
          )}

          {/* Bleed */}
          <div className="flex items-center gap-3">
            <Checkbox
              id="env-bleed"
              checked={inputs.hasBleed}
              disabled={!bleedEnabled}
              onCheckedChange={(checked) => update({ hasBleed: checked === true })}
            />
            <label
              htmlFor="env-bleed"
              className={`text-sm font-medium cursor-pointer ${bleedEnabled ? "text-foreground" : "text-muted-foreground"}`}
            >
              Bleed
            </label>
            {!bleedEnabled && inputs.itemName && (
              <span className="text-[10px] text-muted-foreground">
                {inputs.inkType !== "InkJet" ? "(InkJet only)" : "(Not available for this item)"}
              </span>
            )}
            {inputs.hasBleed && inputs.itemName === "Provided stock" && (
              <span className="text-[10px] font-semibold text-amber-600">Check w/ prod.</span>
            )}
          </div>

          {/* Customer Provided toggle */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Checkbox
                id="env-customer-provided"
                checked={customerProvided}
                onCheckedChange={(checked) => setCustomerProvided(checked === true)}
              />
              <label htmlFor="env-customer-provided" className="text-sm font-medium text-foreground cursor-pointer">
                Customer Provided
              </label>
            </div>

            {customerProvided && (
              <div className="rounded-xl border-2 border-amber-400/60 bg-amber-50 dark:bg-amber-950/20 p-4 flex flex-col gap-4">
                {/* Big pill */}
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-400/20 border border-amber-400/40">
                    <Package className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                    <span className="text-sm font-bold text-amber-800 dark:text-amber-300 tracking-tight">Customer Provides Envelopes</span>
                  </div>
                </div>

                {/* Expected date */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-amber-800 dark:text-amber-300">Expected Date</label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        type="date"
                        value={providerDate}
                        onChange={(e) => setProviderDate(e.target.value)}
                        className="pl-8 text-sm h-9"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-9 text-xs font-medium shrink-0"
                      onClick={() => setProviderDate(new Date().toISOString().slice(0, 10))}
                    >
                      Today
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-9 text-xs font-medium shrink-0"
                      onClick={() => {
                        const d = new Date()
                        d.setDate(d.getDate() + 1)
                        setProviderDate(d.toISOString().slice(0, 10))
                      }}
                    >
                      Tomorrow
                    </Button>
                  </div>
                </div>

                {/* Vendor / Source */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-amber-800 dark:text-amber-300">Vendor / Source</label>
                  <Select value={providerVendor} onValueChange={(val) => { setProviderVendor(val); if (val !== "__custom__") setProviderCustomVendor("") }}>
                    <SelectTrigger className="text-sm h-9">
                      <SelectValue placeholder="Select vendor or enter custom" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__custom__">Type custom name...</SelectItem>
                      {vendors?.map((vnd) => (
                        <SelectItem key={vnd.id} value={vnd.id}>{vnd.company_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {providerVendor === "__custom__" && (
                    <Input
                      type="text"
                      placeholder="Enter vendor or source name"
                      value={providerCustomVendor}
                      onChange={(e) => setProviderCustomVendor(e.target.value)}
                      className="text-sm h-9 mt-1"
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Customer type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Customer</label>
            <Select value={inputs.customerType} onValueChange={(val) => update({ customerType: val as "Regular" | "Broker" })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Regular">Regular (x{settings.customer.Regular})</SelectItem>
                <SelectItem value="Broker">Broker (x{settings.customer.Broker})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-destructive/5 border border-destructive/20 px-4 py-3 text-xs text-destructive font-medium">
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button onClick={handleCalculate} className="flex-1 font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90">
              Calculate
            </Button>
            <Button type="button" variant="secondary" onClick={handleReset} className="flex-1 font-semibold rounded-xl">
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reset
            </Button>
          </div>

          {/* ─── Collapsible Settings ─── */}
          {showSettings && (
            <EnvelopeSettingsPanel settings={settings} onSettingsChange={setSettings} />
          )}
        </div>
      </div>

      {/* ─── RIGHT: Result ─── */}
      <div className="lg:w-[22rem] shrink-0">
        {calcResult ? (
          <div className="flex flex-col gap-3">
            <EnvelopeResultCard
              result={calcResult}
              inputs={inputs}
              settings={settings}
              onEffectiveTotalChange={setEffectiveTotal}
            />
            <Button
              onClick={handleAddToQuote}
              className="w-full gap-2 rounded-full bg-foreground text-background hover:bg-foreground/90"
              size="sm"
            >
              <Plus className="h-4 w-4" />
              Add to Quote - {formatCurrency(effectiveTotal > 0 ? effectiveTotal : calcResult.price)}
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/20 flex flex-col items-center justify-center py-16 px-6 text-center">
            <p className="text-sm font-medium text-muted-foreground">Enter details and calculate</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Result will appear here</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Result card using CalcPriceCard ─── */

function EnvelopeResultCard({
  result,
  inputs,
  settings,
  onEffectiveTotalChange,
}: {
  result: EnvelopeCalcResult
  inputs: EnvelopeInputs
  settings: EnvelopeSettings
  onEffectiveTotalChange?: (total: number) => void
}) {
  const stats: PaperStat[] = [
    { label: "Qty", value: result.quantity.toLocaleString() },
    { label: "Ink", value: inputs.inkType },
    { label: "Markup", value: `x${result.customerMarkup}` },
  ]

  const costLines: CostLine[] = [
    { label: "Base Cost", value: result.baseCost, sub: `${result.quantity} x (env + print) x ${result.customerMarkup}` },
  ]

  if (result.bleedFeesApplied) {
    costLines.push({ label: "Bleed Markup +10%", value: result.bleedMarkupAmount })
    costLines.push({ label: "Bleed Setup Fee", value: result.setupFee })
  }

  if (result.minFeeApplied) {
    costLines.push({ label: "Minimum Fee", value: settings.fees.minNoBleed, sub: `base < $${settings.fees.minNoBleed}` })
  }

  const expandedDetails = (
    <div className="flex flex-col gap-3 text-xs">
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
        <span className="text-muted-foreground">Envelope</span>
        <span className="font-medium text-foreground">{inputs.itemName}</span>
        <span className="text-muted-foreground">Env Cost / 1000</span>
        <span className="font-mono text-foreground">${result.envelopeCostPer1000.toFixed(2)}</span>
        <span className="text-muted-foreground">Print Type</span>
        <span className="font-medium text-foreground">{inputs.printType}</span>
        <span className="text-muted-foreground">Print Cost / 1000</span>
        <span className="font-mono text-foreground">${result.printCostPer1000.toFixed(2)}</span>
        <span className="text-muted-foreground">Bleed</span>
        <span className="font-medium text-foreground">{inputs.hasBleed ? "Yes" : "No"}</span>
        <span className="text-muted-foreground">Customer</span>
        <span className="font-medium text-foreground">{inputs.customerType}</span>
      </div>
    </div>
  )

  return (
    <CalcPriceCard
      total={result.price}
      perUnitLabel="/ envelope"
      perUnitCost={result.pricePerUnit}
      paperName={inputs.itemName}
      stats={stats}
      costLines={costLines}
      details={expandedDetails}
      onEffectiveTotalChange={onEffectiveTotalChange}
    />
  )
}

/* ─── Settings panel ─── */

function EnvelopeSettingsPanel({
  settings,
  onSettingsChange,
}: {
  settings: EnvelopeSettings
  onSettingsChange: (s: EnvelopeSettings) => void
}) {
  const [open, setOpen] = useState<string | null>(null)

  const updateInkjet = (key: string, val: number) => {
    const next = structuredClone(settings)
    next.inkjet[key as InkJetPrintType] = val
    onSettingsChange(next)
  }
  const updateLaser = (key: string, val: number) => {
    const next = structuredClone(settings)
    next.laser[key as LaserPrintType] = val
    onSettingsChange(next)
  }
  const updateCustomer = (key: string, val: number) => {
    const next = structuredClone(settings)
    next.customer[key as "Regular" | "Broker"] = val
    onSettingsChange(next)
  }
  const updateFee = (key: keyof typeof settings.fees, val: number) => {
    const next = structuredClone(settings)
    next.fees[key] = val
    onSettingsChange(next)
  }
  const updateItemCost = (idx: number, val: number) => {
    const next = structuredClone(settings)
    next.items[idx].costPer1000 = val
    onSettingsChange(next)
  }

  const sections = [
    {
      id: "env",
      title: "Envelope Costs",
      content: (
        <div className="flex flex-col gap-2">
          {settings.items.map((item, i) => (
            <div key={item.name} className="flex items-center justify-between gap-3">
              <span className="text-xs text-foreground flex-1 min-w-0 truncate">{item.name}</span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  value={item.costPer1000}
                  onChange={(e) => updateItemCost(i, parseFloat(e.target.value) || 0)}
                  className="h-7 w-20 text-xs font-mono"
                  disabled={item.name === "Provided stock"}
                />
                <span className={`text-[10px] w-6 text-center ${item.bleed ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                  {item.bleed ? "B" : "-"}
                </span>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "inkjet",
      title: "InkJet Print Costs (/1000)",
      content: (
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(settings.inkjet).map(([key, val]) => (
            <div key={key} className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground">{key}</span>
              <Input
                type="number"
                step="0.5"
                value={val}
                onChange={(e) => updateInkjet(key, parseFloat(e.target.value) || 0)}
                className="h-7 text-xs font-mono"
                disabled={key === "Custom"}
              />
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "laser",
      title: "Laser Print Costs (/1000)",
      content: (
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(settings.laser).map(([key, val]) => (
            <div key={key} className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground">{key}</span>
              <Input
                type="number"
                step="0.5"
                value={val}
                onChange={(e) => updateLaser(key, parseFloat(e.target.value) || 0)}
                className="h-7 text-xs font-mono"
              />
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "markup",
      title: "Customer Markup",
      content: (
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(settings.customer).map(([key, val]) => (
            <div key={key} className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground">{key}</span>
              <Input
                type="number"
                step="0.01"
                value={val}
                onChange={(e) => updateCustomer(key, parseFloat(e.target.value) || 0)}
                className="h-7 text-xs font-mono"
              />
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "fees",
      title: "Fees & Minimums",
      content: (
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground">Min (no bleed)</span>
            <Input type="number" step="1" value={settings.fees.minNoBleed} onChange={(e) => updateFee("minNoBleed", parseFloat(e.target.value) || 0)} className="h-7 text-xs font-mono" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground">Setup (bleed)</span>
            <Input type="number" step="1" value={settings.fees.setupFee} onChange={(e) => updateFee("setupFee", parseFloat(e.target.value) || 0)} className="h-7 text-xs font-mono" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground">Bleed markup</span>
            <Input type="number" step="0.01" value={settings.fees.bleedMarkup} onChange={(e) => updateFee("bleedMarkup", parseFloat(e.target.value) || 0)} className="h-7 text-xs font-mono" />
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="rounded-xl border border-border bg-secondary/20 overflow-hidden divide-y divide-border">
      {sections.map((sec) => (
        <div key={sec.id}>
          <button
            type="button"
            onClick={() => setOpen(open === sec.id ? null : sec.id)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-secondary/40 transition-colors"
          >
            {sec.title}
            {open === sec.id ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          {open === sec.id && <div className="px-4 pb-4 pt-1">{sec.content}</div>}
        </div>
      ))}
    </div>
  )
}
