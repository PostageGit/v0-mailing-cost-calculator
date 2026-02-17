"use client"

import { useState, useCallback } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { UserManagementTab } from "@/components/user-management-tab"
import { EmailSettingsTab } from "@/components/email-settings-tab"
import {
  DEFAULT_CLICK_COSTS,
  DEFAULT_PAPER_PRICES,
  DEFAULT_BOOKLET_PAPER_PRICES,
  DEFAULT_MARKUPS,
  DEFAULT_FINISHING_OPTIONS,
  DEFAULT_SCORE_FOLD_CONFIG,
  type FinishingOption,
  type ScoreFoldConfig,
  type ScoreFoldEntry,
} from "@/lib/pricing-config"
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
  Mail,
  Activity,
  Zap,
  Calendar,
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

// ---------- main panel ----------
export function MailClassSettingsPanel({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center p-4 pt-[6vh] overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <Card className="w-full max-w-3xl border-border shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted">
                <Settings className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">Settings</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5 text-pretty">
                  Labor rates, departments, custom fields, payment terms, and system health.
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Close settings"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="max-h-[75vh] overflow-y-auto">
          <Tabs defaultValue="labor" className="w-full">
            <TabsList className="mb-4 bg-muted/60 h-auto p-1 w-fit flex flex-wrap gap-0.5">
              <TabsTrigger value="labor" className="gap-1.5 px-3 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Wrench className="h-3.5 w-3.5" />
                Labor Rates
              </TabsTrigger>
              <TabsTrigger value="departments" className="gap-1.5 px-3 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Palette className="h-3.5 w-3.5" />
                Departments
              </TabsTrigger>
              <TabsTrigger value="fields" className="gap-1.5 px-3 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <ListPlus className="h-3.5 w-3.5" />
                Custom Fields
              </TabsTrigger>
              <TabsTrigger value="terms" className="gap-1.5 px-3 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <CreditCard className="h-3.5 w-3.5" />
                Dropdowns
              </TabsTrigger>
              <TabsTrigger value="items" className="gap-1.5 px-3 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Package className="h-3.5 w-3.5" />
                Items
              </TabsTrigger>
              <TabsTrigger value="finishings" className="gap-1.5 px-3 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Wrench className="h-3.5 w-3.5" />
                Finishings
              </TabsTrigger>
              <TabsTrigger value="finishing-calcs" className="gap-1.5 px-3 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Calculator className="h-3.5 w-3.5" />
                Finishing Calcs
              </TabsTrigger>
              <TabsTrigger value="pricing" className="gap-1.5 px-3 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <DollarSign className="h-3.5 w-3.5" />
                Pricing
              </TabsTrigger>
              <TabsTrigger value="steps" className="gap-1.5 px-3 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <ListPlus className="h-3.5 w-3.5" />
                Job Steps
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-1.5 px-3 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Users className="h-3.5 w-3.5" />
                Users
              </TabsTrigger>
              <TabsTrigger value="email" className="gap-1.5 px-3 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Mail className="h-3.5 w-3.5" />
                Email
              </TabsTrigger>
              <TabsTrigger value="system" className="gap-1.5 px-3 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Activity className="h-3.5 w-3.5" />
                System
              </TabsTrigger>
            </TabsList>

            <TabsContent value="labor">
              <LaborRatesTab />
            </TabsContent>
            <TabsContent value="departments">
              <DepartmentsTab />
            </TabsContent>
            <TabsContent value="fields">
              <CustomFieldsTab />
            </TabsContent>
            <TabsContent value="terms">
              <PaymentTermsTab />
            </TabsContent>
            <TabsContent value="items">
              <ItemsSettingsTab />
            </TabsContent>
            <TabsContent value="finishings">
              <FinishingsSettingsTab />
            </TabsContent>
            <TabsContent value="finishing-calcs">
              <FinishingCalculatorsSettingsTab />
            </TabsContent>
            <TabsContent value="pricing">
              <PricingSettingsTab />
            </TabsContent>
            <TabsContent value="steps">
              <JobStepsTab />
            </TabsContent>
            <TabsContent value="users">
              <UserManagementTab />
            </TabsContent>
            <TabsContent value="email">
              <EmailSettingsTab />
            </TabsContent>
            <TabsContent value="system">
              <SystemDashboardTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
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

// ---------- DROPDOWN FIELDS TAB ----------
const APP_SETTINGS_KEY = "/api/app-settings"

function DropdownListEditor({
  settingsKey,
  title,
  description,
  placeholder,
  icon,
  protectedValues = [],
  uppercase = false,
}: {
  settingsKey: string
  title: string
  description: string
  placeholder: string
  icon: React.ReactNode
  protectedValues?: string[]
  uppercase?: boolean
}) {
  const { data: settings, mutate } = useSWR<Record<string, unknown>>(APP_SETTINGS_KEY, fetcher)
  const items = (settings?.[settingsKey] ?? []) as string[]
  const [newItem, setNewItem] = useState("")
  const [saving, setSaving] = useState(false)

  const saveItems = async (updated: string[]) => {
    setSaving(true)
    try {
      await fetch("/api/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [settingsKey]: updated }),
      })
      mutate()
    } finally {
      setSaving(false)
    }
  }

  const addItem = async () => {
    const trimmed = uppercase ? newItem.trim().toUpperCase() : newItem.trim()
    if (!trimmed || items.includes(trimmed)) return
    await saveItems([...items, trimmed])
    setNewItem("")
  }

  const removeItem = async (item: string) => {
    await saveItems(items.filter((i) => i !== item))
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <div key={item} className="group flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5">
            {icon}
            <span className="text-sm font-medium text-foreground">{item}</span>
            {!protectedValues.includes(item) && (
              <button onClick={() => removeItem(item)} className="ml-1 p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100" aria-label={`Remove ${item}`}>
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-muted-foreground italic">No options added yet</p>}
      </div>
      <div className="flex items-center gap-2">
        <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addItem()} placeholder={placeholder} className="h-9 text-sm w-48" />
        <Button size="sm" className="h-9 gap-1.5 text-xs" onClick={addItem} disabled={saving || !newItem.trim()}>
          <Plus className="h-3.5 w-3.5" />
          {saving ? "Saving..." : "Add"}
        </Button>
      </div>
    </div>
  )
}

function PaymentTermsTab() {
  return (
    <div className="flex flex-col gap-8">
      <DropdownListEditor
        settingsKey="payment_terms"
        title="Payment Terms"
        description="Options for the Terms dropdown on customer records."
        placeholder="New term (e.g. NET 60)"
        icon={<CreditCard className="h-3.5 w-3.5 text-muted-foreground" />}
        protectedValues={["COD"]}
        uppercase
      />

      <Separator />

      <DropdownListEditor
        settingsKey="billing_methods"
        title="Billing Methods"
        description="Payment method options in the Billing & Tax tab."
        placeholder="New method (e.g. PayPal)"
        icon={<CreditCard className="h-3.5 w-3.5 text-muted-foreground" />}
      />

      <Separator />

      <DropdownListEditor
        settingsKey="billing_frequencies"
        title="Billing Frequencies"
        description="How often to bill a customer."
        placeholder="New frequency (e.g. Annually)"
        icon={<Calendar className="h-3.5 w-3.5 text-muted-foreground" />}
      />
    </div>
  )
}

// ---------- SYSTEM DASHBOARD TAB ----------
interface ActivityEntry {
  id: string; quote_id: string | null; entity_type: string; entity_id: string | null
  event: string; detail: string; user_name: string; created_at: string
}
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
  activity: {
    events_24h: number; events_7d: number
    top_events: { event: string; count: number }[]
    active_users: string[]
    feed: ActivityEntry[]
  }
  features: {
    active_quotes: number; active_jobs: number; total_converted: number
    total_customers: number; synced_customers: number
    total_files: number; total_vendor_bids: number; total_users: number
    overdue_deliveries: number; today_deliveries: number
  }
}

const TABLE_LABELS: Record<string, string> = {
  customers: "Customers",
  customer_contacts: "Contacts",
  delivery_addresses: "Delivery Addresses",
  quotes: "Quotes / Jobs",
  mail_class_settings: "Mail Class Settings",
  app_settings: "App Settings",
  quote_activity_log: "Activity Log",
  board_columns: "Board Columns",
  app_users: "Users",
  vendor_bids: "Vendor Bids",
  quote_files: "Files",
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

      {/* ── Feature Health Grid ── */}
      <section>
        <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Activity className="h-3 w-3" /> Feature Health
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          {[
            { label: "Active Quotes", value: data.features.active_quotes, sub: `${data.features.total_converted} converted`, color: "text-blue-600 dark:text-blue-400" },
            { label: "Active Jobs", value: data.features.active_jobs, sub: data.features.overdue_deliveries > 0 ? `${data.features.overdue_deliveries} overdue!` : `${data.features.today_deliveries} due today`, color: data.features.overdue_deliveries > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400" },
            { label: "Customers", value: data.features.total_customers, sub: `${data.features.synced_customers} synced to QBO`, color: "text-foreground" },
            { label: "Deliveries", value: data.features.today_deliveries, sub: data.features.overdue_deliveries > 0 ? `${data.features.overdue_deliveries} overdue` : "none overdue", color: data.features.overdue_deliveries > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400" },
            { label: "Files Uploaded", value: data.features.total_files, sub: `across all jobs`, color: "text-foreground" },
            { label: "Vendor Bids", value: data.features.total_vendor_bids, sub: `${data.features.total_users} users`, color: "text-foreground" },
          ].map((card) => (
            <div key={card.label} className="rounded-lg border border-border bg-card p-2.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{card.label}</p>
              <p className={`text-lg font-bold tabular-nums ${card.color}`}>{card.value.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">{card.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Activity Metrics ── */}
      <section>
        <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Zap className="h-3 w-3" /> Activity (Last 7 Days)
        </h4>
        <div className="grid grid-cols-3 gap-2.5 mb-3">
          <div className="rounded-lg border border-border bg-card p-2.5 text-center">
            <p className="text-lg font-bold tabular-nums text-foreground">{data.activity.events_24h}</p>
            <p className="text-[10px] text-muted-foreground">Last 24h</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-2.5 text-center">
            <p className="text-lg font-bold tabular-nums text-foreground">{data.activity.events_7d}</p>
            <p className="text-[10px] text-muted-foreground">Last 7 days</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-2.5 text-center">
            <p className="text-lg font-bold tabular-nums text-foreground">{data.activity.active_users.length}</p>
            <p className="text-[10px] text-muted-foreground">Active users</p>
          </div>
        </div>
        {data.activity.top_events.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {data.activity.top_events.map((e) => (
              <span key={e.event} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-foreground tabular-nums">
                {e.event.replace(/_/g, " ")} <span className="text-muted-foreground ml-0.5">{e.count}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ── Live Activity Feed ── */}
      {data.activity.feed.length > 0 && (
        <section>
          <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Recent Activity
          </h4>
          <div className="rounded-lg border border-border overflow-hidden max-h-[300px] overflow-y-auto">
            {data.activity.feed.map((entry, i) => {
              const time = new Date(entry.created_at)
              const isToday = time.toDateString() === new Date().toDateString()
              return (
                <div key={entry.id || i} className="flex items-start gap-2.5 px-3 py-2 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <div className="flex flex-col items-center mt-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      entry.event.includes("overdue") || entry.event.includes("delete") ? "bg-red-500"
                      : entry.event.includes("created") || entry.event.includes("converted") ? "bg-emerald-500"
                      : entry.event.includes("moved") || entry.event.includes("updated") ? "bg-blue-500"
                      : "bg-muted-foreground/40"
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-foreground truncate">
                        {entry.event.replace(/_/g, " ")}
                      </span>
                      {entry.user_name && (
                        <span className="text-[9px] px-1.5 py-0 rounded-full bg-secondary text-muted-foreground shrink-0">
                          {entry.user_name}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{entry.detail}</p>
                  </div>
                  <span className="text-[9px] text-muted-foreground tabular-nums shrink-0 mt-0.5">
                    {isToday ? time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : time.toLocaleDateString([], { month: "short", day: "numeric" })}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

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

  const sections: { key: PricingSection; label: string }[] = [
    { key: "click", label: "Click Costs" },
    { key: "flat", label: "Flat Paper Prices" },
    { key: "booklet", label: "Booklet Paper Prices" },
    { key: "markups", label: "Markup Levels" },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Pricing Configuration</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Edit click costs, paper prices, and markup levels. Changes apply to both Flat and Saddle Stitch calculators.
        </p>
      </div>

      {/* Section picker */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {sections.map((s) => (
          <Button
            key={s.key}
            variant={section === s.key ? "secondary" : "ghost"}
            size="sm"
            className="text-xs h-7"
            onClick={() => { setSection(s.key); setDirty(false) }}
          >
            {s.label}
          </Button>
        ))}
      </div>

      {/* Save / Reset bar */}
      <div className="flex items-center gap-2">
        <Button size="sm" className="h-7 text-xs gap-1" onClick={saveSection} disabled={saving}>
          <Save className="h-3 w-3" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={resetSection}>
          Reset to Defaults
        </Button>
        {dirty && <span className="text-[10px] text-amber-500 font-medium">Unsaved changes</span>}
      </div>

      <Separator />

      {/* Click Costs */}
      {section === "click" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Cost per click for B&W and Color printing. "Regular" is the toner/ink cost, "Machine" is the machine wear cost.
          </p>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left font-medium text-muted-foreground px-3 py-2">Type</th>
                  <th className="text-right font-medium text-muted-foreground px-3 py-2">Regular</th>
                  <th className="text-right font-medium text-muted-foreground px-3 py-2">Machine</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(clickCosts).map(([type, costs]) => (
                  <tr key={type} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground">{type}</td>
                    <td className="px-3 py-1.5 text-right">
                      <Input
                        type="number"
                        step="0.0001"
                        value={costs.regular}
                        onChange={(e) => {
                          setClickCosts((p) => ({ ...p, [type]: { ...p[type], regular: parseFloat(e.target.value) || 0 } }))
                          setDirty(true)
                        }}
                        className="h-7 text-xs w-24 ml-auto text-right"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <Input
                        type="number"
                        step="0.0001"
                        value={costs.machine}
                        onChange={(e) => {
                          setClickCosts((p) => ({ ...p, [type]: { ...p[type], machine: parseFloat(e.target.value) || 0 } }))
                          setDirty(true)
                        }}
                        className="h-7 text-xs w-24 ml-auto text-right"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Flat Paper Prices */}
      {section === "flat" && (
        <PaperPriceEditor
          prices={flatPrices}
          onChange={(updated) => { setFlatPrices(updated); setDirty(true) }}
          label="Flat Printing"
        />
      )}

      {/* Booklet Paper Prices */}
      {section === "booklet" && (
        <PaperPriceEditor
          prices={bookletPrices}
          onChange={(updated) => { setBookletPrices(updated); setDirty(true) }}
          label="Saddle Stitch / Booklet"
        />
      )}

      {/* Markup Levels */}
      {section === "markups" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Markup multipliers per quantity level. These apply to both Flat and Saddle Stitch calculators.
          </p>
          <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
            <table className="w-full text-xs min-w-[600px]">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left font-medium text-muted-foreground px-3 py-2 sticky left-0 bg-muted/50">Category</th>
                  {LEVEL_LABELS.map((l) => (
                    <th key={l.level} className="text-center font-medium text-muted-foreground px-1.5 py-2 whitespace-nowrap">
                      {l.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(markups).map(([category, levels]) => (
                  <tr key={category} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap sticky left-0 bg-card">{category}</td>
                    {LEVEL_LABELS.map((l) => (
                      <td key={l.level} className="px-1 py-1">
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
                          className="h-6 text-[10px] w-14 text-center px-1"
                        />
                      </td>
                    ))}
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

// Reusable paper price editor for flat and booklet
function PaperPriceEditor({
  prices,
  onChange,
  label,
}: {
  prices: Record<string, Record<string, number>>
  onChange: (updated: Record<string, Record<string, number>>) => void
  label: string
}) {
  const [expandedPaper, setExpandedPaper] = useState<string | null>(null)

  // Collect all unique sizes across all papers
  const allSizes = Array.from(
    new Set(Object.values(prices).flatMap((sizes) => Object.keys(sizes)))
  ).sort()

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Per-sheet paper costs for {label}. Click a paper type to expand and edit prices per size.
      </p>
      <div className="flex flex-col gap-1">
        {Object.entries(prices).map(([paper, sizes]) => {
          const isExpanded = expandedPaper === paper
          return (
            <div key={paper} className="rounded-lg border border-border">
              <button
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedPaper(isExpanded ? null : paper)}
              >
                <span className="text-xs font-medium text-foreground">{paper}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{Object.keys(sizes).length} sizes</span>
                  {isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                </div>
              </button>
              {isExpanded && (
                <div className="px-3 pb-2 border-t border-border pt-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(sizes).map(([size, price]) => (
                      <div key={size} className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground w-16 shrink-0">{size}</span>
                        <Input
                          type="number"
                          step="0.0001"
                          value={price}
                          onChange={(e) => {
                            const updated = structuredClone(prices)
                            updated[paper][size] = parseFloat(e.target.value) || 0
                            onChange(updated)
                          }}
                          className="h-6 text-[10px] w-20 text-right px-1.5"
                        />
                      </div>
                    ))}
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

  const [loaded, setLoaded] = useState(false)
  if (settings && !loaded) {
    if (dbFinishings && dbFinishings.length > 0) setFinishings(structuredClone(dbFinishings))
    if (dbScoreFold) setScoreFold(structuredClone(dbScoreFold))
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

  const updateSetupLevel = (level: string, minutes: number) => {
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
                  <Input type="number" step="1" value={mins} onChange={(e) => updateSetupLevel(level, parseInt(e.target.value) || 0)} className="h-7 text-xs" />
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
                          <><th key={ft + "-s"} className="text-center text-muted-foreground px-1 py-1 font-normal">Setup</th><th key={ft + "-r"} className="text-center text-muted-foreground px-1 py-1 font-normal">Rt/100</th></>
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
    </div>
  )
}
