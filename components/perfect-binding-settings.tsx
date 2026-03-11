"use client"

import { useState, useEffect } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Save, RotateCcw } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())
const SETTINGS_KEY = "perfect_binding_config"

// Default configuration matching current hardcoded values
export interface PerfectBindingConfig {
  setupCost: number
  scoringSpeed: number // books per minute
  scoringRate: number // $ per hour
  bindingSpeedGloss: number // books per hour for gloss
  bindingSpeedMatte: number // books per hour for matte/other
  bindingRate: number // $ per hour
  markupRetail: number // markup multiplier for retail
  markupBroker: number // markup multiplier for broker
  smallSizeSurcharge: number // per book if width < 4 or height < 6
  highPageSurchargeRetail: number // per book if pages >= 600 (retail)
  highPageSurchargeBroker: number // per book if pages >= 600 (broker)
  brokerDiscountRate: number // percentage discount on finishing
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCTION RULES — Cover Size Calculation
  // ═══════════════════════════════════════════════════════════════════════════
  // Extra size per trimmed side (top, bottom, fore-edge) based on bleed settings.
  // The trim line is the reference point: "How far past trim does cover need to reach?"
  coverExtraNoBleed: number         // Case 1: No bleed on either — overhang only (default 0.20")
  coverExtraCoverBleedOnly: number  // Case 2: Cover bleed only — cover bleed serves as overhang (default 0.25")
  coverExtraInsideBleed: number     // Case 3 & 4: Inside has bleed — 0.25 bleed + 0.25 buffer (default 0.50")
  
  // Production limits
  maxCoverUps: number               // Max ups for perfect binding covers (default 2)
  maxLaminationWidth: number        // Max width laminator can handle in inches (default 12.45")
  coverGutter: number               // Gutter between 2-up covers (default 0.50" = 0.25" overhang per book)
}

export const DEFAULT_PERFECT_BINDING_CONFIG: PerfectBindingConfig = {
  setupCost: 25,
  scoringSpeed: 25,
  scoringRate: 30,
  bindingSpeedGloss: 250,
  bindingSpeedMatte: 300,
  bindingRate: 60,
  markupRetail: 3,
  markupBroker: 2.25,
  smallSizeSurcharge: 0.20,
  highPageSurchargeRetail: 0.20,
  highPageSurchargeBroker: 0.15,
  brokerDiscountRate: 15,
  
  // Production rules
  coverExtraNoBleed: 0.20,
  coverExtraCoverBleedOnly: 0.25,
  coverExtraInsideBleed: 0.50,
  maxCoverUps: 2,
  maxLaminationWidth: 12.45,
  coverGutter: 0.50,
}

