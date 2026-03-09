"use client"

import React, { useState, useCallback } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCurrency } from "@/lib/pricing"
import { FinishingCalculatorsSettingsTab } from "@/components/finishing-calculators-settings"
import { PaperWeightsSettingsTab } from "@/components/paper-weights-settings"
import { DEFAULT_FOLD_SETTINGS, type FoldFinishingSettings } from "@/lib/finishing-fold-engine"
import { SuppliersSettings } from "@/components/suppliers-settings"
import { FoldScoreSettingsTab } from "@/components/fold-score-settings"
import { SaddleStitchSettingsTab } from "@/components/saddle-stitch-settings"
import { PerfectBindingSettingsTab } from "@/components/perfect-binding-settings"
import { LaminationSettingsTab } from "@/components/lamination-settings"
import {
  DEFAULT_CLICK_COSTS,
  DEFAULT_PAPER_PRICES,
  DEFAULT_BOOKLET_PAPER_PRICES,
  DEFAULT_MARKUPS,
  DEFAULT_FINISHING_OPTIONS,
  DEFAULT_SCORE_FOLD_CONFIG,
  applyOverrides,
  getActiveConfig,
  type FinishingOption,
  type ScoreFoldConfig,
  type ScoreFoldEntry,
  type EnvelopeSettings,
  type AddressingConfig,
  type AddressingBracket,
  DEFAULT_ADDRESSING_CONFIG,
  type TabbingConfig,
  DEFAULT_TABBING_CONFIG,
  DEFAULT_SORT_LEVEL_MIX,
  sortMixKey,
  type SortLevelMixConfig,
} from "@/lib/pricing-config"
import {
  DEFAULT_ENVELOPE_SETTINGS,
  type InkJetPrintType,
  type LaserPrintType,
} from "@/lib/envelope-pricing"
import {
  Settings,
  X,
  Plus,
  Save,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  DollarSign,
  AlertTriangle,
  GripVertical,
  Lock,
  Palette,
  ListPlus,
  Wrench,
  CreditCard,
  Activity,
  Calculator,
  Database,
  KeyRound,
  CheckCircle2,
  XCircle,
  RefreshCw,
  HardDrive,
  ShieldAlert,
  Info,
  Package,
  Users,
  UserPlus,
  Search,
  Mail,
  Boxes,
  Scale,
  MessageSquare,
  Eye,
  Clock,
} from "lucide-react"

// ---------- types ----------
export interface LaborItem {
  name: string
  rate: number
  per_unit: "per_piece" | "per_1000" | "per_500" | "per_job" | string
  required: boolean
  enabled: boolean
  note: string
}

export interface MailClassSetting {
  id: string
  class_name: string
  items: LaborItem[]
  notes: string | null
  created_at: string
  updated_at: string
}

const PER_UNIT_OPTIONS: { value: string; label: string }[] = [
  { value: "per_piece", label: "Per Piece" },
  { value: "per_1000", label: "Per 1,000" },
  { value: "per_500", label: "Per 500" },
  { value: "per_job", label: "Per Job (Flat)" },
]

export function perUnitLabel(pu: string): string {
  return PER_UNIT_OPTIONS.find((o) => o.value === pu)?.label ?? pu
}

const SWR_KEY = "/api/mail-class-settings"
const fetcher = (url: string) => fetch(url).then((r) => r.json())

// ---------- nav config ----------
type SettingsTab =
  | "pricing" | "paper-weights" | "finishings" | "finishing-calcs" | "fold-score" | "saddle-stitch" | "perfect-binding" | "lamination"
  | "labor" | "departments" | "envelopes" | "addressing" | "sort-mix" | "dont-forget"
  | "items" | "supplies" | "steps"
  | "fields" | "terms" | "team" | "system"

interface SettingsNavGroup {
  label: string
  items: { id: SettingsTab; label: string; icon: React.ReactNode; description: string }[]
}

const SETTINGS_NAV: SettingsNavGroup[] = [
  {
    label: "Pricing Engine",
    items: [
      { id: "pricing", label: "Click & Paper Costs", icon: <DollarSign className="h-4 w-4" />, description: "Click costs, paper prices, markup levels" },
      { id: "paper-weights", label: "Paper Weights", icon: <Scale className="h-4 w-4" />, description: "Weight per 1,000 sheets, thickness" },
      { id: "finishings", label: "Finishings", icon: <Wrench className="h-4 w-4" />, description: "Score, fold, lamination options" },
      { id: "finishing-calcs", label: "Finishing Calculators", icon: <Calculator className="h-4 w-4" />, description: "Custom finishing cost builders" },
      { id: "fold-score", label: "Fold & Score", icon: <Wrench className="h-4 w-4" />, description: "Fold and score pricing parameters" },
      { id: "saddle-stitch", label: "Saddle Stitch", icon: <Wrench className="h-4 w-4" />, description: "Saddle stitch binding rates" },
      { id: "perfect-binding", label: "Perfect Binding", icon: <Wrench className="h-4 w-4" />, description: "Perfect bound book binding rates" },
      { id: "lamination", label: "Lamination", icon: <Wrench className="h-4 w-4" />, description: "Lamination pricing by type" },
    ],
  },
  {
    label: "Operations",
    items: [
      { id: "labor", label: "Labor Rates", icon: <Wrench className="h-4 w-4" />, description: "Mail class labor costs" },
      { id: "departments", label: "Departments", icon: <Palette className="h-4 w-4" />, description: "Color-coded department tags" },
      { id: "envelopes", label: "Envelopes", icon: <Mail className="h-4 w-4" />, description: "Envelope pricing, ink-jet, laser" },
      { id: "addressing", label: "Addressing & Tabbing", icon: <Mail className="h-4 w-4" />, description: "Addressing brackets, tabbing rates" },
      { id: "sort-mix", label: "Sort Mix", icon: <Mail className="h-4 w-4" />, description: "USPS sort level mix ratios" },
      { id: "dont-forget", label: "Don't Forget", icon: <AlertTriangle className="h-4 w-4" />, description: "Checklist items per mailing class" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { id: "items", label: "Item Database", icon: <Package className="h-4 w-4" />, description: "Reusable items catalog" },
      { id: "supplies", label: "Suppliers & Supplies", icon: <Boxes className="h-4 w-4" />, description: "Vendors, costs, list rentals" },
      { id: "steps", label: "Job Steps", icon: <ListPlus className="h-4 w-4" />, description: "Workflow step configuration" },
    ],
  },
  {
    label: "System",
    items: [
      { id: "fields", label: "Custom Fields", icon: <ListPlus className="h-4 w-4" />, description: "Customer & contact fields" },
      { id: "terms", label: "Payment Terms", icon: <CreditCard className="h-4 w-4" />, description: "Net terms, due dates" },
      { id: "team", label: "Team", icon: <Users className="h-4 w-4" />, description: "Team members and roles" },
      { id: "system", label: "System Health", icon: <Activity className="h-4 w-4" />, description: "Database, storage, diagnostics" },
    ],
  },
]

const SETTINGS_CONTENT: Record<SettingsTab, () => React.ReactNode> = {
  pricing: () => <PricingSettingsTab />,
  "paper-weights": () => <PaperWeightsSettingsTab />,
  finishings: () => <FinishingsSettingsTab />,
  "finishing-calcs": () => <FinishingCalculatorsSettingsTab />,
  "fold-score": () => <FoldScoreSettingsTab />,
  "saddle-stitch": () => <SaddleStitchSettingsTab />,
  "perfect-binding": () => <PerfectBindingSettingsTab />,
  "lamination": () => <LaminationSettingsTab />,
  labor: () => <LaborRatesTab />,
  departments: () => <DepartmentsTab />,
  envelopes: () => <EnvelopeSettingsTab />,
  addressing: () => (
    <>
      <AddressingBracketsSettings />
      <div className="mt-8 border-t border-border pt-8">
        <TabbingBracketsSettings />
      </div>
    </>
  ),
  "sort-mix": () => <SortMixTab />,
  "dont-forget": () => <DontForgetSettingsTab />,
  items: () => <ItemsSettingsTab />,
  supplies: () => <SuppliersSettings />,
  steps: () => <JobStepsTab />,
  fields: () => <CustomFieldsTab />,
  terms: () => <PaymentTermsTab />,
  team: () => <TeamTab />,
  system: () => <SystemDashboardTab />,
}

// ---------- main panel ----------
export function MailClassSettingsPanel({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("pricing")
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Find the active item metadata for the header
  const activeItem = SETTINGS_NAV.flatMap((g) => g.items).find((i) => i.id === activeTab)

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Top bar */}
      <header className="flex items-center h-14 px-4 lg:px-6 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Mobile nav toggle -- shows current section name so it's clear it's tappable */}
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="lg:hidden flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-secondary min-h-[44px] border border-border"
            aria-label="Toggle settings navigation"
          >
            <Settings className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">{activeItem?.label || "Settings"}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </button>
          <div className="hidden lg:flex items-center justify-center h-9 w-9 rounded-lg bg-foreground">
            <Settings className="h-4 w-4 text-background" />
          </div>
          <div className="min-w-0 hidden lg:block">
            <h1 className="text-base font-bold text-foreground truncate">Settings</h1>
            <p className="text-xs text-muted-foreground truncate">
              {activeItem?.description || "Configure your system"}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          className="gap-2 h-9 text-sm shrink-0 min-w-[44px]"
        >
          <X className="h-4 w-4" />
          <span className="hidden sm:inline">Close</span>
        </Button>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Mobile nav overlay */}
        {mobileNavOpen && (
          <div
            className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
        )}

        {/* Left sidebar nav */}
        <aside className={cn(
          "bg-card border-r border-border flex flex-col shrink-0 overflow-y-auto",
          // Desktop: always visible
          "hidden lg:flex w-64",
        )}>
          <nav className="flex-1 px-3 py-4 flex flex-col gap-5">
            {SETTINGS_NAV.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-3 mb-2">
                  {group.label}
                </p>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const active = activeTab === item.id
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left min-h-[44px]",
                          active
                            ? "bg-foreground text-background font-semibold"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                        )}
                      >
                        <span className={cn("shrink-0", active ? "text-background" : "text-muted-foreground")}>
                          {item.icon}
                        </span>
                        <span className="text-sm truncate">{item.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Mobile sidebar overlay panel */}
        {mobileNavOpen && (
          <aside className="fixed left-0 top-14 bottom-0 w-72 bg-card border-r border-border z-50 flex flex-col lg:hidden animate-in slide-in-from-left-2 duration-200 overflow-y-auto">
            <nav className="flex-1 px-3 py-4 flex flex-col gap-5">
              {SETTINGS_NAV.map((group) => (
                <div key={group.label}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-3 mb-2">
                    {group.label}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const active = activeTab === item.id
                      return (
                        <button
                          key={item.id}
                          onClick={() => { setActiveTab(item.id); setMobileNavOpen(false) }}
                          className={cn(
                            "flex items-start gap-3 px-3 py-3 rounded-lg transition-all text-left min-h-[44px]",
                            active
                              ? "bg-foreground text-background font-semibold"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                          )}
                        >
                          <span className={cn("shrink-0 mt-0.5", active ? "text-background" : "text-muted-foreground")}>
                            {item.icon}
                          </span>
                          <div className="min-w-0">
                            <span className="text-sm block truncate">{item.label}</span>
                            <span className={cn(
                              "text-[11px] block truncate mt-0.5",
                              active ? "text-background/70" : "text-muted-foreground/70"
                            )}>
                              {item.description}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
            {/* Content header */}
            <div className="mb-6 lg:mb-8">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-muted-foreground">{activeItem?.icon}</span>
                <h2 className="text-lg lg:text-xl font-bold text-foreground">{activeItem?.label}</h2>
              </div>
              <p className="text-sm text-muted-foreground ml-7">
                {activeItem?.description}
              </p>
            </div>

            {/* Tab content */}
            {SETTINGS_CONTENT[activeTab]?.()}
          </div>
        </main>
      </div>
    </div>
  )
}

// ---------- LABOR RATES TAB ----------
function LaborRatesTab() {
  const { data: settings, isLoading } = useSWR<MailClassSetting[]>(SWR_KEY, fetcher)
  const [adding, setAdding] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading settings...</span>
        </div>
      )}

      {!isLoading && settings && settings.length === 0 && !adding && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
          <DollarSign className="h-8 w-8 opacity-40" />
          <p className="text-sm">No mail class settings yet.</p>
          <p className="text-xs">Add a USPS mail class to configure its labor costs.</p>
        </div>
      )}

      {settings?.map((s) => (
        <MailClassCard key={s.id} setting={s} />
      ))}

      {adding && (
        <AddMailClassForm
          onDone={() => setAdding(false)}
          existingNames={settings?.map((s) => s.class_name.toLowerCase()) || []}
        />
      )}

      {!adding && (
        <Button variant="outline" className="gap-2 h-10 border-dashed" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" />
          Add USPS Mail Class
        </Button>
      )}
    </div>
  )
}

// ---------- DEPARTMENTS TAB ----------
const PRESET_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899",
  "#6366f1", "#ef4444", "#14b8a6", "#f97316", "#06b6d4",
]

