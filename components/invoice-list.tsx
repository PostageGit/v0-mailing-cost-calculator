"use client"

import { useState, useMemo } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCurrency } from "@/lib/pricing"
import {
  generateInvoiceCSV,
  quoteItemsToQBLines,
  downloadCSV,
  type QBInvoiceData,
} from "@/lib/qb-export"
import {
  Search, Receipt, Download, Check, FileText,
  Calendar, Loader2, MoreHorizontal, Trash2, CheckCircle2,
  Circle, Clock, Send, XCircle,
} from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Invoice {
  id: string
  invoice_number: number
  quote_id: string | null
  customer_id: string | null
  customer_name: string
  contact_name: string | null
  status: string
  invoice_date: string
  due_date: string | null
  terms: string
  items: { id: number; category: string; label: string; description: string; amount: number }[]
  subtotal: number
  tax_amount: number
  total: number
  notes: string | null
  memo: string | null
  reference_number: string | null
  project_name: string | null
  qb_exported: boolean
  qb_exported_at: string | null
  created_at: string
  updated_at: string
}

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: "Draft", color: "bg-secondary text-muted-foreground", icon: <Circle className="h-3 w-3" /> },
  pending: { label: "Pending", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", icon: <Clock className="h-3 w-3" /> },
  sent: { label: "Sent", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: <Send className="h-3 w-3" /> },
  paid: { label: "Paid", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", icon: <CheckCircle2 className="h-3 w-3" /> },
  void: { label: "Void", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: <XCircle className="h-3 w-3" /> },
}

export function InvoiceList() {
  const { data: invoices, isLoading } = useSWR<Invoice[]>("/api/invoices", fetcher)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!invoices) return []
    return invoices.filter((inv) => {
      if (filterStatus !== "all" && inv.status !== filterStatus) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          inv.customer_name.toLowerCase().includes(q) ||
          String(inv.invoice_number).includes(q) ||
          (inv.project_name?.toLowerCase().includes(q) ?? false) ||
          (inv.reference_number?.toLowerCase().includes(q) ?? false)
        )
      }
      return true
    })
  }, [invoices, search, filterStatus])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((i) => i.id)))
    }
  }

  const handleExportSelected = async () => {
    if (selectedIds.size === 0) return
    setExporting(true)
    try {
      const res = await fetch("/api/invoices/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), markExported: true }),
      })
      const data: Invoice[] = await res.json()

      const qbInvoices: QBInvoiceData[] = data.map((inv) => ({
        invoiceNumber: inv.invoice_number,
        customerName: inv.customer_name,
        invoiceDate: inv.invoice_date,
        dueDate: inv.due_date || undefined,
        terms: inv.terms,
        items: quoteItemsToQBLines(inv.items),
        memo: inv.memo || undefined,
      }))

      const csv = generateInvoiceCSV(qbInvoices)
      const filename = data.length === 1
        ? `Invoice_${data[0].invoice_number}_${data[0].customer_name.replace(/\s/g, "_")}.csv`
        : `Invoices_batch_${new Date().toISOString().slice(0, 10)}.csv`
      downloadCSV(csv, filename)

      globalMutate("/api/invoices")
      setSelectedIds(new Set())
    } finally {
      setExporting(false)
    }
  }

  const handleExportSingle = async (inv: Invoice) => {
    const qbInv: QBInvoiceData = {
      invoiceNumber: inv.invoice_number,
      customerName: inv.customer_name,
      invoiceDate: inv.invoice_date,
      dueDate: inv.due_date || undefined,
      terms: inv.terms,
      items: quoteItemsToQBLines(inv.items),
      memo: inv.memo || undefined,
    }
    const csv = generateInvoiceCSV([qbInv])
    downloadCSV(csv, `Invoice_${inv.invoice_number}_${inv.customer_name.replace(/\s/g, "_")}.csv`)

    // Mark as exported
    await fetch(`/api/invoices/${inv.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qb_exported: true, qb_exported_at: new Date().toISOString() }),
    })
    globalMutate("/api/invoices")
  }

  const handleUpdateStatus = async (id: string, status: string) => {
    await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    globalMutate("/api/invoices")
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/invoices/${id}`, { method: "DELETE" })
    globalMutate("/api/invoices")
    setExpandedId(null)
  }

  const totalSelected = filtered.filter((i) => selectedIds.has(i.id)).reduce((s, i) => s + i.total, 0)

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage invoices and export to QuickBooks Online.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer, invoice #, project..."
            className="h-9 text-sm pl-9 rounded-xl"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-9 text-sm w-[130px] rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="void">Void</SelectItem>
          </SelectContent>
        </Select>
        {selectedIds.size > 0 && (
          <Button
            size="sm"
            onClick={handleExportSelected}
            disabled={exporting}
            className="h-9 gap-2 rounded-xl text-sm font-semibold bg-foreground text-background hover:bg-foreground/90"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export {selectedIds.size} to QB ({formatCurrency(totalSelected)})
          </Button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading invoices...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Receipt className="h-12 w-12 mx-auto mb-3 text-muted-foreground/20" />
          <p className="text-sm font-semibold text-foreground/80">No invoices yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Create an invoice from the Finalize button on any quote.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {/* Select all bar */}
          <div className="flex items-center gap-3 px-3 py-1.5 text-xs text-muted-foreground">
            <button onClick={selectAll} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
              <div className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                selectedIds.size === filtered.length && filtered.length > 0
                  ? "bg-foreground border-foreground" : "border-border"
              }`}>
                {selectedIds.size === filtered.length && filtered.length > 0 && <Check className="h-2.5 w-2.5 text-background" />}
              </div>
              Select all
            </button>
            <span className="text-muted-foreground/60">{filtered.length} invoice{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          {filtered.map((inv) => {
            const meta = STATUS_META[inv.status] || STATUS_META.draft
            const isExpanded = expandedId === inv.id
            const isSelected = selectedIds.has(inv.id)
            return (
              <Card
                key={inv.id}
                className={`rounded-xl border transition-all ${isSelected ? "border-foreground/40 bg-foreground/[0.02]" : "border-border"}`}
              >
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                >
                  {/* Checkbox */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelect(inv.id) }}
                    className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? "bg-foreground border-foreground" : "border-border hover:border-foreground/40"
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 text-background" />}
                  </button>

                  {/* Invoice info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground font-mono">
                        INV-{inv.invoice_number}
                      </span>
                      <Badge className={`text-[10px] font-semibold px-1.5 py-0 ${meta.color}`}>
                        {meta.icon}
                        <span className="ml-1">{meta.label}</span>
                      </Badge>
                      {inv.qb_exported && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-600 border-emerald-300">
                          QB Exported
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/80">{inv.customer_name}</span>
                      {inv.project_name && (
                        <><span className="text-muted-foreground/30">|</span><span>{inv.project_name}</span></>
                      )}
                    </div>
                  </div>

                  {/* Amount + date */}
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold font-mono text-foreground">{formatCurrency(inv.total)}</span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(inv.invoice_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border/40 pt-3">
                    {/* Line items */}
                    <div className="rounded-lg border border-border/40 bg-secondary/20 mb-3">
                      {inv.items.map((item, idx) => (
                        <div key={idx} className={`flex items-center justify-between px-3 py-2 ${idx > 0 ? "border-t border-border/20" : ""}`}>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-foreground">{item.label}</p>
                            {item.description && <p className="text-[10px] text-muted-foreground truncate">{item.description}</p>}
                          </div>
                          <span className="text-xs font-mono font-semibold text-foreground ml-3">{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Meta info */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-3">
                      <div><span className="text-muted-foreground">Terms:</span> <span className="font-medium text-foreground">{inv.terms}</span></div>
                      {inv.due_date && <div><span className="text-muted-foreground">Due:</span> <span className="font-medium text-foreground">{new Date(inv.due_date).toLocaleDateString()}</span></div>}
                      {inv.reference_number && <div><span className="text-muted-foreground">PO/Ref:</span> <span className="font-medium text-foreground">{inv.reference_number}</span></div>}
                      {inv.contact_name && <div><span className="text-muted-foreground">Contact:</span> <span className="font-medium text-foreground">{inv.contact_name}</span></div>}
                    </div>

                    {inv.notes && <p className="text-xs text-muted-foreground mb-3 italic">{inv.notes}</p>}

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button size="sm" className="h-8 text-xs gap-1.5 rounded-lg bg-foreground text-background hover:bg-foreground/90" onClick={() => handleExportSingle(inv)}>
                        <Download className="h-3 w-3" /> Export QB CSV
                      </Button>
                      <Select value={inv.status} onValueChange={(v) => handleUpdateStatus(inv.id, v)}>
                        <SelectTrigger className="h-8 text-xs w-[110px] rounded-lg"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="sent">Sent</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="void">Void</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => handleDelete(inv.id)}>
                        <Trash2 className="h-3 w-3" /> Delete
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
