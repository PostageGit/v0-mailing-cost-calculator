"use client"

import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, Save, Package, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { type BoxSize, DEFAULT_BOX_SIZES } from "@/lib/shipping-boxes"

export function BoxSizesSettings() {
  const [boxes, setBoxes] = useState<BoxSize[]>(DEFAULT_BOX_SIZES)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  // Load from app_settings
  useEffect(() => {
    fetch("/api/app-settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.box_sizes && Array.isArray(data.box_sizes) && data.box_sizes.length > 0) {
          setBoxes(data.box_sizes as BoxSize[])
        }
      })
      .catch(() => {})
  }, [])

  const save = useCallback(async () => {
    setSaving(true)
    try {
      await fetch("/api/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ box_sizes: boxes }),
      })
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }, [boxes])

  const addBox = () => {
    setBoxes((prev) => [
      ...prev,
      {
        name: "",
        lengthIn: 12,
        widthIn: 10,
        heightIn: 6,
        volume: 12 * 10 * 6,
        upsEligible: true,
        boxWeightOz: 8,
      },
    ])
    setDirty(true)
  }

  const updateBox = (index: number, patch: Partial<BoxSize>) => {
    setBoxes((prev) =>
      prev.map((box, i) => {
        if (i !== index) return box
        const updated = { ...box, ...patch }
        // Recalculate volume
        updated.volume = updated.lengthIn * updated.widthIn * updated.heightIn
        return updated
      })
    )
    setDirty(true)
  }

  const deleteBox = (index: number) => {
    setBoxes((prev) => prev.filter((_, i) => i !== index))
    setDirty(true)
  }

  const resetToDefaults = () => {
    setBoxes(DEFAULT_BOX_SIZES)
    setDirty(true)
  }

  // Sort by volume for display
  const sortedBoxes = [...boxes].sort((a, b) => a.volume - b.volume)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Shipping Box Sizes</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure available box sizes for the shipping calculator.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetToDefaults}
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            Reset to Defaults
          </Button>
          {dirty && (
            <Button size="sm" onClick={save} disabled={saving} className="h-7 text-xs gap-1">
              <Save className="h-3 w-3" />
              {saving ? "Saving..." : "Save"}
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[100px_70px_70px_70px_70px_70px_80px_24px] gap-2 px-4 py-2 text-[9px] font-semibold text-muted-foreground uppercase tracking-wide bg-muted/30 border-b">
          <span>Name</span>
          <span className="text-right">Length</span>
          <span className="text-right">Width</span>
          <span className="text-right">Height</span>
          <span className="text-right">Box Wt (oz)</span>
          <span className="text-right">Volume</span>
          <span>UPS Safe</span>
          <span />
        </div>

        {/* Rows */}
        <div className="divide-y divide-border/50">
          {sortedBoxes.map((box, displayIndex) => {
            // Find actual index in unsorted array
            const actualIndex = boxes.findIndex(
              (b) =>
                b.name === box.name &&
                b.lengthIn === box.lengthIn &&
                b.widthIn === box.widthIn &&
                b.heightIn === box.heightIn
            )

            return (
              <div
                key={`${box.name}-${actualIndex}`}
                className="grid grid-cols-[100px_70px_70px_70px_70px_70px_80px_24px] gap-2 px-4 py-1.5 items-center"
              >
                <Input
                  value={box.name}
                  onChange={(e) => updateBox(actualIndex, { name: e.target.value })}
                  className="h-7 text-xs px-2 font-semibold"
                  placeholder="Name..."
                />
                <div className="relative">
                  <Input
                    type="number"
                    step="0.25"
                    value={box.lengthIn}
                    onChange={(e) => updateBox(actualIndex, { lengthIn: parseFloat(e.target.value) || 0 })}
                    className="h-7 text-xs px-2 text-right pr-5"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">&quot;</span>
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.25"
                    value={box.widthIn}
                    onChange={(e) => updateBox(actualIndex, { widthIn: parseFloat(e.target.value) || 0 })}
                    className="h-7 text-xs px-2 text-right pr-5"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">&quot;</span>
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.25"
                    value={box.heightIn}
                    onChange={(e) => updateBox(actualIndex, { heightIn: parseFloat(e.target.value) || 0 })}
                    className="h-7 text-xs px-2 text-right pr-5"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">&quot;</span>
                </div>
                <Input
                  type="number"
                  step="1"
                  value={box.boxWeightOz}
                  onChange={(e) => updateBox(actualIndex, { boxWeightOz: parseFloat(e.target.value) || 0 })}
                  className="h-7 text-xs px-2 text-right"
                />
                <div className="text-xs text-right text-muted-foreground font-mono">
                  {box.volume.toFixed(0)}
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={box.upsEligible}
                    onChange={(e) => updateBox(actualIndex, { upsEligible: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-border accent-foreground"
                  />
                  {!box.upsEligible && (
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => deleteBox(actualIndex)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>

        {/* Add button */}
        <div className="px-4 py-2 border-t bg-muted/10">
          <Button
            variant="ghost"
            size="sm"
            onClick={addBox}
            className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
          >
            <Plus className="h-3 w-3" />
            Add Box Size
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
        <Package className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-foreground">Box dimensions guide</p>
          <p className="mt-0.5">
            Length × Width = footprint (must fit the piece), Height = stacking capacity.
            Mark boxes as not UPS-safe if they are too fragile or exceed size limits.
          </p>
        </div>
      </div>
    </div>
  )
}
