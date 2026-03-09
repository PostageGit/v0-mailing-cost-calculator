"use client"

import { useState, useEffect } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Save, RotateCcw } from "lucide-react"
import type { LaminationType } from "@/lib/lamination-pricing"

const fetcher = (url: string) => fetch(url).then((r) => r.json())
const SETTINGS_KEY = "lamination_config"

const LAM_TYPES: LaminationType[] = ["Gloss", "Matte", "Silk", "Leather", "Linen"]

export interface LaminationConfig {
  rollCosts: Record<LaminationType, number>
  rollChangeFees: Record<LaminationType, number>
  wastePct: Record<LaminationType, number>
  minSheets: Record<LaminationType, number>
  runtimeCostText: { silk: number; other: number }
  runtimeCostCard: { silk: number; other: number }
  runtimeCost2ndText: { silk: number; other: number }
  runtimeCost2ndCard: { silk: number; other: number }
  setupCost: number
  minimumOrder: number
  defaultMarkupPct: number
  defaultBrokerDiscountPct: number
}

export const DEFAULT_LAMINATION_CONFIG: LaminationConfig = {
  rollCosts: { Gloss: 0.1058, Matte: 0.1045, Silk: 0.1009, Leather: 0.1045, Linen: 0.1045 },
  rollChangeFees: { Gloss: 0, Matte: 10, Silk: 10, Leather: 10, Linen: 10 },
  wastePct: { Gloss: 5, Matte: 5, Silk: 10, Leather: 5, Linen: 5 },
  minSheets: { Gloss: 5, Matte: 5, Silk: 10, Leather: 5, Linen: 5 },
  runtimeCostText: { silk: 0.1333, other: 0.0667 },
  runtimeCostCard: { silk: 0.05, other: 0.025 },
  runtimeCost2ndText: { silk: 0.30, other: 0.15 },
  runtimeCost2ndCard: { silk: 0.10, other: 0.05 },
  setupCost: 10,
  minimumOrder: 45,
  defaultMarkupPct: 225,
  defaultBrokerDiscountPct: 30,
}

