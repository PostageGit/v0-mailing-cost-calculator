"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useQuote } from "@/lib/quote-context"
import { formatCurrency } from "@/lib/pricing"
import { getCategoryLabel, type QuoteCategory } from "@/lib/quote-types"
import {
  generateEstimateCSV,
  generateInvoiceCSV,
  quoteItemsToQBLines,
  downloadCSV,
  type QBInvoiceData,
  type QBEstimateData,
} from "@/lib/qb-export"
import {
  X, FileText, FileCheck, Download, Loader2, Check,
  ArrowRight, Receipt,
} from "lucide-react"
import { mutate as globalMutate } from "swr"

interface Props {
  open: boolean
  onClose: () => void
  /** Customer name resolved from the customer record */
  customerName?: string
}

const TERMS_OPTIONS = [
  "Due on receipt",
  "Net 15",
  "Net 30",
  "Net 45",
  "Net 60",
]

type Action = "estimate" | "invoice"

export function FinalizeQuoteModal({ open, onClose, customerName }: Props) {
  const q = useQuote()
  const [action, setAction] = useState<Action>("invoice")
  const [terms, setTerms] = useState("Due on receipt")
  const [dueDate, setDueDate] = useState("")
  const [notes, setNotes] = useState("")
  const [memo, setMemo] = useState("")
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [createdInvoiceNumber, setCreatedInvoiceNumber] = useState<number | null>(null)

  if (!open) return null

  const total = q.getTotal()
  const today = new Date().toISOString().slice(0, 10)
  const resolvedCustomer = customerName || "Customer"

  const handleCreate = async () => {
    setSaving(true)
    try {
      // Ensure quote is saved first
      const quoteId = await q.ensureSaved()

      if (action === "invoice") {
        // Create invoice in DB
        const res = await fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quote_id: quoteId || null,
            customer_id: q.customerId,
            customer_name: resolvedCustomer,
            contact_name: q.contactName || null,
            status: "pending",
            invoice_date: today,
            due_date: dueDate || null,
            terms,
            items: q.items,
            subtotal: total,
            tax_rate: 0,
            tax_amount: 0,
            total,
            notes: notes || null,
            memo: memo || null,
            reference_number: q.referenceNumber || null,
            project_name: q.projectName || null,
          }),
        })
        const data = await res.json()
        if (data.invoice_number) {
          setCreatedInvoiceNumber(data.invoice_number)
        }
        globalMutate("/api/invoices")

        // Log activity
        q.logActivity("invoice_created", `Invoice #${data.invoice_number || ""}`)
      } else {
        // Export as QB Estimate CSV (no DB record, just download)
        const qbItems = quoteItemsToQBLines(q.items)
        const est: QBEstimateData = {
          estimateNumber: q.quoteNumber || "DRAFT",
          customerName: resolvedCustomer,
          estimateDate: today,
          items: qbItems,
          memo: memo || undefined,
        }
        const csv = generateEstimateCSV([est])
        downloadCSV(csv, `Estimate_Q${q.quoteNumber || "draft"}_${resolvedCustomer.replace(/\s/g, "_")}.csv`)
        q.logActivity("estimate_exported", `QB Estimate CSV for ${resolvedCustomer}`)
      }

      setDone(true)
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadInvoiceCSV = () => {
    const qbItems = quoteItemsToQBLines(q.items)
    const inv: QBInvoiceData = {
      invoiceNumber: createdInvoiceNumber || q.quoteNumber || "DRAFT",
      customerName: resolvedCustomer,
      invoiceDate: today,
      dueDate: dueDate || undefined,
      terms,
      items: qbItems,
      memo: memo || undefined,
    }
    const csv = generateInvoiceCSV([inv])
    downloadCSV(csv, `Invoice_${createdInvoiceNumber || "draft"}_${resolvedCustomer.replace(/\s/g, "_")}.csv`)
    q.logActivity("invoice_exported", `QB Invoice CSV #${createdInvoiceNumber}`)
  }

  const handleClose = () => {
    setDone(false)
    setCreatedInvoiceNumber(null)
    setNotes("")
    setMemo("")
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-secondary p-2.5">
              <FileCheck className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Finalize Quote</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Convert to invoice or export as QB estimate</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Done state */}
        {done ? (
          <div className="px-6 py-8 text-center">
            <div className="rounded-full bg-emerald-500/10 p-4 w-fit mx-auto mb-4">
              <Check className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">
              {action === "invoice" ? "Invoice Created" : "Estimate Exported"}
            </h3>
            {action === "invoice" && createdInvoiceNumber && (
              <p className="text-sm text-muted-foreground mb-6">
                Invoice #{createdInvoiceNumber} for {resolvedCustomer} -- {formatCurrency(total)}
              </p>
            )}
            {action === "estimate" && (
              <p className="text-sm text-muted-foreground mb-6">
                QB Estimate CSV downloaded for {resolvedCustomer}
              </p>
            )}
            <div className="flex flex-col gap-2.5">
              {action === "invoice" && (
                <Button
                  onClick={handleDownloadInvoiceCSV}
                  className="gap-2 rounded-xl h-11 text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 w-full"
                >
                  <Download className="h-4 w-4" /> Download QB Invoice CSV
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={handleClose}
                className="gap-2 rounded-xl h-10 text-sm font-medium w-full"
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Quote summary */}
            <div className="px-6 pt-5 pb-4">
              <div className="rounded-xl bg-secondary/30 border border-border/40 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    {q.quoteNumber ? `Quote Q-${q.quoteNumber}` : "Draft Quote"}
                  </span>
                  <span className="text-lg font-bold font-mono text-foreground">{formatCurrency(total)}</span>
                </div>
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <span><strong className="text-foreground">{resolvedCustomer}</strong></span>
                  {q.projectName && <span>{q.projectName}</span>}
                  <span>{q.items.length} line item{q.items.length !== 1 ? "s" : ""}</span>
                </div>
              </div>
            </div>

            {/* Action selector */}
            <div className="px-6 pb-4">
              <Label className="text-xs font-medium text-muted-foreground mb-2 block">What do you want to create?</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setAction("invoice")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    action === "invoice"
                      ? "border-foreground bg-foreground/5"
                      : "border-border hover:border-foreground/30"
                  }`}
                >
                  <Receipt className={`h-5 w-5 ${action === "invoice" ? "text-foreground" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-semibold ${action === "invoice" ? "text-foreground" : "text-muted-foreground"}`}>
                    Invoice
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-tight text-center">
                    Save to DB and export for QB
                  </span>
                </button>
                <button
                  onClick={() => setAction("estimate")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    action === "estimate"
                      ? "border-foreground bg-foreground/5"
                      : "border-border hover:border-foreground/30"
                  }`}
                >
                  <FileText className={`h-5 w-5 ${action === "estimate" ? "text-foreground" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-semibold ${action === "estimate" ? "text-foreground" : "text-muted-foreground"}`}>
                    QB Estimate
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-tight text-center">
                    Download CSV for QB import
                  </span>
                </button>
              </div>
            </div>

            {/* Invoice-specific fields */}
            {action === "invoice" && (
              <div className="px-6 pb-4 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Terms</Label>
                    <Select value={terms} onValueChange={setTerms}>
                      <SelectTrigger className="h-9 text-sm rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TERMS_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Due Date</Label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="h-9 text-sm rounded-xl"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Shared fields */}
            <div className="px-6 pb-4 flex flex-col gap-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Notes (visible to customer)</Label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Thank you for your business..."
                  rows={2}
                  className="w-full text-sm rounded-xl border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Memo (internal only)</Label>
                <Input
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Internal note..."
                  className="h-9 text-sm rounded-xl"
                />
              </div>
            </div>

            {/* Line items preview */}
            <div className="px-6 pb-4">
              <Label className="text-xs font-medium text-muted-foreground mb-2 block">
                Line Items ({q.items.length})
              </Label>
              <div className="rounded-xl border border-border/40 bg-secondary/20 max-h-40 overflow-y-auto">
                {q.items.map((item, idx) => (
                  <div key={item.id} className={`flex items-center justify-between px-3 py-2 ${idx > 0 ? "border-t border-border/20" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">{item.label}</p>
                      {item.description && (
                        <p className="text-[10px] text-muted-foreground truncate">{item.description}</p>
                      )}
                    </div>
                    <span className="text-xs font-mono font-semibold text-foreground ml-3 shrink-0">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 pt-2">
              <Button
                onClick={handleCreate}
                disabled={saving || q.items.length === 0}
                className="w-full h-11 gap-2 rounded-xl text-sm font-semibold bg-foreground text-background hover:bg-foreground/90"
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</>
                ) : action === "invoice" ? (
                  <><Receipt className="h-4 w-4" /> Create Invoice</>
                ) : (
                  <><Download className="h-4 w-4" /> Export QB Estimate CSV</>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
