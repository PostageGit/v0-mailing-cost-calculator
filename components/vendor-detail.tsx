"use client"

import { useState, useEffect } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  Save, X, Trash2, Loader2, Plus, User, Building2, Phone, Mail, Globe,
  Factory, Smartphone, CreditCard, AtSign, ChevronDown, ChevronUp,
  Clock, Calendar, Copy, MapPin,
} from "lucide-react"
import type { Vendor, VendorFacility, QuotingContact } from "@/lib/vendor-types"
import type { SpecialDay } from "@/lib/customer-types"
import { EMPTY_FACILITY } from "@/lib/vendor-types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Props {
  vendorId: string | null
  isNew: boolean
  onClose: () => void
  onCreated: (id: string) => void
}

export function VendorDetail({ vendorId, isNew, onClose, onCreated }: Props) {
  const { data: existing } = useSWR<Vendor>(vendorId ? `/api/vendors/${vendorId}` : null, fetcher)
  const { data: settings } = useSWR<Record<string, unknown>>("/api/app-settings", fetcher)
  const paymentTerms = (settings?.payment_terms ?? ["COD", "BILL 30", "CCOF", "ACH"]) as string[]

  // Form state
  const [form, setForm] = useState({
    company_name: "",
    terms: "COD",
    contact_name: "",
    office_phone: "",
    cell_phone: "",
    email: "",
    quoting_contacts: [] as QuotingContact[],
    cc_all_quoting: false,
    pickup_cost: 0,
    website: "",
    notes: "",
  })

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Facilities
  const { data: facilities, mutate: mutateFacilities } = useSWR<VendorFacility[]>(
    vendorId ? `/api/vendors/${vendorId}/facilities` : null,
    fetcher
  )
  const [expandedFacility, setExpandedFacility] = useState<string | null>(null)
  const [newFacility, setNewFacility] = useState(false)
  const [facilityForm, setFacilityForm] = useState({ ...EMPTY_FACILITY })
  const [editingFacilityId, setEditingFacilityId] = useState<string | null>(null)
  const [savingFacility, setSavingFacility] = useState(false)

  // Load existing vendor
  useEffect(() => {
    if (existing) {
      setForm({
        company_name: existing.company_name || "",
        terms: existing.terms || "COD",
        contact_name: existing.contact_name || "",
        office_phone: existing.office_phone || "",
        cell_phone: existing.cell_phone || "",
        email: existing.email || "",
        quoting_contacts: existing.quoting_contacts || [],
        cc_all_quoting: existing.cc_all_quoting || false,
        pickup_cost: existing.pickup_cost ?? 0,
        website: existing.website || "",
        notes: existing.notes || "",
      })
    }
  }, [existing])

  const updateField = (key: string, value: string | boolean | QuotingContact[]) =>
    setForm((p) => ({ ...p, [key]: value }))

  // Quoting contacts helpers
  const addQuotingContact = () => {
    setForm((p) => ({
      ...p,
      quoting_contacts: [...p.quoting_contacts, { name: "", email: "" }],
    }))
  }

  const removeQuotingContact = (idx: number) => {
    setForm((p) => ({
      ...p,
      quoting_contacts: p.quoting_contacts.filter((_, i) => i !== idx),
    }))
  }

  const updateQuotingContact = (idx: number, field: "name" | "email", value: string) => {
    setForm((p) => ({
      ...p,
      quoting_contacts: p.quoting_contacts.map((c, i) =>
        i === idx ? { ...c, [field]: value } : c
      ),
    }))
  }

  // Save vendor
  const handleSave = async () => {
    if (!form.company_name.trim()) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        contact_name: form.contact_name || null,
        office_phone: form.office_phone || null,
        cell_phone: form.cell_phone || null,
        email: form.email || null,
        pickup_cost: parseFloat(String(form.pickup_cost)) || 0,
        website: form.website || null,
        notes: form.notes || null,
      }

      if (isNew) {
        const res = await fetch("/api/vendors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.id) onCreated(data.id)
      } else if (vendorId) {
        await fetch(`/api/vendors/${vendorId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!vendorId) return
    setDeleting(true)
    await fetch(`/api/vendors/${vendorId}`, { method: "DELETE" })
    setDeleting(false)
    onClose()
  }

  // Facility helpers
  const resetFacilityForm = () => {
    setFacilityForm({ ...EMPTY_FACILITY, company_name: form.company_name || null })
  }

  const openNewFacility = () => {
    setEditingFacilityId(null)
    resetFacilityForm()
    setNewFacility(true)
  }

  const openEditFacility = (f: VendorFacility) => {
    setNewFacility(false)
    setEditingFacilityId(f.id)
    setFacilityForm({
      label: f.label,
      company_name: f.company_name,
      street: f.street,
      city: f.city,
      state: f.state,
      postal_code: f.postal_code,
      pickup_contact: f.pickup_contact,
      pickup_phone: f.pickup_phone,
      is_24_hours: f.is_24_hours,
      pickup_window_from: f.pickup_window_from,
      pickup_window_to: f.pickup_window_to,
      special_days: f.special_days || [],
      notes: f.notes,
    })
  }

  const saveFacility = async () => {
    if (!facilityForm.street?.trim()) return
    setSavingFacility(true)
    try {
      const payload = {
        label: facilityForm.label || null,
        company_name: facilityForm.company_name || null,
        street: facilityForm.street,
        city: facilityForm.city || null,
        state: facilityForm.state || null,
        postal_code: facilityForm.postal_code || null,
        pickup_contact: facilityForm.pickup_contact || null,
        pickup_phone: facilityForm.pickup_phone || null,
        is_24_hours: facilityForm.is_24_hours,
        pickup_window_from: facilityForm.is_24_hours ? null : (facilityForm.pickup_window_from || null),
        pickup_window_to: facilityForm.is_24_hours ? null : (facilityForm.pickup_window_to || null),
        special_days: facilityForm.special_days.filter((sd) => sd.enabled),
        notes: facilityForm.notes || null,
      }
      if (editingFacilityId) {
        await fetch(`/api/facilities/${editingFacilityId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else if (vendorId) {
        await fetch(`/api/vendors/${vendorId}/facilities`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }
      setEditingFacilityId(null)
      setNewFacility(false)
      mutateFacilities()
    } finally {
      setSavingFacility(false)
    }
  }

  const deleteFacility = async (id: string) => {
    await fetch(`/api/facilities/${id}`, { method: "DELETE" })
    mutateFacilities()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center p-4 pt-[4vh] overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <Card className="w-full max-w-2xl border-border shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-amber-500/10">
                <Factory className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-lg">
                  {isNew ? "New Vendor" : (existing?.company_name || "Vendor")}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isNew ? "Add a new vendor" : "Edit vendor details"}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
          {isNew || !vendorId ? (
            <CompanyTab
              form={form}
              updateField={updateField}
              addQuotingContact={addQuotingContact}
              removeQuotingContact={removeQuotingContact}
              updateQuotingContact={updateQuotingContact}
              paymentTerms={paymentTerms}
            />
          ) : (
            <Tabs defaultValue="company" className="w-full">
              <TabsList className="mb-4 bg-muted/60 h-auto p-1 w-fit flex flex-wrap gap-0.5">
                <TabsTrigger value="company" className="gap-1.5 px-3 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
                  <Building2 className="h-3.5 w-3.5" /> Company
                </TabsTrigger>
                <TabsTrigger value="quoting" className="gap-1.5 px-3 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
                  <AtSign className="h-3.5 w-3.5" /> Quoting Contacts
                </TabsTrigger>
                <TabsTrigger value="facilities" className="gap-1.5 px-3 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
                  <MapPin className="h-3.5 w-3.5" /> Facilities ({facilities?.length ?? 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="company">
                <CompanyTab
                  form={form}
                  updateField={updateField}
                  addQuotingContact={addQuotingContact}
                  removeQuotingContact={removeQuotingContact}
                  updateQuotingContact={updateQuotingContact}
                  paymentTerms={paymentTerms}
                  hideQuoting
                />
              </TabsContent>

              <TabsContent value="quoting">
                <QuotingTab
                  contacts={form.quoting_contacts}
                  ccAll={form.cc_all_quoting}
                  onAdd={addQuotingContact}
                  onRemove={removeQuotingContact}
                  onUpdate={updateQuotingContact}
                  onToggleCcAll={(v) => updateField("cc_all_quoting", v)}
                />
              </TabsContent>

              <TabsContent value="facilities">
                <FacilitiesTab
                  facilities={facilities ?? []}
                  expandedId={expandedFacility}
                  setExpandedId={setExpandedFacility}
                  editingId={editingFacilityId}
                  onOpenNew={openNewFacility}
                  onOpenEdit={openEditFacility}
                  onDelete={deleteFacility}
                  newFacility={newFacility}
                  facilityForm={facilityForm}
                  setFacilityForm={setFacilityForm}
                  savingFacility={savingFacility}
                  onSave={saveFacility}
                  onCancel={() => { setNewFacility(false); setEditingFacilityId(null) }}
                />
              </TabsContent>
            </Tabs>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button size="sm" className="gap-1.5 text-xs h-9" onClick={handleSave} disabled={saving || !form.company_name.trim()}>
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving..." : isNew ? "Create Vendor" : "Save Changes"}
            </Button>
            {!isNew && vendorId && (
              <div>
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-destructive font-medium">Delete vendor?</span>
                    <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={handleDelete} disabled={deleting}>
                      {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yes, delete"}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:bg-destructive/10 gap-1" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="h-3 w-3" /> Delete
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ==== Company Tab ==== */
function CompanyTab({
  form, updateField, addQuotingContact, removeQuotingContact, updateQuotingContact, paymentTerms, hideQuoting,
}: {
  form: { company_name: string; terms: string; contact_name: string; office_phone: string; cell_phone: string; email: string; quoting_contacts: QuotingContact[]; cc_all_quoting: boolean; pickup_cost: number; website: string; notes: string }
  updateField: (key: string, value: string | boolean | QuotingContact[]) => void
  addQuotingContact: () => void
  removeQuotingContact: (i: number) => void
  updateQuotingContact: (i: number, f: "name" | "email", v: string) => void
  paymentTerms: string[]
  hideQuoting?: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" /> Company Info
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-foreground mb-1 block">Company Name *</label>
            <Input value={form.company_name} onChange={(e) => updateField("company_name", e.target.value)} placeholder="Vendor company name" className="h-8 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Terms</label>
            <Select value={form.terms} onValueChange={(v) => updateField("terms", v)}>
              <SelectTrigger className="h-8 text-sm">
                <div className="flex items-center gap-1.5"><CreditCard className="h-3 w-3 text-muted-foreground" /><SelectValue /></div>
              </SelectTrigger>
              <SelectContent>
                {paymentTerms.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Website</label>
            <Input value={form.website} onChange={(e) => updateField("website", e.target.value)} placeholder="https://..." className="h-8 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Pickup Cost ($)</label>
            <Input type="number" step="1" min="0" value={form.pickup_cost || ""} onChange={(e) => updateField("pickup_cost", e.target.value)} placeholder="0" className="h-8 text-sm" />
          </div>
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <User className="h-3.5 w-3.5" /> Main Contact
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Input value={form.contact_name} onChange={(e) => updateField("contact_name", e.target.value)} placeholder="Contact name" className="h-8 text-sm" />
          <Input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} placeholder="Email" className="h-8 text-sm" />
          <Input value={form.office_phone} onChange={(e) => updateField("office_phone", e.target.value)} placeholder="Office phone" className="h-8 text-sm" />
          <Input value={form.cell_phone} onChange={(e) => updateField("cell_phone", e.target.value)} placeholder="Cell phone" className="h-8 text-sm" />
        </div>
      </section>

      {!hideQuoting && (
        <>
          <Separator />
          <QuotingTab
            contacts={form.quoting_contacts}
            ccAll={form.cc_all_quoting}
            onAdd={addQuotingContact}
            onRemove={removeQuotingContact}
            onUpdate={updateQuotingContact}
            onToggleCcAll={(v) => updateField("cc_all_quoting", v)}
          />
        </>
      )}

      <Separator />

      <section>
        <label className="text-xs font-medium text-foreground mb-1 block">Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          placeholder="Vendor notes..."
          rows={2}
          className="w-full text-sm bg-card border border-border rounded-lg p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
        />
      </section>
    </div>
  )
}

/* ==== Quoting Contacts Tab ==== */
function QuotingTab({
  contacts, ccAll, onAdd, onRemove, onUpdate, onToggleCcAll,
}: {
  contacts: QuotingContact[]
  ccAll: boolean
  onAdd: () => void
  onRemove: (i: number) => void
  onUpdate: (i: number, f: "name" | "email", v: string) => void
  onToggleCcAll: (v: boolean) => void
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <AtSign className="h-3.5 w-3.5" /> Quoting Contacts
        </h3>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onAdd}>
          <Plus className="h-3 w-3" /> Add Contact
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Contacts who receive quote requests. Toggle CC All to include everyone on each request.
      </p>

      <div className="flex items-center gap-2">
        <Switch checked={ccAll} onCheckedChange={onToggleCcAll} />
        <span className="text-xs text-foreground">CC all quoting contacts on every request</span>
      </div>

      <div className="flex flex-col gap-2">
        {contacts.map((c, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                value={c.name}
                onChange={(e) => onUpdate(i, "name", e.target.value)}
                placeholder="Contact name"
                className="h-7 text-xs"
              />
              <Input
                type="email"
                value={c.email}
                onChange={(e) => onUpdate(i, "email", e.target.value)}
                placeholder="Email address"
                className="h-7 text-xs"
              />
            </div>
            <button
              onClick={() => onRemove(i)}
              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label="Remove contact"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {contacts.length === 0 && (
          <p className="text-xs text-muted-foreground py-3 text-center">No quoting contacts added yet.</p>
        )}
      </div>
    </section>
  )
}

/* ==== Facilities Tab ==== */
const DAYS: Array<{ key: "friday" | "saturday" | "sunday"; label: string }> = [
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
]

function FacilitiesTab({
  facilities, expandedId, setExpandedId, editingId, onOpenNew, onOpenEdit, onDelete,
  newFacility, facilityForm, setFacilityForm, savingFacility, onSave, onCancel,
}: {
  facilities: VendorFacility[]
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  editingId: string | null
  onOpenNew: () => void
  onOpenEdit: (f: VendorFacility) => void
  onDelete: (id: string) => void
  newFacility: boolean
  facilityForm: typeof EMPTY_FACILITY
  setFacilityForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FACILITY>>
  savingFacility: boolean
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" /> Facilities ({facilities.length})
        </h3>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onOpenNew}>
          <Plus className="h-3 w-3" /> Add Facility
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {facilities.map((f) => {
          const isEditing = editingId === f.id
          const isExpanded = expandedId === f.id
          return (
            <div key={f.id} className="rounded-lg border border-border bg-muted/30">
              {isEditing ? (
                <div className="p-3">
                  <FacilityForm form={facilityForm} setForm={setFacilityForm} saving={savingFacility} onSave={onSave} onCancel={onCancel} />
                </div>
              ) : (
                <div>
                  <button className="w-full flex items-start justify-between gap-3 p-3 text-left" onClick={() => setExpandedId(isExpanded ? null : f.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{f.label || f.company_name || "Facility"}</span>
                        {f.is_24_hours && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">24 Hours</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {[f.street, f.city, f.state, f.postal_code].filter(Boolean).join(", ")}
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground mt-0.5" /> : <ChevronDown className="h-4 w-4 text-muted-foreground mt-0.5" />}
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 flex flex-col gap-2 border-t border-border pt-2">
                      {f.company_name && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Building2 className="h-3 w-3" /> {f.company_name}</div>}
                      {f.pickup_contact && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><User className="h-3 w-3" /> {f.pickup_contact}</div>}
                      {f.pickup_phone && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Phone className="h-3 w-3" /> {f.pickup_phone}</div>}
                      {!f.is_24_hours && f.pickup_window_from && f.pickup_window_to && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> {f.pickup_window_from} - {f.pickup_window_to}</div>
                      )}
                      {f.special_days?.filter((sd: SpecialDay) => sd.enabled).map((sd: SpecialDay) => (
                        <div key={sd.day} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" /><span className="capitalize font-medium">{sd.day}:</span> {sd.is_24_hours ? "24 Hours" : `${sd.from} - ${sd.to}`}
                        </div>
                      ))}
                      {f.notes && <p className="text-xs text-muted-foreground italic">{f.notes}</p>}
                      <div className="flex items-center gap-1 mt-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onOpenEdit(f)}>Edit</Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10" onClick={() => onDelete(f.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {newFacility && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <FacilityForm form={facilityForm} setForm={setFacilityForm} saving={savingFacility} onSave={onSave} onCancel={onCancel} />
        </div>
      )}
    </section>
  )
}

/* ==== Facility Inline Form (Pickup Location) ==== */
function FacilityForm({
  form, setForm, saving, onSave, onCancel,
}: {
  form: typeof EMPTY_FACILITY
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FACILITY>>
  saving: boolean
  onSave: () => void
  onCancel: () => void
}) {
  const updateField = (key: string, value: string | boolean | null) =>
    setForm((p) => ({ ...p, [key]: value }))

  const toggleSpecialDay = (day: "friday" | "saturday" | "sunday") => {
    setForm((p) => {
      const existing = p.special_days.find((sd) => sd.day === day)
      if (existing) {
        return { ...p, special_days: p.special_days.map((sd) => sd.day === day ? { ...sd, enabled: !sd.enabled } : sd) }
      }
      return { ...p, special_days: [...p.special_days, { day, enabled: true, from: "08:00", to: "17:00", is_24_hours: false }] }
    })
  }

  const updateSpecialDay = (day: string, key: string, value: string | boolean) => {
    setForm((p) => ({ ...p, special_days: p.special_days.map((sd) => sd.day === day ? { ...sd, [key]: value } : sd) }))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">Label</label>
          <Input value={form.label || ""} onChange={(e) => updateField("label", e.target.value)} placeholder="e.g. Main Plant, Warehouse 2..." className="h-8 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">Company Name</label>
          <Input value={form.company_name || ""} onChange={(e) => updateField("company_name", e.target.value)} placeholder="Facility company name" className="h-8 text-sm" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-foreground mb-1 block">Street *</label>
          <Input value={form.street} onChange={(e) => updateField("street", e.target.value)} placeholder="Street address" className="h-8 text-sm" />
        </div>
        <Input value={form.city || ""} onChange={(e) => updateField("city", e.target.value)} placeholder="City" className="h-8 text-sm" />
        <div className="grid grid-cols-2 gap-2.5">
          <Input value={form.state || ""} onChange={(e) => updateField("state", e.target.value)} placeholder="State" className="h-8 text-sm" />
          <Input value={form.postal_code || ""} onChange={(e) => updateField("postal_code", e.target.value)} placeholder="ZIP" className="h-8 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">Pickup Contact</label>
          <Input value={form.pickup_contact || ""} onChange={(e) => updateField("pickup_contact", e.target.value)} placeholder="Contact name" className="h-8 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">Pickup Phone</label>
          <Input value={form.pickup_phone || ""} onChange={(e) => updateField("pickup_phone", e.target.value)} placeholder="(555) 123-4567" className="h-8 text-sm" />
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-2.5">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="h-3 w-3" /> Pickup Hours
        </h4>
        <div className="flex items-center gap-2">
          <Switch checked={form.is_24_hours} onCheckedChange={(v) => updateField("is_24_hours", v)} />
          <span className="text-xs text-foreground">24 Hours</span>
        </div>
        {!form.is_24_hours && (
          <div className="flex items-center gap-2">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">From</label>
              <Input type="time" value={form.pickup_window_from || "08:00"} onChange={(e) => updateField("pickup_window_from", e.target.value)} className="h-8 text-sm w-32" />
            </div>
            <span className="text-xs text-muted-foreground mt-4">to</span>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">To</label>
              <Input type="time" value={form.pickup_window_to || "17:00"} onChange={(e) => updateField("pickup_window_to", e.target.value)} className="h-8 text-sm w-32" />
            </div>
          </div>
        )}
      </div>

      <Separator />

      <div className="flex flex-col gap-2.5">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Calendar className="h-3 w-3" /> Special Day Hours
        </h4>
        <div className="flex flex-col gap-2">
          {DAYS.map(({ key, label }) => {
            const sd = form.special_days.find((s) => s.day === key)
            const enabled = sd?.enabled ?? false
            return (
              <div key={key} className="rounded-lg border border-border bg-card/50 px-3 py-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <Switch checked={enabled} onCheckedChange={() => toggleSpecialDay(key)} />
                  <span className="text-xs font-medium text-foreground w-16">{label}</span>
                  {enabled && sd && (
                    <div className="flex items-center gap-2 flex-1">
                      <div className="flex items-center gap-2">
                        <Switch checked={sd.is_24_hours} onCheckedChange={(v) => updateSpecialDay(key, "is_24_hours", v)} />
                        <span className="text-[11px] text-muted-foreground">24hr</span>
                      </div>
                      {!sd.is_24_hours && (
                        <div className="flex items-center gap-1.5">
                          <Input type="time" value={sd.from} onChange={(e) => updateSpecialDay(key, "from", e.target.value)} className="h-7 text-xs w-28" />
                          <span className="text-[11px] text-muted-foreground">-</span>
                          <Input type="time" value={sd.to} onChange={(e) => updateSpecialDay(key, "to", e.target.value)} className="h-7 text-xs w-28" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-foreground mb-1 block">Notes</label>
        <textarea
          value={form.notes || ""}
          onChange={(e) => updateField("notes", e.target.value)}
          placeholder="Pickup instructions, dock info, gate codes..."
          rows={2}
          className="w-full text-sm bg-card border border-border rounded-lg p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs gap-1" onClick={onSave} disabled={saving || !form.street?.trim()}>
          <Save className="h-3 w-3" /> {saving ? "Saving..." : "Save Facility"}
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}
