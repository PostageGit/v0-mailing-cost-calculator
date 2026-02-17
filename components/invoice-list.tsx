"use client"

import { useState, useMemo, useCallback } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { Card } from "@/components/ui/card"
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
import { COMPANY } from "@/lib/company"
import {
  Search, Receipt, Download, Check, FileText,
  Loader2, Trash2, CheckCircle2,
  Circle, Clock, Send, XCircle, ArrowRight, Mail, X,
} from "lucide-react"
import { toast } from "sonner"

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

/* ═══════════════════════════════════════════════════════
   PDF Invoice Generator (jsPDF)
   ═══════════════════════════════════════════════════════ */
async function generateInvoicePDF(inv: Invoice) {
  const { default: jsPDF } = await import("jspdf")
  const doc = new jsPDF({ unit: "mm", format: "letter" })

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 18
  const contentW = pageW - margin * 2
  let y = margin

  // Colors
  const dark = [24, 24, 27] as const
  const mid = [113, 113, 122] as const
  const light = [228, 228, 231] as const
  const accent = [16, 185, 129] as const
  const softBg = [248, 248, 248] as const

  // ── Top accent line
  doc.setFillColor(...accent)
  doc.rect(0, 0, pageW, 2.5, "F")

  y = 12

  // ── Company letterhead (left)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(20)
  doc.setTextColor(...dark)
  doc.text(COMPANY.name.toUpperCase(), margin, y)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(...mid)
  y += 5.5
  doc.text(COMPANY.address, margin, y)
  y += 3.5
  doc.text(`${COMPANY.city}, ${COMPANY.state} ${COMPANY.zip}`, margin, y)
  y += 3.5
  doc.text(`${COMPANY.phone}  |  ${COMPANY.email}`, margin, y)

  // ── INVOICE title (right)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(32)
  doc.setTextColor(...accent)
  const invTitle = "INVOICE"
  doc.text(invTitle, pageW - margin - doc.getTextWidth(invTitle), 14)

  // ── Invoice details box (right-aligned)
  const rightCol = pageW - margin
  let ry = 22
  doc.setFontSize(8.5)

  const detailPairs = [
    ["Invoice #", `INV-${inv.invoice_number}`],
    ["Date", new Date(inv.invoice_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })],
    ...(inv.due_date ? [["Due Date", new Date(inv.due_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })]] : []),
    ["Terms", inv.terms],
    ...(inv.reference_number ? [["PO / Ref #", inv.reference_number]] : []),
  ]

  for (const [label, value] of detailPairs) {
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...mid)
    const valW = doc.getTextWidth(value)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...dark)
    doc.text(value, rightCol - valW, ry)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...mid)
    doc.text(label + ":", rightCol - valW - doc.getTextWidth(label + ":  "), ry)
    ry += 4.5
  }

  y = Math.max(y, ry) + 6

  // ── Divider
  doc.setDrawColor(...light)
  doc.setLineWidth(0.4)
  doc.line(margin, y, pageW - margin, y)
  y += 7

  // ── Bill To section
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  doc.setTextColor(...accent)
  doc.text("BILL TO", margin, y)
  y += 4.5

  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.setTextColor(...dark)
  doc.text(inv.customer_name, margin, y)
  y += 5
  if (inv.contact_name) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...mid)
    doc.text(inv.contact_name, margin, y)
    y += 4.5
  }
  if (inv.project_name) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(...mid)
    doc.text(`Project: ${inv.project_name}`, margin, y)
    y += 4.5
  }
  y += 6

  // ── Line items table
  const colDescX = margin
  const colAmtX = pageW - margin

  // Table header
  doc.setFillColor(...dark)
  doc.roundedRect(margin, y, contentW, 7.5, 1.2, 1.2, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.5)
  doc.setTextColor(255, 255, 255)
  doc.text("DESCRIPTION", colDescX + 4, y + 5)
  const amtH = "AMOUNT"
  doc.text(amtH, colAmtX - doc.getTextWidth(amtH) - 4, y + 5)
  y += 9

  // Rows
  doc.setFontSize(8.5)
  for (let i = 0; i < inv.items.length; i++) {
    const item = inv.items[i]
    const rowH = 7

    // Check page break
    if (y + rowH > pageH - 35) {
      doc.addPage()
      y = margin
    }

    // Alternate background
    if (i % 2 === 0) {
      doc.setFillColor(...softBg)
      doc.rect(margin, y, contentW, rowH, "F")
    }

    // Description
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...dark)
    const labelText = item.label || item.description || item.category
    const maxLblW = contentW - 45
    const displayText = doc.getTextWidth(labelText) > maxLblW
      ? labelText.substring(0, Math.floor(maxLblW / doc.getTextWidth("M") * labelText.length)) + "..."
      : labelText
    doc.text(displayText, colDescX + 4, y + 4.8)

    // Amount
    const amtText = formatCurrency(item.amount)
    doc.setFont("helvetica", "bold")
    doc.text(amtText, colAmtX - doc.getTextWidth(amtText) - 4, y + 4.8)

    y += rowH
  }

  // Bottom line
  doc.setDrawColor(...light)
  doc.setLineWidth(0.3)
  doc.line(margin, y + 1, pageW - margin, y + 1)
  y += 6

  // ── Totals box
  const totalsBoxW = 75
  const totalsX = pageW - margin - totalsBoxW

  // Subtotal
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(...mid)
  doc.text("Subtotal", totalsX + 4, y)
  doc.setTextColor(...dark)
  doc.setFont("helvetica", "bold")
  const subText = formatCurrency(inv.subtotal)
  doc.text(subText, colAmtX - doc.getTextWidth(subText) - 4, y)
  y += 5

  // Tax (if any)
  if (inv.tax_amount > 0) {
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...mid)
    doc.text("Tax", totalsX + 4, y)
    doc.setTextColor(...dark)
    doc.setFont("helvetica", "bold")
    const taxText = formatCurrency(inv.tax_amount)
    doc.text(taxText, colAmtX - doc.getTextWidth(taxText) - 4, y)
    y += 5
  }

  y += 2

  // Grand total bar
  doc.setFillColor(...accent)
  doc.roundedRect(totalsX, y - 4, totalsBoxW, 10, 1.2, 1.2, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text("TOTAL DUE", totalsX + 4, y + 3)
  const totalText = formatCurrency(inv.total)
  doc.text(totalText, colAmtX - doc.getTextWidth(totalText) - 4, y + 3)
  y += 14

  // ── Notes
  if (inv.notes) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...mid)
    doc.text("Notes:", margin, y)
    y += 3.5
    doc.setFont("helvetica", "italic")
    const noteLines = doc.splitTextToSize(inv.notes, contentW)
    doc.text(noteLines, margin, y)
    y += noteLines.length * 3.5 + 4
  }

  // ── Footer
  const footerY = pageH - 12
  doc.setDrawColor(...light)
  doc.setLineWidth(0.3)
  doc.line(margin, footerY - 5, pageW - margin, footerY - 5)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(...mid)
  doc.text("Thank you for your business!", margin, footerY)
  const footerRight = `${COMPANY.name}  |  ${COMPANY.phone}  |  ${COMPANY.email}`
  doc.text(footerRight, pageW - margin - doc.getTextWidth(footerRight), footerY)

  // Save
  doc.save(`Invoice_INV-${inv.invoice_number}_${inv.customer_name.replace(/\s+/g, "_")}.pdf`)
}