export function LaminationSettingsTab() {
  const { data, isLoading } = useSWR<Record<string, unknown>>("/api/app-settings", fetcher)

  const [config, setConfig] = useState<LaminationConfig>(DEFAULT_LAMINATION_CONFIG)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (data?.[SETTINGS_KEY]) {
      setConfig(data[SETTINGS_KEY] as LaminationConfig)
    } else {
      setConfig(DEFAULT_LAMINATION_CONFIG)
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
    setConfig(DEFAULT_LAMINATION_CONFIG)
    setHasChanges(true)
  }

  const updateRollCost = (type: LaminationType, value: number) => {
    setConfig((prev) => ({ ...prev, rollCosts: { ...prev.rollCosts, [type]: value } }))
    setHasChanges(true)
  }

  const updateRollChangeFee = (type: LaminationType, value: number) => {
    setConfig((prev) => ({ ...prev, rollChangeFees: { ...prev.rollChangeFees, [type]: value } }))
    setHasChanges(true)
  }

  const updateWastePct = (type: LaminationType, value: number) => {
    setConfig((prev) => ({ ...prev, wastePct: { ...prev.wastePct, [type]: value } }))
    setHasChanges(true)
  }

  const updateMinSheets = (type: LaminationType, value: number) => {
    setConfig((prev) => ({ ...prev, minSheets: { ...prev.minSheets, [type]: value } }))
    setHasChanges(true)
  }

  const updateField = <K extends keyof LaminationConfig>(key: K, value: LaminationConfig[K]) => {
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
          <h3 className="text-lg font-semibold">Lamination Settings</h3>
          <p className="text-sm text-muted-foreground">Configure lamination pricing by type</p>
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

      {/* Per-Type Settings */}
      <div className="rounded-lg border p-4 space-y-4">
        <h4 className="font-medium text-sm">Costs by Lamination Type</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium">Type</th>
                <th className="text-left py-2 font-medium">Roll Cost ($/sheet)</th>
                <th className="text-left py-2 font-medium">Roll Change Fee ($)</th>
                <th className="text-left py-2 font-medium">Waste %</th>
                <th className="text-left py-2 font-medium">Min Sheets</th>
              </tr>
            </thead>
            <tbody>
              {LAM_TYPES.map((type) => (
                <tr key={type} className="border-b last:border-0">
                  <td className="py-2 font-medium">{type}</td>
                  <td className="py-2">
                    <Input
                      type="number"
                      step="0.0001"
                      value={config.rollCosts[type]}
                      onChange={(e) => updateRollCost(type, parseFloat(e.target.value) || 0)}
                      className="h-7 w-24"
                    />
                  </td>
                  <td className="py-2">
                    <Input
                      type="number"
                      step="1"
                      value={config.rollChangeFees[type]}
                      onChange={(e) => updateRollChangeFee(type, parseFloat(e.target.value) || 0)}
                      className="h-7 w-20"
                    />
                  </td>
                  <td className="py-2">
                    <Input
                      type="number"
                      step="1"
                      value={config.wastePct[type]}
                      onChange={(e) => updateWastePct(type, parseFloat(e.target.value) || 0)}
                      className="h-7 w-16"
                    />
                  </td>
                  <td className="py-2">
                    <Input
                      type="number"
                      step="1"
                      value={config.minSheets[type]}
                      onChange={(e) => updateMinSheets(type, parseFloat(e.target.value) || 0)}
                      className="h-7 w-16"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Runtime Costs */}
      <div className="rounded-lg border p-4 space-y-4">
        <h4 className="font-medium text-sm">Runtime Costs ($/sheet)</h4>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">100 Text / 80 Cover (1st side)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Silk</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={config.runtimeCostText.silk}
                  onChange={(e) => updateField("runtimeCostText", { ...config.runtimeCostText, silk: parseFloat(e.target.value) || 0 })}
                  className="h-7"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Other</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={config.runtimeCostText.other}
                  onChange={(e) => updateField("runtimeCostText", { ...config.runtimeCostText, other: parseFloat(e.target.value) || 0 })}
                  className="h-7"
                />
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Card Stock (1st side)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Silk</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={config.runtimeCostCard.silk}
                  onChange={(e) => updateField("runtimeCostCard", { ...config.runtimeCostCard, silk: parseFloat(e.target.value) || 0 })}
                  className="h-7"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Other</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={config.runtimeCostCard.other}
                  onChange={(e) => updateField("runtimeCostCard", { ...config.runtimeCostCard, other: parseFloat(e.target.value) || 0 })}
                  className="h-7"
                />
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">100 Text / 80 Cover (2nd side D/S)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Silk</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={config.runtimeCost2ndText.silk}
                  onChange={(e) => updateField("runtimeCost2ndText", { ...config.runtimeCost2ndText, silk: parseFloat(e.target.value) || 0 })}
                  className="h-7"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Other</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={config.runtimeCost2ndText.other}
                  onChange={(e) => updateField("runtimeCost2ndText", { ...config.runtimeCost2ndText, other: parseFloat(e.target.value) || 0 })}
                  className="h-7"
                />
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Card Stock (2nd side D/S)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Silk</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={config.runtimeCost2ndCard.silk}
                  onChange={(e) => updateField("runtimeCost2ndCard", { ...config.runtimeCost2ndCard, silk: parseFloat(e.target.value) || 0 })}
                  className="h-7"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Other</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={config.runtimeCost2ndCard.other}
                  onChange={(e) => updateField("runtimeCost2ndCard", { ...config.runtimeCost2ndCard, other: parseFloat(e.target.value) || 0 })}
                  className="h-7"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* General Settings */}
      <div className="rounded-lg border p-4 space-y-4">
        <h4 className="font-medium text-sm">General Settings</h4>
        <div className="grid grid-cols-4 gap-4">
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
            <Label className="text-xs">Minimum Order ($)</Label>
            <Input
              type="number"
              step="1"
              value={config.minimumOrder}
              onChange={(e) => updateField("minimumOrder", parseFloat(e.target.value) || 0)}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Default Markup (%)</Label>
            <Input
              type="number"
              step="1"
              value={config.defaultMarkupPct}
              onChange={(e) => updateField("defaultMarkupPct", parseFloat(e.target.value) || 0)}
              className="h-8"
            />
            <p className="text-[10px] text-muted-foreground">225 = sell at 2.25× cost</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Broker Discount (%)</Label>
            <Input
              type="number"
              step="1"
              value={config.defaultBrokerDiscountPct}
              onChange={(e) => updateField("defaultBrokerDiscountPct", parseFloat(e.target.value) || 0)}
              className="h-8"
            />
            <p className="text-[10px] text-muted-foreground">Off the markup</p>
          </div>
        </div>
      </div>
    </div>
  )
}
