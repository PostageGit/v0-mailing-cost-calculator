"use client"

import { useState, useMemo } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Save, Loader2, RotateCcw, Scale, Calculator } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  applyOverrides,
  DEFAULT_PAPER_WEIGHT_CONFIG,
  WEIGHT_SHEET_SIZES,
  parseSheetSize,
  type PaperWeightConfig,
  type PaperWeightEntry,
  type WeightSheetSize,
} from "@/lib/pricing-config"
import { PAPER_OPTIONS } from "@/lib/printing-pricing"
import { formatWeight, ENVELOPE_WEIGHTS } from "@/lib/paper-weights"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

/**
 * Paper Weights settings tab.
 *
 * For each paper from PAPER_OPTIONS, shows editable "lbs per 1,000 sheets"
 * fields for each sheet size (8.5x11, 11x17, 12x18, 13x19).
 * Only shows columns for sizes that paper is available in.
 */
export function PaperWeightsSettingsTab() {
  const { data: appSettings, isLoading } = useSWR<Record<string, unknown>>("/api/app-settings", fetcher)
  const [config, setConfig] = useState<PaperWeightConfig | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Test calculator state
  const [testPaper, setTestPaper] = useState(PAPER_OPTIONS[0]?.name || "")
  const [testWidth, setTestWidth] = useState(8.5)
  const [testHeight, setTestHeight] = useState(11)

  // Load once from DB
  if (appSettings && !loaded) {
    const savedCfg = appSettings.paper_weight_config as PaperWeightConfig | undefined
    // Merge: start with defaults for all PAPER_OPTIONS, overlay saved values
    const base: PaperWeightConfig = {}
    for (const p of PAPER_OPTIONS) {
      base[p.name] = { ...(DEFAULT_PAPER_WEIGHT_CONFIG[p.name] ?? {}) }
    }
    if (savedCfg) {
      for (const [k, v] of Object.entries(savedCfg)) {
        if (k in base && v && typeof v === "object") {
          base[k] = { ...base[k], ...v }
        }
      }
    }
    setConfig(base)
    setLoaded(true)
  }

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    try {
      await fetch("/api/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paper_weight_config: config }),
      })
      applyOverrides({ paper_weight_config: config })
      globalMutate("/api/app-settings")
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    const base: PaperWeightConfig = {}
    for (const p of PAPER_OPTIONS) {
      base[p.name] = { ...(DEFAULT_PAPER_WEIGHT_CONFIG[p.name] ?? {}) }
    }
    setConfig(base)
  }

  const updateWeight = (name: string, size: WeightSheetSize, value: number) => {
    if (!config) return
    const current = config[name] ?? {}
    setConfig({ ...config, [name]: { ...current, [size]: value } })
  }

  // Weight tester: compute weight for given paper + piece dimensions
  const testResult = useMemo(() => {
    if (!config || !testPaper || !testWidth || !testHeight) return null
    const entry = config[testPaper]
    if (!entry) return null

    // Find smallest sheet that fits
    const pieceW = testWidth
    const pieceH = testHeight
    let bestLbs = 0
    let bestArea = Infinity

    for (const sizeKey of WEIGHT_SHEET_SIZES) {
      const lbs = entry[sizeKey]
      if (!lbs || lbs <= 0) continue
      const [sw, sh] = parseSheetSize(sizeKey)
      const fits =
        (pieceW <= sw + 0.01 && pieceH <= sh + 0.01) ||
        (pieceW <= sh + 0.01 && pieceH <= sw + 0.01)
      if (!fits) continue
      const area = sw * sh
      if (area < bestArea) {
        bestArea = area
        bestLbs = lbs
      }
    }

    if (bestLbs === 0) {
      // Fallback: largest sheet, area ratio extrapolation
      let largestLbs = 0
      let largestArea = 0
      for (const sizeKey of WEIGHT_SHEET_SIZES) {
        const lbs = entry[sizeKey]
        if (!lbs || lbs <= 0) continue
        const [sw, sh] = parseSheetSize(sizeKey)
        const area = sw * sh
        if (area > largestArea) { largestArea = area; largestLbs = lbs }
      }
      if (largestArea === 0) return null
      const sheetOz = (largestLbs / 1000) * 16
      const ozPerSqIn = sheetOz / largestArea
      return Math.round(ozPerSqIn * pieceW * pieceH * 10000) / 10000
    }

    const sheetOz = (bestLbs / 1000) * 16
    return Math.round(sheetOz * ((pieceW * pieceH) / bestArea) * 10000) / 10000
  }, [config, testPaper, testWidth, testHeight])

  if (isLoading || !config) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Paper Weight Table</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed max-w-lg">
            Enter the weight in lbs per 1,000 sheets for each sheet size you carry.
            The system uses this to compute per-piece weight for any printed size.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="text-xs gap-1.5 h-8">
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="text-xs gap-1.5 h-8">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : saved ? <Scale className="h-3 w-3" /> : <Save className="h-3 w-3" />}
            {saved ? "Saved" : "Save"}
          </Button>
        </div>
      </div>

      {/* Weight tester */}
      <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Weight Tester</span>
          <span className="text-[10px] text-muted-foreground">-- pick paper + any custom piece size</span>
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Paper</label>
            <Select value={testPaper} onValueChange={setTestPaper}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAPER_OPTIONS.map((p) => (
                  <SelectItem key={p.name} value={p.name} className="text-xs">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1 w-20">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Width {"(\""}</label>
            <Input
              type="number"
              step="0.125"
              value={testWidth}
              onChange={(e) => setTestWidth(parseFloat(e.target.value) || 0)}
              className="h-9 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1 w-20">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Height {"(\""}</label>
            <Input
              type="number"
              step="0.125"
              value={testHeight}
              onChange={(e) => setTestHeight(parseFloat(e.target.value) || 0)}
              className="h-9 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Per Piece</label>
            <div className="h-9 flex items-center px-3 rounded-md bg-foreground text-background text-sm font-mono font-bold tabular-nums min-w-[100px]">
              {testResult !== null ? formatWeight(testResult) : "--"}
            </div>
          </div>
        </div>
      </div>

      {/* Paper weight table with per-size columns */}
      <div className="rounded-xl border border-border/40 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary/30 border-b border-border/30">
              <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-4 py-2.5 whitespace-nowrap">
                Paper
              </th>
              <th className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-2.5 w-14">
                Type
              </th>
              {WEIGHT_SHEET_SIZES.map((size) => (
                <th key={size} className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-2.5 whitespace-nowrap">
                  {size}
                  <div className="text-[8px] font-normal normal-case tracking-normal text-muted-foreground/50">lbs/1000</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PAPER_OPTIONS.map((paper) => {
              const entry = config[paper.name] ?? {}
              // Determine which sizes this paper is available in
              const availableSizes = new Set(paper.availableSizes ?? [])

              return (
                <tr
                  key={paper.name}
                  className="border-b border-border/20 last:border-b-0 hover:bg-secondary/20 transition-colors"
                >
                  <td className="px-4 py-2 font-medium text-foreground whitespace-nowrap">
                    {paper.name}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      paper.isCardstock
                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                        : "bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400"
                    }`}>
                      {paper.isCardstock ? "Card" : "Text"}
                    </span>
                  </td>
                  {WEIGHT_SHEET_SIZES.map((size) => {
                    // Normalize: paper may have "12.5x19" but we show "13x19" column
                    const hasSize = availableSizes.has(size) ||
                      (size === "13x19" && availableSizes.has("12.5x19")) ||
                      (size === "13x19" && availableSizes.has("13x26"))

                    if (!hasSize) {
                      return (
                        <td key={size} className="px-2 py-2 text-center">
                          <span className="text-[10px] text-muted-foreground/30">--</span>
                        </td>
                      )
                    }

                    const value = entry[size] ?? 0
                    return (
                      <td key={size} className="px-2 py-2">
                        <Input
                          type="number"
                          step="0.5"
                          value={value || ""}
                          placeholder="0"
                          onChange={(e) => updateWeight(paper.name, size, parseFloat(e.target.value) || 0)}
                          className="h-7 text-xs tabular-nums text-center w-20 mx-auto"
                        />
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Envelope weights (read-only reference) */}
      <div className="flex flex-col gap-3 pt-2">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Envelope Weights</h3>
          <span className="text-[10px] text-muted-foreground">(reference)</span>
        </div>
        <div className="rounded-xl border border-border/40 overflow-hidden">
          <div className="grid grid-cols-[1fr_100px] gap-2 px-4 py-2 bg-secondary/30 border-b border-border/30">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Type</span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-right">Weight (oz)</span>
          </div>
          {Object.entries(ENVELOPE_WEIGHTS).filter(([, v]) => v > 0).map(([key, val]) => (
            <div key={key} className="grid grid-cols-[1fr_100px] gap-2 items-center px-4 py-1.5 border-b border-border/20 last:border-b-0">
              <span className="text-xs font-medium text-foreground/80">{key}</span>
              <span className="text-right text-xs font-mono tabular-nums text-muted-foreground">{val.toFixed(2)} oz</span>
            </div>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="flex gap-2.5 rounded-xl bg-secondary/20 border border-border/30 p-3">
        <span className="text-[10px] text-muted-foreground/60 leading-relaxed">
          Enter the actual weight from your paper supplier (lbs per 1,000 sheets) for each sheet size.
          The system computes per-piece weight by finding the parent sheet size, then applying
          the area ratio for any custom printed dimension. New papers added to any calculator
          automatically appear here.
        </span>
      </div>
    </div>
  )
}
