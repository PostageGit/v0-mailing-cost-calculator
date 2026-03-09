"use client"

import React, { useState, useEffect } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Loader2, Save, RotateCcw, Plus, Trash2 } from "lucide-react"
import {
  DEFAULT_FOLD_SETTINGS,
  type FoldFinishingSettings,
} from "@/lib/finishing-fold-engine"

const fetcher = (url: string) => fetch(url).then((r) => r.json())
const SETTINGS_KEY = "fold_settings"

export function FoldScoreSettingsTab() {
  const { data, isLoading } = useSWR<Record<string, unknown>>("/api/app-settings", fetcher)
  
  const [settings, setSettings] = useState<FoldFinishingSettings>(DEFAULT_FOLD_SETTINGS)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Load from DB or defaults
  useEffect(() => {
    if (data?.[SETTINGS_KEY]) {
      setSettings(data[SETTINGS_KEY] as FoldFinishingSettings)
    } else {
      setSettings(DEFAULT_FOLD_SETTINGS)
    }
    setHasChanges(false)
  }, [data])

  // Update a field
  const updateField = <K extends keyof FoldFinishingSettings>(
    field: K,
    value: FoldFinishingSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  // Update a setup level
  const updateSetupLevel = (index: number, field: "label" | "minutes", value: string | number) => {
    setSettings((prev) => ({
      ...prev,
      setupLevels: prev.setupLevels.map((level, i) =>
        i === index ? { ...level, [field]: value } : level
      ),
    }))
    setHasChanges(true)
  }

  // Add a setup level
  const addSetupLevel = () => {
    const nextNum = settings.setupLevels.length + 1
    setSettings((prev) => ({
      ...prev,
      setupLevels: [...prev.setupLevels, { label: `Level ${nextNum}`, minutes: 15 }],
    }))
    setHasChanges(true)
  }

  // Remove a setup level
  const removeSetupLevel = (index: number) => {
    setSettings((prev) => ({
      ...prev,
      setupLevels: prev.setupLevels.filter((_, i) => i !== index),
    }))
    setHasChanges(true)
  }

  // Save to DB
  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [SETTINGS_KEY]: settings }),
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

  // Reset to defaults
  const handleReset = () => {
    setSettings(DEFAULT_FOLD_SETTINGS)
    setHasChanges(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with save/reset buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Fold & Score Settings</h3>
          <p className="text-sm text-muted-foreground">
            Configure pricing parameters for folding and score & fold operations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Main Pricing Parameters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Pricing Parameters</CardTitle>
          <CardDescription className="text-xs">
            Base rates and margins for fold calculations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Hourly Rate</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={settings.hourlyRate}
                  onChange={(e) => updateField("hourlyRate", parseFloat(e.target.value) || 0)}
                  className="h-8"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Run Rate (pcs/min)</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={settings.runRate || 30}
                onChange={(e) => updateField("runRate", parseFloat(e.target.value) || 30)}
                className="h-8"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Markup %</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  step={10}
                  value={settings.markupPercent}
                  onChange={(e) => updateField("markupPercent", parseFloat(e.target.value) || 0)}
                  className="h-8"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Broker Discount %</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={settings.brokerDiscountPercent}
                  onChange={(e) => updateField("brokerDiscountPercent", parseFloat(e.target.value) || 0)}
                  className="h-8"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Minimum Job Price</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  min={0}
                  step={5}
                  value={settings.minimumJobPrice}
                  onChange={(e) => updateField("minimumJobPrice", parseFloat(e.target.value) || 0)}
                  className="h-8"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Long Sheet Setup Fee</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  min={0}
                  step={5}
                  value={settings.longSheetSetupFee}
                  onChange={(e) => updateField("longSheetSetupFee", parseFloat(e.target.value) || 0)}
                  className="h-8"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Extra fee for sheets 13x26+</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hand Fold Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Hand Fold Rates</CardTitle>
          <CardDescription className="text-xs">
            Pricing for manual hand folding when machine folding is not available
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Hand Fold Hourly Rate</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={settings.handFoldHourlyRate}
                  onChange={(e) => updateField("handFoldHourlyRate", parseFloat(e.target.value) || 0)}
                  className="h-8"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Hand Fold Rate per Piece</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={settings.handFoldRatePerPiece}
                  onChange={(e) => updateField("handFoldRatePerPiece", parseFloat(e.target.value) || 0)}
                  className="h-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Setup Levels */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Setup Levels</CardTitle>
          <CardDescription className="text-xs">
            Time required for different setup complexity levels (used in cost calculations)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings.setupLevels.map((level, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <Input
                value={level.label}
                onChange={(e) => updateSetupLevel(idx, "label", e.target.value)}
                className="h-8 w-32"
                placeholder="Label"
              />
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={level.minutes}
                  onChange={(e) => updateSetupLevel(idx, "minutes", parseInt(e.target.value) || 0)}
                  className="h-8 w-20"
                />
                <span className="text-sm text-muted-foreground">min</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeSetupLevel(idx)}
                disabled={settings.setupLevels.length <= 1}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addSetupLevel} className="mt-2">
            <Plus className="h-4 w-4 mr-1" />
            Add Level
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