function DepartmentsTab() {
  const { data: appSettings, isLoading } = useSWR<Record<string, unknown>>("/api/app-settings", fetcher)
  const [depts, setDepts] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newDept, setNewDept] = useState("")

  // Load from server
  if (appSettings && !loaded) {
    setDepts((appSettings.department_colors ?? {}) as Record<string, string>)
    setLoaded(true)
  }

  const saveDepts = async () => {
    setSaving(true)
    await fetch("/api/app-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ department_colors: depts }),
    })
    globalMutate("/api/app-settings")
    setSaving(false)
  }

  const addDept = () => {
    if (!newDept.trim() || depts[newDept.trim()]) return
    const usedColors = Object.values(depts)
    const nextColor = PRESET_COLORS.find((c) => !usedColors.includes(c)) || PRESET_COLORS[0]
    setDepts((p) => ({ ...p, [newDept.trim()]: nextColor }))
    setNewDept("")
  }

  const removeDept = (name: string) => {
    setDepts((p) => {
      const copy = { ...p }
      delete copy[name]
      return copy
    })
  }

  const updateColor = (name: string, color: string) => {
    setDepts((p) => ({ ...p, [name]: color }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground text-pretty">
        Departments are used as color-coded tags on customer contacts. Add, rename, or change colors below.
      </p>

      <div className="flex flex-col gap-2">
        {Object.entries(depts).map(([name, color]) => (
          <div key={name} className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <div className="flex gap-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => updateColor(name, c)}
                  className="h-5 w-5 rounded-full border-2 transition-transform"
                  style={{
                    backgroundColor: c,
                    borderColor: c === color ? "var(--foreground)" : "transparent",
                    transform: c === color ? "scale(1.15)" : "scale(1)",
                  }}
                  aria-label={`Set color to ${c}`}
                />
              ))}
            </div>
            <Badge
              variant="secondary"
              className="text-xs font-medium px-2 py-0.5 ml-1"
              style={{ backgroundColor: color + "20", color, borderColor: color + "40" }}
            >
              {name}
            </Badge>
            <div className="flex-1" />
            <button
              onClick={() => removeDept(name)}
              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label={`Remove ${name}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={newDept}
          onChange={(e) => setNewDept(e.target.value)}
          placeholder="New department name..."
          className="h-8 text-sm flex-1"
          onKeyDown={(e) => e.key === "Enter" && addDept()}
        />
        <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={addDept} disabled={!newDept.trim()}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>

      <Button size="sm" className="gap-1.5 text-xs h-9 w-fit" onClick={saveDepts} disabled={saving}>
        <Save className="h-3.5 w-3.5" />
        {saving ? "Saving..." : "Save Departments"}
      </Button>
    </div>
  )
}

// ---------- CUSTOM FIELDS TAB ----------
function CustomFieldsTab() {
  const { data: appSettings, isLoading } = useSWR<Record<string, unknown>>("/api/app-settings", fetcher)
  const [custFields, setCustFields] = useState<{ name: string }[]>([])
  const [contFields, setContFields] = useState<{ name: string }[]>([])
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newCustField, setNewCustField] = useState("")
  const [newContField, setNewContField] = useState("")

  if (appSettings && !loaded) {
    setCustFields((appSettings.customer_custom_fields ?? []) as { name: string }[])
    setContFields((appSettings.contact_custom_fields ?? []) as { name: string }[])
    setLoaded(true)
  }

  const saveFields = async () => {
    setSaving(true)
    await fetch("/api/app-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_custom_fields: custFields,
        contact_custom_fields: contFields,
      }),
    })
    globalMutate("/api/app-settings")
    setSaving(false)
  }

  const addCustField = () => {
    if (!newCustField.trim()) return
    if (custFields.some((f) => f.name.toLowerCase() === newCustField.trim().toLowerCase())) return
    setCustFields((p) => [...p, { name: newCustField.trim() }])
    setNewCustField("")
  }

  const addContField = () => {
    if (!newContField.trim()) return
    if (contFields.some((f) => f.name.toLowerCase() === newContField.trim().toLowerCase())) return
    setContFields((p) => [...p, { name: newContField.trim() }])
    setNewContField("")
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-muted-foreground text-pretty">
        Add custom fields that appear on customer and contact forms. These fields are also included in CSV exports.
      </p>

      {/* Customer fields */}
      <section className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer Fields</h4>
        <div className="flex flex-wrap gap-1.5">
          {custFields.map((f) => (
            <Badge key={f.name} variant="secondary" className="text-xs gap-1 pr-1">
              {f.name}
              <button
                onClick={() => setCustFields((p) => p.filter((x) => x.name !== f.name))}
                className="ml-0.5 p-0.5 rounded hover:bg-destructive/20 hover:text-destructive transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {custFields.length === 0 && (
            <span className="text-xs text-muted-foreground">No custom customer fields</span>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            value={newCustField}
            onChange={(e) => setNewCustField(e.target.value)}
            placeholder="Field name..."
            className="h-8 text-sm flex-1 max-w-xs"
            onKeyDown={(e) => e.key === "Enter" && addCustField()}
          />
          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={addCustField} disabled={!newCustField.trim()}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </section>

      <Separator />

      {/* Contact fields */}
      <section className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact Fields</h4>
        <div className="flex flex-wrap gap-1.5">
          {contFields.map((f) => (
            <Badge key={f.name} variant="secondary" className="text-xs gap-1 pr-1">
              {f.name}
              <button
                onClick={() => setContFields((p) => p.filter((x) => x.name !== f.name))}
                className="ml-0.5 p-0.5 rounded hover:bg-destructive/20 hover:text-destructive transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {contFields.length === 0 && (
            <span className="text-xs text-muted-foreground">No custom contact fields</span>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            value={newContField}
            onChange={(e) => setNewContField(e.target.value)}
            placeholder="Field name..."
            className="h-8 text-sm flex-1 max-w-xs"
            onKeyDown={(e) => e.key === "Enter" && addContField()}
          />
          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={addContField} disabled={!newContField.trim()}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </section>

      <Button size="sm" className="gap-1.5 text-xs h-9 w-fit" onClick={saveFields} disabled={saving}>
        <Save className="h-3.5 w-3.5" />
        {saving ? "Saving..." : "Save Custom Fields"}
      </Button>
    </div>
  )
}

// ---------- single class card ----------
function MailClassCard({ setting }: { setting: MailClassSetting }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [draftItems, setDraftItems] = useState<LaborItem[]>(setting.items)
  const [draftName, setDraftName] = useState(setting.class_name)
  const [draftNotes, setDraftNotes] = useState(setting.notes || "")

  const enabledItems = setting.items.filter((i) => i.enabled)
  const requiredCount = setting.items.filter((i) => i.required).length
  const optionalCount = setting.items.length - requiredCount

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await fetch(`/api/mail-class-settings/${setting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_name: draftName,
          items: draftItems,
          notes: draftNotes || null,
        }),
      })
      globalMutate(SWR_KEY)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }, [draftName, draftItems, draftNotes, setting.id])

  const handleDelete = useCallback(async () => {
    await fetch(`/api/mail-class-settings/${setting.id}`, { method: "DELETE" })
    globalMutate(SWR_KEY)
  }, [setting.id])

  const updateDraftItem = (idx: number, updates: Partial<LaborItem>) => {
    setDraftItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...updates } : item))
    )
  }

  const removeDraftItem = (idx: number) => {
    setDraftItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const addDraftItem = () => {
    setDraftItems((prev) => [
      ...prev,
      {
        name: "",
        rate: 0,
        per_unit: "per_1000",
        required: false,
        enabled: true,
        note: "",
      },
    ])
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header row */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/40 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5">
          <Badge
            variant="secondary"
            className="text-xs font-semibold px-2.5 py-0.5"
          >
            {setting.class_name}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {enabledItems.length} active
            {requiredCount > 0 && ` / ${requiredCount} required`}
            {optionalCount > 0 && ` / ${optionalCount} optional`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-mono">
            {setting.items.length} items
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 bg-card border-t border-border flex flex-col gap-3">
          {/* Class name edit */}
          {editing && (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Class Name
              </label>
              <Input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="h-8 text-sm w-56"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          )}

          {/* Items table */}
          <div className="flex flex-col gap-2">
            {/* Header */}
            <div className="grid grid-cols-[1fr_90px_130px_70px_70px_28px] gap-2 items-center px-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Item Name
              </span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Rate
              </span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Per Unit
              </span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide text-center">
                Required
              </span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide text-center">
                Active
              </span>
              <span />
            </div>

            {/* Items */}
            {(editing ? draftItems : setting.items).map((item, idx) => (
              <div
                key={idx}
                className={`grid grid-cols-[1fr_90px_130px_70px_70px_28px] gap-2 items-center px-1 py-1.5 rounded-md ${
                  !item.enabled ? "opacity-50" : ""
                } ${item.required && item.enabled ? "bg-primary/5" : "bg-muted/30"}`}
              >
                {editing ? (
                  <>
                    <Input
                      value={item.name}
                      onChange={(e) =>
                        updateDraftItem(idx, { name: e.target.value })
                      }
                      placeholder="Item name..."
                      className="h-7 text-xs"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <div className="relative">
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min={0}
                        value={item.rate || ""}
                        onChange={(e) =>
                          updateDraftItem(idx, {
                            rate: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="h-7 text-xs font-mono pl-4 tabular-nums"
                        autoComplete="off"
                      />
                    </div>
                    <Select
                      value={item.per_unit}
                      onValueChange={(v) =>
                        updateDraftItem(idx, { per_unit: v })
                      }
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PER_UNIT_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex justify-center">
                      <Switch
                        checked={item.required}
                        onCheckedChange={(v) =>
                          updateDraftItem(idx, { required: v })
                        }
                        className="scale-75"
                      />
                    </div>
                    <div className="flex justify-center">
                      <Switch
                        checked={item.enabled}
                        onCheckedChange={(v) =>
                          updateDraftItem(idx, { enabled: v })
                        }
                        className="scale-75"
                      />
                    </div>
                    <button
                      onClick={() => removeDraftItem(idx)}
                      className="p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors"
                      aria-label={`Remove ${item.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 min-w-0">
                      {item.required && (
                        <Lock className="h-3 w-3 text-primary flex-shrink-0" />
                      )}
                      <span className="text-xs font-medium text-foreground truncate">
                        {item.name}
                      </span>
                      {item.note && (
                        <span className="text-[9px] text-muted-foreground truncate hidden sm:inline">
                          ({item.note})
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono tabular-nums text-foreground">
                      {formatCurrency(item.rate)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {perUnitLabel(item.per_unit)}
                    </span>
                    <div className="flex justify-center">
                      {item.required ? (
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary"
                        >
                          Req
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1.5 py-0"
                        >
                          Opt
                        </Badge>
                      )}
                    </div>
                    <div className="flex justify-center">
                      {item.enabled ? (
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                      )}
                    </div>
                    <span />
                  </>
                )}
              </div>
            ))}

            {/* Add item button (edit mode) */}
            {editing && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 w-fit text-muted-foreground"
                onClick={addDraftItem}
              >
                <Plus className="h-3 w-3" />
                Add Labor Item
              </Button>
            )}
          </div>

          {/* Notes */}
          {editing ? (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Notes
              </label>
              <textarea
                value={draftNotes}
                onChange={(e) => setDraftNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={2}
                className="w-full text-sm bg-card border border-border rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>
          ) : (
            setting.notes && (
              <p className="text-xs text-muted-foreground italic">
                {setting.notes}
              </p>
            )
          )}

          <Separator />

          {/* Actions */}
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={handleSave}
                  disabled={saving}
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setDraftItems(setting.items)
                    setDraftName(setting.class_name)
                    setDraftNotes(setting.notes || "")
                    setEditing(false)
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setDraftItems(setting.items)
                    setDraftName(setting.class_name)
                    setDraftNotes(setting.notes || "")
                    setEditing(true)
                  }}
                >
                  Edit
                </Button>
                {confirmDelete ? (
                  <div className="flex items-center gap-1 ml-auto">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 text-xs gap-1"
                      onClick={handleDelete}
                    >
                      <AlertTriangle className="h-3 w-3" />
                      Confirm
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground hover:text-destructive ml-auto"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- add new class form ----------
function AddMailClassForm({
  onDone,
  existingNames,
}: {
  onDone: () => void
  existingNames: string[]
}) {
  const [name, setName] = useState("")
  const [items, setItems] = useState<LaborItem[]>([
    {
      name: "Addressing",
      rate: 125,
      per_unit: "per_job",
      required: true,
      enabled: true,
      note: "",
    },
    {
      name: "Computer Work",
      rate: 125,
      per_unit: "per_job",
      required: true,
      enabled: true,
      note: "",
    },
    {
      name: "CASS / 2nd",
      rate: 10,
      per_unit: "per_1000",
      required: true,
      enabled: true,
      note: "",
    },
  ])
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const updateItem = (idx: number, updates: Partial<LaborItem>) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...updates } : item))
    )
  }
  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }
  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        name: "",
        rate: 0,
        per_unit: "per_1000",
        required: false,
        enabled: true,
        note: "",
      },
    ])
  }

  const handleAdd = useCallback(async () => {
    if (!name.trim()) {
      setError("Class name is required")
      return
    }
    if (existingNames.includes(name.toLowerCase().trim())) {
      setError("This class name already exists")
      return
    }
    const validItems = items.filter((i) => i.name.trim())
    if (validItems.length === 0) {
      setError("Add at least one labor item")
      return
    }
    setError("")
    setSaving(true)
    try {
      await fetch("/api/mail-class-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_name: name.trim(),
          items: validItems,
          notes: notes || null,
        }),
      })
      globalMutate(SWR_KEY)
      onDone()
    } finally {
      setSaving(false)
    }
  }, [name, items, notes, existingNames, onDone])

  return (
    <div className="border border-primary/30 border-dashed rounded-lg p-4 bg-primary/5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          New Mail Class
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={onDone}
        >
          Cancel
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="new-class-name"
          className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide"
        >
          Class Name
        </label>
        <Input
          id="new-class-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Flat, Parcel, BPM..."
          autoComplete="off"
          spellCheck={false}
          className="h-9 w-56"
        />
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>

      {/* Items */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-[1fr_90px_130px_70px_70px_28px] gap-2 items-center px-1">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Item Name
          </span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Rate
          </span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Per Unit
          </span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide text-center">
            Required
          </span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide text-center">
            Active
          </span>
          <span />
        </div>

        {items.map((item, idx) => (
          <div
            key={idx}
            className="grid grid-cols-[1fr_90px_130px_70px_70px_28px] gap-2 items-center px-1"
          >
            <Input
              value={item.name}
              onChange={(e) => updateItem(idx, { name: e.target.value })}
              placeholder="Item name..."
              className="h-7 text-xs"
              autoComplete="off"
              spellCheck={false}
            />
            <div className="relative">
              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                value={item.rate || ""}
                onChange={(e) =>
                  updateItem(idx, { rate: parseFloat(e.target.value) || 0 })
                }
                className="h-7 text-xs font-mono pl-4 tabular-nums"
                autoComplete="off"
              />
            </div>
            <Select
              value={item.per_unit}
              onValueChange={(v) => updateItem(idx, { per_unit: v })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PER_UNIT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-center">
              <Switch
                checked={item.required}
                onCheckedChange={(v) => updateItem(idx, { required: v })}
                className="scale-75"
              />
            </div>
            <div className="flex justify-center">
              <Switch
                checked={item.enabled}
                onCheckedChange={(v) => updateItem(idx, { enabled: v })}
                className="scale-75"
              />
            </div>
            <button
              onClick={() => removeItem(idx)}
              className="p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors"
              aria-label={`Remove ${item.name}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 w-fit text-muted-foreground"
          onClick={addItem}
        >
          <Plus className="h-3 w-3" />
          Add Labor Item
        </Button>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes..."
          rows={2}
          className="w-full text-sm bg-card border border-border rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
        />
      </div>

      <Button
        size="sm"
        className="gap-1.5 h-9 w-fit"
        onClick={handleAdd}
        disabled={saving}
      >
        <Plus className="h-3.5 w-3.5" />
        {saving ? "Adding..." : "Add Mail Class"}
      </Button>
    </div>
  )
}

// ---------- PAYMENT TERMS TAB ----------
const APP_SETTINGS_KEY = "/api/app-settings"

function PaymentTermsTab() {
  const { data: settings, mutate } = useSWR<Record<string, unknown>>(APP_SETTINGS_KEY, fetcher)
  const terms = (settings?.payment_terms ?? []) as string[]
  const [newTerm, setNewTerm] = useState("")
  const [saving, setSaving] = useState(false)

  const saveterms = async (updated: string[]) => {
    setSaving(true)
    try {
      await fetch("/api/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_terms: updated }),
      })
      mutate()
    } finally {
      setSaving(false)
    }
  }

  const addTerm = async () => {
    const trimmed = newTerm.trim().toUpperCase()
    if (!trimmed || terms.includes(trimmed)) return
    await saveterms([...terms, trimmed])
    setNewTerm("")
  }

  const removeTerm = async (term: string) => {
    await saveterms(terms.filter((t) => t !== term))
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Payment Terms</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Manage payment terms options available when editing customers. Default is COD.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {terms.map((term) => (
          <div
            key={term}
            className="group flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5"
          >
            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{term}</span>
            {term !== "COD" && (
              <button
                onClick={() => removeTerm(term)}
                className="ml-1 p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                aria-label={`Remove ${term}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={newTerm}
          onChange={(e) => setNewTerm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTerm()}
          placeholder="New term (e.g. NET 60)"
          className="h-9 text-sm w-48"
        />
        <Button
          size="sm"
          className="h-9 gap-1.5 text-xs"
          onClick={addTerm}
          disabled={saving || !newTerm.trim()}
        >
          <Plus className="h-3.5 w-3.5" />
          {saving ? "Adding..." : "Add Term"}
        </Button>
      </div>
    </div>
  )
}

// ---------- SYSTEM DASHBOARD TAB ----------
interface SystemStats {
  connection: boolean
  supabase_url: string | null
  row_counts: Record<string, number>
  total_rows: number
  db_size_bytes: number
  db_size_formatted: string
  table_sizes: { table_name: string; size_bytes: number; size_formatted: string }[]
  env_status: Record<string, { set: boolean; preview: string }>
  warnings: { level: "info" | "warning" | "critical"; message: string }[]
  checked_at: string
}

const TABLE_LABELS: Record<string, string> = {
  customers: "Customers",
  customer_contacts: "Contacts",
  delivery_addresses: "Delivery Addresses",
  quotes: "Quotes",
  mail_class_settings: "Mail Class Settings",
  app_settings: "App Settings",
}

const WARNING_STYLES: Record<string, { bg: string; border: string; icon: string; text: string }> = {
  info: { bg: "bg-blue-500/10", border: "border-blue-500/30", icon: "text-blue-500", text: "text-blue-700 dark:text-blue-300" },
  warning: { bg: "bg-amber-500/10", border: "border-amber-500/30", icon: "text-amber-500", text: "text-amber-700 dark:text-amber-300" },
  critical: { bg: "bg-red-500/10", border: "border-red-500/30", icon: "text-red-500", text: "text-red-700 dark:text-red-300" },
}

// ---------- JOB STEPS TAB ----------
const DEFAULT_STEPS = [
  "Working on Quote",
  "Waiting for Approval",
  "Waiting for Customer Reply",
  "Waiting for List",
  "Ready to Print",
  "Printing in Progress",
  "Prints Arrived",
  "Working on Mailing",
  "Ready to Mail",
  "Out for Delivery",
  "Brand New",
]

function JobStepsTab() {
  const { data: appSettings, isLoading } = useSWR<Record<string, unknown>>("/api/app-settings", fetcher)
  const [steps, setSteps] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newStep, setNewStep] = useState("")

  if (appSettings && !loaded) {
    const saved = appSettings.next_steps as string[] | undefined
    setSteps(saved && saved.length > 0 ? saved : DEFAULT_STEPS)
    setLoaded(true)
  }

  const saveSteps = async () => {
    setSaving(true)
    await fetch("/api/app-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ next_steps: steps }),
    })
    globalMutate("/api/app-settings")
    setSaving(false)
  }

  const addStep = () => {
    if (!newStep.trim()) return
    if (steps.some((s) => s.toLowerCase() === newStep.trim().toLowerCase())) return
    setSteps((p) => [...p, newStep.trim()])
    setNewStep("")
  }

  const removeStep = (idx: number) => setSteps((p) => p.filter((_, i) => i !== idx))

  const moveUp = (idx: number) => {
    if (idx === 0) return
    setSteps((p) => {
      const copy = [...p]
      ;[copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]]
      return copy
    })
  }

  const moveDown = (idx: number) => {
    if (idx >= steps.length - 1) return
    setSteps((p) => {
      const copy = [...p]
      ;[copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]]
      return copy
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground text-pretty">
        Configure the steps / statuses that appear in the Next Step dropdown on every job and quote card.
        Drag to reorder. These are shown to all users.
      </p>

      <div className="flex flex-col gap-1">
        {steps.map((step, idx) => (
          <div key={step} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 group">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
            <span className="text-sm text-foreground flex-1">{step}</span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => moveUp(idx)} disabled={idx === 0}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-20 transition-colors">
                <ChevronUp className="h-3 w-3" />
              </button>
              <button onClick={() => moveDown(idx)} disabled={idx >= steps.length - 1}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-20 transition-colors">
                <ChevronDown className="h-3 w-3" />
              </button>
              <button onClick={() => removeStep(idx)}
                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={newStep}
          onChange={(e) => setNewStep(e.target.value)}
          placeholder="New step name..."
          className="h-8 text-sm flex-1"
          onKeyDown={(e) => e.key === "Enter" && addStep()}
        />
        <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={addStep} disabled={!newStep.trim()}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" className="gap-1.5 text-xs h-9 w-fit" onClick={saveSteps} disabled={saving}>
          <Save className="h-3.5 w-3.5" />
          {saving ? "Saving..." : "Save Steps"}
        </Button>
        <Button variant="outline" size="sm" className="text-xs h-9" onClick={() => setSteps(DEFAULT_STEPS)}>
          Reset to Defaults
        </Button>
      </div>
    </div>
  )
}

function SystemDashboardTab() {
  const { data, error, isLoading, mutate } = useSWR<SystemStats>("/api/system-stats", fetcher)
  const [refreshing, setRefreshing] = useState(false)

  const refresh = async () => {
    setRefreshing(true)
    await mutate()
    setRefreshing(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading system stats...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <XCircle className="h-6 w-6 text-destructive" />
        <p className="text-sm">Failed to load system stats.</p>
        <Button variant="outline" size="sm" className="mt-2 gap-1 text-xs" onClick={refresh}>
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
      </div>
    )
  }

  const DB_LIMIT = 500 * 1024 * 1024 // 500MB free tier
  const dbPercent = data.db_size_bytes > 0 ? Math.min(100, (data.db_size_bytes / DB_LIMIT) * 100) : 0

  return (
    <div className="flex flex-col gap-5">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">System Dashboard</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Last checked: {new Date(data.checked_at).toLocaleString()}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={refresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Warnings */}
      {data.warnings.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {data.warnings.map((w, i) => {
            const style = WARNING_STYLES[w.level] || WARNING_STYLES.info
            return (
              <div
                key={i}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${style.bg} ${style.border}`}
              >
                {w.level === "critical" ? (
                  <ShieldAlert className={`h-4 w-4 mt-0.5 shrink-0 ${style.icon}`} />
                ) : w.level === "warning" ? (
                  <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${style.icon}`} />
                ) : (
                  <Info className={`h-4 w-4 mt-0.5 shrink-0 ${style.icon}`} />
                )}
                <span className={`text-xs ${style.text}`}>{w.message}</span>
              </div>
            )
          })}
        </div>
      )}

      {data.warnings.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <span className="text-xs text-emerald-700 dark:text-emerald-300">
            All systems healthy. No warnings detected.
          </span>
        </div>
      )}

      {/* Connection status */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Database className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Connection</span>
          </div>
          <div className="flex items-center gap-2">
            {data.connection ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
            <span className="text-sm font-semibold text-foreground">
              {data.connection ? "Connected" : "Disconnected"}
            </span>
          </div>
          {data.supabase_url && (
            <p className="text-[10px] text-muted-foreground mt-1 truncate">{data.supabase_url}</p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Database Size</span>
          </div>
          <p className="text-sm font-semibold text-foreground">{data.db_size_formatted}</p>
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                dbPercent > 80
                  ? "bg-red-500"
                  : dbPercent > 50
                    ? "bg-amber-500"
                    : "bg-emerald-500"
              }`}
              style={{ width: `${dbPercent}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {dbPercent.toFixed(1)}% of 500 MB free tier
          </p>
        </div>
      </div>

      {/* Row counts & table sizes */}
      <section>
        <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Data Points ({data.total_rows.toLocaleString()} total rows)
        </h4>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left font-medium text-muted-foreground px-3 py-2">Table</th>
                <th className="text-right font-medium text-muted-foreground px-3 py-2">Rows</th>
                <th className="text-right font-medium text-muted-foreground px-3 py-2">Size</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.row_counts).map(([table, count]) => {
                const sizeInfo = data.table_sizes.find((t) => t.table_name === table)
                return (
                  <tr key={table} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 font-medium text-foreground">
                      {TABLE_LABELS[table] || table}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">
                      {count >= 0 ? count.toLocaleString() : (
                        <span className="text-destructive">Error</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                      {sizeInfo?.size_formatted || "-"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Environment variables */}
      <section>
        <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <KeyRound className="h-3 w-3" /> Environment Variables
        </h4>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left font-medium text-muted-foreground px-3 py-2">Variable</th>
                <th className="text-left font-medium text-muted-foreground px-3 py-2">Status</th>
                <th className="text-left font-medium text-muted-foreground px-3 py-2">Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.env_status).map(([key, info]) => (
                <tr key={key} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-mono text-[10px] text-foreground">{key}</td>
                  <td className="px-3 py-2">
                    {info.set ? (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> Set
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-destructive">
                        <XCircle className="h-3 w-3" /> Missing
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground truncate max-w-[140px]">
                    {info.preview}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

// ---------- PRICING SETTINGS TAB ----------
const LEVEL_LABELS = [
  { level: 1, label: "1 (1+)" },
  { level: 2, label: "2 (10+)" },
  { level: 3, label: "3 (100+)" },
  { level: 4, label: "4 (250+)" },
  { level: 5, label: "5 (1K+)" },
  { level: 6, label: "6 (2K+)" },
  { level: 7, label: "7 (3.5K+)" },
  { level: 8, label: "8 (5K+)" },
  { level: 9, label: "9 (100K+)" },
  { level: 10, label: "10 (1M+)" },
]

type PricingSection = "click" | "flat" | "booklet" | "markups"

function __PLACEHOLDER_REMOVE() {
  void 0 // placeholder -- entire function will be removed
  interface ChatQuote {
    id: string; ref_number: number; customer_name: string; project_name: string;
    product_type: string; total: number; per_unit: number;
    specs: Record<string, unknown>; cost_breakdown: Record<string, unknown>;
    notes: string; created_at: string;
  }
  const [quotes, setQuotes] = useState<ChatQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadQuotes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/chat-quotes")
      if (res.ok) {
        const data = await res.json()
        setQuotes(data)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useState(() => { loadQuotes() })

  const filtered = quotes.filter((q) => {
    const term = searchTerm.toLowerCase()
    if (!term) return true
    return (
      q.customer_name?.toLowerCase().includes(term) ||
      q.project_name?.toLowerCase().includes(term) ||
      q.product_type?.toLowerCase().includes(term) ||
      String(q.ref_number).includes(term)
    )
  })

  const PRODUCT_COLORS: Record<string, string> = {
    flat: "bg-blue-500/15 text-blue-700",
    booklet: "bg-green-500/15 text-green-700",
    perfect: "bg-purple-500/15 text-purple-700",
    spiral: "bg-orange-500/15 text-orange-700",
    pad: "bg-yellow-500/15 text-yellow-700",
    envelope: "bg-pink-500/15 text-pink-700",
  }

  // Helper to format spec keys nicely
  const formatKey = (key: string) =>
    key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()).trim()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Search & refresh */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, project, ref #, or product type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-11 pl-10 text-sm"
          />
        </div>
        <Button variant="outline" size="sm" className="h-11 px-4" onClick={loadQuotes}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Total Quotes</p>
          <p className="text-2xl font-bold text-foreground mt-1">{quotes.length}</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Total Value</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            ${quotes.reduce((sum, q) => sum + Number(q.total || 0), 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">This Month</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {quotes.filter((q) => {
              const d = new Date(q.created_at)
              const now = new Date()
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
            }).length}
          </p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Avg Quote</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            ${quotes.length > 0
              ? (quotes.reduce((sum, q) => sum + Number(q.total || 0), 0) / quotes.length).toFixed(2)
              : "0.00"}
          </p>
        </div>
      </div>

      {/* Quote list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {searchTerm ? "No quotes match your search." : "No chat quotes saved yet. Quotes will appear here when customers save them from the chat."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((q) => {
            const isExpanded = expandedId === q.id
            const specs = q.specs || {}
            const breakdown = q.cost_breakdown || {}
            const productColor = PRODUCT_COLORS[q.product_type] || "bg-muted text-muted-foreground"
            return (
              <div key={q.id} className="rounded-xl border border-border overflow-hidden">
                {/* Header row */}
                <button
                  className={cn(
                    "w-full flex items-center justify-between px-5 py-4 text-left transition-colors min-h-[64px]",
                    isExpanded ? "bg-muted/40" : "hover:bg-muted/20"
                  )}
                  onClick={() => setExpandedId(isExpanded ? null : q.id)}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex items-center justify-center h-11 w-14 rounded-lg bg-foreground shrink-0">
                      <span className="text-xs font-bold text-background">#{q.ref_number}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-foreground truncate">{q.project_name}</p>
                        <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0", productColor)}>
                          {q.product_type}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {q.customer_name || "No name"} &middot; {new Date(q.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {q.per_unit > 0 && <> &middot; ${Number(q.per_unit).toFixed(4)}/ea</>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-base font-bold text-foreground">${Number(q.total).toFixed(2)}</span>
                    {isExpanded
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    }
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/5">
                    {/* Specs section */}
                    <div className="px-5 py-4">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Job Specifications</h4>
                      {Object.keys(specs).length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
                          {Object.entries(specs).map(([key, value]) => (
                            <div key={key}>
                              <p className="text-[11px] text-muted-foreground">{formatKey(key)}</p>
                              <p className="text-sm font-medium text-foreground">
                                {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No specs recorded.</p>
                      )}
                    </div>

                    {/* Cost breakdown section */}
                    {Object.keys(breakdown).length > 0 && (
                      <div className="px-5 py-4 border-t border-border">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Cost Breakdown</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
                          {Object.entries(breakdown).map(([key, value]) => (
                            <div key={key}>
                              <p className="text-[11px] text-muted-foreground">{formatKey(key)}</p>
                              <p className="text-sm font-bold text-foreground">{String(value)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Summary footer */}
                    <div className="px-5 py-4 border-t border-border bg-muted/20 flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-6">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Customer</p>
                          <p className="text-sm font-semibold text-foreground">{q.customer_name || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Date</p>
                          <p className="text-sm font-semibold text-foreground">
                            {new Date(q.created_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                        {q.per_unit > 0 && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Per Unit</p>
                            <p className="text-sm font-semibold text-foreground">${Number(q.per_unit).toFixed(4)}</p>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
                        <p className="text-xl font-bold text-foreground">${Number(q.total).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PricingSettingsTab() {
  const { data: settings, mutate } = useSWR<Record<string, unknown>>("/api/app-settings", fetcher)
  const [section, setSection] = useState<PricingSection>("click")
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Click costs state
  const dbClickCosts = (settings?.pricing_click_costs ?? null) as Record<string, { regular: number; machine: number }> | null
  const [clickCosts, setClickCosts] = useState<Record<string, { regular: number; machine: number }>>({ ...DEFAULT_CLICK_COSTS })

  // Paper prices state
  const dbPaperPrices = (settings?.pricing_paper_prices ?? null) as Record<string, Record<string, number>> | null
  const [flatPrices, setFlatPrices] = useState<Record<string, Record<string, number>>>(structuredClone(DEFAULT_PAPER_PRICES))

  // Booklet paper prices state
  const dbBookletPrices = (settings?.pricing_booklet_paper_prices ?? null) as Record<string, Record<string, number>> | null
  const [bookletPrices, setBookletPrices] = useState<Record<string, Record<string, number>>>(structuredClone(DEFAULT_BOOKLET_PAPER_PRICES))

  // Markup percentages state
  const dbMarkups = (settings?.pricing_markups ?? null) as Record<string, Record<string, number>> | null
  const [markups, setMarkups] = useState<Record<string, Record<number, number>>>(structuredClone(DEFAULT_MARKUPS))

  // Load from DB when settings arrive
  const [loaded, setLoaded] = useState(false)
  if (settings && !loaded) {
    if (dbClickCosts) setClickCosts({ BW: { ...DEFAULT_CLICK_COSTS.BW, ...dbClickCosts.BW }, Color: { ...DEFAULT_CLICK_COSTS.Color, ...dbClickCosts.Color } })
    if (dbPaperPrices) {
      const merged = structuredClone(DEFAULT_PAPER_PRICES)
      for (const [paper, sizes] of Object.entries(dbPaperPrices)) {
        if (merged[paper]) merged[paper] = { ...merged[paper], ...sizes }
      }
      setFlatPrices(merged)
    }
    if (dbBookletPrices) {
      const merged = structuredClone(DEFAULT_BOOKLET_PAPER_PRICES)
      for (const [paper, sizes] of Object.entries(dbBookletPrices)) {
        if (merged[paper]) merged[paper] = { ...merged[paper], ...sizes }
      }
      setBookletPrices(merged)
    }
    if (dbMarkups) {
      const merged = structuredClone(DEFAULT_MARKUPS)
      for (const [cat, levels] of Object.entries(dbMarkups)) {
        if (merged[cat]) {
          for (const [lvl, val] of Object.entries(levels)) {
            merged[cat][parseInt(lvl)] = val as number
          }
        }
      }
      setMarkups(merged)
    }
    setLoaded(true)
  }

  const saveSection = async () => {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {}
      if (section === "click") payload.pricing_click_costs = clickCosts
      if (section === "flat") payload.pricing_paper_prices = flatPrices
      if (section === "booklet") payload.pricing_booklet_paper_prices = bookletPrices
      if (section === "markups") payload.pricing_markups = markups
      await fetch("/api/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      setDirty(false)
      mutate()
      globalMutate("/api/app-settings")
    } finally {
      setSaving(false)
    }
  }

  const resetSection = () => {
    if (section === "click") setClickCosts({ ...DEFAULT_CLICK_COSTS })
    if (section === "flat") setFlatPrices(structuredClone(DEFAULT_PAPER_PRICES))
    if (section === "booklet") setBookletPrices(structuredClone(DEFAULT_BOOKLET_PAPER_PRICES))
    if (section === "markups") setMarkups(structuredClone(DEFAULT_MARKUPS))
    setDirty(true)
  }

  const sections: { key: PricingSection; label: string; description: string }[] = [
    { key: "click", label: "Click Costs", description: "Toner/ink and machine wear cost per impression" },
    { key: "flat", label: "Flat Paper Prices", description: "Paper cost per 1,000 sheets for flat printing (flyers, postcards, etc.)" },
    { key: "booklet", label: "Book Paper Prices", description: "Paper cost per 1,000 sheets for saddle-stitch, perfect, and spiral binding" },
    { key: "markups", label: "Markup Levels", description: "Printing markup multipliers by quantity level" },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Section picker */}
      <div className="flex items-center gap-2 flex-wrap">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => { setSection(s.key); setDirty(false) }}
            className={cn(
              "px-4 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px]",
              section === s.key
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Section description */}
      <p className="text-sm text-muted-foreground">
        {sections.find((s) => s.key === section)?.description}
      </p>

      {/* Save / Reset bar */}
      <div className="flex items-center gap-3">
        <Button size="sm" className="h-10 text-sm gap-2 px-5" onClick={saveSection} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
        <Button variant="outline" size="sm" className="h-10 text-sm px-4" onClick={resetSection}>
          Reset to Defaults
        </Button>
        {dirty && <span className="text-xs text-amber-500 font-medium ml-2">Unsaved changes</span>}
      </div>

      <Separator />

      {/* Click Costs */}
      {section === "click" && (
        <div className="flex flex-col gap-4">
          {Object.entries(clickCosts).map(([type, costs]) => (
            <div key={type} className="rounded-xl border border-border p-5">
              <h4 className="text-sm font-bold text-foreground mb-4">{type} Clicks</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Regular (toner/ink)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="0.0001"
                      value={costs.regular}
                      onChange={(e) => {
                        setClickCosts((p) => ({ ...p, [type]: { ...p[type], regular: parseFloat(e.target.value) || 0 } }))
                        setDirty(true)
                      }}
                      className="h-11 text-sm pl-7 text-right"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Machine (wear)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="0.0001"
                      value={costs.machine}
                      onChange={(e) => {
                        setClickCosts((p) => ({ ...p, [type]: { ...p[type], machine: parseFloat(e.target.value) || 0 } }))
                        setDirty(true)
                      }}
                      className="h-11 text-sm pl-7 text-right"
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Total per click: <span className="font-semibold text-foreground">${(costs.regular + costs.machine).toFixed(4)}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Flat Paper Prices */}
      {section === "flat" && (
        <PaperPriceEditor
          prices={flatPrices}
          onChange={(updated) => { setFlatPrices(updated); setDirty(true) }}
          usedBy="Flat printing (flyers, postcards, business cards, etc.)"
        />
      )}

      {/* Booklet Paper Prices */}
      {section === "booklet" && (
        <PaperPriceEditor
          prices={bookletPrices}
          onChange={(updated) => { setBookletPrices(updated); setDirty(true) }}
          usedBy="Saddle-stitch, perfect binding, and spiral binding"
        />
      )}

      {/* Markup Levels */}
      {section === "markups" && (
        <div className="flex flex-col gap-4">
          {Object.entries(markups).map(([category, levels]) => (
            <div key={category} className="rounded-xl border border-border p-5">
              <h4 className="text-sm font-bold text-foreground mb-4">{category} Markup</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {LEVEL_LABELS.map((l) => (
                  <div key={l.level}>
                    <label className="text-[11px] font-medium text-muted-foreground mb-1 block">{l.label}</label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        value={levels[l.level] ?? 0}
                        onChange={(e) => {
                          setMarkups((p) => {
                            const updated = structuredClone(p)
                            updated[category][l.level] = parseFloat(e.target.value) || 0
                            return updated
                          })
                          setDirty(true)
                        }}
                        className="h-10 text-sm text-right pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">x</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Reusable paper price editor -- shows ALL possible sizes per paper, split into
// Regular and Short sections.  Active sizes have a price and editable input.
// Inactive sizes are grayed out with a toggle to activate + set a price.
function PaperPriceEditor({
  prices,
  onChange,
  usedBy,
}: {
  prices: Record<string, Record<string, number>>
  onChange: (updated: Record<string, Record<string, number>>) => void
  usedBy: string
}) {
  const [expandedPaper, setExpandedPaper] = useState<string | null>(null)

  const ALL_REGULAR: string[] = ["8.5x11", "11x17", "12x18", "12.5x19", "13x19", "13x26"]
  const ALL_SHORT: string[] = ["Short 11x17", "Short 12x18", "Short 12.5x19"]

  const toggleSize = (paper: string, size: string, active: boolean) => {
    const updated = structuredClone(prices)
    if (active) {
      // Activate with a default price of 0
      if (!updated[paper]) updated[paper] = {}
      updated[paper][size] = 0
    } else {
      // Deactivate -- remove the size
      delete updated[paper][size]
    }
    onChange(updated)
  }

  const updatePrice = (paper: string, size: string, per1000: number) => {
    const updated = structuredClone(prices)
    updated[paper][size] = per1000 / 1000
    onChange(updated)
  }

  /** Render a single size row (active or inactive) */
  const renderSizeRow = (paper: string, size: string) => {
    const isActive = prices[paper]?.[size] !== undefined
    const pricePerSheet = prices[paper]?.[size] ?? 0

    return (
      <div key={size} className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
        isActive ? "border-border bg-background" : "border-dashed border-border/50 bg-muted/20"
      )}>
        <Switch
          checked={isActive}
          onCheckedChange={(checked) => toggleSize(paper, size, checked)}
          className="shrink-0 scale-[0.85]"
          aria-label={`Toggle ${size} for ${paper}`}
        />
        <span className={cn(
          "text-xs font-medium min-w-[80px] shrink-0",
          isActive ? "text-foreground" : "text-muted-foreground/60"
        )}>
          {size}
        </span>
        {isActive ? (
          <div className="flex items-center gap-2 flex-1 justify-end">
            <div className="relative max-w-[140px] w-full">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
              <Input
                type="number"
                step="0.01"
                value={Math.round(pricePerSheet * 1000 * 100) / 100}
                onChange={(e) => updatePrice(paper, size, parseFloat(e.target.value) || 0)}
                className="h-8 text-xs pl-6 pr-10 text-right"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">/1K</span>
            </div>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap w-[72px] text-right">
              {"$"}{pricePerSheet.toFixed(4)}/sh
            </span>
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground/40 italic ml-auto">Inactive</span>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Used by: {usedBy}. Prices shown are <span className="font-semibold text-foreground">per 1,000 sheets</span>.
        Toggle inactive sizes on when that paper size becomes available.
      </p>
      <div className="flex flex-col gap-2">
        {Object.keys(prices).map((paper) => {
          const sizes = prices[paper] || {}
          const isExpanded = expandedPaper === paper
          const activeSizes = Object.keys(sizes)
          const totalPossible = ALL_REGULAR.length + ALL_SHORT.length
          const activeCount = activeSizes.length
          const cheapest = activeCount > 0 ? Math.min(...Object.values(sizes)) * 1000 : 0
          const hasShortSizes = ALL_SHORT.some((s) => sizes[s] !== undefined)

          return (
            <div key={paper} className="rounded-xl border border-border overflow-hidden">
              <button
                className={cn(
                  "w-full flex items-center justify-between px-5 py-4 text-left transition-colors min-h-[56px]",
                  isExpanded ? "bg-muted/40" : "hover:bg-muted/20"
                )}
                onClick={() => setExpandedPaper(isExpanded ? null : paper)}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-foreground">{paper}</span>
                  <span className="text-xs text-muted-foreground">
                    {activeCount} of {totalPossible} sizes active
                    {activeCount > 0 && <> &middot; from {"$"}{cheapest.toFixed(2)}/1K</>}
                    {hasShortSizes && <> &middot; <span className="text-amber-600 dark:text-amber-400 font-medium">has Short</span></>}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {isExpanded
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  }
                </div>
              </button>
              {isExpanded && (
                <div className="px-5 pb-5 pt-3 border-t border-border bg-muted/10">
                  {/* Regular Sizes */}
                  <div className="mb-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">
                      Regular Sizes
                    </h4>
                    <div className="flex flex-col gap-1.5">
                      {ALL_REGULAR.map((size) => renderSizeRow(paper, size))}
                    </div>
                  </div>

                  {/* Short Sheets */}
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-2">
                      Short Sheets
                    </h4>
                    <div className="flex flex-col gap-1.5">
                      {ALL_SHORT.map((size) => renderSizeRow(paper, size))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- ITEMS DATABASE TAB ----------

interface DbItem {
  id: string
  name: string
  description: string
  sku: string
  unit_cost: number
  unit_label: string
  category: string
  labor_class_id: string | null
  created_at: string
  updated_at: string
}

const ITEM_CATEGORIES = ["General", "Envelopes", "Paper Stock", "Ink / Toner", "Packaging", "Postage Supplies", "Labels", "Hardware", "Services"]

function ItemsSettingsTab() {
  const { data: items, isLoading, mutate: mutateItems } = useSWR<DbItem[]>("/api/items", fetcher)
  const { data: laborClasses } = useSWR<MailClassSetting[]>(SWR_KEY, fetcher)
  const [saving, setSaving] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>("all")

  const filtered = (items || []).filter((i) => filterCategory === "all" || i.category === filterCategory)
  const categories = Array.from(new Set((items || []).map((i) => i.category))).sort()

  const addItem = async () => {
    setSaving("new")
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Item", category: filterCategory !== "all" ? filterCategory : "General" }),
      })
      const newItem = await res.json()
      mutateItems()
      setExpandedId(newItem.id)
    } finally { setSaving(null) }
  }

  const updateItem = async (id: string, updates: Partial<DbItem>) => {
    setSaving(id)
    try {
      await fetch(`/api/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      mutateItems()
    } finally { setSaving(null) }
  }

  const deleteItem = async (id: string) => {
    await fetch(`/api/items/${id}`, { method: "DELETE" })
    mutateItems()
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Item Database</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Build a reusable catalog of items (envelopes, paper, supplies). Link items to labor classes so they auto-import, or add them individually to any quote.
        </p>
      </div>

      {/* Actions bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" className="h-7 text-xs gap-1" onClick={addItem} disabled={saving === "new"}>
          <Plus className="h-3 w-3" /> {saving === "new" ? "Adding..." : "Add Item"}
        </Button>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="h-7 text-xs w-[140px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {[...new Set([...ITEM_CATEGORIES, ...categories])].sort().map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-[10px] text-muted-foreground ml-auto">{filtered.length} item{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading items...</span>
        </div>
      )}

      {/* Items list */}
      <div className="flex flex-col gap-1.5">
        {filtered.map((item) => {
          const isExpanded = expandedId === item.id
          const isSaving = saving === item.id
          const linkedClass = laborClasses?.find((c) => c.id === item.labor_class_id)
          return (
            <div key={item.id} className="rounded-lg border border-border">
              <button
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-semibold text-foreground truncate">{item.name}</span>
                  <Badge variant="outline" className="text-[9px] shrink-0">{item.category}</Badge>
                  {linkedClass && <Badge variant="secondary" className="text-[9px] shrink-0">{linkedClass.class_name}</Badge>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-muted-foreground font-medium">
                    ${Number(item.unit_cost).toFixed(2)} / {item.unit_label}
                  </span>
                  {isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                </div>
              </button>

              {isExpanded && (
                <ItemEditForm
                  item={item}
                  laborClasses={laborClasses || []}
                  isSaving={isSaving}
                  onSave={(updates) => updateItem(item.id, updates)}
                  onDelete={() => deleteItem(item.id)}
                />
              )}
            </div>
          )
        })}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No items yet</p>
            <p className="text-xs mt-1">Click "Add Item" to create your first catalog item.</p>
          </div>
        )}
      </div>
    </div>
  )
}

/** Inline edit form for a single item */
function ItemEditForm({
  item,
  laborClasses,
  isSaving,
  onSave,
  onDelete,
}: {
  item: DbItem
  laborClasses: MailClassSetting[]
  isSaving: boolean
  onSave: (updates: Partial<DbItem>) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(item.name)
  const [description, setDescription] = useState(item.description)
  const [sku, setSku] = useState(item.sku)
  const [unitCost, setUnitCost] = useState(String(item.unit_cost))
  const [unitLabel, setUnitLabel] = useState(item.unit_label)
  const [category, setCategory] = useState(item.category)
  const [laborClassId, setLaborClassId] = useState(item.labor_class_id || "none")

  const handleSave = () => {
    onSave({
      name,
      description,
      sku,
      unit_cost: parseFloat(unitCost) || 0,
      unit_label: unitLabel,
      category,
      labor_class_id: laborClassId === "none" ? null : laborClassId,
    })
  }

  return (
    <div className="px-3 pb-3 border-t border-border pt-3 flex flex-col gap-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="flex flex-col gap-1 col-span-2">
          <label className="text-[10px] font-medium text-muted-foreground">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-7 text-xs" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-muted-foreground">SKU</label>
          <Input value={sku} onChange={(e) => setSku(e.target.value)} className="h-7 text-xs" placeholder="Optional" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-muted-foreground">Category</label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ITEM_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-muted-foreground">Unit Cost ($)</label>
          <Input type="number" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="h-7 text-xs" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-muted-foreground">Unit Label</label>
          <Select value={unitLabel} onValueChange={setUnitLabel}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="each">Each</SelectItem>
              <SelectItem value="per 1000">Per 1,000</SelectItem>
              <SelectItem value="per 500">Per 500</SelectItem>
              <SelectItem value="box">Box</SelectItem>
              <SelectItem value="roll">Roll</SelectItem>
              <SelectItem value="ream">Ream</SelectItem>
              <SelectItem value="sheet">Sheet</SelectItem>
              <SelectItem value="sqft">Sq Ft</SelectItem>
              <SelectItem value="flat">Flat (per job)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1 col-span-2">
          <label className="text-[10px] font-medium text-muted-foreground">Linked Labor Class</label>
          <Select value={laborClassId} onValueChange={setLaborClassId}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (General)</SelectItem>
              {laborClasses.map((lc) => (
                <SelectItem key={lc.id} value={lc.id}>{lc.class_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-medium text-muted-foreground">Description</label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-7 text-xs" placeholder="Optional notes about this item" />
      </div>

      <div className="flex items-center justify-between pt-1">
        <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={onDelete}>
          <Trash2 className="h-3 w-3" /> Delete
        </Button>
        <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSave} disabled={isSaving}>
          <Save className="h-3 w-3" /> {isSaving ? "Saving..." : "Save Item"}
        </Button>
      </div>
    </div>
  )
}

// ---------- FINISHINGS SETTINGS TAB ----------

const FOLD_TYPE_LABELS: Record<string, string> = { foldInHalf: "Half", foldIn3: "Tri", foldIn4: "Quad", gateFold: "Gate" }
const PAPER_CATS = ["80text", "100text", "cardstock"] as const
const FOLD_SIZES = ["11x17", "8.5x11", "8.5x5.5"] as const
const FOLD_TYPES = ["foldInHalf", "foldIn3", "foldIn4", "gateFold"] as const
const SETUP_OPTIONS = ["N/A", "hand fold", "Level 1", "Level 2", "Level 3", "Level 4", "Level 5"]

function FinishingsSettingsTab() {
  const { data: settings, mutate } = useSWR<Record<string, unknown>>("/api/app-settings", fetcher)
  const [saving, setSaving] = useState(false)

  // --- Sheet finishings state ---
  const dbFinishings = (settings?.pricing_finishings ?? null) as FinishingOption[] | null
  const [finishings, setFinishings] = useState<FinishingOption[]>(structuredClone(DEFAULT_FINISHING_OPTIONS))
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sheetDirty, setSheetDirty] = useState(false)

  // --- Score & Fold state ---
  const dbScoreFold = (settings?.pricing_score_fold ?? null) as ScoreFoldConfig | null
  const [scoreFold, setScoreFold] = useState<ScoreFoldConfig>(structuredClone(DEFAULT_SCORE_FOLD_CONFIG))
  const [sfDirty, setSfDirty] = useState(false)
  const [sfActiveOp, setSfActiveOp] = useState<"folding" | "scoring">("folding")

  // --- Fold Finishing Settings state ---
  const dbFoldSettings = (settings?.fold_finishing_settings ?? null) as FoldFinishingSettings | null
  const [foldSettings, setFoldSettings] = useState<FoldFinishingSettings>(structuredClone(DEFAULT_FOLD_SETTINGS))
  const [foldDirty, setFoldDirty] = useState(false)

  const [loaded, setLoaded] = useState(false)
  if (settings && !loaded) {
    if (dbFinishings && dbFinishings.length > 0) setFinishings(structuredClone(dbFinishings))
    if (dbScoreFold) setScoreFold(structuredClone(dbScoreFold))
    if (dbFoldSettings) setFoldSettings(structuredClone(dbFoldSettings))
    setLoaded(true)
  }

  // ---------- Sheet Finishing helpers ----------
  const saveSheetFinishings = async (updated: FinishingOption[]) => {
    setSaving(true)
    try {
      await fetch("/api/app-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pricing_finishings: updated }) })
      setSheetDirty(false)
      mutate()
      globalMutate("/api/app-settings")
    } finally { setSaving(false) }
  }

  const updateFinishing = (id: string, partial: Partial<FinishingOption>) => {
    setFinishings((prev) => prev.map((f) => (f.id === id ? { ...f, ...partial } : f)))
    setSheetDirty(true)
  }

  const addFinishing = () => {
    const id = "custom_" + Date.now()
    const newF: FinishingOption = {
      id, name: "New Finishing", category: "finishing", setupCost: 10,
      runtimeCosts: { "80Cover": { default: 0.05 }, Cardstock: { default: 0.025 } },
      rollCostPerSheet: 0, rollChangeFee: 0, wastePercent: 0.05, minSheets: 5,
      markupPercent: 225, brokerDiscountPercent: 30, minimumJobPrice: 45, reducesSheetArea: false,
    }
    setFinishings((prev) => [...prev, newF])
    setExpandedId(id)
    setSheetDirty(true)
  }

  const removeFinishing = (id: string) => { setFinishings((prev) => prev.filter((f) => f.id !== id)); setSheetDirty(true) }
  const resetSheetDefaults = () => { setFinishings(structuredClone(DEFAULT_FINISHING_OPTIONS)); setSheetDirty(true) }

  // ---------- Fold Finishing Settings helpers ----------
  const updateFoldSetting = <K extends keyof FoldFinishingSettings>(key: K, val: FoldFinishingSettings[K]) => {
    setFoldSettings((prev) => ({ ...prev, [key]: val }))
    setFoldDirty(true)
  }
  const updateSetupLevel = (level: number, field: "label" | "minutes", val: string | number) => {
    setFoldSettings((prev) => {
      const levels = prev.setupLevels.map((l, i) => i === level ? { ...l, [field]: val } : l)
      return { ...prev, setupLevels: levels }
    })
    setFoldDirty(true)
  }
  const saveFoldSettings = async () => {
    setSaving(true)
    try {
      await fetch("/api/app-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fold_finishing_settings: foldSettings }) })
      setFoldDirty(false)
      mutate()
      globalMutate("/api/app-settings")
    } finally { setSaving(false) }
  }
  const resetFoldDefaults = () => { setFoldSettings(structuredClone(DEFAULT_FOLD_SETTINGS)); setFoldDirty(true) }

  // ---------- Score & Fold helpers ----------
  const saveScoreFold = async (updated: ScoreFoldConfig) => {
    setSaving(true)
    try {
      await fetch("/api/app-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pricing_score_fold: updated }) })
      setSfDirty(false)
      mutate()
      globalMutate("/api/app-settings")
    } finally { setSaving(false) }
  }

  const updateSfGlobal = (partial: Partial<ScoreFoldConfig>) => { setScoreFold((prev) => ({ ...prev, ...partial })); setSfDirty(true) }

  const updateSfEntry = (op: string, paper: string, size: string, fold: string, partial: Partial<ScoreFoldEntry>) => {
    setScoreFold((prev) => {
      const clone = structuredClone(prev)
      const entry = clone.data[op]?.[paper]?.[size]?.[fold]
      if (entry) Object.assign(entry, partial)
      return clone
    })
    setSfDirty(true)
  }

  const updateSfSetupLevel = (level: string, minutes: number) => {
    setScoreFold((prev) => {
      const clone = structuredClone(prev)
      clone.setupLevels[level] = minutes
      return clone
    })
    setSfDirty(true)
  }

  const resetSfDefaults = () => { setScoreFold(structuredClone(DEFAULT_SCORE_FOLD_CONFIG)); setSfDirty(true) }

  return (
    <div className="flex flex-col gap-6">

      {/* ========== SECTION 1: SHEET FINISHINGS ========== */}
      <div className="rounded-lg border border-border">
        <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border rounded-t-lg">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Sheet Finishings</h3>
            <p className="text-[11px] text-muted-foreground">
              Lamination and coatings applied per parent sheet (the big printer sheet).
            </p>
          </div>
          <Badge variant="outline" className="text-[9px]">Per Sheet</Badge>
        </div>

        <div className="p-4 flex flex-col gap-3">
          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => saveSheetFinishings(finishings)} disabled={saving}>
              <Save className="h-3 w-3" /> {saving ? "Saving..." : "Save"}
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addFinishing}>
              <Plus className="h-3 w-3" /> Add
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={resetSheetDefaults}>Reset Defaults</Button>
            {sheetDirty && <span className="text-[10px] text-amber-500 font-medium">Unsaved</span>}
          </div>

          {/* Cards */}
          <div className="flex flex-col gap-2">
            {finishings.map((f) => {
              const isExpanded = expandedId === f.id
              return (
                <div key={f.id} className="rounded-lg border border-border">
                  <button
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : f.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">{f.name}</span>
                      <Badge variant="outline" className="text-[9px]">{f.category}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        Setup: ${f.setupCost} | Markup: {f.markupPercent}% | Min: ${f.minimumJobPrice}
                      </span>
                      {isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 border-t border-border pt-3 flex flex-col gap-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-medium text-muted-foreground">Name</label>
                          <Input value={f.name} onChange={(e) => updateFinishing(f.id, { name: e.target.value })} className="h-7 text-xs" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-medium text-muted-foreground">Category</label>
                          <Select value={f.category} onValueChange={(v) => updateFinishing(f.id, { category: v as "lamination" | "finishing" })}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="lamination">Lamination</SelectItem>
                              <SelectItem value="finishing">Finishing</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-medium text-muted-foreground">Setup Cost ($)</label>
                          <Input type="number" step="0.01" value={f.setupCost} onChange={(e) => updateFinishing(f.id, { setupCost: parseFloat(e.target.value) || 0 })} className="h-7 text-xs" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-medium text-muted-foreground">Min Job Price ($)</label>
                          <Input type="number" step="0.01" value={f.minimumJobPrice} onChange={(e) => updateFinishing(f.id, { minimumJobPrice: parseFloat(e.target.value) || 0 })} className="h-7 text-xs" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-medium text-muted-foreground">Roll Cost / Sheet ($)</label>
                          <Input type="number" step="0.0001" value={f.rollCostPerSheet} onChange={(e) => updateFinishing(f.id, { rollCostPerSheet: parseFloat(e.target.value) || 0 })} className="h-7 text-xs" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-medium text-muted-foreground">Roll Change Fee ($)</label>
                          <Input type="number" step="0.01" value={f.rollChangeFee} onChange={(e) => updateFinishing(f.id, { rollChangeFee: parseFloat(e.target.value) || 0 })} className="h-7 text-xs" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-medium text-muted-foreground">Waste %</label>
                          <Input type="number" step="0.01" value={(f.wastePercent * 100).toFixed(1)} onChange={(e) => updateFinishing(f.id, { wastePercent: (parseFloat(e.target.value) || 0) / 100 })} className="h-7 text-xs" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-medium text-muted-foreground">Min Sheets</label>
                          <Input type="number" step="1" value={f.minSheets} onChange={(e) => updateFinishing(f.id, { minSheets: parseInt(e.target.value) || 1 })} className="h-7 text-xs" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-medium text-muted-foreground">Markup %</label>
                          <Input type="number" step="1" value={f.markupPercent} onChange={(e) => updateFinishing(f.id, { markupPercent: parseFloat(e.target.value) || 0 })} className="h-7 text-xs" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-medium text-muted-foreground">Broker Discount %</label>
                          <Input type="number" step="1" value={f.brokerDiscountPercent} onChange={(e) => updateFinishing(f.id, { brokerDiscountPercent: parseFloat(e.target.value) || 0 })} className="h-7 text-xs" />
                        </div>
                        <div className="flex items-end gap-2 col-span-2">
                          <div className="flex items-center gap-2 h-7">
                            <Switch checked={f.reducesSheetArea} onCheckedChange={(v) => updateFinishing(f.id, { reducesSheetArea: v })} />
                            <span className="text-[10px] text-muted-foreground">Reduces printable area (0.15in margin)</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Runtime Cost / Sheet</h4>
                        <div className="rounded border border-border overflow-hidden">
                          <table className="w-full text-xs">
                            <thead><tr className="bg-muted/50 border-b border-border"><th className="text-left font-medium text-muted-foreground px-2 py-1.5">Category</th><th className="text-right font-medium text-muted-foreground px-2 py-1.5">Cost ($)</th></tr></thead>
                            <tbody>
                              {Object.entries(f.runtimeCosts).map(([cat, costs]) => (
                                <tr key={cat} className="border-b border-border last:border-0">
                                  <td className="px-2 py-1 font-medium text-foreground">{cat}</td>
                                  <td className="px-2 py-1 text-right">
                                    <Input type="number" step="0.0001" value={costs["default"] || Object.values(costs)[0] || 0}
                                      onChange={(e) => { const val = parseFloat(e.target.value) || 0; updateFinishing(f.id, { runtimeCosts: { ...f.runtimeCosts, [cat]: { default: val } } }) }}
                                      className="h-6 text-[10px] w-20 ml-auto text-right" />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={() => removeFinishing(f.id)}>
                          <Trash2 className="h-3 w-3" /> Remove
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ========== SECTION 2: PIECE FINISHINGS (Score & Fold) ========== */}
      <div className="rounded-lg border border-border">
        <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border rounded-t-lg">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Piece Finishings -- Score & Fold</h3>
            <p className="text-[11px] text-muted-foreground">
              Folding and scoring applied per cut piece. Setup levels, runtimes, and cost parameters.
            </p>
          </div>
          <Badge variant="outline" className="text-[9px]">Per Piece</Badge>
        </div>

        <div className="p-4 flex flex-col gap-4">
          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => saveScoreFold(scoreFold)} disabled={saving}>
              <Save className="h-3 w-3" /> {saving ? "Saving..." : "Save"}
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={resetSfDefaults}>Reset Defaults</Button>
            {sfDirty && <span className="text-[10px] text-amber-500 font-medium">Unsaved</span>}
          </div>

          {/* Global cost parameters */}
          <div>
            <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Cost Parameters</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-muted-foreground">Setup Cost / Hr ($)</label>
                <Input type="number" step="1" value={scoreFold.setupCostPerHour} onChange={(e) => updateSfGlobal({ setupCostPerHour: parseFloat(e.target.value) || 0 })} className="h-7 text-xs" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-muted-foreground">Runtime Cost / Hr ($)</label>
                <Input type="number" step="1" value={scoreFold.runtimeCostPerHour} onChange={(e) => updateSfGlobal({ runtimeCostPerHour: parseFloat(e.target.value) || 0 })} className="h-7 text-xs" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-muted-foreground">Machine Charge / Hr ($)</label>
                <Input type="number" step="1" value={scoreFold.machineChargePerHour} onChange={(e) => updateSfGlobal({ machineChargePerHour: parseFloat(e.target.value) || 0 })} className="h-7 text-xs" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-muted-foreground">Min Job Price ($)</label>
                <Input type="number" step="1" value={scoreFold.minimumJobPrice} onChange={(e) => updateSfGlobal({ minimumJobPrice: parseFloat(e.target.value) || 0 })} className="h-7 text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-muted-foreground">Markup %</label>
                <Input type="number" step="1" value={scoreFold.markupPercent} onChange={(e) => updateSfGlobal({ markupPercent: parseFloat(e.target.value) || 0 })} className="h-7 text-xs" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-muted-foreground">Broker Discount %</label>
                <Input type="number" step="1" value={scoreFold.brokerDiscountPercent} onChange={(e) => updateSfGlobal({ brokerDiscountPercent: parseFloat(e.target.value) || 0 })} className="h-7 text-xs" />
              </div>
            </div>
          </div>

          <Separator />

          {/* Setup levels */}
          <div>
            <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Setup Levels (minutes)</h4>
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(scoreFold.setupLevels).map(([level, mins]) => (
                <div key={level} className="flex flex-col gap-1">
                  <label className="text-[10px] font-medium text-muted-foreground">{level}</label>
                  <Input type="number" step="1" value={mins} onChange={(e) => updateSfSetupLevel(level, parseInt(e.target.value) || 0)} className="h-7 text-xs" />
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Data table -- toggle between folding / scoring */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Rate Table</h4>
              <div className="flex rounded-md border border-border overflow-hidden ml-2">
                <button
                  className={`px-3 py-1 text-[10px] font-medium transition-colors ${sfActiveOp === "folding" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setSfActiveOp("folding")}
                >
                  Folding
                </button>
                <button
                  className={`px-3 py-1 text-[10px] font-medium transition-colors border-l border-border ${sfActiveOp === "scoring" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setSfActiveOp("scoring")}
                >
                  Score & Fold
                </button>
              </div>
            </div>

            {/* One table per paper category */}
            {PAPER_CATS.map((paper) => (
              <div key={paper} className="mb-4">
                <h5 className="text-[11px] font-semibold text-foreground mb-1.5 capitalize">
                  {paper === "80text" ? "80 Text" : paper === "100text" ? "100 Text" : "Cardstock"}
                </h5>
                <div className="rounded border border-border overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        <th className="text-left font-medium text-muted-foreground px-2 py-1.5 w-20">Size</th>
                        {FOLD_TYPES.map((ft) => (
                          <th key={ft} className="text-center font-medium text-muted-foreground px-1 py-1.5" colSpan={2}>
                            {FOLD_TYPE_LABELS[ft]}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-muted/30 border-b border-border">
                        <th />
                        {FOLD_TYPES.map((ft) => (
                          <React.Fragment key={ft}>
                            <th className="text-center text-muted-foreground px-1 py-1 font-normal">Setup</th>
                            <th className="text-center text-muted-foreground px-1 py-1 font-normal">Rt/100</th>
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {FOLD_SIZES.map((size) => {
                        return (
                          <tr key={size} className="border-b border-border last:border-0">
                            <td className="px-2 py-1.5 font-medium text-foreground whitespace-nowrap">{size}</td>
                            {FOLD_TYPES.map((ft) => {
                              const entry = scoreFold.data[sfActiveOp]?.[paper]?.[size]?.[ft] || { setup: "N/A", runtime: 0 }
                              const isNA = entry.setup === "N/A"
                              return (
                                <td key={ft + "-s"} colSpan={2} className="px-1 py-1">
                                  <div className="flex items-center gap-1">
                                    <Select
                                      value={entry.setup}
                                      onValueChange={(v) => updateSfEntry(sfActiveOp, paper, size, ft, { setup: v })}
                                    >
                                      <SelectTrigger className={`h-6 text-[10px] w-[70px] ${isNA ? "opacity-50" : ""}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {SETUP_OPTIONS.map((opt) => (
                                          <SelectItem key={opt} value={opt} className="text-[10px]">{opt}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={Math.round(entry.runtime * 60 * 100) / 100}
                                      onChange={(e) => updateSfEntry(sfActiveOp, paper, size, ft, { runtime: (parseFloat(e.target.value) || 0) / 60 })}
                                      disabled={isNA || entry.setup === "hand fold"}
                                      className={`h-6 text-[10px] w-14 text-right ${isNA || entry.setup === "hand fold" ? "opacity-30" : ""}`}
                                    />
                                  </div>
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION 3: Fold & Score Pricing Settings ── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Fold & Score Pricing</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Markup, broker discount, setup levels, and long sheet fee</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetFoldDefaults} className="text-xs h-7">Reset</Button>
            <Button size="sm" onClick={saveFoldSettings} disabled={!foldDirty || saving} className="text-xs h-7">
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        {/* Row 1: Markup + Broker + Long sheet fee */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Markup %</label>
            <Input type="number" step="1" value={foldSettings.markupPercent} onChange={(e) => updateFoldSetting("markupPercent", parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
            <p className="text-[10px] text-muted-foreground">Applied to base cost. E.g., 300 = 4x multiplier</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Broker Discount %</label>
            <Input type="number" step="1" value={foldSettings.brokerDiscountPercent} onChange={(e) => updateFoldSetting("brokerDiscountPercent", parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
            <p className="text-[10px] text-muted-foreground">Off sell price when broker flag is on</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Long Sheet Fee ($)</label>
            <Input type="number" step="1" value={foldSettings.longSheetSetupFee} onChange={(e) => updateFoldSetting("longSheetSetupFee", parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
            <p className="text-[10px] text-muted-foreground">Extra setup for 13x26+ sheets</p>
          </div>
        </div>

        {/* Row 2: Setup Levels */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Setup Levels (minutes per level)</label>
          <div className="grid grid-cols-5 gap-3">
            {foldSettings.setupLevels.map((level, i) => (
              <div key={i} className="space-y-1 rounded-lg border border-border p-2.5">
                <Input value={level.label} onChange={(e) => updateSetupLevel(i, "label", e.target.value)} className="h-7 text-xs font-medium" />
                <div className="flex items-center gap-1">
                  <Input type="number" step="1" value={level.minutes} onChange={(e) => updateSetupLevel(i, "minutes", parseFloat(e.target.value) || 0)} className="h-7 text-xs w-full" />
                  <span className="text-[10px] text-muted-foreground shrink-0">min</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Row 3: Hourly rate + Min job price */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Hourly Rate ($)</label>
            <Input type="number" step="1" value={foldSettings.hourlyRate} onChange={(e) => updateFoldSetting("hourlyRate", parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Min Job Price ($)</label>
            <Input type="number" step="1" value={foldSettings.minimumJobPrice} onChange={(e) => updateFoldSetting("minimumJobPrice", parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Hand Fold Hourly ($)</label>
            <Input type="number" step="1" value={foldSettings.handFoldHourlyRate} onChange={(e) => updateFoldSetting("handFoldHourlyRate", parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Hand Fold $/pc</label>
            <Input type="number" step="0.01" value={foldSettings.handFoldRatePerPiece ?? 0.25} onChange={(e) => updateFoldSetting("handFoldRatePerPiece", parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- TEAM TAB ----------
interface TeamMember {
  id: string
  name: string
  department: string | null
  role: "admin" | "manager" | "member"
  color: string
  is_active: boolean
  created_at: string
}

const ROLE_LABELS: Record<string, { label: string; style: string }> = {
  admin: { label: "Admin", style: "bg-red-50 text-red-700 border-red-200/50 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30" },
  manager: { label: "Manager", style: "bg-amber-50 text-amber-700 border-amber-200/50 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/30" },
  member: { label: "Member", style: "bg-secondary text-muted-foreground border-border" },
}

const MEMBER_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899",
  "#6366f1", "#ef4444", "#14b8a6", "#f97316", "#06b6d4",
  "#84cc16", "#e11d48", "#0ea5e9", "#a855f7", "#22c55e",
]

function TeamTab() {
  const { data: members, isLoading, mutate: mutateTeam } = useSWR<TeamMember[]>("/api/team", fetcher)
  const { data: appSettings } = useSWR<Record<string, unknown>>("/api/app-settings", fetcher)
  const [search, setSearch] = useState("")
  const [filterDept, setFilterDept] = useState("")
  const [filterRole, setFilterRole] = useState("")
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDept, setNewDept] = useState("")
  const [newRole, setNewRole] = useState<"admin" | "manager" | "member">("member")
  const [newColor, setNewColor] = useState(MEMBER_COLORS[0])
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const depts = appSettings?.departments
    ? Object.keys(appSettings.departments as Record<string, string>)
    : []

  const filtered = (members || []).filter((m) => {
    const s = search.toLowerCase()
    if (s && !m.name.toLowerCase().includes(s) && !(m.department || "").toLowerCase().includes(s)) return false
    if (filterDept && m.department !== filterDept) return false
    if (filterRole && m.role !== filterRole) return false
    return true
  })

  const activeCount = (members || []).filter((m) => m.is_active).length

  async function addMember() {
    if (!newName.trim()) return
    setSaving(true)
    await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), department: newDept || null, role: newRole, color: newColor }),
    })
    await mutateTeam()
    setNewName(""); setNewDept(""); setNewRole("member")
    setNewColor(MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)])
    setAdding(false); setSaving(false)
  }

  async function updateMember(id: string, patch: Partial<TeamMember>) {
    await fetch(`/api/team/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
    await mutateTeam()
  }

  async function deleteMember(id: string) {
    if (!confirm("Remove this team member?")) return
    await fetch(`/api/team/${id}`, { method: "DELETE" })
    await mutateTeam()
  }

  if (isLoading) return <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-4">
      {/* Header + Stats */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold text-foreground">Team Members</h3>
          <p className="text-[10px] text-muted-foreground">{activeCount} active member{activeCount !== 1 ? "s" : ""} across {new Set((members || []).map((m) => m.department).filter(Boolean)).size} department{new Set((members || []).map((m) => m.department).filter(Boolean)).size !== 1 ? "s" : ""}</p>
        </div>
        <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setAdding(true)} disabled={adding}>
          <UserPlus className="h-3 w-3" />
          Add Member
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
          <Input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team..."
            className="h-7 pl-7 text-xs"
          />
        </div>
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="h-7 w-auto min-w-[100px] text-xs">
            <SelectValue placeholder="All depts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Depts</SelectItem>
            {depts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="h-7 w-auto min-w-[90px] text-xs">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="member">Member</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Add Member Form */}
      {adding && (
        <div className="rounded-lg border border-primary/30 bg-primary/[0.03] p-3 space-y-3">
          <p className="text-xs font-semibold text-foreground">New Team Member</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium text-muted-foreground">Name *</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" className="h-7 text-xs" autoFocus />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium text-muted-foreground">Department</label>
              <Select value={newDept} onValueChange={setNewDept}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Select dept..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {depts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium text-muted-foreground">Role</label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as "admin" | "manager" | "member")}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium text-muted-foreground">Color</label>
              <div className="flex items-center gap-1 flex-wrap">
                {MEMBER_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={`h-5 w-5 rounded-full border-2 transition-all ${newColor === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={addMember} disabled={!newName.trim() || saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Members List */}
      <div className="space-y-1.5">
        {filtered.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground/50">
            {(members || []).length === 0 ? "No team members yet. Add your first member above." : "No members match your filters."}
          </div>
        )}
        {filtered.map((m) => {
          const roleInfo = ROLE_LABELS[m.role] || ROLE_LABELS.member
          const isEditing = editingId === m.id
          return (
            <div key={m.id} className={`rounded-lg border transition-all ${m.is_active ? "border-border bg-card" : "border-border/50 bg-muted/20 opacity-60"}`}>
              <div className="flex items-center gap-3 px-3 py-2">
                {/* Color dot */}
                <div className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center text-white text-[11px] font-bold" style={{ backgroundColor: m.color }}>
                  {m.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>

                {/* Name + dept */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground truncate">{m.name}</span>
                    <Badge variant="outline" className={`text-[8px] font-semibold border px-1 py-0 ${roleInfo.style}`}>{roleInfo.label}</Badge>
                  </div>
                  {m.department && <p className="text-[10px] text-muted-foreground truncate">{m.department}</p>}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Switch
                    checked={m.is_active}
                    onCheckedChange={(v) => updateMember(m.id, { is_active: v })}
                    className="scale-75"
                  />
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditingId(isEditing ? null : m.id)}>
                    <Settings className="h-3 w-3 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive/60 hover:text-destructive" onClick={() => deleteMember(m.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Inline edit */}
              {isEditing && (
                <div className="px-3 pb-3 pt-1 border-t border-border space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-medium text-muted-foreground">Name</label>
                      <Input defaultValue={m.name} onBlur={(e) => { if (e.target.value !== m.name) updateMember(m.id, { name: e.target.value }) }} className="h-7 text-xs" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-medium text-muted-foreground">Department</label>
                      <Select defaultValue={m.department || "none"} onValueChange={(v) => updateMember(m.id, { department: v === "none" ? null : v } as Partial<TeamMember>)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {depts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-medium text-muted-foreground">Role</label>
                      <Select defaultValue={m.role} onValueChange={(v) => updateMember(m.id, { role: v as "admin" | "manager" | "member" })}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-muted-foreground">Color</label>
                    <div className="flex items-center gap-1 flex-wrap">
                      {MEMBER_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => updateMember(m.id, { color: c })}
                          className={`h-5 w-5 rounded-full border-2 transition-all ${m.color === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- Envelope Settings Tab ----------
function EnvelopeSettingsTab() {
  const { data: appSettings, mutate } = useSWR<Record<string, unknown>>("/api/app-settings", fetcher)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [envSettings, setEnvSettings] = useState<EnvelopeSettings>(
    structuredClone(DEFAULT_ENVELOPE_SETTINGS)
  )

  // Load from DB when settings arrive
  if (appSettings && !loaded) {
    const dbEnv = appSettings.envelope_settings as EnvelopeSettings | undefined
    if (dbEnv) {
      const merged = structuredClone(DEFAULT_ENVELOPE_SETTINGS)
      if (dbEnv.items) merged.items = dbEnv.items
      if (dbEnv.inkjet) merged.inkjet = { ...merged.inkjet, ...dbEnv.inkjet }
      if (dbEnv.laser) merged.laser = { ...merged.laser, ...dbEnv.laser }
      if (dbEnv.customer) merged.customer = { ...merged.customer, ...dbEnv.customer }
      if (dbEnv.fees) merged.fees = { ...merged.fees, ...dbEnv.fees }
      setEnvSettings(merged)
    }
    setLoaded(true)
  }

  const handleChange = useCallback((next: EnvelopeSettings) => {
    setEnvSettings(next)
    setDirty(true)
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await fetch("/api/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ envelope_settings: envSettings }),
      })
      applyOverrides({
        ...(appSettings as Record<string, unknown> ?? {}),
        envelope_settings: envSettings,
      } as Parameters<typeof applyOverrides>[0])
      setDirty(false)
      mutate()
      globalMutate("/api/app-settings")
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setEnvSettings(structuredClone(DEFAULT_ENVELOPE_SETTINGS))
    setDirty(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Envelope Pricing</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure envelope costs, print costs, customer markup, and fees.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={reset}>
            <RefreshCw className="h-3 w-3" />
            Defaults
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1" onClick={save} disabled={!dirty || saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Save
          </Button>
        </div>
      </div>

      {dirty && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Unsaved changes. Click Save to persist.
        </div>
      )}

      <EnvelopeSettingsInlinePanel settings={envSettings} onSettingsChange={handleChange} />
    </div>
  )
}

function EnvelopeSettingsInlinePanel({
  settings,
  onSettingsChange,
}: {
  settings: EnvelopeSettings
  onSettingsChange: (s: EnvelopeSettings) => void
}) {
  const [open, setOpen] = useState<string | null>("env")

  const updateInkjet = (key: string, val: number) => {
    const next = structuredClone(settings)
    next.inkjet[key as InkJetPrintType] = val
    onSettingsChange(next)
  }
  const updateLaser = (key: string, val: number) => {
    const next = structuredClone(settings)
    next.laser[key as LaserPrintType] = val
    onSettingsChange(next)
  }
  const updateCustomer = (key: string, val: number) => {
    const next = structuredClone(settings)
    next.customer[key as "Regular" | "Broker"] = val
    onSettingsChange(next)
  }
  const updateFee = (key: keyof typeof settings.fees, val: number) => {
    const next = structuredClone(settings)
    next.fees[key] = val
    onSettingsChange(next)
  }
  const updateItemCost = (idx: number, val: number) => {
    const next = structuredClone(settings)
    next.items[idx].costPer1000 = val
    onSettingsChange(next)
  }
  const addItem = () => {
    const next = structuredClone(settings)
    next.items.push({ name: "New Envelope", costPer1000: 0, bleed: false })
    onSettingsChange(next)
  }
  const removeItem = (idx: number) => {
    const next = structuredClone(settings)
    if (next.items[idx].name === "Provided stock") return
    next.items.splice(idx, 1)
    onSettingsChange(next)
  }
  const updateItemName = (idx: number, name: string) => {
    const next = structuredClone(settings)
    next.items[idx].name = name
    onSettingsChange(next)
  }
  const toggleBleed = (idx: number) => {
    const next = structuredClone(settings)
    next.items[idx].bleed = !next.items[idx].bleed
    onSettingsChange(next)
  }

  const sections = [
    {
      id: "env",
      title: "Envelope Types & Costs",
      badge: `${settings.items.length} types`,
      content: (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/30">
            <span className="flex-1">Envelope</span>
            <span className="w-24 text-right">Cost / 1,000</span>
            <span className="w-10 text-center">Bleed</span>
            <span className="w-6"></span>
          </div>
          {settings.items.map((item, i) => (
            <div key={`${item.name}-${i}`} className="flex items-center gap-2">
              <Input
                value={item.name}
                onChange={(e) => updateItemName(i, e.target.value)}
                className="h-8 text-xs flex-1"
                disabled={item.name === "Provided stock"}
              />
              <Input
                type="number"
                step="0.01"
                value={item.costPer1000}
                onChange={(e) => updateItemCost(i, parseFloat(e.target.value) || 0)}
                className="h-8 w-24 text-xs font-mono text-right"
                disabled={item.name === "Provided stock"}
              />
              <div className="w-10 flex justify-center">
                <Switch
                  checked={item.bleed}
                  onCheckedChange={() => toggleBleed(i)}
                  className="scale-75"
                  disabled={item.name === "Provided stock"}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-destructive/50 hover:text-destructive"
                onClick={() => removeItem(i)}
                disabled={item.name === "Provided stock"}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1 w-full" onClick={addItem}>
            <Plus className="h-3 w-3" />
            Add Envelope Type
          </Button>
        </div>
      ),
    },
    {
      id: "inkjet",
      title: "InkJet Print Costs",
      badge: "per 1,000",
      content: (
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(settings.inkjet).map(([key, val]) => (
            <div key={key} className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-muted-foreground">{key}</span>
              <Input
                type="number"
                step="0.5"
                value={val}
                onChange={(e) => updateInkjet(key, parseFloat(e.target.value) || 0)}
                className="h-8 text-xs font-mono"
                disabled={key === "Custom"}
              />
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "laser",
      title: "Laser Print Costs",
      badge: "per 1,000",
      content: (
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(settings.laser).map(([key, val]) => (
            <div key={key} className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-muted-foreground">{key}</span>
              <Input
                type="number"
                step="0.5"
                value={val}
                onChange={(e) => updateLaser(key, parseFloat(e.target.value) || 0)}
                className="h-8 text-xs font-mono"
              />
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "markup",
      title: "Customer Markup",
      badge: "multiplier",
      content: (
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(settings.customer).map(([key, val]) => (
            <div key={key} className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-muted-foreground">{key}</span>
              <Input
                type="number"
                step="0.01"
                value={val}
                onChange={(e) => updateCustomer(key, parseFloat(e.target.value) || 0)}
                className="h-8 text-xs font-mono"
              />
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "fees",
      title: "Fees & Minimums",
      content: (
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">Min price (no bleed)</span>
            <Input type="number" step="1" value={settings.fees.minNoBleed} onChange={(e) => updateFee("minNoBleed", parseFloat(e.target.value) || 0)} className="h-8 text-xs font-mono" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">Setup fee (bleed)</span>
            <Input type="number" step="1" value={settings.fees.setupFee} onChange={(e) => updateFee("setupFee", parseFloat(e.target.value) || 0)} className="h-8 text-xs font-mono" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">Bleed markup</span>
            <Input type="number" step="0.01" value={settings.fees.bleedMarkup} onChange={(e) => updateFee("bleedMarkup", parseFloat(e.target.value) || 0)} className="h-8 text-xs font-mono" />
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="rounded-xl border border-border bg-secondary/20 overflow-hidden divide-y divide-border">
      {sections.map((sec) => (
        <div key={sec.id}>
          <button
            type="button"
            onClick={() => setOpen(open === sec.id ? null : sec.id)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground hover:bg-secondary/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              {sec.title}
              {sec.badge && (
                <Badge variant="secondary" className="text-[10px] font-normal">
                  {sec.badge}
                </Badge>
              )}
            </div>
            {open === sec.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {open === sec.id && <div className="px-4 pb-4 pt-1">{sec.content}</div>}
        </div>
      ))}
    </div>
  )
}

// =========== ADDRESSING BRACKETS SETTINGS ===========

function AddressingBracketsSettings() {
  const { data: appSettings, isLoading } = useSWR<Record<string, unknown>>("/api/app-settings", fetcher)
  const [config, setConfig] = useState<AddressingConfig | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  if (appSettings && !loaded) {
    const saved = appSettings.addressing_config as AddressingConfig | undefined
    setConfig(saved ?? structuredClone(DEFAULT_ADDRESSING_CONFIG))
    setLoaded(true)
  }

  const save = async () => {
    if (!config) return
    setSaving(true)
    try {
      await fetch("/api/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addressing_config: config }),
      })
      applyOverrides({ addressing_config: config })
      globalMutate("/api/app-settings")
    } finally {
      setSaving(false)
    }
  }

  const updateBracket = (type: "letterPostcard" | "flat", idx: number, updates: Partial<AddressingBracket>) => {
    if (!config) return
    setConfig({
      ...config,
      [type]: config[type].map((b, i) => (i === idx ? { ...b, ...updates } : b)),
    })
  }

  const addBracket = (type: "letterPostcard" | "flat") => {
    if (!config) return
    const brackets = config[type]
    // Insert before the last (unlimited) bracket
    const newBracket: AddressingBracket = { maxQty: 10000, perPiece: 0.03 }
    const updated = [...brackets]
    updated.splice(Math.max(0, brackets.length - 1), 0, newBracket)
    setConfig({ ...config, [type]: updated })
  }

  const removeBracket = (type: "letterPostcard" | "flat", idx: number) => {
    if (!config) return
    if (config[type].length <= 1) return
    setConfig({ ...config, [type]: config[type].filter((_, i) => i !== idx) })
  }

  if (isLoading || !config) return <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">Addressing Rate Brackets</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Set tiered pricing for addressing. Each bracket either has a flat minimum or per-piece rate.
          </p>
        </div>
        <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </Button>
      </div>

      <BracketEditor
        label="Letters / Postcards"
        description="Non-flat mail pieces"
        brackets={config.letterPostcard}
        type="letterPostcard"
        onUpdate={updateBracket}
        onAdd={addBracket}
        onRemove={removeBracket}
      />

      <BracketEditor
        label="Flats"
        description="Flat mail pieces (large envelopes, catalogs)"
        brackets={config.flat}
        type="flat"
        onUpdate={updateBracket}
        onAdd={addBracket}
        onRemove={removeBracket}
      />
    </div>
  )
}

function BracketEditor({
  label,
  description,
  brackets,
  type,
  onUpdate,
  onAdd,
  onRemove,
}: {
  label: string
  description: string
  brackets: AddressingBracket[]
  type: "letterPostcard" | "flat"
  onUpdate: (type: "letterPostcard" | "flat", idx: number, updates: Partial<AddressingBracket>) => void
  onAdd: (type: "letterPostcard" | "flat") => void
  onRemove: (type: "letterPostcard" | "flat", idx: number) => void
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">{label}</CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
          <span>Up to (qty)</span>
          <span />
          <span>Price</span>
          <span />
        </div>
        {brackets.map((b, i) => {
          const isLast = b.maxQty === null
          const hasFlat = b.flatMin != null
          return (
            <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
              <div>
                {isLast ? (
                  <span className="text-xs font-medium text-muted-foreground px-2">Unlimited</span>
                ) : (
                  <Input
                    type="number"
                    className="h-8 text-sm"
                    value={b.maxQty ?? ""}
                    onChange={(e) => onUpdate(type, i, { maxQty: parseInt(e.target.value) || 0 })}
                  />
                )}
              </div>
              <Select
                value={hasFlat ? "flat" : "piece"}
                onValueChange={(v) => {
                  if (v === "flat") {
                    onUpdate(type, i, { flatMin: 125, perPiece: undefined })
                  } else {
                    onUpdate(type, i, { perPiece: 0.05, flatMin: undefined })
                  }
                }}
              >
                <SelectTrigger className="h-8 w-[110px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">Flat Min $</SelectItem>
                  <SelectItem value="piece">Per Piece $</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                <Input
                  type="number"
                  step={hasFlat ? "1" : "0.001"}
                  className="h-8 text-sm pl-5"
                  value={hasFlat ? (b.flatMin ?? "") : (b.perPiece ?? "")}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0
                    if (hasFlat) {
                      onUpdate(type, i, { flatMin: val })
                    } else {
                      onUpdate(type, i, { perPiece: val })
                    }
                  }}
                />
              </div>
              <button
                onClick={() => onRemove(type, i)}
                disabled={brackets.length <= 1}
                className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-20"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
        <Button variant="outline" size="sm" className="w-full gap-1.5 mt-2" onClick={() => onAdd(type)}>
          <Plus className="h-3.5 w-3.5" />
          Add Bracket
        </Button>
      </CardContent>
    </Card>
  )
}

// =========== TABBING BRACKETS SETTINGS ===========

function TabbingBracketsSettings() {
  const { data: appSettings, isLoading } = useSWR<Record<string, unknown>>("/api/app-settings", fetcher)
  const [config, setConfig] = useState<TabbingConfig | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  if (appSettings && !loaded) {
    const saved = appSettings.tabbing_config as TabbingConfig | undefined
    setConfig(saved ?? structuredClone(DEFAULT_TABBING_CONFIG))
    setLoaded(true)
  }

  const save = async () => {
    if (!config) return
    setSaving(true)
    try {
      await fetch("/api/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabbing_config: config }),
      })
      applyOverrides({ tabbing_config: config })
      globalMutate("/api/app-settings")
    } finally {
      setSaving(false)
    }
  }

  const updateBracket = (idx: number, updates: Partial<AddressingBracket>) => {
    if (!config) return
    setConfig({
      ...config,
      brackets: config.brackets.map((b, i) => (i === idx ? { ...b, ...updates } : b)),
    })
  }

  const addBracket = () => {
    if (!config) return
    const newBracket: AddressingBracket = { maxQty: 5000, perPiece: 0.10 }
    const updated = [...config.brackets]
    updated.splice(Math.max(0, config.brackets.length - 1), 0, newBracket)
    setConfig({ ...config, brackets: updated })
  }

  const removeBracket = (idx: number) => {
    if (!config) return
    if (config.brackets.length <= 1) return
    setConfig({ ...config, brackets: config.brackets.filter((_, i) => i !== idx) })
  }

  if (isLoading || !config) return <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">Tabbing Rate Brackets</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tiered pricing for applying tabs to self-mailers and booklets.
          </p>
        </div>
        <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Tabbing Brackets</CardTitle>
          <p className="text-xs text-muted-foreground">Default: $125 min up to 1,000 pc, then $0.125/pc</p>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
            <span>Up to (qty)</span>
            <span />
            <span>Price</span>
            <span />
          </div>
          {config.brackets.map((b, i) => {
            const isLast = b.maxQty === null
            const hasFlat = b.flatMin != null
            return (
              <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
                <div>
                  {isLast ? (
                    <span className="text-xs font-medium text-muted-foreground px-2">Unlimited</span>
                  ) : (
                    <Input
                      type="number"
                      className="h-8 text-sm"
                      value={b.maxQty ?? ""}
                      onChange={(e) => updateBracket(i, { maxQty: parseInt(e.target.value) || 0 })}
                    />
                  )}
                </div>
                <Select
                  value={hasFlat ? "flat" : "piece"}
                  onValueChange={(v) => {
                    if (v === "flat") {
                      updateBracket(i, { flatMin: 125, perPiece: undefined })
                    } else {
                      updateBracket(i, { perPiece: 0.125, flatMin: undefined })
                    }
                  }}
                >
                  <SelectTrigger className="h-8 w-[110px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Flat Min $</SelectItem>
                    <SelectItem value="piece">Per Piece $</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                  <Input
                    type="number"
                    step={hasFlat ? "1" : "0.001"}
                    className="h-8 text-sm pl-5"
                    value={hasFlat ? (b.flatMin ?? "") : (b.perPiece ?? "")}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0
                      if (hasFlat) {
                        updateBracket(i, { flatMin: val })
                      } else {
                        updateBracket(i, { perPiece: val })
                      }
                    }}
                  />
                </div>
                <button
                  onClick={() => removeBracket(i)}
                  disabled={config.brackets.length <= 1}
                  className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
          <Button variant="outline" size="sm" className="w-full gap-1.5 mt-2" onClick={addBracket}>
            <Plus className="h-3.5 w-3.5" />
            Add Bracket
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// =========== SORT LEVEL MIX SETTINGS ===========

const SORT_MIX_GROUPS = [
  {
    label: "First-Class Presort",
    keys: [
      { key: "FCM_COMM_LETTER_AUTO", label: "Letter" },
      { key: "FCM_COMM_FLAT_AUTO", label: "Flat" },
      { key: "FCM_COMM_POSTCARD_AUTO", label: "Postcard" },
    ],
  },
  {
    label: "Marketing Mail -- Automation",
    keys: [
      { key: "MKT_COMM_LETTER_AUTO", label: "Letter" },
      { key: "MKT_COMM_FLAT_AUTO", label: "Flat" },
    ],
  },
  {
    label: "Marketing Mail -- Carrier Route",
    keys: [
      { key: "MKT_COMM_LETTER_CR", label: "Letter" },
      { key: "MKT_COMM_FLAT_CR", label: "Flat" },
    ],
  },
  {
    label: "Nonprofit -- Automation",
    keys: [
      { key: "MKT_NP_LETTER_AUTO", label: "Letter" },
      { key: "MKT_NP_FLAT_AUTO", label: "Flat" },
    ],
  },
  {
    label: "Nonprofit -- Carrier Route",
    keys: [
      { key: "MKT_NP_LETTER_CR", label: "Letter" },
      { key: "MKT_NP_FLAT_CR", label: "Flat" },
    ],
  },
]

function SortMixTab() {
  const { data: appSettings, mutate } = useSWR<Record<string, unknown>>("/api/app-settings", fetcher)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [mix, setMix] = useState<SortLevelMixConfig>(structuredClone(DEFAULT_SORT_LEVEL_MIX))

  // Load from DB
  if (appSettings && !loaded) {
    const dbMix = appSettings.sort_level_mix as SortLevelMixConfig | undefined
    if (dbMix) {
      setMix({ ...structuredClone(DEFAULT_SORT_LEVEL_MIX), ...dbMix })
    }
    setLoaded(true)
  }

  const updatePct = (configKey: string, tierKey: string, value: number) => {
    setMix(prev => ({
      ...prev,
      [configKey]: { ...prev[configKey], [tierKey]: Math.max(0, Math.min(100, value)) },
    }))
    setDirty(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      await fetch("/api/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_level_mix: mix }),
      })
      applyOverrides({ sort_level_mix: mix })
      await mutate()
      await globalMutate("/api/app-settings")
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  const tierLabel = (tierKey: string): string => {
    const labels: Record<string, string> = {
      MIX: "Mixed", ADC: "AADC/ADC", TD: "3-Digit", FD: "5-Digit",
      CR_B: "CR Basic", CR_H: "CR HD", CR_HP: "CR HD+",
    }
    return labels[tierKey] || tierKey
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Default Sort Level Mix</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Set the default % split for each sort level per mail class. These pre-fill the qty distribution on the USPS page.
          </p>
        </div>
        <Button
          size="sm"
          onClick={save}
          disabled={!dirty || saving}
          className="gap-1.5"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </Button>
      </div>

      {SORT_MIX_GROUPS.map((group) => (
        <Card key={group.label} className="overflow-hidden">
          <CardHeader className="py-3 px-4 bg-muted/30">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{group.label}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-[10px] font-bold text-muted-foreground uppercase px-4 py-2 w-24">Shape</th>
                  {Object.keys(mix[group.keys[0].key] || {}).map(tk => (
                    <th key={tk} className="text-center text-[10px] font-bold text-muted-foreground uppercase px-2 py-2">{tierLabel(tk)}</th>
                  ))}
                  <th className="text-center text-[10px] font-bold text-muted-foreground uppercase px-2 py-2 w-16">Total</th>
                </tr>
              </thead>
              <tbody>
                {group.keys.map(({ key, label: shapeLabel }) => {
                  const tiers = mix[key] || {}
                  const total = Object.values(tiers).reduce((s, v) => s + (v || 0), 0)
                  const isValid = Math.abs(total - 100) < 0.5
                  return (
                    <tr key={key} className="border-b border-border/50 last:border-b-0">
                      <td className="px-4 py-2 font-medium text-sm">{shapeLabel}</td>
                      {Object.entries(tiers).map(([tk, pct]) => (
                        <td key={tk} className="px-1 py-1.5 text-center">
                          <div className="relative inline-flex items-center">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              value={pct}
                              onChange={(e) => updatePct(key, tk, parseInt(e.target.value) || 0)}
                              className="w-14 h-7 text-center text-xs font-mono font-semibold rounded border border-border bg-background px-1 outline-none focus:ring-1 focus:ring-foreground/20 tabular-nums"
                            />
                            <span className="text-[10px] text-muted-foreground ml-0.5">%</span>
                          </div>
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center">
                        <Badge variant={isValid ? "secondary" : "destructive"} className="font-mono text-xs tabular-nums">
                          {total}%
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Don't Forget Settings Tab ──────────────────────────────────

// Categories that can be set as "commonly needed"
const ALL_SERVICE_CATEGORIES = [
  { id: "LIST_RENTAL", label: "List Rentals", hint: "Does customer need a mailing list?" },
  { id: "ADDRESSING", label: "Addressing", hint: "How will addresses be applied?" },
  { id: "COMPUTER_WORK", label: "Computer Work", hint: "Data processing, CASS, deduping" },
  { id: "INSERTING", label: "Inserting", hint: "Machine inserting services" },
  { id: "LABELING", label: "Labeling", hint: "Label application" },
  { id: "LIST_WORK", label: "List Work", hint: "List cleaning, merge/purge" },
  { id: "DELIVERY", label: "Delivery", hint: "Local delivery services" },
] as const

// Mail classes for configuration
const MAIL_CLASSES = [
  { id: "ALL", label: "All Mailings", description: "Default checklist for all mail classes" },
  { id: "MKT_COMM", label: "Marketing Mail", description: "Standard commercial marketing mail" },
  { id: "MKT_NP", label: "Non-Profit", description: "Non-profit marketing mail" },
  { id: "FC_COMM", label: "First Class", description: "First class commercial mail" },
  { id: "FC_NP", label: "First Class Non-Profit", description: "First class non-profit" },
  { id: "RETAIL", label: "Retail / Stamps", description: "Single-piece retail mailings" },
] as const

type MailClassId = typeof MAIL_CLASSES[number]["id"]

export interface DontForgetConfig {
  [mailClass: string]: string[] // array of category IDs
}

export const DEFAULT_DONT_FORGET_CONFIG: DontForgetConfig = {
  ALL: ["LIST_RENTAL", "ADDRESSING", "COMPUTER_WORK"],
}

function DontForgetSettingsTab() {
  const { data: appSettings, mutate } = useSWR<Record<string, unknown>>("/api/app-settings", fetcher)
  const [saving, setSaving] = useState(false)
  const [activeClass, setActiveClass] = useState<MailClassId>("ALL")
  
  // Load config from app settings
  const config: DontForgetConfig = (appSettings?.dont_forget_config as DontForgetConfig) || DEFAULT_DONT_FORGET_CONFIG
  
  // Get categories for active mail class (fall back to ALL if not set)
  const activeCategories = config[activeClass] || config.ALL || []
  
  const toggleCategory = async (categoryId: string) => {
    const currentList = [...activeCategories]
    const idx = currentList.indexOf(categoryId)
    if (idx >= 0) {
      currentList.splice(idx, 1)
    } else {
      currentList.push(categoryId)
    }
    
    const newConfig = { ...config, [activeClass]: currentList }
    
    setSaving(true)
    try {
      await fetch("/api/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dont_forget_config: newConfig }),
      })
      await mutate()
    } finally {
      setSaving(false)
    }
  }
  
  const copyFromAll = async () => {
    const allCategories = config.ALL || []
    const newConfig = { ...config, [activeClass]: [...allCategories] }
    
    setSaving(true)
    try {
      await fetch("/api/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dont_forget_config: newConfig }),
      })
      await mutate()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-foreground">Don't Forget Checklist</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Configure which service categories appear in the "Don't Forget" checklist. These prompts help ensure important items aren't missed when creating quotes.
          </p>
        </div>
        {saving && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      </div>

      {/* Mail Class Tabs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Select Mail Class</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {MAIL_CLASSES.map((mc) => {
              const isActive = activeClass === mc.id
              const hasCustom = mc.id !== "ALL" && config[mc.id] !== undefined
              return (
                <button
                  key={mc.id}
                  onClick={() => setActiveClass(mc.id)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all border",
                    isActive
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background hover:bg-muted border-border",
                    hasCustom && !isActive && "border-amber-400 dark:border-amber-600"
                  )}
                >
                  {mc.label}
                  {hasCustom && !isActive && (
                    <span className="ml-1.5 text-[10px] text-amber-600 dark:text-amber-400">*</span>
                  )}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {activeClass === "ALL"
              ? "This is the default checklist used when no mail class-specific config exists."
              : `Custom checklist for ${MAIL_CLASSES.find((m) => m.id === activeClass)?.label}. Leave empty to use "All Mailings" defaults.`}
          </p>
        </CardContent>
      </Card>

      {/* Category Selection */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            Checklist Items for "{MAIL_CLASSES.find((m) => m.id === activeClass)?.label}"
          </CardTitle>
          {activeClass !== "ALL" && (
            <Button variant="outline" size="sm" onClick={copyFromAll} disabled={saving}>
              Copy from "All Mailings"
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ALL_SERVICE_CATEGORIES.map((cat) => {
              const isEnabled = activeCategories.includes(cat.id)
              return (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  disabled={saving}
                  className={cn(
                    "flex items-start gap-3 p-4 rounded-xl border text-left transition-all",
                    isEnabled
                      ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/20"
                      : "border-border bg-background hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "rounded-lg p-2 shrink-0",
                    isEnabled ? "bg-emerald-500" : "bg-muted"
                  )}>
                    {isEnabled ? (
                      <CheckCircle2 className="h-4 w-4 text-white" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className={cn(
                      "font-semibold text-sm",
                      isEnabled ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"
                    )}>
                      {cat.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{cat.hint}</p>
                  </div>
                </button>
              )
            })}
          </div>
          
          {activeCategories.length === 0 && (
            <div className="mt-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                  No items selected
                </p>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                {activeClass === "ALL"
                  ? "The Don't Forget checklist won't appear if no items are selected."
                  : "Will use the \"All Mailings\" defaults since no items are selected."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <h4 className="text-sm font-bold text-foreground">Don't Forget</h4>
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                {activeCategories.length} to review
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeCategories.length > 0 ? (
                activeCategories.map((catId) => {
                  const cat = ALL_SERVICE_CATEGORIES.find((c) => c.id === catId)
                  return cat ? (
                    <div
                      key={catId}
                      className="flex items-center gap-2 rounded-xl border border-amber-300 dark:border-amber-600 bg-white dark:bg-amber-950/10 px-3 py-2"
                    >
                      <span className="text-sm font-medium text-foreground">{cat.label}</span>
                      <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">Add / Not needed</span>
                    </div>
                  ) : null
                })
              ) : (
                <p className="text-sm text-muted-foreground italic">No checklist items configured</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
