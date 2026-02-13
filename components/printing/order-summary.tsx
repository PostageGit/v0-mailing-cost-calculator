"use client"

import { useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Pencil, Copy, Trash2, Printer, Download, FileDown } from "lucide-react"
import { formatCurrency } from "@/lib/printing-pricing"
import { Receipt } from "./receipt"
import type { OrderItem } from "@/lib/printing-types"

interface OrderSummaryProps {
  items: OrderItem[]
  editingItemId: number | null
  onEdit: (id: number) => void
  onDuplicate: (id: number) => void
  onRemove: (id: number) => void
}

export function OrderSummary({
  items,
  editingItemId,
  onEdit,
  onDuplicate,
  onRemove,
}: OrderSummaryProps) {
  const receiptRef = useRef<HTMLDivElement>(null)
  const subtotal = items.reduce((sum, item) => sum + item.summary.subtotal, 0)
  const grandTotal = subtotal

  const captureReceipt = useCallback(async () => {
    if (!receiptRef.current) return null
    const html2canvas = (await import("html2canvas")).default
    const canvas = await html2canvas(receiptRef.current, {
      scale: 2,
      backgroundColor: "#ffffff",
      logging: false,
    })
    return canvas
  }, [])

  const handlePrintReceipt = useCallback(() => {
    window.print()
  }, [])

  const handleDownloadPng = useCallback(async () => {
    const canvas = await captureReceipt()
    if (!canvas) return
    const link = document.createElement("a")
    link.download = `receipt-${Date.now()}.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
  }, [captureReceipt])

  const handleDownloadPdf = useCallback(async () => {
    const canvas = await captureReceipt()
    if (!canvas) return
    const { jsPDF } = await import("jspdf")
    const imgData = canvas.toDataURL("image/png")
    const pdfWidth = 3.5
    const pdfHeight = (canvas.height / canvas.width) * pdfWidth
    const pdf = new jsPDF({
      unit: "in",
      format: [pdfWidth, pdfHeight],
    })
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight)
    pdf.save(`receipt-${Date.now()}.pdf`)
  }, [captureReceipt])

  return (
    <>
      <div className="bg-card rounded-xl border border-border shadow-sm p-6 flex flex-col h-full max-h-[calc(100vh-8rem)]">
        <h2 className="text-xl font-bold text-foreground text-center mb-4 flex-shrink-0">
          Order Summary
        </h2>

        {/* Order items */}
        <div className="flex-1 min-h-0 mb-4 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">Your order is empty.</p>
          ) : (
            <div className="flex flex-col gap-2 pr-3">
              {items.map((item) => {
                const isEditing = item.id === editingItemId
                return (
                  <div
                    key={item.id}
                    className={`bg-muted/30 p-3 rounded-lg border transition-all ${
                      isEditing
                        ? "border-primary shadow-[0_0_0_2px_hsl(var(--primary))] bg-primary/5"
                        : "border-border"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-grow min-w-0">
                        <p className="font-semibold text-sm text-foreground">{item.summary.description}</p>
                        <p className="text-xs text-muted-foreground leading-tight whitespace-pre-wrap mt-0.5">
                          {item.summary.details}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-foreground font-mono">
                          {formatCurrency(item.summary.subtotal)}
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end items-center gap-1 mt-2 pt-2 border-t border-border">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(item.id)}
                        className="text-xs text-primary hover:text-primary hover:bg-primary/10 h-7 px-2"
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDuplicate(item.id)}
                        className="text-xs text-accent hover:text-accent hover:bg-accent/10 h-7 px-2"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Duplicate
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemove(item.id)}
                        className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Totals Footer */}
        <div className="flex-shrink-0 border-t border-border pt-4">
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="flex justify-between items-center text-base font-semibold">
              <span className="text-foreground">Subtotal:</span>
              <span className="font-mono text-foreground">{formatCurrency(subtotal)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between items-center text-lg font-bold">
              <span className="text-foreground">Grand Total:</span>
              <span className="font-mono text-foreground">{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          {items.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              <Button
                variant="secondary"
                onClick={handlePrintReceipt}
                className="w-full font-semibold"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print Receipt
              </Button>
              <Button
                onClick={handleDownloadPng}
                className="w-full font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Download className="h-4 w-4 mr-2" />
                Download PNG
              </Button>
              <Button
                variant="destructive"
                onClick={handleDownloadPdf}
                className="w-full font-semibold"
              >
                <FileDown className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Hidden receipt for capture */}
      <Receipt ref={receiptRef} items={items} />

    </>
  )
}
