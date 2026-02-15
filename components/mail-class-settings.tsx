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
  Database,
  KeyRound,
  CheckCircle2,
  XCircle,
  RefreshCw,
  HardDrive,
  ShieldAlert,
  Info,
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
                Payment Terms
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
            All systems healthy. No warnings.
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
