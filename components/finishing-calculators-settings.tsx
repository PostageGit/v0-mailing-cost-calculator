"use client"

import { useState, useCallback } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Save, Trash2, Loader2, Calculator, ChevronDown, ChevronUp } from "lucide-react"
import { formatCurrency } from "@/lib/pricing"
import type {
  FinishingCalculator,
  FinishingGlobalRates,
  CalculatorTarget,
} from "@/lib/finishing-calculator-types"
import { CALCULATOR_TARGET_LABELS, calculateFinishingTotal } from "@/lib/finishing-calculator-types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const TARGETS: CalculatorTarget[] = ["flat", "saddle", "perfect_binding"]

export function FinishingCalculatorsSettingsTab() {
  return (
    <div className="flex flex-col gap-6">
      <GlobalRatesCard />
      <Separator />
      <FinishingCalculatorsList />
    </div>
  )
}

// ---------- GLOBAL RATES ----------
function GlobalRatesCard() {
  const { data, isLoading, mutate } = useSWR<FinishingGlobalRates>(
    "/api/finishing-global-rates",
    fetcher,
  )
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<FinishingGlobalRates>>({})

  const rates = data
    ? { ...data, ...form }
    : { setup_labor_rate: 45, running_labor_rate: 25, broker_discount: 0.3, ...form }

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await fetch("/api/finishing-global-rates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      mutate()
      setForm({})
    } finally {
      setSaving(false)
    }
  }, [form, mutate])

  const isDirty = Object.keys(form).length > 0

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading rates...</div>

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Global Finishing Rates</CardTitle>
        <p className="text-xs text-muted-foreground">
          These rates apply to all finishing calculators.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">
              Setup Labor Rate ($/hr)
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={rates.setup_labor_rate}
              onChange={(e) =>
                setForm((p) => ({ ...p, setup_labor_rate: parseFloat(e.target.value) || 0 }))
              }
              className="h-8 text-sm font-mono"
            />
            <span className="text-[10px] text-muted-foreground">Skilled setup work</span>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">
              Running Labor Rate ($/hr)
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={rates.running_labor_rate}
              onChange={(e) =>
                setForm((p) => ({ ...p, running_labor_rate: parseFloat(e.target.value) || 0 }))
              }
              className="h-8 text-sm font-mono"
            />
            <span className="text-[10px] text-muted-foreground">Normal operator</span>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">
              Broker Discount (%)
            </label>
            <Input
              type="number"
              step="1"
              min="0"
              max="100"
              value={Math.round((rates.broker_discount ?? 0.3) * 100)}
              onChange={(e) =>
                setForm((p) => ({ ...p, broker_discount: (parseFloat(e.target.value) || 0) / 100 }))
              }
              className="h-8 text-sm font-mono"
            />
            <span className="text-[10px] text-muted-foreground">Default 30%</span>
          </div>
        </div>
        {isDirty && (
          <div className="flex justify-end mt-3">
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 text-xs">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save Rates
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------- LIST ----------
function FinishingCalculatorsList() {
  const { data: calcs, isLoading, mutate } = useSWR<FinishingCalculator[]>(
    "/api/finishing-calculators",
    fetcher,
  )
  const [creating, setCreating] = useState(false)

  const handleCreate = useCallback(async () => {
    setCreating(true)
    try {
      await fetch("/api/finishing-calculators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Finishing" }),
      })
      mutate()
    } finally {
      setCreating(false)
    }
  }, [mutate])

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading finishings...</div>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Finishing Calculators</h3>
          <p className="text-xs text-muted-foreground">
            Build named finishings and push them to any calculator.
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={creating}
          className="gap-1.5 text-xs"
        >
          {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Add Finishing
        </Button>
      </div>

      {(!calcs || calcs.length === 0) && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No finishing calculators yet. Click &quot;Add Finishing&quot; to create one.
        </div>
      )}

      {(calcs || []).map((calc) => (
        <FinishingCalculatorCard key={calc.id} calc={calc} onMutate={mutate} />
      ))}
    </div>
  )
}

