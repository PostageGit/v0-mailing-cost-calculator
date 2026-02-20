"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Settings2, Save, X, Plus, Trash2 } from "lucide-react"
import type { PadSettings, PadTier } from "@/lib/pad-types"
import { DEFAULT_PAD_SETTINGS } from "@/lib/pad-types"
import { cn } from "@/lib/utils"

interface PadSettingsPanelProps {
  settings: PadSettings
  onSave: (settings: PadSettings) => void
}

export function PadSettingsPanel({ settings, onSave }: PadSettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [draft, setDraft] = useState<PadSettings>(settings)
  const [saving, setSaving] = useState(false)

  function openPanel() {
    setDraft(JSON.parse(JSON.stringify(settings)))
    setIsOpen(true)
  }

  function updateTier(idx: number, partial: Partial<PadTier>) {
    const tiers = [...draft.tiers]
    tiers[idx] = { ...tiers[idx], ...partial }
    setDraft({ ...draft, tiers })
  }

  function removeTier(idx: number) {
    if (draft.tiers.length <= 1) return
    setDraft({ ...draft, tiers: draft.tiers.filter((_, i) => i !== idx) })
  }

  function addTier() {
    const last = draft.tiers[draft.tiers.length - 1]
    const newMin = last ? (last.max === Infinity ? last.min + 1000 : last.max + 1) : 1
    setDraft({
      ...draft,
      tiers: [
        ...draft.tiers,
        { min: newMin, max: Infinity, label: `${newMin}+ pads`, pricePerPad: 0.40 },
      ],
    })
  }

  async function handleSave() {
    setSaving(true)
    // Normalize: sort by min, fix labels, last tier gets Infinity
    const sorted = [...draft.tiers].sort((a, b) => a.min - b.min)
    sorted.forEach((t, i) => {
      if (i === sorted.length - 1) {
        t.max = Infinity
        t.label = `${t.min}+ pads`
      } else {
        t.max = sorted[i + 1].min - 1
        t.label = `${t.min}-${t.max} pads`
      }
    })
    const final: PadSettings = { ...draft, tiers: sorted }

    try {
      await fetch("/api/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pad_finishing_settings: final }),
      })
      onSave(final)
      setIsOpen(false)
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setDraft(JSON.parse(JSON.stringify(DEFAULT_PAD_SETTINGS)))
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={openPanel}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
      >
        <Settings2 className="h-3.5 w-3.5" />
        Settings
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Pad Finishing Rates</h3>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tier Table */}
      <div className="rounded-lg border border-border overflow-hidden mb-4">
        <div className="grid grid-cols-[1fr_6rem_2.5rem] gap-0 bg-muted/50 px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          <span>Quantity Range</span>
          <span className="text-right">Per Pad</span>
          <span />
        </div>
        {draft.tiers.map((tier, idx) => (
          <div
            key={idx}
            className={cn(
              "grid grid-cols-[1fr_6rem_2.5rem] gap-0 items-center px-3 py-1.5 border-t border-border",
              idx % 2 === 0 ? "bg-card" : "bg-muted/20",
            )}
          >
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={1}
                value={tier.min}
                onChange={(e) => updateTier(idx, { min: parseInt(e.target.value) || 0 })}
                className="h-7 w-16 text-xs"
              />
              <span className="text-xs text-muted-foreground">to</span>
              {idx === draft.tiers.length - 1 ? (
                <span className="text-xs text-muted-foreground font-medium">{"unlimited"}</span>
              ) : (
                <Input
                  type="number"
                  min={tier.min}
                  value={tier.max === Infinity ? "" : tier.max}
                  onChange={(e) => updateTier(idx, { max: parseInt(e.target.value) || tier.min })}
                  className="h-7 w-16 text-xs"
                />
              )}
            </div>
            <div className="flex items-center justify-end">
              <span className="text-xs text-muted-foreground mr-1">$</span>
              <Input
                type="number"
                step={0.01}
                min={0}
                value={tier.pricePerPad}
                onChange={(e) => updateTier(idx, { pricePerPad: parseFloat(e.target.value) || 0 })}
                className="h-7 w-16 text-xs text-right"
              />
            </div>
            <button
              type="button"
              onClick={() => removeTier(idx)}
              disabled={draft.tiers.length <= 1}
              className="flex items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addTier}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <Plus className="h-3 w-3" /> Add tier
      </button>

      {/* Setup & Chip Board */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Setup Charge ($)</label>
          <Input
            type="number"
            step={1}
            min={0}
            value={draft.setupCharge}
            onChange={(e) => setDraft({ ...draft, setupCharge: parseFloat(e.target.value) || 0 })}
            className="h-8 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Chip Board / Pad ($)</label>
          <Input
            type="number"
            step={0.01}
            min={0}
            value={draft.chipBoardPerPad}
            onChange={(e) => setDraft({ ...draft, chipBoardPerPad: parseFloat(e.target.value) || 0 })}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
          <Save className="h-3.5 w-3.5" />
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={handleReset}>
          Reset to Default
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setIsOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