export function PerfectBindingSettingsTab() {
  const { data, isLoading } = useSWR<Record<string, unknown>>("/api/app-settings", fetcher)

  const [config, setConfig] = useState<PerfectBindingConfig>(DEFAULT_PERFECT_BINDING_CONFIG)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (data?.[SETTINGS_KEY]) {
      setConfig(data[SETTINGS_KEY] as PerfectBindingConfig)
    } else {
      setConfig(DEFAULT_PERFECT_BINDING_CONFIG)
    }
    setHasChanges(false)
  }, [data])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [SETTINGS_KEY]: config }),
      })
      if (!res.ok) throw new Error("Failed to save")
      globalMutate("/api/app-settings")
      setHasChanges(false)
    } catch (e) {
      console.error("Save failed:", e)
      alert("Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setConfig(DEFAULT_PERFECT_BINDING_CONFIG)
    setHasChanges(true)
  }

  const updateField = <K extends keyof PerfectBindingConfig>(key: K, value: PerfectBindingConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Perfect Binding Settings</h3>
          <p className="text-sm text-muted-foreground">Configure pricing for perfect-bound book binding</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>
            <RotateCcw className="h-4 w-4 mr-1" /> Reset
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
        </div>
      </div>

      {/* Setup & Scoring */}
      <div className="rounded-lg border p-4 space-y-4">
        <h4 className="font-medium text-sm">Setup & Scoring</h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Setup Cost ($)</Label>
            <Input
              type="number"
              step="0.01"
              value={config.setupCost}
              onChange={(e) => updateField("setupCost", parseFloat(e.target.value) || 0)}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Scoring Speed (books/min)</Label>
            <Input
              type="number"
              step="1"
              value={config.scoringSpeed}
              onChange={(e) => updateField("scoringSpeed", parseFloat(e.target.value) || 0)}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Scoring Rate ($/hr)</Label>
            <Input
              type="number"
              step="0.01"
              value={config.scoringRate}
              onChange={(e) => updateField("scoringRate", parseFloat(e.target.value) || 0)}
              className="h-8"
            />
          </div>
        </div>
      </div>

      {/* Binding Speed & Rate */}
      <div className="rounded-lg border p-4 space-y-4">
        <h4 className="font-medium text-sm">Binding Speed & Rate</h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Gloss Speed (books/hr)</Label>
            <Input
              type="number"
              step="1"
              value={config.bindingSpeedGloss}
              onChange={(e) => updateField("bindingSpeedGloss", parseFloat(e.target.value) || 0)}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Matte Speed (books/hr)</Label>
            <Input
              type="number"
              step="1"
              value={config.bindingSpeedMatte}
              onChange={(e) => updateField("bindingSpeedMatte", parseFloat(e.target.value) || 0)}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Binding Rate ($/hr)</Label>
            <Input
              type="number"
              step="0.01"
              value={config.bindingRate}
              onChange={(e) => updateField("bindingRate", parseFloat(e.target.value) || 0)}
              className="h-8"
            />
          </div>
        </div>
      </div>

      {/* Markup */}
      <div className="rounded-lg border p-4 space-y-4">
        <h4 className="font-medium text-sm">Markup Multipliers</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Retail Markup (×)</Label>
            <Input
              type="number"
              step="0.01"
              value={config.markupRetail}
              onChange={(e) => updateField("markupRetail", parseFloat(e.target.value) || 0)}
              className="h-8"
            />
            <p className="text-[10px] text-muted-foreground">e.g., 3 = cost × 3</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Broker Markup (×)</Label>
            <Input
              type="number"
              step="0.01"
              value={config.markupBroker}
              onChange={(e) => updateField("markupBroker", parseFloat(e.target.value) || 0)}
              className="h-8"
            />
            <p className="text-[10px] text-muted-foreground">e.g., 2.25 = cost × 2.25</p>
          </div>
        </div>
      </div>

      {/* Surcharges */}
      <div className="rounded-lg border p-4 space-y-4">
        <h4 className="font-medium text-sm">Surcharges (per book)</h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Small Size ($/book)</Label>
            <Input
              type="number"
              step="0.01"
              value={config.smallSizeSurcharge}
              onChange={(e) => updateField("smallSizeSurcharge", parseFloat(e.target.value) || 0)}
              className="h-8"
            />
            <p className="text-[10px] text-muted-foreground">If width &lt; 4&quot; or height &lt; 6&quot;</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">600+ Pages Retail ($/book)</Label>
            <Input
              type="number"
              step="0.01"
              value={config.highPageSurchargeRetail}
              onChange={(e) => updateField("highPageSurchargeRetail", parseFloat(e.target.value) || 0)}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">600+ Pages Broker ($/book)</Label>
            <Input
              type="number"
              step="0.01"
              value={config.highPageSurchargeBroker}
              onChange={(e) => updateField("highPageSurchargeBroker", parseFloat(e.target.value) || 0)}
              className="h-8"
            />
          </div>
        </div>
      </div>

      {/* Broker Discount */}
      <div className="rounded-lg border p-4 space-y-4">
        <h4 className="font-medium text-sm">Broker Discount</h4>
        <div className="w-1/3 space-y-1">
          <Label className="text-xs">Finishing Discount (%)</Label>
          <Input
            type="number"
            step="1"
            value={config.brokerDiscountRate}
            onChange={(e) => updateField("brokerDiscountRate", parseFloat(e.target.value) || 0)}
            className="h-8"
          />
          <p className="text-[10px] text-muted-foreground">Discount on binding + lamination for brokers</p>
        </div>
      </div>

      {/* Production Rules - Cover Size Calculation */}
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-4 space-y-4">
        <div>
          <h4 className="font-semibold text-sm text-amber-900 dark:text-amber-200">Production Rules — Cover Size Calculation</h4>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
            These values determine how much extra size is added per trimmed side (top, bottom, fore-edge) based on bleed settings.
          </p>
        </div>
        
        {/* Visual explanation */}
        <div className="bg-white dark:bg-card rounded border p-3 text-xs space-y-2">
          <p className="font-medium">How it works:</p>
          <p className="text-muted-foreground">
            The <strong>trim line</strong> is the reference point. The extra size is how far past the trim line the cover extends.
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
            <li><strong>No bleed</strong>: Only overhang needed (default 0.20&quot;)</li>
            <li><strong>Cover bleed only</strong>: Cover bleed serves as the overhang (default 0.25&quot;)</li>
            <li><strong>Inside bleed</strong>: 0.25&quot; inside bleed + 0.25&quot; registration buffer = 0.50&quot;</li>
            <li>If <em>both</em> have bleed, cover bleed is absorbed into inside bleed area (still 0.50&quot;)</li>
          </ul>
          <p className="text-muted-foreground pt-2 border-t mt-2">
            <strong>Formula:</strong> Cover Width = (BookWidth × 2) + Spine + (Extra × 2) | Cover Height = BookHeight + (Extra × 2)
          </p>
        </div>

        {/* Editable values */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Case 1: No Bleed (&quot;)</Label>
            <Input
              type="number"
              step="0.01"
              value={config.coverExtraNoBleed}
              onChange={(e) => updateField("coverExtraNoBleed", parseFloat(e.target.value) || 0)}
              className="h-8"
            />
            <p className="text-[10px] text-muted-foreground">Neither inside nor cover has bleed</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Case 2: Cover Bleed Only (&quot;)</Label>
            <Input
              type="number"
              step="0.01"
              value={config.coverExtraCoverBleedOnly}
              onChange={(e) => updateField("coverExtraCoverBleedOnly", parseFloat(e.target.value) || 0)}
              className="h-8"
            />
            <p className="text-[10px] text-muted-foreground">Only cover has bleed</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Case 3 & 4: Inside Bleed (&quot;)</Label>
            <Input
              type="number"
              step="0.01"
              value={config.coverExtraInsideBleed}
              onChange={(e) => updateField("coverExtraInsideBleed", parseFloat(e.target.value) || 0)}
              className="h-8"
            />
            <p className="text-[10px] text-muted-foreground">Inside has bleed (cover bleed absorbed)</p>
          </div>
        </div>

        {/* Production Limits */}
        <div className="pt-3 border-t border-amber-200 dark:border-amber-700">
          <h5 className="font-medium text-xs text-amber-900 dark:text-amber-200 mb-3">Production Limits</h5>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Max Cover Ups</Label>
              <Input
                type="number"
                step="1"
                min="1"
                max="4"
                value={config.maxCoverUps}
                onChange={(e) => updateField("maxCoverUps", parseInt(e.target.value) || 2)}
                className="h-8"
              />
              <p className="text-[10px] text-muted-foreground">Maximum impositions for covers (typically 2)</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cover Gutter (2-Up) (&quot;)</Label>
              <Input
                type="number"
                step="0.01"
                value={config.coverGutter}
                onChange={(e) => updateField("coverGutter", parseFloat(e.target.value) || 0.50)}
                className="h-8"
              />
              <p className="text-[10px] text-muted-foreground">Space between 2-up covers (0.5&quot; = 0.25&quot; overhang each)</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max Lamination Width (&quot;)</Label>
              <Input
                type="number"
                step="0.01"
                value={config.maxLaminationWidth}
                onChange={(e) => updateField("maxLaminationWidth", parseFloat(e.target.value) || 12.45)}
                className="h-8"
              />
              <p className="text-[10px] text-muted-foreground">Covers wider than this cannot be laminated</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