// ---------- SINGLE CARD ----------
function FinishingCalculatorCard({
  calc,
  onMutate,
}: {
  calc: FinishingCalculator
  onMutate: () => void
}) {
  const { data: rates } = useSWR<FinishingGlobalRates>("/api/finishing-global-rates", fetcher)
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState<Partial<FinishingCalculator>>({})

  const merged = { ...calc, ...form }

  const update = (key: string, value: unknown) => {
    setForm((p) => ({ ...p, [key]: value }))
  }

  const isDirty = Object.keys(form).length > 0

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await fetch(`/api/finishing-calculators/${calc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      onMutate()
      setForm({})
    } finally {
      setSaving(false)
    }
  }, [calc.id, form, onMutate])

  const handleDelete = useCallback(async () => {
    if (!confirm(`Delete "${calc.name}"?`)) return
    setDeleting(true)
    try {
      await fetch(`/api/finishing-calculators/${calc.id}`, { method: "DELETE" })
      onMutate()
    } finally {
      setDeleting(false)
    }
  }, [calc.id, calc.name, onMutate])

  const toggleTarget = (target: CalculatorTarget) => {
    const current = merged.enabled_calculators || []
    const next = current.includes(target)
      ? current.filter((t) => t !== target)
      : [...current, target]
    update("enabled_calculators", next)
  }

  // Preview calculation with 1000 items
  const preview =
    rates && calculateFinishingTotal(merged as FinishingCalculator, rates, 1000, false)

  return (
    <Card className={`transition-colors ${!merged.is_active ? "opacity-60" : ""}`}>
      {/* Collapsed header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Calculator className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-semibold text-foreground truncate">{merged.name}</span>
            <Badge variant="outline" className="text-[9px] px-1.5 shrink-0">
              {merged.apply_per === "cut_item" ? "Per Cut Item" : "Per Parent Sheet"}
            </Badge>
            {!merged.is_active && (
              <Badge variant="secondary" className="text-[9px] px-1.5">Inactive</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {(merged.enabled_calculators || []).map((t) => (
              <Badge key={t} className="text-[9px] px-1.5 bg-primary/10 text-primary border-0">
                {CALCULATOR_TARGET_LABELS[t]}
              </Badge>
            ))}
            {(merged.enabled_calculators || []).length === 0 && (
              <span className="text-[10px] text-muted-foreground">Not pushed to any calculator</span>
            )}
          </div>
        </div>
        {preview && (
          <span className="text-xs font-mono text-muted-foreground shrink-0">
            {formatCurrency(preview.total)}/1k
          </span>
        )}
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </div>

      {/* Expanded form */}
      {expanded && (
        <CardContent className="pt-0 pb-4 flex flex-col gap-4">
          <Separator />

          {/* Row 1: Name, Apply Per, Active */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">Name</label>
              <Input
                value={merged.name}
                onChange={(e) => update("name", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">Apply Per</label>
              <Select
                value={merged.apply_per}
                onValueChange={(v) => update("apply_per", v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cut_item">Per Cut Item</SelectItem>
                  <SelectItem value="parent_sheet">Per Parent Sheet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">Active</label>
              <div className="flex items-center gap-2 h-8">
                <Switch
                  checked={merged.is_active}
                  onCheckedChange={(v) => update("is_active", v)}
                />
                <span className="text-xs text-muted-foreground">
                  {merged.is_active ? "On" : "Off"}
                </span>
              </div>
            </div>
          </div>

          {/* Row 2: Material + Labor */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Material Cost ($/{merged.apply_per === "cut_item" ? "item" : "sheet"})
              </label>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={merged.material_cost}
                onChange={(e) => update("material_cost", parseFloat(e.target.value) || 0)}
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Labor Cost ($/{merged.apply_per === "cut_item" ? "item" : "sheet"})
              </label>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={merged.labor_cost}
                onChange={(e) => update("labor_cost", parseFloat(e.target.value) || 0)}
                className="h-8 text-sm font-mono"
              />
            </div>
          </div>

          {/* Row 3: Setup + Buffer */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Setup Time (min)
              </label>
              <Input
                type="number"
                step="1"
                min="0"
                value={merged.setup_minutes}
                onChange={(e) => update("setup_minutes", parseFloat(e.target.value) || 0)}
                className="h-8 text-sm font-mono"
              />
              <span className="text-[10px] text-muted-foreground">
                At ${rates?.setup_labor_rate ?? 45}/hr
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Setup Buffer (min)
              </label>
              <Input
                type="number"
                step="1"
                min="0"
                value={merged.setup_buffer_minutes}
                onChange={(e) => update("setup_buffer_minutes", parseFloat(e.target.value) || 0)}
                className="h-8 text-sm font-mono"
              />
              <span className="text-[10px] text-muted-foreground">Extra time around setup</span>
            </div>
          </div>

          {/* Row 4: Speed + Running Buffer */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Speed (items/hr)
              </label>
              <Input
                type="number"
                step="1"
                min="0"
                value={merged.speed_per_hour}
                onChange={(e) => update("speed_per_hour", parseFloat(e.target.value) || 0)}
                className="h-8 text-sm font-mono"
              />
              <span className="text-[10px] text-muted-foreground">
                At ${rates?.running_labor_rate ?? 25}/hr
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Running Buffer (min)
              </label>
              <Input
                type="number"
                step="1"
                min="0"
                value={merged.running_buffer_minutes}
                onChange={(e) => update("running_buffer_minutes", parseFloat(e.target.value) || 0)}
                className="h-8 text-sm font-mono"
              />
              <span className="text-[10px] text-muted-foreground">Extra time on running</span>
            </div>
          </div>

          {/* Row 5: Markup */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Markup Multiplier
              </label>
              <Input
                type="number"
                step="0.01"
                min="1"
                value={merged.markup}
                onChange={(e) => update("markup", parseFloat(e.target.value) || 1)}
                className="h-8 text-sm font-mono"
              />
              <span className="text-[10px] text-muted-foreground">
                1.0 = no markup, 1.5 = 50% markup
              </span>
            </div>
          </div>

          <Separator />

          {/* Push to Calculators */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-medium text-muted-foreground">
              Push to Calculators
            </label>
            <div className="flex gap-2 flex-wrap">
              {TARGETS.map((t) => {
                const active = (merged.enabled_calculators || []).includes(t)
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTarget(t)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      active
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {CALCULATOR_TARGET_LABELS[t]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Preview */}
          {preview && (
            <>
              <Separator />
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-[11px] font-medium text-muted-foreground mb-2">
                  Preview (1,000 {merged.apply_per === "cut_item" ? "items" : "sheets"})
                </p>
                <div className="grid grid-cols-5 gap-2 text-xs">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">Material</span>
                    <span className="font-mono font-semibold">{formatCurrency(preview.material)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">Labor</span>
                    <span className="font-mono font-semibold">{formatCurrency(preview.labor)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">Setup</span>
                    <span className="font-mono font-semibold">{formatCurrency(preview.setup)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">Running</span>
                    <span className="font-mono font-semibold">{formatCurrency(preview.running)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-primary font-medium">Total</span>
                    <span className="font-mono font-bold text-primary">{formatCurrency(preview.total)}</span>
                  </div>
                </div>
                {rates && rates.broker_discount > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Broker price: {formatCurrency(
                      calculateFinishingTotal(merged as FinishingCalculator, rates, 1000, true).total
                    )}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="text-destructive hover:text-destructive text-xs gap-1.5"
            >
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Delete
            </Button>
            {isDirty && (
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 text-xs">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Save Changes
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
