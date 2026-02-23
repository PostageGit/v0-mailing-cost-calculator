"use client"

import { useState, useCallback, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Save, Loader2, Plus, Trash2, RotateCcw, Scale, Calculator, Info } from "lucide-react"
import {
  DEFAULT_PAPER_WEIGHTS,
  ENVELOPE_WEIGHTS,
  calcSheetWeightOz,
  formatWeight,
  type PaperWeightEntry,
  type PaperCategory,
} from "@/lib/paper-weights"

const CATEGORY_LABELS: Record<PaperCategory, string> = {
  bond: "Bond / Writing",
  offset: "Offset (Uncoated)",
  text: "Text / Book (Coated)",
  cover: "Cover",
  index: "Index",
  tag: "Tag",
  cardstock_pt: "Cardstock (pt)",
}

const CATEGORY_COLORS: Record<PaperCategory, string> = {
  bond: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  offset: "bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300",
  text: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
  cover: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  index: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  tag: "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300",
  cardstock_pt: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
}

/**
 * Paper Weights settings tab.
 * Lets user view/edit all paper weight entries (GSM, basis weight, caliper)
 * and envelope weights. Changes are stored in localStorage to persist overrides.
 */
export function PaperWeightsSettingsTab() {
  // Load overrides from localStorage (or start with defaults)
  const [papers, setPapers] = useState<PaperWeightEntry[]>(() => {
    if (typeof window === "undefined") return DEFAULT_PAPER_WEIGHTS
    try {
      const stored = localStorage.getItem("pp_paper_weights")
      if (stored) return JSON.parse(stored)
    } catch { /* ignore */ }
    return DEFAULT_PAPER_WEIGHTS
  })

  const [envWeights, setEnvWeights] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return ENVELOPE_WEIGHTS
    try {
      const stored = localStorage.getItem("pp_envelope_weights")
      if (stored) return JSON.parse(stored)
    } catch { /* ignore */ }
    return ENVELOPE_WEIGHTS
  })

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testWidth, setTestWidth] = useState(8.5)
  const [testHeight, setTestHeight] = useState(11)
  const [testPaper, setTestPaper] = useState(papers[0]?.name || "20lb Offset")

  // Group papers by category
  const grouped = useMemo(() => {
    const map = new Map<PaperCategory, PaperWeightEntry[]>()
    for (const p of papers) {
      const list = map.get(p.category) || []
      list.push(p)
      map.set(p.category, list)
    }
    return map
  }, [papers])

  const handleSave = useCallback(() => {
    setSaving(true)
    try {
      localStorage.setItem("pp_paper_weights", JSON.stringify(papers))
      localStorage.setItem("pp_envelope_weights", JSON.stringify(envWeights))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }, [papers, envWeights])

  const handleReset = useCallback(() => {
    setPapers(DEFAULT_PAPER_WEIGHTS)
    setEnvWeights(ENVELOPE_WEIGHTS)
    localStorage.removeItem("pp_paper_weights")
    localStorage.removeItem("pp_envelope_weights")
  }, [])

  const updatePaper = useCallback((idx: number, updates: Partial<PaperWeightEntry>) => {
    setPapers((prev) => prev.map((p, i) => i === idx ? { ...p, ...updates, userOverride: true } : p))
  }, [])

  const removePaper = useCallback((idx: number) => {
    setPapers((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  const addPaper = useCallback(() => {
    setPapers((prev) => [
      ...prev,
      {
        name: "New Paper",
        category: "offset" as PaperCategory,
        basisWeight: 0,
        gsm: 0,
        caliperInches: 0.005,
        isCardstock: false,
      },
    ])
  }, [])

  // Weight test calculator
  const testResult = useMemo(() => {
    if (!testWidth || !testHeight || !testPaper) return null
    return calcSheetWeightOz(testPaper, testWidth, testHeight, papers)
  }, [testWidth, testHeight, testPaper, papers])

  return (
    <div className="flex flex-col gap-6">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Paper Weight Table</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed max-w-md">
            Industry-standard GSM values for each paper stock. Used to auto-calculate mail piece weight for postage. Edit GSM or caliper if your stock differs from standard.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="text-xs gap-1.5 h-8">
            <RotateCcw className="h-3 w-3" />
            Reset Defaults
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="text-xs gap-1.5 h-8">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : saved ? <Scale className="h-3 w-3" /> : <Save className="h-3 w-3" />}
            {saved ? "Saved" : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Weight tester */}
      <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Weight Tester</span>
          <span className="text-[10px] text-muted-foreground">-- pick paper + dimensions to test</span>
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Paper</label>
            <Select value={testPaper} onValueChange={setTestPaper}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {papers.map((p) => (
                  <SelectItem key={p.name} value={p.name} className="text-xs">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1 w-20">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Width (in)</label>
            <Input
              type="number"
              step="0.125"
              value={testWidth}
              onChange={(e) => setTestWidth(parseFloat(e.target.value) || 0)}
              className="h-9 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1 w-20">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Height (in)</label>
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

      {/* Paper table grouped by category */}
      {Array.from(grouped.entries()).map(([category, entries]) => (
        <div key={category} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={`text-[10px] font-semibold ${CATEGORY_COLORS[category]}`}>
              {CATEGORY_LABELS[category]}
            </Badge>
            <span className="text-[10px] text-muted-foreground">{entries.length} stock{entries.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_90px_80px_80px_36px] gap-2 px-2">
            <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Name</span>
            <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
              {category === "cardstock_pt" ? "GSM" : "Basis Wt (lb)"}
            </span>
            <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">GSM</span>
            <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Caliper (in)</span>
            <span />
          </div>

          {entries.map((entry) => {
            const globalIdx = papers.indexOf(entry)
            return (
              <div
                key={`${entry.name}-${globalIdx}`}
                className="grid grid-cols-[1fr_90px_80px_80px_36px] gap-2 items-center px-2 py-1.5 rounded-lg hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <Input
                    value={entry.name}
                    onChange={(e) => updatePaper(globalIdx, { name: e.target.value })}
                    className="h-7 text-xs border-none bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  {entry.userOverride && (
                    <span className="text-[8px] text-amber-500 font-medium whitespace-nowrap">edited</span>
                  )}
                </div>
                {category !== "cardstock_pt" ? (
                  <Input
                    type="number"
                    step="1"
                    value={entry.basisWeight}
                    onChange={(e) => updatePaper(globalIdx, { basisWeight: parseFloat(e.target.value) || 0 })}
                    className="h-7 text-xs tabular-nums"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground/50 px-2">--</span>
                )}
                <Input
                  type="number"
                  step="0.5"
                  value={entry.gsm}
                  onChange={(e) => updatePaper(globalIdx, { gsm: parseFloat(e.target.value) || 0 })}
                  className="h-7 text-xs tabular-nums"
                />
                <Input
                  type="number"
                  step="0.001"
                  value={entry.caliperInches}
                  onChange={(e) => updatePaper(globalIdx, { caliperInches: parseFloat(e.target.value) || 0 })}
                  className="h-7 text-xs tabular-nums"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-destructive"
                  onClick={() => removePaper(globalIdx)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )
          })}
        </div>
      ))}

      {/* Add paper button */}
      <Button variant="outline" size="sm" onClick={addPaper} className="w-fit text-xs gap-1.5 h-8">
        <Plus className="h-3 w-3" />
        Add Paper Stock
      </Button>

      {/* Envelope weights section */}
      <div className="flex flex-col gap-3 pt-2">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Envelope Weights</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Standard envelope weights used in mail piece assembly calculation. Adjust if using non-standard stock.
        </p>

        <div className="grid grid-cols-[1fr_100px] gap-2 px-2">
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Envelope Type</span>
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Weight (oz)</span>
        </div>

        {Object.entries(envWeights).map(([key, val]) => (
          <div key={key} className="grid grid-cols-[1fr_100px] gap-2 items-center px-2 py-1 rounded-lg hover:bg-secondary/30 transition-colors">
            <span className="text-xs font-medium text-foreground/80">{key}</span>
            <Input
              type="number"
              step="0.01"
              value={val}
              onChange={(e) => setEnvWeights((prev) => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
              className="h-7 text-xs tabular-nums"
            />
          </div>
        ))}
      </div>

      {/* Info note */}
      <div className="flex gap-2 rounded-xl bg-secondary/20 border border-border/30 p-3 mt-2">
        <Info className="h-3.5 w-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />
        <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
          Weight formula: GSM x area (sq in) x 0.00002276 = ounces per sheet. For point stocks (10pt, 12pt, etc.), GSM is approximated from coated stock density tables. If your stock differs, adjust the GSM value directly -- it is the master value used in all calculations.
        </p>
      </div>
    </div>
  )
}
