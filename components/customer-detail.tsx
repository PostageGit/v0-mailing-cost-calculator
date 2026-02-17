"use client"

import { useState, useCallback, useEffect } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Truck,
  Clock,
  Calendar,
  ChevronDown,
  ChevronUp,
  Copy,
  CreditCard,
} from "lucide-react"
import type { Customer, CustomerContact, DeliveryAddress, SpecialDay, DepartmentColors } from "@/lib/customer-types"
import { EMPTY_DELIVERY } from "@/lib/customer-types"

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
  const paymentTerms = (settings?.payment_terms ?? ["COD", "BILL 30", "CCOF", "ACH"]) as string[]
  const billingMethods = (settings?.billing_methods ?? ["Check", "ACH", "Credit Card", "Wire Transfer"]) as string[]
  const billingFrequencies = (settings?.billing_frequencies ?? ["Per Job", "Weekly", "Bi-Weekly", "Monthly", "Quarterly"]) as string[]

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
    terms: "COD",
    notes: "",
    custom_fields: {} as Record<string, string>,
    tax_exempt: false,
    tax_id: "",
    tax_rate: 0,
    billing_method: "",
    billing_frequency: "",
    credit_limit: 0,
    account_number: "",
    billing_notes: "",
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

  // Delivery addresses
  const { data: deliveries, mutate: mutateDeliveries } = useSWR<DeliveryAddress[]>(
    customerId ? `/api/customers/${customerId}/deliveries` : null,
    fetcher
  )
  const [expandedDelivery, setExpandedDelivery] = useState<string | null>(null)
  const [newDelivery, setNewDelivery] = useState(false)
  const [deliveryForm, setDeliveryForm] = useState({ ...EMPTY_DELIVERY })
  const [editingDeliveryId, setEditingDeliveryId] = useState<string | null>(null)
  const [savingDelivery, setSavingDelivery] = useState(false)

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
        terms: existing.terms || "COD",
        notes: existing.notes || "",
        custom_fields: existing.custom_fields || {},
        tax_exempt: existing.tax_exempt ?? false,
        tax_id: existing.tax_id || "",
        tax_rate: existing.tax_rate ?? 0,
        billing_method: existing.billing_method || "",
        billing_frequency: existing.billing_frequency || "",
        credit_limit: existing.credit_limit ?? 0,
        account_number: existing.account_number || "",
        billing_notes: existing.billing_notes || "",
      })
    }
  }, [existing])

  const updateField = (key: string, value: string | boolean | number) =>
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

  // Delivery helpers
  const resetDeliveryForm = () => {
    setDeliveryForm({
      ...EMPTY_DELIVERY,
      company_name: form.company_name || null,
    })
  }

  const openNewDelivery = () => {
    setEditingDeliveryId(null)
    resetDeliveryForm()
    setNewDelivery(true)
  }

  const openEditDelivery = (d: DeliveryAddress) => {
    setNewDelivery(false)
    setEditingDeliveryId(d.id)
    setDeliveryForm({
      label: d.label,
      company_name: d.company_name,
      street: d.street,
      city: d.city,
      state: d.state,
      postal_code: d.postal_code,
      delivery_contact: d.delivery_contact,
      delivery_phone: d.delivery_phone,
      after_hours_ok: d.after_hours_ok,
      is_24_hours: d.is_24_hours,
      delivery_window_from: d.delivery_window_from,
      delivery_window_to: d.delivery_window_to,
      special_days: d.special_days || [],
      notes: d.notes,
    })
  }

  const saveDelivery = async () => {
    if (!deliveryForm.street?.trim()) return
    setSavingDelivery(true)
    try {
      const payload = {
        label: deliveryForm.label || null,
        company_name: deliveryForm.company_name || null,
        street: deliveryForm.street,
        city: deliveryForm.city || null,
        state: deliveryForm.state || null,
        postal_code: deliveryForm.postal_code || null,
        delivery_contact: deliveryForm.delivery_contact || null,
        delivery_phone: deliveryForm.delivery_phone || null,
        after_hours_ok: deliveryForm.after_hours_ok,
        is_24_hours: deliveryForm.is_24_hours,
        delivery_window_from: deliveryForm.is_24_hours ? null : (deliveryForm.delivery_window_from || null),
        delivery_window_to: deliveryForm.is_24_hours ? null : (deliveryForm.delivery_window_to || null),
        special_days: deliveryForm.special_days.filter((sd) => sd.enabled),
        notes: deliveryForm.notes || null,
      }

      if (editingDeliveryId) {
        await fetch(`/api/deliveries/${editingDeliveryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else if (customerId) {
        await fetch(`/api/customers/${customerId}/deliveries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }
      setEditingDeliveryId(null)
      setNewDelivery(false)
      mutateDeliveries()
    } finally {
      setSavingDelivery(false)
    }
  }

  const deleteDelivery = async (id: string) => {
    await fetch(`/api/deliveries/${id}`, { method: "DELETE" })
    mutateDeliveries()
  }

  const copyFromCompanyAddress = () => {
    setDeliveryForm((p) => ({
      ...p,
      company_name: form.company_name || null,
      street: form.street || "",
      city: form.city || null,
      state: form.state || null,
      postal_code: form.postal_code || null,
    }))
  }

  const showTabs = !isNew && customerId

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center p-4 pt-[5vh] overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <Card className="w-full max-w-2xl border-border shadow-lg mb-8">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {isNew ? "New Customer" : form.company_name || "Customer Detail"}
              </CardTitle>
              {!isNew && form.terms && (
                <Badge variant="outline" className="text-[10px] font-semibold tracking-wide px-2 py-0.5">
                  {form.terms}
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {showTabs ? (
            <Tabs defaultValue="company" className="w-full">
              <TabsList className="mb-4 bg-muted/60 h-9 p-1 w-fit">
                <TabsTrigger value="company" className="gap-1.5 px-3 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
                  <Building2 className="h-3.5 w-3.5" /> Company
                </TabsTrigger>
                <TabsTrigger value="contacts" className="gap-1.5 px-3 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
                  <Users className="h-3.5 w-3.5" /> Contacts ({contacts?.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="deliveries" className="gap-1.5 px-3 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
                  <Truck className="h-3.5 w-3.5" /> Deliveries ({deliveries?.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="billing" className="gap-1.5 px-3 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
                  <CreditCard className="h-3.5 w-3.5" /> Billing & Tax
                </TabsTrigger>
              </TabsList>

              <TabsContent value="company" className="flex flex-col gap-5 mt-0">
                <CompanyInfoSection
                  form={form}
                  updateField={updateField}
                  updateCustomField={updateCustomField}
                  customerCustomFields={customerCustomFields}
                  paymentTerms={paymentTerms}
                />
                <Separator />
                <ActionBar
                  isNew={isNew}
                  saving={saving}
                  deleting={deleting}
                  confirmDelete={confirmDelete}
                  disabled={!form.company_name.trim()}
                  onSave={handleSave}
                  onDelete={handleDelete}
                  onConfirmDelete={() => setConfirmDelete(true)}
                  onCancelDelete={() => setConfirmDelete(false)}
                  customerId={customerId}
                />
              </TabsContent>

              <TabsContent value="contacts" className="flex flex-col gap-3 mt-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> Contacts
                  </h3>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={openNewContact}>
                    <Plus className="h-3 w-3" /> Add Contact
                  </Button>
                </div>

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

                {(!contacts || contacts.length === 0) && !newContact && (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                    <Users className="h-7 w-7 opacity-40" />
                    <p className="text-sm">No contacts yet</p>
                    <p className="text-xs">Add contacts for this customer above.</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="deliveries" className="flex flex-col gap-3 mt-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5" /> Delivery Addresses
                  </h3>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={openNewDelivery}>
                    <Plus className="h-3 w-3" /> Add Address
                  </Button>
                </div>

                <div className="flex flex-col gap-2">
                  {deliveries?.map((d) => {
                    const isEditing = editingDeliveryId === d.id
                    const isExpanded = expandedDelivery === d.id
                    return (
                      <div key={d.id} className="rounded-lg border border-border bg-muted/30">
                        {isEditing ? (
                          <div className="p-3">
                            <DeliveryForm
                              form={deliveryForm}
                              setForm={setDeliveryForm}
                              saving={savingDelivery}
                              onSave={saveDelivery}
                              onCancel={() => setEditingDeliveryId(null)}
                              onCopyAddress={copyFromCompanyAddress}
                            />
                          </div>
                        ) : (
                          <div>
                            <button
                              className="w-full flex items-start justify-between gap-3 p-3 text-left"
                              onClick={() => setExpandedDelivery(isExpanded ? null : d.id)}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold text-foreground">
                                    {d.label || d.company_name || "Delivery Address"}
                                  </span>
                                  {d.after_hours_ok && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">After Hours OK</Badge>
                                  )}
                                  {d.is_24_hours && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">24 Hours</Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {[d.street, d.city, d.state, d.postal_code].filter(Boolean).join(", ")}
                                </div>
                              </div>
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground mt-0.5" /> : <ChevronDown className="h-4 w-4 text-muted-foreground mt-0.5" />}
                            </button>
                            {isExpanded && (
                              <div className="px-3 pb-3 flex flex-col gap-2 border-t border-border pt-2">
                                {d.company_name && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Building2 className="h-3 w-3" /> {d.company_name}</div>
                                )}
                                {d.delivery_contact && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><User className="h-3 w-3" /> {d.delivery_contact}</div>
                                )}
                                {d.delivery_phone && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Phone className="h-3 w-3" /> {d.delivery_phone}</div>
                                )}
                                {!d.is_24_hours && d.delivery_window_from && d.delivery_window_to && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> {d.delivery_window_from} - {d.delivery_window_to}</div>
                                )}
                                {d.special_days && d.special_days.filter((sd: SpecialDay) => sd.enabled).length > 0 && (
                                  <div className="flex flex-col gap-0.5">
                                    {d.special_days.filter((sd: SpecialDay) => sd.enabled).map((sd: SpecialDay) => (
                                      <div key={sd.day} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Calendar className="h-3 w-3" />
                                        <span className="capitalize font-medium">{sd.day}:</span>
                                        {sd.is_24_hours ? "24 Hours" : `${sd.from} - ${sd.to}`}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {d.notes && <p className="text-xs text-muted-foreground italic">{d.notes}</p>}
                                <div className="flex items-center gap-1 mt-1">
                                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEditDelivery(d)}>Edit</Button>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10" onClick={() => deleteDelivery(d.id)}>
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

                {newDelivery && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <DeliveryForm
                      form={deliveryForm}
                      setForm={setDeliveryForm}
                      saving={savingDelivery}
                      onSave={saveDelivery}
                      onCancel={() => setNewDelivery(false)}
                      onCopyAddress={copyFromCompanyAddress}
                    />
                  </div>
                )}

                {(!deliveries || deliveries.length === 0) && !newDelivery && (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                    <Truck className="h-7 w-7 opacity-40" />
                    <p className="text-sm">No delivery addresses yet</p>
                    <p className="text-xs">Add a delivery location for this customer above.</p>
                  </div>
                )}
              </TabsContent>

              {/* ── Billing & Tax ── */}
              <TabsContent value="billing" className="flex flex-col gap-5 mt-0">
                {/* Tax Info */}
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Receipt className="h-3.5 w-3.5" /> Tax Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                      <Label className="text-xs text-muted-foreground">Tax Exempt</Label>
                      <Switch checked={!!form.tax_exempt} onCheckedChange={(v) => updateField("tax_exempt", v)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Tax ID / EIN</Label>
                      <Input value={form.tax_id} onChange={(e) => updateField("tax_id", e.target.value)} placeholder="e.g. 12-3456789" className="h-9 text-sm rounded-xl border-border" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Tax Rate (%)</Label>
                      <Input type="number" step="0.001" min={0} max={100} value={form.tax_rate || ""} onChange={(e) => updateField("tax_rate", e.target.value)} placeholder="0.000" className="h-9 text-sm rounded-xl border-border" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Account Number</Label>
                      <Input value={form.account_number} onChange={(e) => updateField("account_number", e.target.value)} placeholder="Internal acct #" className="h-9 text-sm rounded-xl border-border" />
                    </div>
                  </div>
                </section>

                {/* Billing Preferences */}
                <Separator />
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" /> Billing Preferences
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Billing Method</Label>
                      <Select value={form.billing_method || ""} onValueChange={(v) => updateField("billing_method", v)}>
                        <SelectTrigger className="h-9 text-sm rounded-xl border-border">
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          {billingMethods.map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Billing Frequency</Label>
                      <Select value={form.billing_frequency || ""} onValueChange={(v) => updateField("billing_frequency", v)}>
                        <SelectTrigger className="h-9 text-sm rounded-xl border-border">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          {billingFrequencies.map((f) => (
                            <SelectItem key={f} value={f}>{f}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Credit Limit ($)</Label>
                      <Input type="number" step="0.01" min={0} value={form.credit_limit || ""} onChange={(e) => updateField("credit_limit", e.target.value)} placeholder="0.00" className="h-9 text-sm rounded-xl border-border" />
                    </div>
                  </div>
                </section>

                {/* Billing Notes */}
                <Separator />
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Billing Notes</h3>
                  <Textarea value={form.billing_notes} onChange={(e) => updateField("billing_notes", e.target.value)} placeholder="Special billing instructions, PO requirements, etc." className="min-h-[80px] text-sm rounded-xl border-border" />
                </section>

                <Separator />
                <ActionBar
                  isNew={isNew}
                  saving={saving}
                  deleting={deleting}
                  confirmDelete={confirmDelete}
                  disabled={!form.company_name.trim()}
                  onSave={handleSave}
                  onDelete={handleDelete}
                  onConfirmDelete={() => setConfirmDelete(true)}
                  onCancelDelete={() => setConfirmDelete(false)}
                  customerId={customerId}
                />
              </TabsContent>
            </Tabs>
          ) : (
            /* New customer -- no tabs, just the company form */
            <div className="flex flex-col gap-5">
              <CompanyInfoSection
                form={form}
                updateField={updateField}
                updateCustomField={updateCustomField}
                customerCustomFields={customerCustomFields}
                paymentTerms={paymentTerms}
              />
              <Separator />
              <ActionBar
                isNew={isNew}
                saving={saving}
                deleting={deleting}
                confirmDelete={confirmDelete}
                disabled={!form.company_name.trim()}
                onSave={handleSave}
                onDelete={handleDelete}
                onConfirmDelete={() => setConfirmDelete(true)}
                onCancelDelete={() => setConfirmDelete(false)}
                customerId={customerId}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ==== Company Info Section (shared between tabs and new-customer view) ==== */
function CompanyInfoSection({
  form,
  updateField,
  updateCustomField,
  customerCustomFields,
  paymentTerms,
}: {
  form: Record<string, any>
  updateField: (key: string, value: string | boolean) => void
  updateCustomField: (key: string, value: string) => void
  customerCustomFields: { name: string }[]
  paymentTerms: string[]
}) {
  return (
    <>
      {/* Company Info */}
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Company Info</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-foreground mb-1 block">Company Name *</label>
            <Input value={form.company_name} onChange={(e) => updateField("company_name", e.target.value)} placeholder="Company name" className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Contact Name</label>
            <Input value={form.contact_name} onChange={(e) => updateField("contact_name", e.target.value)} placeholder="Primary contact" className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Email</label>
            <Input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} placeholder="email@company.com" className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Office Phone</label>
            <Input value={form.office_phone} onChange={(e) => updateField("office_phone", e.target.value)} placeholder="(555) 123-4567" className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Cell Phone</label>
            <Input value={form.cell_phone} onChange={(e) => updateField("cell_phone", e.target.value)} placeholder="(555) 987-6543" className="h-9 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-foreground mb-1 block">Website</label>
            <Input value={form.website} onChange={(e) => updateField("website", e.target.value)} placeholder="https://example.com" className="h-9 text-sm" />
          </div>
        </div>
      </section>

      <Separator />

      {/* Payment Terms */}
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5" /> Payment Terms
        </h3>
        <div className="flex items-center gap-2">
          <Select value={form.terms || "COD"} onValueChange={(v) => updateField("terms", v)}>
            <SelectTrigger className="h-9 text-sm w-48">
              <SelectValue placeholder="Select terms" />
            </SelectTrigger>
            <SelectContent>
              {paymentTerms.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">Default: COD</span>
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
            <Input value={form.street} onChange={(e) => updateField("street", e.target.value)} placeholder="Street address" className="h-9 text-sm" />
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
            <Switch checked={form.billing_same_as_primary} onCheckedChange={(v) => updateField("billing_same_as_primary", v)} />
          </div>
        </div>
        {!form.billing_same_as_primary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Input value={form.billing_contact_name} onChange={(e) => updateField("billing_contact_name", e.target.value)} placeholder="Billing contact name" className="h-9 text-sm" />
            </div>
            <Input type="email" value={form.billing_contact_email} onChange={(e) => updateField("billing_contact_email", e.target.value)} placeholder="Billing email" className="h-9 text-sm" />
            <Input value={form.billing_contact_phone} onChange={(e) => updateField("billing_contact_phone", e.target.value)} placeholder="Billing phone" className="h-9 text-sm" />
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
                  <Input value={form.custom_fields[f.name] || ""} onChange={(e) => updateCustomField(f.name, e.target.value)} className="h-9 text-sm" />
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
    </>
  )
}

/* ==== Action Bar ==== */
function ActionBar({
  isNew,
  saving,
  deleting,
  confirmDelete,
  disabled,
  onSave,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
  customerId,
}: {
  isNew: boolean
  saving: boolean
  deleting: boolean
  confirmDelete: boolean
  disabled: boolean
  onSave: () => void
  onDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
  customerId: string | null
}) {
  return (
    <div className="flex items-center justify-between">
      <Button size="sm" className="gap-1.5 text-xs h-9" onClick={onSave} disabled={saving || disabled}>
        <Save className="h-3.5 w-3.5" />
        {saving ? "Saving..." : isNew ? "Create Customer" : "Save Changes"}
      </Button>
      {!isNew && customerId && (
        <div>
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-destructive font-medium">Delete customer?</span>
              <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={onDelete} disabled={deleting}>
                {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yes, delete"}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancelDelete}>Cancel</Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:bg-destructive/10 gap-1" onClick={onConfirmDelete}>
              <Trash2 className="h-3 w-3" /> Delete
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/* ==== Contact Inline Form ==== */
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
        <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Contact name *" className="h-8 text-sm" />
        <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Job title" className="h-8 text-sm" />
        <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="Email" className="h-8 text-sm" />
        <Input value={form.cell_phone} onChange={(e) => setForm((p) => ({ ...p, cell_phone: e.target.value }))} placeholder="Cell phone" className="h-8 text-sm" />
        <Input value={form.office_phone} onChange={(e) => setForm((p) => ({ ...p, office_phone: e.target.value }))} placeholder="Office phone" className="h-8 text-sm" />
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
                  style={selected ? { backgroundColor: color + "25", color, borderColor: color + "60" } : { borderColor: "var(--border)", color: "var(--muted-foreground)" }}
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

      {customFields.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {customFields.map((f) => (
            <Input
              key={f.name}
              value={form.custom_fields[f.name] || ""}
              onChange={(e) => setForm((p) => ({ ...p, custom_fields: { ...p.custom_fields, [f.name]: e.target.value } }))}
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
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

/* ==== Delivery Address Inline Form ==== */
const DAYS: Array<{ key: "friday" | "saturday" | "sunday"; label: string }> = [
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
]

function DeliveryForm({
  form,
  setForm,
  saving,
  onSave,
  onCancel,
  onCopyAddress,
}: {
  form: typeof EMPTY_DELIVERY
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_DELIVERY>>
  saving: boolean
  onSave: () => void
  onCancel: () => void
  onCopyAddress: () => void
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
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-xs font-medium text-foreground mb-1 block">Label</label>
          <Input value={form.label || ""} onChange={(e) => updateField("label", e.target.value)} placeholder="e.g. Main Office, Warehouse..." className="h-8 text-sm" />
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1 mt-5" onClick={onCopyAddress}>
          <Copy className="h-3 w-3" /> Copy Company Address
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-foreground mb-1 block">Company Name</label>
          <Input value={form.company_name || ""} onChange={(e) => updateField("company_name", e.target.value)} placeholder="Delivery company name" className="h-8 text-sm" />
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
          <label className="text-xs font-medium text-foreground mb-1 block">Delivery Contact</label>
          <Input value={form.delivery_contact || ""} onChange={(e) => updateField("delivery_contact", e.target.value)} placeholder="Contact name" className="h-8 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">Delivery Phone</label>
          <Input value={form.delivery_phone || ""} onChange={(e) => updateField("delivery_phone", e.target.value)} placeholder="(555) 123-4567" className="h-8 text-sm" />
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-2.5">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="h-3 w-3" /> Delivery Hours
        </h4>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch checked={form.after_hours_ok} onCheckedChange={(v) => updateField("after_hours_ok", v)} />
            <span className="text-xs text-foreground">After business hours OK</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.is_24_hours} onCheckedChange={(v) => updateField("is_24_hours", v)} />
            <span className="text-xs text-foreground">24 Hours</span>
          </div>
        </div>
        {!form.is_24_hours && (
          <div className="flex items-center gap-2">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">From</label>
              <Input type="time" value={form.delivery_window_from || "08:00"} onChange={(e) => updateField("delivery_window_from", e.target.value)} className="h-8 text-sm w-32" />
            </div>
            <span className="text-xs text-muted-foreground mt-4">to</span>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">To</label>
              <Input type="time" value={form.delivery_window_to || "17:00"} onChange={(e) => updateField("delivery_window_to", e.target.value)} className="h-8 text-sm w-32" />
            </div>
          </div>
        )}
      </div>

      <Separator />

      <div className="flex flex-col gap-2.5">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Calendar className="h-3 w-3" /> Special Day Hours
        </h4>
        <p className="text-[11px] text-muted-foreground">Set different delivery hours for Friday, Saturday, or Sunday if they differ from the standard window.</p>
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
          placeholder="Delivery instructions, dock info, gate codes..."
          rows={2}
          className="w-full text-sm bg-card border border-border rounded-lg p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs gap-1" onClick={onSave} disabled={saving || !form.street?.trim()}>
          <Save className="h-3 w-3" />
          {saving ? "Saving..." : "Save Address"}
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}
