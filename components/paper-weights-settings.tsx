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
  getActiveConfig,
  DEFAULT_PAPER_WEIGHT_CONFIG,
  type PaperWeightConfig,
} from "@/lib/pricing-config"
import { PAPER_OPTIONS } from "@/lib/printing-pricing"
import { formatWeight, ENVELOPE_WEIGHTS } from "@/lib/paper-weights"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

/**
 * Paper Weights settings tab.
 *
 * Shows every paper from PAPER_OPTIONS with one editable field:
 * "lbs per 1,000 sheets of 11x17". This drives the mail piece weight
 * estimate on quotes. Persisted in app_settings.paper_weight_config.
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
    const saved = appSettings.paper_weight_config as PaperWeightConfig | undefined
    // Merge: start with defaults for all current PAPER_OPTIONS, overlay saved values
    const base: PaperWeightConfig = {}
    for (const p of PAPER_OPTIONS) {
      base[p.name] = DEFAULT_PAPER_WEIGHT_CONFIG[p.name] ?? 0
    }
    if (saved) {
      for (const [k, v] of Object.entries(saved)) {
        if (k in base) base[k] = v
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
      base[p.name] = DEFAULT_PAPER_WEIGHT_CONFIG[p.name] ?? 0
    }
    setConfig(base)
  }

  const updateWeight = (name: string, value: number) => {
    if (!config) return
    setConfig({ ...config, [name]: value })
  }

  // Test: apply config temporarily to get weight
  const testResult = useMemo(() => {
    if (!config || !testPaper || !testWidth || !testHeight) return null
    // Temporarily apply current config for the test
    const lbsPer1000 = config[testPaper]
    if (!lbsPer1000) return null
    const sheetOz11x17 = (lbsPer1000 / 1000) * 16
    const ozPerSqIn = sheetOz11x17 / (11 * 17)
    return Math.round(ozPerSqIn * testWidth * testHeight * 10000) / 10000
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
            Enter the weight in pounds per 1,000 sheets of 11x17 for each paper you carry.
            This is used to auto-calculate per-piece weight on quotes for postage estimation.
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
          <span className="text-[10px] text-muted-foreground">-- pick paper + sheet size to test</span>
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
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Width</label>
            <Input
              type="number"
              step="0.125"
              value={testWidth}
              onChange={(e) => setTestWidth(parseFloat(e.target.value) || 0)}
              className="h-9 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1 w-20">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Height</label>
            <Input
              type="number"
              step="0.125"
              value={testHeight}
              onChange={(e) => setTestHeight(parseFloat(e.target.value) || 0)}
              className="h-9 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Per Sheet</label>
            <div className="h-9 flex items-center px-3 rounded-md bg-foreground text-background text-sm font-mono font-bold tabular-nums min-w-[100px]">
              {testResult !== null ? formatWeight(testResult) : "--"}
            </div>
          </div>
        </div>
      </div>

      {/* Paper table */}
      <div className="rounded-xl border border-border/40 overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_60px_180px_100px] gap-3 px-4 py-2.5 bg-secondary/30 border-b border-border/30">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Paper</span>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center">Type</span>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Lbs / 1,000 sheets (11x17)</span>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-right">Per sheet (oz)</span>
        </div>

        {PAPER_OPTIONS.map((paper) => {
          const lbs = config[paper.name] ?? 0
          const ozPerSheet = lbs > 0 ? ((lbs / 1000) * 16) : 0

          return (
            <div
              key={paper.name}
              className="grid grid-cols-[1fr_60px_180px_100px] gap-3 items-center px-4 py-2 border-b border-border/20 last:border-b-0 hover:bg-secondary/20 transition-colors"
            >
              <span className="text-sm font-medium text-foreground">{paper.name}</span>
              <span className="text-center">
                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  paper.isCardstock
                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                    : "bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400"
                }`}>
                  {paper.isCardstock ? "Card" : "Paper"}
                </span>
              </span>
              <div className="relative">
                <Input
                  type="number"
                  step="0.5"
                  value={lbs || ""}
                  placeholder="Enter weight..."
                  onChange={(e) => updateWeight(paper.name, parseFloat(e.target.value) || 0)}
                  className="h-8 text-sm tabular-nums pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/50 font-medium">lbs</span>
              </div>
              <span className="text-right text-xs font-mono tabular-nums text-muted-foreground">
                {ozPerSheet > 0 ? `${ozPerSheet.toFixed(3)} oz` : "--"}
              </span>
            </div>
          )
        })}
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
          Enter the actual weight from your paper supplier (lbs per 1,000 sheets of 11x17).
          The system derives per-sheet ounces from this value. When new papers are added to any
          calculator, they automatically appear here for you to fill in.
        </span>
      </div>
    </div>
  )
}
