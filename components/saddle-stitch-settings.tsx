"use client"

import React, { useState, useEffect } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Loader2, Save, RotateCcw } from "lucide-react"
import {
  DEFAULT_SADDLE_STITCH_CONFIG,
  type SaddleStitchConfig,
  type SaddleStitchRateEntry,
  type SaddleStitchBindingSurcharge,
} from "@/lib/pricing-config"

const fetcher = (url: string) => fetch(url).then((r) => r.json())
const SETTINGS_KEY = "saddle_stitch_config"

// Size/thickness/cover labels for display
const SIZE_LABELS: Record<string, string> = {
  handheld: "Handheld (5x7 to 9x12)",
  pocket: "Pocket (3x5 to 4.25x6)",
}

const THICKNESS_LABELS: Record<string, string> = {
  thin: "Thin (8-48 pages)",
  thick: "Thick (52-100 pages)",
}

const COVER_LABELS: Record<string, string> = {
  self: "Self-Cover",
  with: "With Cover",
}

const BINDING_TYPE_LABELS: Record<string, { name: string; desc: string }> = {
  staple: { name: "Staple", desc: "Base price (no surcharge)" },
  fold: { name: "Fold Only", desc: "Fold without stapling" },
  perfect: { name: "Perfect Bind", desc: "Glued spine binding" },
}

export function SaddleStitchSettingsTab() {
  const { data, isLoading } = useSWR<Record<string, unknown>>("/api/app-settings", fetcher)
  
  const [config, setConfig] = useState<SaddleStitchConfig>(DEFAULT_SADDLE_STITCH_CONFIG)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Load from DB or defaults
  useEffect(() => {
    if (data?.[SETTINGS_KEY]) {
      setConfig(data[SETTINGS_KEY] as SaddleStitchConfig)
    } else {
      setConfig(DEFAULT_SADDLE_STITCH_CONFIG)
    }
    setHasChanges(false)
  }, [data])

  // Update a rate entry
  const updateRate = (
    size: string,
    thickness: string,
    cover: string,
    field: keyof SaddleStitchRateEntry,
    value: number
  ) => {
    setConfig((prev) => ({
      ...prev,
      rates: {
        ...prev.rates,
        [size]: {
          ...prev.rates[size],
          [thickness]: {
            ...prev.rates[size]?.[thickness],
            [cover]: {
              ...prev.rates[size]?.[thickness]?.[cover],
              [field]: value,
            },
          },
        },
      },
    }))
    setHasChanges(true)
  }

  // Update broker discount
  const updateBrokerDiscount = (value: number) => {
    setConfig((prev) => ({ ...prev, brokerDiscountPercent: value }))
    setHasChanges(true)
  }

  // Update binding surcharge
  const updateBindingSurcharge = (
    bindingType: "staple" | "fold" | "perfect",
    field: keyof SaddleStitchBindingSurcharge,
    value: number
  ) => {
    setConfig((prev) => ({
      ...prev,
      binding: {
        ...prev.binding,
        [bindingType]: {
          ...prev.binding?.[bindingType],
          [field]: value,
        },
      },
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

  // Reset to defaults
  const handleReset = () => {
    setConfig(DEFAULT_SADDLE_STITCH_CONFIG)
    setHasChanges(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const sizes = Object.keys(config.rates)
  const thicknesses = ["thin", "thick"]
  const covers = ["self", "with"]

  return (
    <div className="space-y-6">
      {/* Header with save/reset buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Saddle Stitch Binding Rates</h3>
          <p className="text-sm text-muted-foreground">
            Configure per-book rates and setup fees by size, thickness, and cover type
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

      {/* Broker Discount */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Broker Discount</CardTitle>
          <CardDescription className="text-xs">
            Percentage discount applied for broker orders
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={100}
              value={config.brokerDiscountPercent}
              onChange={(e) => updateBrokerDiscount(parseFloat(e.target.value) || 0)}
              className="w-24 h-8"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </CardContent>
      </Card>

      {/* Binding Type Surcharges */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Binding Type Surcharges</CardTitle>
          <CardDescription className="text-xs">
            Staple is the base price. Fold and Perfect Bind add extra setup fees and per-book rates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Binding Type</th>
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Extra Setup</th>
                  <th className="text-left py-2 font-medium text-muted-foreground">Extra Rate/Book</th>
                </tr>
              </thead>
              <tbody>
                {(["staple", "fold", "perfect"] as const).map((bindingType) => {
                  const entry = config.binding?.[bindingType] || { extraSetup: 0, extraRate: 0 }
                  const label = BINDING_TYPE_LABELS[bindingType]
                  return (
                    <tr key={bindingType} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        <div>
                          <span className="font-medium">{label.name}</span>
                          <span className="text-xs text-muted-foreground block">{label.desc}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">$</span>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={entry.extraSetup}
                            onChange={(e) =>
                              updateBindingSurcharge(bindingType, "extraSetup", parseFloat(e.target.value) || 0)
                            }
                            className="w-20 h-7 text-sm"
                            disabled={bindingType === "staple"}
                          />
                        </div>
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">$</span>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={entry.extraRate}
                            onChange={(e) =>
                              updateBindingSurcharge(bindingType, "extraRate", parseFloat(e.target.value) || 0)
                            }
                            className="w-20 h-7 text-sm"
                            disabled={bindingType === "staple"}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Rate Tables by Size */}
      {sizes.map((size) => (
        <Card key={size}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{SIZE_LABELS[size] || size}</CardTitle>
            <CardDescription className="text-xs">
              {size === "handheld" 
                ? "Larger booklets where max dimension > 6 inches" 
                : "Smaller booklets where max dimension <= 6 inches"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Thickness</th>
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Cover Type</th>
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Rate/Book</th>
                    <th className="text-left py-2 font-medium text-muted-foreground">Setup Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {thicknesses.map((thickness) =>
                    covers.map((cover, coverIdx) => {
                      const entry = config.rates[size]?.[thickness]?.[cover] || { rate: 0, setup: 0 }
                      return (
                        <tr key={`${thickness}-${cover}`} className="border-b last:border-0">
                          {coverIdx === 0 && (
                            <td rowSpan={2} className="py-2 pr-4 align-top">
                              <span className="font-medium">{THICKNESS_LABELS[thickness]}</span>
                            </td>
                          )}
                          <td className="py-2 pr-4">
                            <span className="text-muted-foreground">{COVER_LABELS[cover]}</span>
                          </td>
                          <td className="py-2 pr-4">
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">$</span>
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                value={entry.rate}
                                onChange={(e) =>
                                  updateRate(size, thickness, cover, "rate", parseFloat(e.target.value) || 0)
                                }
                                className="w-20 h-7 text-sm"
                              />
                            </div>
                          </td>
                          <td className="py-2">
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">$</span>
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                value={entry.setup}
                                onChange={(e) =>
                                  updateRate(size, thickness, cover, "setup", parseFloat(e.target.value) || 0)
                                }
                                className="w-20 h-7 text-sm"
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