/* ═══════════════════════════════════════════════════════
   INVOICE LIST COMPONENT
   ═══════════════════════════════════════════════════════ */
export function InvoiceList() {
  const { data: invoices, isLoading } = useSWR<Invoice[]>("/api/invoices", fetcher)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pdfGenerating, setPdfGenerating] = useState<string | null>(null)
  const [qbExporting, setQbExporting] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  /* ── Batch QB Export (Transaction Pro CSV) ── */
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
        message: inv.notes || undefined,
      }))
      const csv = generateInvoiceCSV(qbInvoices)
      const filename = data.length === 1
        ? `Invoice_${data[0].invoice_number}_${data[0].customer_name.replace(/\s+/g, "_")}.csv`
        : `Invoices_batch_${new Date().toISOString().slice(0, 10)}.csv`
      downloadCSV(csv, filename)
      globalMutate("/api/invoices")
      setSelectedIds(new Set())
    } finally {
      setExporting(false)
    }
  }

  /* ── Single QB Export ── */
  const handleExportSingle = useCallback(async (inv: Invoice) => {
    setQbExporting(inv.id)
    try {
      const qbInv: QBInvoiceData = {
        invoiceNumber: inv.invoice_number,
        customerName: inv.customer_name,
        invoiceDate: inv.invoice_date,
        dueDate: inv.due_date || undefined,
        terms: inv.terms,
        items: quoteItemsToQBLines(inv.items),
        memo: inv.memo || undefined,
        message: inv.notes || undefined,
      }
      const csv = generateInvoiceCSV([qbInv])
      downloadCSV(csv, `Invoice_INV-${inv.invoice_number}_${inv.customer_name.replace(/\s+/g, "_")}.csv`)
      await fetch(`/api/invoices/${inv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qb_exported: true, qb_exported_at: new Date().toISOString() }),
      })
      globalMutate("/api/invoices")
    } finally {
      setQbExporting(null)
    }
  }, [])

  /* ── PDF Download ── */
  const handleDownloadPDF = useCallback(async (inv: Invoice) => {
    setPdfGenerating(inv.id)
    try {
      await generateInvoicePDF(inv)
    } finally {
      setPdfGenerating(null)
    }
  }, [])

  const handleUpdateStatus = async (id: string, status: string) => {
    await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    globalMutate("/api/invoices")
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await fetch(`/api/invoices/${id}`, { method: "DELETE" })
      globalMutate("/api/invoices")
      if (expandedId === id) setExpandedId(null)
    } finally {
      setDeletingId(null)
    }
  }

  /* ── Send Email ── */
  const [emailingId, setEmailingId] = useState<string | null>(null)
  const [emailTo, setEmailTo] = useState("")
  const [emailSending, setEmailSending] = useState(false)

  const openEmailForm = (inv: Invoice) => {
    setEmailingId(inv.id)
    // Try to pre-fill with customer email
    setEmailTo("")
    if (inv.customer_id) {
      fetch(`/api/customers/${inv.customer_id}`)
        .then((r) => r.json())
        .then((c) => {
          if (c?.email) setEmailTo(c.email)
          else if (c?.billing_contact_email) setEmailTo(c.billing_contact_email)
        })
        .catch(() => {})
    }
  }

  const handleSendEmail = async (inv: Invoice) => {
    if (!emailTo.trim() || !emailTo.includes("@")) {
      toast.error("Please enter a valid email address")
      return
    }
    setEmailSending(true)
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "invoice",
          to: emailTo.trim(),
          data: {
            invoiceNumber: inv.invoice_number,
            customerName: inv.customer_name,
            contactName: inv.contact_name || undefined,
            total: inv.total,
            dueDate: inv.due_date || undefined,
            terms: inv.terms,
            items: inv.items.map((it) => ({
              label: it.label,
              description: it.description,
              amount: it.amount,
            })),
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to send email")
        return
      }
      toast.success(`Invoice emailed to ${emailTo}`)
      // Update status to "sent" if it was draft/pending
      if (inv.status === "draft" || inv.status === "pending") {
        await fetch(`/api/invoices/${inv.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "sent" }),
        })
      }
      globalMutate("/api/invoices")
      setEmailingId(null)
      setEmailTo("")
    } finally {
      setEmailSending(false)
    }
  }

  const totalSelected = filtered.filter((i) => selectedIds.has(i.id)).reduce((s, i) => s + i.total, 0)

  /* ── Summary stats ── */
  const stats = useMemo(() => {
    if (!invoices) return null
    const total = invoices.reduce((s, i) => s + i.total, 0)
    const paid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0)
    const outstanding = invoices.filter((i) => i.status !== "paid" && i.status !== "void").reduce((s, i) => s + i.total, 0)
    return { count: invoices.length, total, paid, outstanding }
  }, [invoices])

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage invoices, download PDFs, and export to QuickBooks via Transaction Pro.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      {stats && stats.count > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total</p>
            <p className="text-lg font-bold font-mono text-foreground mt-0.5">{formatCurrency(stats.total)}</p>
            <p className="text-[10px] text-muted-foreground">{stats.count} invoice{stats.count !== 1 ? "s" : ""}</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Paid</p>
            <p className="text-lg font-bold font-mono text-emerald-600 mt-0.5">{formatCurrency(stats.paid)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Outstanding</p>
            <p className="text-lg font-bold font-mono text-amber-600 mt-0.5">{formatCurrency(stats.outstanding)}</p>
          </div>
        </div>
      )}

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
            const isPdfLoading = pdfGenerating === inv.id
            const isQbLoading = qbExporting === inv.id
            const isDeleting = deletingId === inv.id
            return (
              <Card
                key={inv.id}
                className={`rounded-xl border transition-all ${isSelected ? "border-foreground/40 bg-foreground/[0.02]" : "border-border"}`}
              >
                {/* ── Collapsed Row ── */}
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
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700">
                          QB
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/80">{inv.customer_name}</span>
                      {inv.project_name && (
                        <><span className="text-muted-foreground/30">|</span><span className="truncate">{inv.project_name}</span></>
                      )}
                    </div>
                  </div>

                  {/* Quick actions + Amount */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Quick PDF download */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownloadPDF(inv) }}
                      disabled={isPdfLoading}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-secondary transition-colors"
                      title="Download PDF"
                    >
                      {isPdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                    </button>
                    {/* Quick send email */}
                    <button
                      onClick={(e) => { e.stopPropagation(); openEmailForm(inv) }}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      title="Send email"
                    >
                      <Mail className="h-3.5 w-3.5" />
                    </button>
                    {/* Quick QB export */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleExportSingle(inv) }}
                      disabled={isQbLoading}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-secondary transition-colors"
                      title={inv.qb_exported ? "Re-export QB CSV" : "Export QB CSV"}
                    >
                      {isQbLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                    </button>
                    {/* Amount + date */}
                    <div className="text-right ml-1">
                      <span className="text-sm font-bold font-mono text-foreground">{formatCurrency(inv.total)}</span>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(inv.invoice_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* ── Expanded Detail ── */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border/40 pt-3">
                    {/* Line items */}
                    <div className="rounded-lg border border-border/40 bg-secondary/20 mb-3 overflow-hidden">
                      {/* Table header */}
                      <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/60 border-b border-border/30">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Description</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Amount</span>
                      </div>
                      {inv.items.map((item, idx) => (
                        <div key={idx} className={`flex items-center justify-between px-3 py-2 ${idx > 0 ? "border-t border-border/20" : ""}`}>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-foreground">{item.label}</p>
                            {item.description && item.description !== item.label && (
                              <p className="text-[10px] text-muted-foreground truncate">{item.description}</p>
                            )}
                          </div>
                          <span className="text-xs font-mono font-semibold text-foreground ml-3">{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                      {/* Totals */}
                      <div className="border-t border-border/40 bg-secondary/40 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">Subtotal</span>
                          <span className="text-xs font-mono text-foreground">{formatCurrency(inv.subtotal)}</span>
                        </div>
                        {inv.tax_amount > 0 && (
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-[10px] text-muted-foreground">Tax</span>
                            <span className="text-xs font-mono text-foreground">{formatCurrency(inv.tax_amount)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-1 pt-1 border-t border-border/30">
                          <span className="text-xs font-bold text-foreground">Total Due</span>
                          <span className="text-sm font-bold font-mono text-foreground">{formatCurrency(inv.total)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-3">
                      <div><span className="text-muted-foreground">Terms:</span> <span className="font-medium text-foreground">{inv.terms}</span></div>
                      {inv.due_date && <div><span className="text-muted-foreground">Due:</span> <span className="font-medium text-foreground">{new Date(inv.due_date).toLocaleDateString()}</span></div>}
                      {inv.reference_number && <div><span className="text-muted-foreground">PO/Ref:</span> <span className="font-medium text-foreground">{inv.reference_number}</span></div>}
                      {inv.contact_name && <div><span className="text-muted-foreground">Contact:</span> <span className="font-medium text-foreground">{inv.contact_name}</span></div>}
                    </div>

                    {inv.notes && <p className="text-xs text-muted-foreground mb-3 italic">{inv.notes}</p>}

                    {/* QB export timestamp */}
                    {inv.qb_exported && inv.qb_exported_at && (
                      <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 mb-3">
                        <CheckCircle2 className="h-3 w-3" />
                        Exported to QB on {new Date(inv.qb_exported_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                      </div>
                    )}

                    {/* ── Inline Email Form ── */}
                    {emailingId === inv.id && (
                      <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 p-3 mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-blue-600" />
                            Send Invoice Email
                          </span>
                          <button onClick={() => { setEmailingId(null); setEmailTo("") }} className="text-muted-foreground hover:text-foreground">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="email"
                            placeholder="recipient@email.com"
                            value={emailTo}
                            onChange={(e) => setEmailTo(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSendEmail(inv) }}
                            className="h-8 text-sm rounded-lg flex-1"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={() => handleSendEmail(inv)}
                            disabled={emailSending || !emailTo.trim()}
                            className="h-8 text-xs gap-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold shrink-0"
                          >
                            {emailSending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                            Send
                          </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1.5">
                          Invoice details and line items will be included in the email body.
                        </p>
                      </div>
                    )}

                    {/* ── Action Buttons ── */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Send Email */}
                      <Button
                        size="sm"
                        className="h-8 text-xs gap-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold"
                        onClick={() => openEmailForm(inv)}
                      >
                        <Mail className="h-3 w-3" />
                        Send Email
                      </Button>

                      {/* Download PDF */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5 rounded-lg border-border font-semibold"
                        onClick={() => handleDownloadPDF(inv)}
                        disabled={isPdfLoading}
                      >
                        {isPdfLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                        Download PDF
                      </Button>

                      {/* Convert to QB */}
                      <Button
                        size="sm"
                        className="h-8 text-xs gap-1.5 rounded-lg bg-foreground text-background hover:bg-foreground/90 font-semibold"
                        onClick={() => handleExportSingle(inv)}
                        disabled={isQbLoading}
                      >
                        {isQbLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
                        {inv.qb_exported ? "Re-export QB CSV" : "Convert to QB Invoice"}
                      </Button>

                      {/* Status dropdown */}
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

                      {/* Delete */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs gap-1.5 rounded-lg text-destructive hover:bg-destructive/10 ml-auto"
                        onClick={() => handleDelete(inv.id)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        Delete
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
