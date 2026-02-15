"use client"

import { useState, useCallback, useEffect } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  Save,
  X,
  Trash2,
  Loader2,
  Plus,
  User,
  Building2,
  Phone,
  Mail,
  Globe,
  MapPin,
  Receipt,
  Users,
  Smartphone,
} from "lucide-react"
import type { Customer, CustomerContact, DepartmentColors, EMPTY_CUSTOMER, EMPTY_CONTACT } from "@/lib/customer-types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Props {
  customerId: string | null
  isNew: boolean
  deptColors: DepartmentColors
  onClose: () => void
  onCreated: (id: string) => void
}

export function CustomerDetail({ customerId, isNew, deptColors, onClose, onCreated }: Props) {
  const { data: existing } = useSWR<Customer>(
    customerId ? `/api/customers/${customerId}` : null,
    fetcher
  )
  const { data: contacts, mutate: mutateContacts } = useSWR<CustomerContact[]>(
    customerId ? `/api/customers/${customerId}/contacts` : null,
    fetcher
  )
  const { data: settings } = useSWR<Record<string, unknown>>("/api/app-settings", fetcher)
  const customerCustomFields = (settings?.customer_custom_fields ?? []) as { name: string }[]
  const contactCustomFields = (settings?.contact_custom_fields ?? []) as { name: string }[]

  // Form state
  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    office_phone: "",
    cell_phone: "",
    email: "",
    billing_same_as_primary: true,
    billing_contact_name: "",
    billing_contact_email: "",
    billing_contact_phone: "",
    website: "",
    street: "",
    city: "",
    state: "",
    postal_code: "",
    country: "US",
    notes: "",
    custom_fields: {} as Record<string, string>,
  })

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Contact editing
  const [editingContact, setEditingContact] = useState<CustomerContact | null>(null)
  const [newContact, setNewContact] = useState(false)
  const [contactForm, setContactForm] = useState({
    name: "",
    department: "",
    email: "",
    cell_phone: "",
    office_phone: "",
    title: "",
    notes: "",
    custom_fields: {} as Record<string, string>,
  })
  const [savingContact, setSavingContact] = useState(false)

  // Load existing
  useEffect(() => {
    if (existing) {
      setForm({
        company_name: existing.company_name || "",
        contact_name: existing.contact_name || "",
        office_phone: existing.office_phone || "",
        cell_phone: existing.cell_phone || "",
        email: existing.email || "",
        billing_same_as_primary: existing.billing_same_as_primary,
        billing_contact_name: existing.billing_contact_name || "",
        billing_contact_email: existing.billing_contact_email || "",
        billing_contact_phone: existing.billing_contact_phone || "",
        website: existing.website || "",
        street: existing.street || "",
        city: existing.city || "",
        state: existing.state || "",
        postal_code: existing.postal_code || "",
        country: existing.country || "US",
        notes: existing.notes || "",
        custom_fields: existing.custom_fields || {},
      })
    }
  }, [existing])

  const updateField = (key: string, value: string | boolean) =>
    setForm((p) => ({ ...p, [key]: value }))

  const updateCustomField = (key: string, value: string) =>
    setForm((p) => ({ ...p, custom_fields: { ...p.custom_fields, [key]: value } }))

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
        billing_contact_name: form.billing_same_as_primary ? null : (form.billing_contact_name || null),
        billing_contact_email: form.billing_same_as_primary ? null : (form.billing_contact_email || null),
        billing_contact_phone: form.billing_same_as_primary ? null : (form.billing_contact_phone || null),
        website: form.website || null,
        street: form.street || null,
        city: form.city || null,
        state: form.state || null,
        postal_code: form.postal_code || null,
        notes: form.notes || null,
      }

      if (isNew) {
        const res = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.id) onCreated(data.id)
      } else if (customerId) {
        await fetch(`/api/customers/${customerId}`, {
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
    if (!customerId) return
    setDeleting(true)
    await fetch(`/api/customers/${customerId}`, { method: "DELETE" })
    setDeleting(false)
    onClose()
  }

  // Contact helpers
  const openNewContact = () => {
    setEditingContact(null)
    setContactForm({ name: "", department: "", email: "", cell_phone: "", office_phone: "", title: "", notes: "", custom_fields: {} })
    setNewContact(true)
  }

  const openEditContact = (c: CustomerContact) => {
    setNewContact(false)
    setEditingContact(c)
    setContactForm({
      name: c.name || "",
      department: c.department || "",
      email: c.email || "",
      cell_phone: c.cell_phone || "",
      office_phone: c.office_phone || "",
      title: c.title || "",
      notes: c.notes || "",
      custom_fields: c.custom_fields || {},
    })
  }

  const saveContact = async () => {
    if (!contactForm.name.trim()) return
    setSavingContact(true)
    try {
      const payload = {
        name: contactForm.name,
        department: contactForm.department || null,
        email: contactForm.email || null,
        cell_phone: contactForm.cell_phone || null,
        office_phone: contactForm.office_phone || null,
        title: contactForm.title || null,
        notes: contactForm.notes || null,
        custom_fields: contactForm.custom_fields,
      }

      if (editingContact) {
        await fetch(`/api/contacts/${editingContact.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else if (customerId) {
        await fetch(`/api/customers/${customerId}/contacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }
      setEditingContact(null)
      setNewContact(false)
      mutateContacts()
    } finally {
      setSavingContact(false)
    }
  }

  const deleteContact = async (id: string) => {
    await fetch(`/api/contacts/${id}`, { method: "DELETE" })
    mutateContacts()
  }

  const getDeptColor = (dept: string | null) => {
    if (!dept) return undefined
    return deptColors[dept] ?? undefined
  }

  const allDepartments = Object.keys(deptColors)

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center p-4 pt-[5vh] overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <Card className="w-full max-w-2xl border-border shadow-lg mb-8">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {isNew ? "New Customer" : form.company_name || "Customer Detail"}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Company Info */}
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Company Info</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-foreground mb-1 block">Company Name *</label>
                <Input
                  value={form.company_name}
                  onChange={(e) => updateField("company_name", e.target.value)}
                  placeholder="Company name"
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Contact Name</label>
                <Input
                  value={form.contact_name}
                  onChange={(e) => updateField("contact_name", e.target.value)}
                  placeholder="Primary contact"
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Email</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="email@company.com"
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Office Phone</label>
                <Input
                  value={form.office_phone}
                  onChange={(e) => updateField("office_phone", e.target.value)}
                  placeholder="(555) 123-4567"
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Cell Phone</label>
                <Input
                  value={form.cell_phone}
                  onChange={(e) => updateField("cell_phone", e.target.value)}
                  placeholder="(555) 987-6543"
                  className="h-9 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-foreground mb-1 block">Website</label>
                <Input
                  value={form.website}
                  onChange={(e) => updateField("website", e.target.value)}
                  placeholder="https://example.com"
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* Address */}
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Address
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Input
                  value={form.street}
                  onChange={(e) => updateField("street", e.target.value)}
                  placeholder="Street address"
                  className="h-9 text-sm"
                />
              </div>
              <Input value={form.city} onChange={(e) => updateField("city", e.target.value)} placeholder="City" className="h-9 text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <Input value={form.state} onChange={(e) => updateField("state", e.target.value)} placeholder="State" className="h-9 text-sm" />
                <Input value={form.postal_code} onChange={(e) => updateField("postal_code", e.target.value)} placeholder="ZIP" className="h-9 text-sm" />
              </div>
            </div>
          </section>

          <Separator />

          {/* Billing Contact */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5" /> Billing Contact
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Same as primary</span>
                <Switch
                  checked={form.billing_same_as_primary}
                  onCheckedChange={(v) => updateField("billing_same_as_primary", v)}
                />
              </div>
            </div>
            {!form.billing_same_as_primary && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Input
                    value={form.billing_contact_name}
                    onChange={(e) => updateField("billing_contact_name", e.target.value)}
                    placeholder="Billing contact name"
                    className="h-9 text-sm"
                  />
                </div>
                <Input
                  type="email"
                  value={form.billing_contact_email}
                  onChange={(e) => updateField("billing_contact_email", e.target.value)}
                  placeholder="Billing email"
                  className="h-9 text-sm"
                />
                <Input
                  value={form.billing_contact_phone}
                  onChange={(e) => updateField("billing_contact_phone", e.target.value)}
                  placeholder="Billing phone"
                  className="h-9 text-sm"
                />
              </div>
            )}
          </section>

          {/* Custom fields */}
          {customerCustomFields.length > 0 && (
            <>
              <Separator />
              <section className="flex flex-col gap-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Custom Fields</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {customerCustomFields.map((f) => (
                    <div key={f.name}>
                      <label className="text-xs font-medium text-foreground mb-1 block">{f.name}</label>
                      <Input
                        value={form.custom_fields[f.name] || ""}
                        onChange={(e) => updateCustomField(f.name, e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          <Separator />

          {/* Notes */}
          <section>
            <label className="text-xs font-medium text-foreground mb-1 block">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="Internal notes..."
              rows={2}
              className="w-full text-sm bg-card border border-border rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
          </section>

          {/* Contacts Section (only for existing customers) */}
          {customerId && !isNew && (
            <>
              <Separator />
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> Contacts ({contacts?.length ?? 0})
                  </h3>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={openNewContact}>
                    <Plus className="h-3 w-3" /> Add Contact
                  </Button>
                </div>

                {/* Contact cards */}
                <div className="flex flex-col gap-2">
                  {contacts?.map((c) => {
                    const color = getDeptColor(c.department)
                    const isEditing = editingContact?.id === c.id
                    return (
                      <div key={c.id} className="rounded-lg border border-border bg-muted/30 p-3">
                        {isEditing ? (
                          <ContactForm
                            form={contactForm}
                            setForm={setContactForm}
                            departments={allDepartments}
                            deptColors={deptColors}
                            customFields={contactCustomFields}
                            saving={savingContact}
                            onSave={saveContact}
                            onCancel={() => setEditingContact(null)}
                          />
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-foreground">{c.name}</span>
                                {c.department && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] px-1.5 py-0 font-medium"
                                    style={color ? { backgroundColor: color + "20", color, borderColor: color + "40" } : {}}
                                  >
                                    {c.department}
                                  </Badge>
                                )}
                                {c.title && <span className="text-[11px] text-muted-foreground">{c.title}</span>}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                                {c.email && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Mail className="h-3 w-3" />{c.email}
                                  </span>
                                )}
                                {c.cell_phone && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Smartphone className="h-3 w-3" />{c.cell_phone}
                                  </span>
                                )}
                                {c.office_phone && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Phone className="h-3 w-3" />{c.office_phone}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEditContact(c)}>
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                onClick={() => deleteContact(c.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* New Contact Form */}
                {newContact && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <ContactForm
                      form={contactForm}
                      setForm={setContactForm}
                      departments={allDepartments}
                      deptColors={deptColors}
                      customFields={contactCustomFields}
                      saving={savingContact}
                      onSave={saveContact}
                      onCancel={() => setNewContact(false)}
                    />
                  </div>
                )}
              </section>
            </>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button size="sm" className="gap-1.5 text-xs h-9" onClick={handleSave} disabled={saving || !form.company_name.trim()}>
                <Save className="h-3.5 w-3.5" />
                {saving ? "Saving..." : isNew ? "Create Customer" : "Save Changes"}
              </Button>
            </div>
            {!isNew && customerId && (
              <div>
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-destructive font-medium">Delete customer?</span>
                    <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={handleDelete} disabled={deleting}>
                      {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yes, delete"}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </Button>
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

/* ---- Contact Inline Form ---- */
function ContactForm({
  form,
  setForm,
  departments,
  deptColors,
  customFields,
  saving,
  onSave,
  onCancel,
}: {
  form: {
    name: string
    department: string
    email: string
    cell_phone: string
    office_phone: string
    title: string
    notes: string
    custom_fields: Record<string, string>
  }
  setForm: (fn: (p: typeof form) => typeof form) => void
  departments: string[]
  deptColors: DepartmentColors
  customFields: { name: string }[]
  saving: boolean
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Input
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          placeholder="Contact name *"
          className="h-8 text-sm"
        />
        <Input
          value={form.title}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          placeholder="Job title"
          className="h-8 text-sm"
        />
        <Input
          type="email"
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          placeholder="Email"
          className="h-8 text-sm"
        />
        <Input
          value={form.cell_phone}
          onChange={(e) => setForm((p) => ({ ...p, cell_phone: e.target.value }))}
          placeholder="Cell phone"
          className="h-8 text-sm"
        />
        <Input
          value={form.office_phone}
          onChange={(e) => setForm((p) => ({ ...p, office_phone: e.target.value }))}
          placeholder="Office phone"
          className="h-8 text-sm"
        />
        {/* Department selector */}
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap gap-1">
            {departments.map((d) => {
              const color = deptColors[d]
              const selected = form.department === d
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, department: selected ? "" : d }))}
                  className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors"
                  style={
                    selected
                      ? { backgroundColor: color + "25", color, borderColor: color + "60" }
                      : { borderColor: "var(--border)", color: "var(--muted-foreground)" }
                  }
                >
                  {d}
                </button>
              )
            })}
          </div>
          <Input
            value={departments.includes(form.department) ? "" : form.department}
            onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
            placeholder="Or type department..."
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Contact custom fields */}
      {customFields.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {customFields.map((f) => (
            <Input
              key={f.name}
              value={form.custom_fields[f.name] || ""}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  custom_fields: { ...p.custom_fields, [f.name]: e.target.value },
                }))
              }
              placeholder={f.name}
              className="h-8 text-sm"
            />
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs gap-1" onClick={onSave} disabled={saving || !form.name.trim()}>
          <Save className="h-3 w-3" />
          {saving ? "Saving..." : "Save Contact"}
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
