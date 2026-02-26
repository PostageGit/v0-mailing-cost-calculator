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
  DEFAULT_ENVELOPE_WEIGHT_CONFIG,
  WEIGHT_SHEET_SIZES,
  parseSheetSize,
  type PaperWeightConfig,
  type PaperWeightEntry,
  type WeightSheetSize,
  type EnvelopeWeightConfig,
  type EnvelopeWeightEntry,
} from "@/lib/pricing-config"
import { PAPER_OPTIONS } from "@/lib/printing-pricing"
import { formatWeight } from "@/lib/paper-weights"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function PaperWeightsSettingsTab() {
  const { data: appSettings, isLoading } = useSWR<Record<string, unknown>>("/api/app-settings", fetcher)
  const [config, setConfig] = useState<PaperWeightConfig | null>(null)
  const [envConfig, setEnvConfig] = useState<EnvelopeWeightConfig | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Test calculator
  const [testPaper, setTestPaper] = useState(PAPER_OPTIONS[0]?.name || "")
  const [testWidth, setTestWidth] = useState(8.5)
  const [testHeight, setTestHeight] = useState(11)

  if (appSettings && !loaded) {
    const savedCfg = appSettings.paper_weight_config as PaperWeightConfig | undefined
    const base: PaperWeightConfig = {}
    for (const p of PAPER_OPTIONS) {
      base[p.name] = savedCfg?.[p.name] ?? DEFAULT_PAPER_WEIGHT_CONFIG[p.name] ?? { size: "11x17", lbs: 0 }
    }
    setConfig(base)
    const savedEnv = appSettings.envelope_weight_config as EnvelopeWeightConfig | undefined
    setEnvConfig({ ...structuredClone(DEFAULT_ENVELOPE_WEIGHT_CONFIG), ...savedEnv })
    setLoaded(true)
  }

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    try {
      await fetch("/api/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paper_weight_config: config, envelope_weight_config: envConfig }),
      })
      applyOverrides({ paper_weight_config: config, envelope_weight_config: envConfig ?? undefined })
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
      base[p.name] = DEFAULT_PAPER_WEIGHT_CONFIG[p.name] ?? { size: "11x17", lbs: 0 }
    }
    setConfig(base)
    setEnvConfig(structuredClone(DEFAULT_ENVELOPE_WEIGHT_CONFIG))
  }

  // Weight tester
  const testResult = useMemo(() => {
    if (!config || !testPaper || !testWidth || !testHeight) return null
    const entry = config[testPaper]
    if (!entry || !entry.lbs || entry.lbs <= 0) return null
    const [refW, refH] = parseSheetSize(entry.size)
    const refArea = refW * refH
    if (refArea <= 0) return null
    const sheetOz = (entry.lbs / 1000) * 16
    const pieceArea = testWidth * testHeight
    return Math.round(sheetOz * (pieceArea / refArea) * 10000) / 10000
  }, [config, testPaper, testWidth, testHeight])

  if (isLoading || !config || !envConfig) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Paper Weight Table</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed max-w-lg">
            Enter lbs per 1,000 sheets at any one size you know. The system computes
            weight for any piece dimension automatically via area ratio.
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
          <span className="text-[10px] text-muted-foreground">-- pick paper + any piece size</span>
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
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{"Width (\u2033)"}</label>
            <Input
              type="number"
              step="0.125"
              value={testWidth}
              onChange={(e) => setTestWidth(parseFloat(e.target.value) || 0)}
              className="h-9 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1 w-20">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{"Height (\u2033)"}</label>
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
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Thickness</label>
            <div className="h-9 flex items-center px-3 rounded-md bg-secondary text-foreground text-sm font-mono font-semibold tabular-nums min-w-[80px]">
              {config?.[testPaper]?.thicknessIn ? `${config[testPaper].thicknessIn}\u2033` : "--"}
            </div>
          </div>
        </div>
      </div>

      {/* Paper weight table -- ONE row per paper */}
      <div className="rounded-xl border border-border/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary/30 border-b border-border/30">
              <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-4 py-2.5">
                Paper
              </th>
              <th className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-2.5 w-14">
                Type
              </th>
              <th className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-2.5">
                Sheet Size
              </th>
              <th className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-2.5">
                <div>Lbs / 1,000 Sheets</div>
              </th>
              <th className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-2.5">
                <div>Thickness (in)</div>
              </th>
              <th className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-2.5">
                Per Sheet (oz)
              </th>
            </tr>
          </thead>
          <tbody>
            {PAPER_OPTIONS.map((paper) => {
              const entry = config[paper.name] ?? { size: "11x17" as WeightSheetSize, lbs: 0 }
              const perSheetOz = entry.lbs > 0 ? ((entry.lbs / 1000) * 16) : 0

              return (
                <tr
                  key={paper.name}
                  className="border-b border-border/20 last:border-b-0 hover:bg-secondary/20 transition-colors"
                >
                  <td className="px-4 py-2 font-medium text-foreground whitespace-nowrap text-xs">
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
                  <td className="px-2 py-2 text-center">
                    <Select
                      value={entry.size}
                      onValueChange={(v) =>
                        setConfig({ ...config, [paper.name]: { ...entry, size: v as WeightSheetSize } })
                      }
                    >
                      <SelectTrigger className="h-7 w-[100px] text-xs mx-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WEIGHT_SHEET_SIZES.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <Input
                      type="number"
                      step="0.5"
                      value={entry.lbs || ""}
                      placeholder="0"
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          [paper.name]: { ...entry, lbs: parseFloat(e.target.value) || 0 },
                        })
                      }
                      className="h-7 text-xs tabular-nums text-center w-24 mx-auto"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <Input
                      type="number"
                      step="0.001"
                      value={entry.thicknessIn || ""}
                      placeholder="0.000"
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          [paper.name]: { ...entry, thicknessIn: parseFloat(e.target.value) || 0 },
                        })
                      }
                      className="h-7 text-xs tabular-nums text-center w-20 mx-auto"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                      {perSheetOz > 0 ? `${perSheetOz.toFixed(3)}` : "--"}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Envelope weights + thickness (editable) */}
      {envConfig && (
        <div className="flex flex-col gap-3 pt-2">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Envelope Weights & Thickness</h3>
          </div>
          <div className="rounded-xl border border-border/40 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/30 border-b border-border/30">
                  <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-4 py-2.5">
                    Envelope
                  </th>
                  <th className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-2.5">
                    Weight (oz)
                  </th>
                  <th className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-2.5">
                    Thickness (in)
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(envConfig).map(([key, entry]) => (
                  <tr
                    key={key}
                    className="border-b border-border/20 last:border-b-0 hover:bg-secondary/20 transition-colors"
                  >
                    <td className="px-4 py-2 font-medium text-foreground whitespace-nowrap text-xs">
                      {key}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <Input
                        type="number"
                        step="0.01"
                        value={entry.oz || ""}
                        placeholder="0.00"
                        onChange={(e) =>
                          setEnvConfig({
                            ...envConfig,
                            [key]: { ...entry, oz: parseFloat(e.target.value) || 0 },
                          })
                        }
                        className="h-7 text-xs tabular-nums text-center w-20 mx-auto"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <Input
                        type="number"
                        step="0.001"
                        value={entry.thicknessIn || ""}
                        placeholder="0.000"
                        onChange={(e) =>
                          setEnvConfig({
                            ...envConfig,
                            [key]: { ...entry, thicknessIn: parseFloat(e.target.value) || 0 },
                          })
                        }
                        className="h-7 text-xs tabular-nums text-center w-20 mx-auto"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
