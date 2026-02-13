"use client"

import { useState, useCallback } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
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
} from "lucide-react"

// ---------- types ----------
interface MailClassSetting {
  id: string
  class_name: string
  addressing: number
  computer_work: number
  cass: number
  inserting: number
  stamping: number
  printing: number
  notes: string | null
  created_at: string
  updated_at: string
}

const LABOR_FIELDS: { key: keyof MailClassSetting; label: string }[] = [
  { key: "addressing", label: "Addressing" },
  { key: "computer_work", label: "Computer Work" },
  { key: "cass", label: "CASS / 2nd" },
  { key: "inserting", label: "Inserting" },
  { key: "stamping", label: "Stamping" },
  { key: "printing", label: "Printing" },
]

const SWR_KEY = "/api/mail-class-settings"
const fetcher = (url: string) => fetch(url).then((r) => r.json())

// ---------- main panel ----------
export function MailClassSettingsPanel({ onClose }: { onClose: () => void }) {
  const { data: settings, isLoading } = useSWR<MailClassSetting[]>(SWR_KEY, fetcher)
  const [adding, setAdding] = useState(false)

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center p-4 pt-[8vh] overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <Card className="w-full max-w-3xl border-border shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted">
                <Settings className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">USPS Mail Class Labor Settings</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5 text-pretty">
                  Configure labor and list work costs per USPS mail class. These can be added to quotes for flat mail jobs.
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close settings">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
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

          {/* Existing classes */}
          {settings?.map((setting) => (
            <MailClassCard key={setting.id} setting={setting} />
          ))}

          {/* Add new form */}
          {adding && (
            <AddMailClassForm
              onDone={() => setAdding(false)}
              existingNames={settings?.map((s) => s.class_name.toLowerCase()) || []}
            />
          )}

          {/* Add button */}
          {!adding && (
            <Button
              variant="outline"
              className="gap-2 h-10 border-dashed"
              onClick={() => setAdding(true)}
            >
              <Plus className="h-4 w-4" />
              Add USPS Mail Class
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------- individual class card ----------
function MailClassCard({ setting }: { setting: MailClassSetting }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [draft, setDraft] = useState({ ...setting })

  const laborTotal = LABOR_FIELDS.reduce(
    (sum, f) => sum + (Number(setting[f.key]) || 0),
    0
  )

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await fetch(`/api/mail-class-settings/${setting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_name: draft.class_name,
          addressing: draft.addressing,
          computer_work: draft.computer_work,
          cass: draft.cass,
          inserting: draft.inserting,
          stamping: draft.stamping,
          printing: draft.printing,
          notes: draft.notes,
        }),
      })
      globalMutate(SWR_KEY)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }, [draft, setting.id])

  const handleDelete = useCallback(async () => {
    await fetch(`/api/mail-class-settings/${setting.id}`, { method: "DELETE" })
    globalMutate(SWR_KEY)
  }, [setting.id])

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header row */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/40 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5">
          <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-0.5">
            {setting.class_name}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {LABOR_FIELDS.filter((f) => Number(setting[f.key]) > 0).length} labor items
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono font-semibold tabular-nums text-foreground">
            {formatCurrency(laborTotal)}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 bg-card border-t border-border flex flex-col gap-3">
          {/* Labor fields */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {LABOR_FIELDS.map((field) => (
              <div key={field.key} className="flex flex-col gap-1">
                <label
                  htmlFor={`${setting.id}-${field.key}`}
                  className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide"
                >
                  {field.label}
                </label>
                {editing ? (
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      $
                    </span>
                    <Input
                      id={`${setting.id}-${field.key}`}
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min={0}
                      autoComplete="off"
                      value={Number(draft[field.key]) || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, [field.key]: parseFloat(e.target.value) || 0 })
                      }
                      className="h-8 text-sm font-mono pl-5 tabular-nums"
                    />
                  </div>
                ) : (
                  <span className="text-sm font-mono tabular-nums text-foreground h-8 flex items-center">
                    {formatCurrency(Number(setting[field.key]) || 0)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Notes */}
          {editing ? (
            <div className="flex flex-col gap-1">
              <label
                htmlFor={`${setting.id}-notes`}
                className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide"
              >
                Notes
              </label>
              <textarea
                id={`${setting.id}-notes`}
                value={draft.notes || ""}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value || null })}
                placeholder="Optional notes..."
                rows={2}
                className="w-full text-sm bg-card border border-border rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>
          ) : (
            setting.notes && (
              <p className="text-xs text-muted-foreground italic">{setting.notes}</p>
            )
          )}

          <Separator />

          {/* Actions */}
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={handleSave} disabled={saving}>
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setDraft({ ...setting })
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
                    setDraft({ ...setting })
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
                      Confirm Delete
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
  const [values, setValues] = useState({
    addressing: 0,
    computer_work: 0,
    cass: 0,
    inserting: 0,
    stamping: 0,
    printing: 0,
  })
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleAdd = useCallback(async () => {
    if (!name.trim()) {
      setError("Class name is required")
      return
    }
    if (existingNames.includes(name.toLowerCase().trim())) {
      setError("This class name already exists")
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
          ...values,
          notes: notes || null,
        }),
      })
      globalMutate(SWR_KEY)
      onDone()
    } finally {
      setSaving(false)
    }
  }, [name, values, notes, existingNames, onDone])

  return (
    <div className="border border-primary/30 border-dashed rounded-lg p-4 bg-primary/5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">New USPS Mail Class</span>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onDone}>
          Cancel
        </Button>
      </div>

      {/* Class name */}
      <div className="flex flex-col gap-1">
        <label htmlFor="new-class-name" className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          Class Name
        </label>
        <Input
          id="new-class-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Flat, Parcel, BPM..."
          autoComplete="off"
          spellCheck={false}
          className="h-9"
        />
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>

      {/* Labor costs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {LABOR_FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col gap-1">
            <label
              htmlFor={`new-${field.key}`}
              className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide"
            >
              {field.label}
            </label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
              <Input
                id={`new-${field.key}`}
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                autoComplete="off"
                value={values[field.key as keyof typeof values] || ""}
                onChange={(e) =>
                  setValues({ ...values, [field.key]: parseFloat(e.target.value) || 0 })
                }
                className="h-8 text-sm font-mono pl-5 tabular-nums"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <label htmlFor="new-notes" className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          Notes
        </label>
        <textarea
          id="new-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes..."
          rows={2}
          className="w-full text-sm bg-card border border-border rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
        />
      </div>

      <Button size="sm" className="gap-1.5 h-9 w-fit" onClick={handleAdd} disabled={saving}>
        <Plus className="h-3.5 w-3.5" />
        {saving ? "Adding..." : "Add Mail Class"}
      </Button>
    </div>
  )
}
