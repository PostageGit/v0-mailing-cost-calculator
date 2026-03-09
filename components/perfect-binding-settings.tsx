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
    </div>
  )
}
