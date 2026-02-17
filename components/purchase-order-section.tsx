"use client"

import { useState, useRef } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Plus, Send, Printer, CheckCircle2, Clock, AlertTriangle,
  Package, Trash2, ChevronDown, ChevronUp, X, Truck, Factory,
} from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface PO {
  id: string; job_id: string
  po_number: string; ohp_job_number: string; ohp_location: string
  urgency: string; needed_date: string | null; needed_time: string
  status: string; cost: number; notes: string; ohp_email: string
  sent_at: string | null; confirmed_at: string | null
  in_production_at: string | null; received_at: string | null
  created_by: string; created_at: string; updated_at: string
  quotes?: { project_name: string; company_name: string }
}

const STATUS_FLOW = ["draft", "sent", "confirmed", "in_production", "received"] as const
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: <Clock className="h-3 w-3" /> },
  sent: { label: "Sent", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: <Send className="h-3 w-3" /> },
  confirmed: { label: "Confirmed", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: <CheckCircle2 className="h-3 w-3" /> },
  in_production: { label: "In Production", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", icon: <Factory className="h-3 w-3" /> },
  received: { label: "Received", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: <Package className="h-3 w-3" /> },
}

const URGENCY_CONFIG: Record<string, { label: string; color: string }> = {
  past_due: { label: "PAST DUE!", color: "bg-red-600 text-white animate-pulse" },
  today: { label: "TODAY", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-bold" },
  tomorrow: { label: "Tomorrow", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  standard: { label: "Standard", color: "bg-muted text-muted-foreground" },
  custom: { label: "Custom Date", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
}

export function PurchaseOrderSection({ jobId, jobName }: { jobId: string; jobName: string }) {
  const { data: pos, mutate: mutatePOs } = useSWR<PO[]>(`/api/purchase-orders?job_id=${jobId}`, fetcher)
  const { data: settings } = useSWR<Record<string, unknown>>("/api/app-settings", fetcher)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const ohpLocations = (settings?.ohp_locations ?? ["OHP Main"]) as string[]
  const ohpEmails = (settings?.ohp_emails ?? []) as string[]

  // New PO form state
  const [form, setForm] = useState({
    po_number: "", ohp_job_number: "", ohp_location: ohpLocations[0] || "",
    urgency: "standard", needed_date: "", needed_time: "",
    cost: "", notes: "", ohp_email: ohpEmails[0] || "",
  })

  const resetForm = () => {
    setForm({
      po_number: "", ohp_job_number: "", ohp_location: ohpLocations[0] || "",
      urgency: "standard", needed_date: "", needed_time: "",
      cost: "", notes: "", ohp_email: ohpEmails[0] || "",
    })
    setShowForm(false)
  }

  const valid = form.po_number.trim() || form.ohp_job_number.trim()

  const createPO = async () => {
    if (!valid) return
    setSaving(true)
    try {
      await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          job_id: jobId,
          cost: form.cost ? parseFloat(form.cost) : 0,
          needed_date: form.needed_date || null,
        }),
      })
      mutatePOs()
      globalMutate((key: string) => typeof key === "string" && key.startsWith("/api/purchase-orders"))
      resetForm()
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (poId: string, newStatus: string) => {
    await fetch(`/api/purchase-orders/${poId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    mutatePOs()
    globalMutate((key: string) => typeof key === "string" && key.startsWith("/api/purchase-orders"))
  }

  const sendPO = async (po: PO) => {
    await fetch(`/api/purchase-orders/${po.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: po.ohp_email }),
    })
    mutatePOs()
    globalMutate((key: string) => typeof key === "string" && key.startsWith("/api/purchase-orders"))
  }

  const deletePO = async (poId: string) => {
    await fetch(`/api/purchase-orders/${poId}`, { method: "DELETE" })
    mutatePOs()
    globalMutate((key: string) => typeof key === "string" && key.startsWith("/api/purchase-orders"))
  }

  const handlePrint = (po: PO) => {
    const w = window.open("", "_blank", "width=700,height=900")
    if (!w) return
    const urgLabel = URGENCY_CONFIG[po.urgency]?.label || po.urgency
    const statusLabel = STATUS_CONFIG[po.status]?.label || po.status
    w.document.write(`<!DOCTYPE html><html><head><title>PO ${po.po_number || po.ohp_job_number}</title>
    <style>body{font-family:system-ui,sans-serif;padding:40px;color:#111}
    h1{font-size:24px;margin-bottom:4px}h2{font-size:14px;color:#666;margin-top:0}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0}
    .field{border:1px solid #ddd;border-radius:8px;padding:10px}
    .field label{font-size:10px;text-transform:uppercase;color:#888;letter-spacing:0.5px;display:block}
    .field span{font-size:14px;font-weight:600}
    .urgency{display:inline-block;padding:4px 12px;border-radius:6px;font-weight:700;font-size:12px;
      ${po.urgency === "past_due" ? "background:#dc2626;color:white" :
        po.urgency === "today" ? "background:#fee2e2;color:#b91c1c" :
        po.urgency === "tomorrow" ? "background:#fef3c7;color:#b45309" :
        "background:#f3f4f6;color:#374151"}}
    .timeline{margin-top:20px;border-top:1px solid #ddd;padding-top:16px}
    .timeline div{font-size:12px;color:#666;margin-bottom:4px}
    .notes{margin-top:16px;padding:12px;background:#f9fafb;border-radius:8px;font-size:13px}
    @media print{body{padding:20px}}</style></head><body>
    <h1>Purchase Order: ${po.po_number || "N/A"}</h1>
    <h2>Job: ${jobName}</h2>
    <div class="grid">
      <div class="field"><label>PO Number</label><span>${po.po_number || "—"}</span></div>
      <div class="field"><label>OHP Job #</label><span>${po.ohp_job_number || "—"}</span></div>
      <div class="field"><label>OHP Location</label><span>${po.ohp_location || "—"}</span></div>
      <div class="field"><label>Status</label><span>${statusLabel}</span></div>
      <div class="field"><label>Urgency</label><span class="urgency">${urgLabel}</span></div>
      <div class="field"><label>Needed By</label><span>${po.needed_date || "—"} ${po.needed_time || ""}</span></div>
      <div class="field"><label>Cost</label><span>${po.cost ? "$" + Number(po.cost).toFixed(2) : "—"}</span></div>
      <div class="field"><label>OHP Email</label><span>${po.ohp_email || "—"}</span></div>
    </div>
    ${po.notes ? `<div class="notes"><strong>Notes:</strong> ${po.notes}</div>` : ""}
    <div class="timeline"><strong>Timeline</strong>
      <div>Created: ${new Date(po.created_at).toLocaleString()}</div>
      ${po.sent_at ? `<div>Sent: ${new Date(po.sent_at).toLocaleString()}</div>` : ""}
      ${po.confirmed_at ? `<div>Confirmed: ${new Date(po.confirmed_at).toLocaleString()}</div>` : ""}
      ${po.in_production_at ? `<div>In Production: ${new Date(po.in_production_at).toLocaleString()}</div>` : ""}
      ${po.received_at ? `<div>Received: ${new Date(po.received_at).toLocaleString()}</div>` : ""}
    </div></body></html>`)
    w.document.close()
    w.print()
  }

  const getNextStatus = (current: string) => {
    const idx = STATUS_FLOW.indexOf(current as typeof STATUS_FLOW[number])
    return idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null
  }

  const getUrgencyFromDate = (dateStr: string | null) => {
    if (!dateStr) return "standard"
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const d = new Date(dateStr + "T00:00:00"); d.setHours(0, 0, 0, 0)
    const diff = Math.floor((d.getTime() - today.getTime()) / 86400000)
    if (diff < 0) return "past_due"
    if (diff === 0) return "today"
    if (diff === 1) return "tomorrow"
    return "custom"
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5" /> Purchase Orders
          {pos && pos.length > 0 && (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-1">{pos.length}</Badge>
          )}
        </h3>
        {!showForm && (
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => setShowForm(true)}>
            <Plus className="h-3 w-3" /> New PO
          </Button>
        )}
      </div>

      {/* ── New PO Form ── */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-3 mb-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">New Purchase Order</p>
            <button onClick={resetForm} className="p-1 rounded hover:bg-secondary"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">PO Number *</Label>
              <Input value={form.po_number} onChange={(e) => setForm(p => ({ ...p, po_number: e.target.value }))}
                placeholder="PO-001" className="h-8 text-sm rounded-lg border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">OHP Job # *</Label>
              <Input value={form.ohp_job_number} onChange={(e) => setForm(p => ({ ...p, ohp_job_number: e.target.value }))}
                placeholder="OHP-12345" className="h-8 text-sm rounded-lg border-border" />
            </div>
          </div>
          <p className="text-[9px] text-muted-foreground -mt-1">* Fill at least one</p>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">OHP Location</Label>
              <Select value={form.ohp_location} onValueChange={(v) => setForm(p => ({ ...p, ohp_location: v }))}>
                <SelectTrigger className="h-8 text-sm rounded-lg border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ohpLocations.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Urgency</Label>
              <Select value={form.urgency} onValueChange={(v) => setForm(p => ({ ...p, urgency: v }))}>
                <SelectTrigger className="h-8 text-sm rounded-lg border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(URGENCY_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Needed Date</Label>
              <Input type="date" value={form.needed_date} onChange={(e) => setForm(p => ({ ...p, needed_date: e.target.value }))}
                className="h-8 text-sm rounded-lg border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Needed Time</Label>
              <Input type="time" value={form.needed_time} onChange={(e) => setForm(p => ({ ...p, needed_time: e.target.value }))}
                className="h-8 text-sm rounded-lg border-border" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">OHP Email</Label>
              <Input value={form.ohp_email} onChange={(e) => setForm(p => ({ ...p, ohp_email: e.target.value }))}
                placeholder="print@ohp.com" className="h-8 text-sm rounded-lg border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Est. Cost ($)</Label>
              <Input type="number" step="0.01" min={0} value={form.cost} onChange={(e) => setForm(p => ({ ...p, cost: e.target.value }))}
                placeholder="0.00" className="h-8 text-sm rounded-lg border-border" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Paper specs, special instructions..." className="min-h-[50px] text-sm rounded-lg border-border" />
          </div>

          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={resetForm}>Cancel</Button>
            <Button size="sm" className="h-8 text-xs gap-1" onClick={createPO} disabled={saving || !valid}>
              {saving ? "Creating..." : "Create PO"}
            </Button>
          </div>
        </div>
      )}

      {/* ── PO List ── */}
      {!pos || pos.length === 0 ? (
        !showForm && (
          <div className="text-center py-6 border border-dashed border-border rounded-xl">
            <Package className="h-6 w-6 text-muted-foreground/40 mx-auto mb-1.5" />
            <p className="text-xs text-muted-foreground">No purchase orders yet</p>
            <Button size="sm" variant="ghost" className="h-7 text-[10px] mt-1.5 gap-1" onClick={() => setShowForm(true)}>
              <Plus className="h-3 w-3" /> Create First PO
            </Button>
          </div>
        )
      ) : (
        <div className="space-y-2">
          {pos.map((po) => {
            const expanded = expandedId === po.id
            const statusCfg = STATUS_CONFIG[po.status] || STATUS_CONFIG.draft
            const liveUrgency = po.needed_date ? getUrgencyFromDate(po.needed_date) : po.urgency
            const urgCfg = URGENCY_CONFIG[liveUrgency] || URGENCY_CONFIG.standard
            const nextStatus = getNextStatus(po.status)

            return (
              <div key={po.id} className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Header */}
                <button
                  onClick={() => setExpandedId(expanded ? null : po.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {statusCfg.icon}
                    <span className="text-sm font-semibold text-foreground truncate">
                      {po.po_number || po.ohp_job_number}
                    </span>
                    <Badge className={`text-[9px] px-1.5 py-0 ${statusCfg.color} border-0`}>
                      {statusCfg.label}
                    </Badge>
                    <Badge className={`text-[9px] px-1.5 py-0 ${urgCfg.color} border-0`}>
                      {urgCfg.label}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {po.ohp_location}
                  </span>
                  {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>

                {/* Expanded Details */}
                {expanded && (
                  <div className="border-t border-border px-3 py-3 space-y-3">
                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-muted-foreground">PO #:</span> <span className="font-medium text-foreground">{po.po_number || "—"}</span></div>
                      <div><span className="text-muted-foreground">OHP Job #:</span> <span className="font-medium text-foreground">{po.ohp_job_number || "—"}</span></div>
                      <div><span className="text-muted-foreground">Location:</span> <span className="font-medium text-foreground">{po.ohp_location || "—"}</span></div>
                      <div><span className="text-muted-foreground">Needed:</span> <span className="font-medium text-foreground">{po.needed_date || "—"} {po.needed_time}</span></div>
                      <div><span className="text-muted-foreground">Cost:</span> <span className="font-medium text-foreground">{po.cost ? `$${Number(po.cost).toFixed(2)}` : "—"}</span></div>
                      <div><span className="text-muted-foreground">Email:</span> <span className="font-medium text-foreground truncate">{po.ohp_email || "—"}</span></div>
                    </div>

                    {po.notes && (
                      <p className="text-[11px] text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-2">{po.notes}</p>
                    )}

                    {/* Status Timeline */}
                    <div className="flex items-center gap-0.5">
                      {STATUS_FLOW.map((s, i) => {
                        const reached = STATUS_FLOW.indexOf(po.status as typeof STATUS_FLOW[number]) >= i
                        const ts = s === "sent" ? po.sent_at : s === "confirmed" ? po.confirmed_at :
                          s === "in_production" ? po.in_production_at : s === "received" ? po.received_at : po.created_at
                        return (
                          <div key={s} className="flex items-center gap-0.5 flex-1">
                            <div className="flex flex-col items-center flex-1">
                              <div className={`w-2.5 h-2.5 rounded-full ${reached ? "bg-emerald-500" : "bg-muted-foreground/20"}`} />
                              <span className="text-[8px] text-muted-foreground mt-0.5">{STATUS_CONFIG[s]?.label}</span>
                              {ts && reached && (
                                <span className="text-[7px] text-muted-foreground/60">
                                  {new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" })}
                                </span>
                              )}
                            </div>
                            {i < STATUS_FLOW.length - 1 && (
                              <div className={`h-px flex-1 ${reached ? "bg-emerald-500" : "bg-muted-foreground/20"}`} />
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Actions */}
                    <Separator />
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {po.status === "draft" && (
                        <Button size="sm" className="h-7 text-[10px] gap-1" onClick={() => sendPO(po)}>
                          <Send className="h-3 w-3" /> Send to OHP
                        </Button>
                      )}
                      {nextStatus && po.status !== "draft" && (
                        <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => updateStatus(po.id, nextStatus)}>
                          {STATUS_CONFIG[nextStatus]?.icon}
                          Mark {STATUS_CONFIG[nextStatus]?.label}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => handlePrint(po)}>
                        <Printer className="h-3 w-3" /> Print
                      </Button>
                      {po.status === "draft" && (
                        <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-destructive hover:text-destructive" onClick={() => deletePO(po.id)}>
                          <Trash2 className="h-3 w-3" /> Delete
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ── Small badge for kanban cards ──
export function POStatusBadge({ jobId }: { jobId: string }) {
  const { data: pos } = useSWR<PO[]>(`/api/purchase-orders?job_id=${jobId}`, fetcher)
  if (!pos || pos.length === 0) return null

  // Show worst status (earliest in pipeline)
  const worst = pos.reduce((w, po) => {
    const wIdx = STATUS_FLOW.indexOf(w.status as typeof STATUS_FLOW[number])
    const pIdx = STATUS_FLOW.indexOf(po.status as typeof STATUS_FLOW[number])
    return pIdx < wIdx ? po : w
  }, pos[0])

  const cfg = STATUS_CONFIG[worst.status] || STATUS_CONFIG.draft
  const liveUrgency = worst.needed_date ? getUrgencyFromDate(worst.needed_date) : worst.urgency
  const isUrgent = liveUrgency === "past_due" || liveUrgency === "today"

  return (
    <Badge className={`text-[8px] px-1 py-0 gap-0.5 ${isUrgent && worst.status !== "received" ? "bg-red-600 text-white border-0" : cfg.color + " border-0"}`}>
      {cfg.icon}
      <span>PO {pos.length > 1 ? `(${pos.length})` : ""}</span>
    </Badge>
  )
}

function getUrgencyFromDate(dateStr: string | null) {
  if (!dateStr) return "standard"
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + "T00:00:00"); d.setHours(0, 0, 0, 0)
  const diff = Math.floor((d.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return "past_due"
  if (diff === 0) return "today"
  if (diff === 1) return "tomorrow"
  return "custom"
}
