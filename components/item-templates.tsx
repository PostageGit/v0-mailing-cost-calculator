"use client"

import { useState, useMemo, useCallback } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { useQuote } from "@/lib/quote-context"
import { formatCurrency } from "@/lib/pricing"
import type { QuoteCategory } from "@/lib/quote-types"
import {
  Package, Plus, Search, Pencil, Trash2, Copy, Check,
  FolderOpen, Loader2, ShoppingCart, X, Archive,
} from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface ItemTemplate {
  id: string
  name: string
  group_name: string
  category: string
  description: string
  specs: Record<string, unknown>
  amount: number
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

const EMPTY_TEMPLATE: Omit<ItemTemplate, "id" | "created_at" | "updated_at"> = {
  name: "",
  group_name: "General",
  category: "flat",
  description: "",
  specs: {},
  amount: 0,
  is_active: true,
  sort_order: 0,
}

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "flat", label: "Flat Printing" },
  { value: "booklet", label: "Fold & Staple" },
  { value: "spiral", label: "Spiral Binding" },
  { value: "perfect", label: "Perfect Binding" },
  { value: "postage", label: "Postage / USPS" },
  { value: "listwork", label: "List Work & Mailing" },
  { value: "item", label: "Items & Supplies" },
  { value: "ohp", label: "Out of House" },
  { value: "envelope", label: "Envelopes" },
]

// ---- Spec Editor ----
function SpecsEditor({ specs, onChange }: { specs: Record<string, unknown>; onChange: (s: Record<string, unknown>) => void }) {
  const [newKey, setNewKey] = useState("")
  const [newVal, setNewVal] = useState("")

  const addSpec = () => {
    const key = newKey.trim()
    if (!key) return
    onChange({ ...specs, [key]: newVal.trim() })
    setNewKey("")
    setNewVal("")
  }

  const removeSpec = (key: string) => {
    const copy = { ...specs }
    delete copy[key]
    onChange(copy)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(specs).map(([k, v]) => (
          <div key={k} className="group flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1">
            <span className="text-[10px] font-medium text-foreground">{k}:</span>
            <span className="text-[10px] text-muted-foreground">{String(v)}</span>
            <button onClick={() => removeSpec(k)} className="ml-0.5 p-0.5 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}
        {Object.keys(specs).length === 0 && (
          <span className="text-[10px] text-muted-foreground italic">No specs added yet</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="Spec name" className="h-7 text-[11px] w-28" />
        <Input value={newVal} onChange={(e) => setNewVal(e.target.value)} placeholder="Value" className="h-7 text-[11px] w-28" onKeyDown={(e) => e.key === "Enter" && addSpec()} />
        <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={addSpec} disabled={!newKey.trim()}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

// ---- Template Form Dialog ----
function TemplateDialog({
  open,
  onClose,
  initial,
  groups,
  onSave,
}: {
  open: boolean
  onClose: () => void
  initial: Omit<ItemTemplate, "id" | "created_at" | "updated_at"> | null
  groups: string[]
  onSave: (data: Omit<ItemTemplate, "id" | "created_at" | "updated_at">) => Promise<void>
}) {
  const [form, setForm] = useState(initial || EMPTY_TEMPLATE)
  const [saving, setSaving] = useState(false)
  const [customGroup, setCustomGroup] = useState("")

  const update = (key: string, value: unknown) => setForm((p) => ({ ...p, [key]: value }))

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleAddCustomGroup = () => {
    const g = customGroup.trim()
    if (!g) return
    update("group_name", g)
    setCustomGroup("")
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{initial ? "Edit Template" : "New Template"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label className="text-xs text-muted-foreground">Template Name</Label>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Business Cards - 500ct" className="h-9 text-sm" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Group</Label>
              <Select value={form.group_name} onValueChange={(v) => update("group_name", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {groups.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1.5 mt-1">
                <Input value={customGroup} onChange={(e) => setCustomGroup(e.target.value)} placeholder="New group..." className="h-7 text-[11px]" onKeyDown={(e) => e.key === "Enter" && handleAddCustomGroup()} />
                <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2" onClick={handleAddCustomGroup} disabled={!customGroup.trim()}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <Select value={form.category} onValueChange={(v) => update("category", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 col-span-2">
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Paper stock, size, quantity, etc." className="min-h-[60px] text-sm" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Default Amount ($)</Label>
              <Input type="number" step="0.01" min={0} value={form.amount || ""} onChange={(e) => update("amount", parseFloat(e.target.value) || 0)} placeholder="0.00" className="h-9 text-sm" />
            </div>

            <div className="flex items-center gap-3 pt-5">
              <Switch checked={form.is_active} onCheckedChange={(v) => update("is_active", v)} />
              <Label className="text-xs text-muted-foreground">Active</Label>
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Specs / Details</Label>
            <p className="text-[10px] text-muted-foreground">Add any spec pairs (size, paper, ink, quantity, etc.) that define this template.</p>
            <SpecsEditor specs={form.specs} onChange={(s) => update("specs", s)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !form.name.trim()} className="text-xs gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {saving ? "Saving..." : "Save Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---- Main Templates Screen ----
export function ItemTemplatesScreen() {
  const { data: templates, isLoading, mutate } = useSWR<ItemTemplate[]>("/api/item-templates", fetcher)
  const { data: settings } = useSWR<Record<string, unknown>>("/api/app-settings", fetcher)
  const quote = useQuote()

  const [search, setSearch] = useState("")
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ItemTemplate | null>(null)
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const groupsFromSettings = (settings?.template_groups ?? []) as string[]
  const groupsFromData = useMemo(() => {
    if (!templates) return []
    return Array.from(new Set(templates.map((t) => t.group_name))).sort()
  }, [templates])
  const allGroups = useMemo(() => {
    const set = new Set([...groupsFromSettings, ...groupsFromData])
    return Array.from(set).sort()
  }, [groupsFromSettings, groupsFromData])

  const filtered = useMemo(() => {
    if (!templates) return []
    return templates.filter((t) => {
      if (!showInactive && !t.is_active) return false
      if (selectedGroup && t.group_name !== selectedGroup) return false
      if (search) {
        const q = search.toLowerCase()
        return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.group_name.toLowerCase().includes(q)
      }
      return true
    })
  }, [templates, selectedGroup, showInactive, search])

  // Group the filtered templates
  const grouped = useMemo(() => {
    const map: Record<string, ItemTemplate[]> = {}
    for (const t of filtered) {
      if (!map[t.group_name]) map[t.group_name] = []
      map[t.group_name].push(t)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const handleCreate = async (data: Omit<ItemTemplate, "id" | "created_at" | "updated_at">) => {
    await fetch("/api/item-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
    mutate()
  }

  const handleUpdate = async (data: Omit<ItemTemplate, "id" | "created_at" | "updated_at">) => {
    if (!editingTemplate) return
    await fetch(`/api/item-templates/${editingTemplate.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
    setEditingTemplate(null)
    mutate()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/item-templates/${id}`, { method: "DELETE" })
    setConfirmDelete(null)
    mutate()
  }

  const handleDuplicate = async (template: ItemTemplate) => {
    const { id, created_at, updated_at, ...rest } = template
    await fetch("/api/item-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...rest, name: `${rest.name} (copy)` }) })
    mutate()
  }

  const handleAddToQuote = useCallback((template: ItemTemplate) => {
    const specSummary = Object.entries(template.specs).map(([k, v]) => `${k}: ${v}`).join(" | ")
    quote.addItem({
      category: (template.category || "item") as QuoteCategory,
      label: template.name,
      description: [template.description, specSummary].filter(Boolean).join(" -- "),
      amount: template.amount,
    })
    setJustAdded((prev) => new Set(prev).add(template.id))
    setTimeout(() => setJustAdded((prev) => { const n = new Set(prev); n.delete(template.id); return n }), 1500)
  }, [quote])

  const openCreate = () => { setEditingTemplate(null); setDialogOpen(true) }
  const openEdit = (t: ItemTemplate) => { setEditingTemplate(t); setDialogOpen(true) }

  return (
    <div className="flex h-full min-h-0">
      {/* ── Group sidebar ── */}
      <aside className="w-48 shrink-0 border-r border-border bg-muted/20 flex flex-col">
        <div className="px-3 pt-4 pb-2">
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Groups</h3>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 flex flex-col gap-0.5">
          <button
            onClick={() => setSelectedGroup(null)}
            className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors ${
              !selectedGroup ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">All Templates</span>
            <span className="ml-auto text-[10px] tabular-nums opacity-70">{templates?.filter((t) => showInactive || t.is_active).length ?? 0}</span>
          </button>
          {allGroups.map((g) => {
            const count = templates?.filter((t) => t.group_name === g && (showInactive || t.is_active)).length ?? 0
            return (
              <button
                key={g}
                onClick={() => setSelectedGroup(g)}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors ${
                  selectedGroup === g ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Package className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{g}</span>
                <span className="ml-auto text-[10px] tabular-nums opacity-70">{count}</span>
              </button>
            )
          })}
        </nav>
        <div className="px-3 py-3 border-t border-border">
          <div className="flex items-center gap-2">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} className="scale-75" />
            <span className="text-[10px] text-muted-foreground">Show inactive</span>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50">
          <h2 className="text-sm font-semibold text-foreground shrink-0">
            {selectedGroup ?? "All Templates"}
          </h2>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates..." className="h-8 text-xs pl-8" />
          </div>
          <Button size="sm" className="h-8 gap-1.5 text-xs ml-auto" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" /> New Template
          </Button>
        </div>

        {/* Template grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> <span className="text-sm">Loading templates...</span>
            </div>
          )}

          {!isLoading && grouped.length === 0 && (
            <div className="text-center py-16">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-sm font-semibold text-foreground mb-1">No templates yet</h3>
              <p className="text-xs text-muted-foreground mb-4">
                {search ? "No templates match your search." : "Create your first reusable item template to get started."}
              </p>
              {!search && (
                <Button size="sm" className="text-xs gap-1.5" onClick={openCreate}>
                  <Plus className="h-3.5 w-3.5" /> Create Template
                </Button>
              )}
            </div>
          )}

          {!isLoading && grouped.map(([groupName, items]) => (
            <div key={groupName} className="mb-6 last:mb-0">
              <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FolderOpen className="h-3 w-3" /> {groupName}
                <Badge variant="outline" className="text-[9px] ml-1">{items.length}</Badge>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                {items.map((tpl) => {
                  const wasAdded = justAdded.has(tpl.id)
                  const catLabel = CATEGORY_OPTIONS.find((c) => c.value === tpl.category)?.label ?? tpl.category
                  return (
                    <div
                      key={tpl.id}
                      className={`group rounded-xl border bg-card p-3 flex flex-col gap-2 transition-colors hover:border-primary/30 ${
                        !tpl.is_active ? "opacity-50" : ""
                      }`}
                    >
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-foreground truncate">{tpl.name}</h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge variant="outline" className="text-[9px]">{catLabel}</Badge>
                            {!tpl.is_active && <Badge variant="secondary" className="text-[9px]">Inactive</Badge>}
                          </div>
                        </div>
                        <span className="text-sm font-bold text-foreground tabular-nums shrink-0">
                          {formatCurrency(tpl.amount)}
                        </span>
                      </div>

                      {/* Description */}
                      {tpl.description && (
                        <p className="text-[10px] text-muted-foreground line-clamp-2">{tpl.description}</p>
                      )}

                      {/* Specs chips */}
                      {Object.keys(tpl.specs).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(tpl.specs).slice(0, 5).map(([k, v]) => (
                            <span key={k} className="text-[9px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                              {k}: {String(v)}
                            </span>
                          ))}
                          {Object.keys(tpl.specs).length > 5 && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                              +{Object.keys(tpl.specs).length - 5} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 mt-auto pt-1">
                        <Button
                          size="sm"
                          className={`h-7 text-[10px] gap-1 flex-1 transition-colors ${
                            wasAdded
                              ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                              : "bg-primary hover:bg-primary/90 text-primary-foreground"
                          }`}
                          onClick={() => handleAddToQuote(tpl)}
                        >
                          {wasAdded ? <><Check className="h-3 w-3" /> Added</> : <><ShoppingCart className="h-3 w-3" /> Add to Quote</>}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(tpl)} title="Edit">
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleDuplicate(tpl)} title="Duplicate">
                          <Copy className="h-3 w-3" />
                        </Button>
                        {confirmDelete === tpl.id ? (
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="destructive" className="h-7 text-[10px] px-2" onClick={() => handleDelete(tpl.id)}>
                              Delete
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2" onClick={() => setConfirmDelete(null)}>
                              No
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(tpl.id)} title="Delete">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dialog */}
      <TemplateDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingTemplate(null) }}
        initial={editingTemplate ? {
          name: editingTemplate.name,
          group_name: editingTemplate.group_name,
          category: editingTemplate.category,
          description: editingTemplate.description,
          specs: editingTemplate.specs,
          amount: editingTemplate.amount,
          is_active: editingTemplate.is_active,
          sort_order: editingTemplate.sort_order,
        } : null}
        groups={allGroups}
        onSave={editingTemplate ? handleUpdate : handleCreate}
      />
    </div>
  )
}

// ---- Save-As-Template Dialog (used from calculators) ----
export function SaveAsTemplateDialog({
  open,
  onClose,
  defaults,
}: {
  open: boolean
  onClose: () => void
  defaults: {
    name?: string
    category?: string
    description?: string
    specs?: Record<string, unknown>
    amount?: number
  }
}) {
  const { data: settings } = useSWR<Record<string, unknown>>("/api/app-settings", fetcher)
  const groups = (settings?.template_groups ?? ["General"]) as string[]
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async (data: Omit<ItemTemplate, "id" | "created_at" | "updated_at">) => {
    setSaving(true)
    try {
      await fetch("/api/item-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      setSaved(true)
      setTimeout(() => { setSaved(false); onClose() }, 1000)
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <Dialog open={open} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-xs">
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
              <Check className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-foreground">Template Saved</p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <TemplateDialog
      open={open}
      onClose={onClose}
      initial={{
        name: defaults.name ?? "",
        group_name: "General",
        category: defaults.category ?? "flat",
        description: defaults.description ?? "",
        specs: defaults.specs ?? {},
        amount: defaults.amount ?? 0,
        is_active: true,
        sort_order: 0,
      }}
      groups={groups}
      onSave={handleSave}
    />
  )
}
