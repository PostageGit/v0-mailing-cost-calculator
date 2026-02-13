"use client"

import { forwardRef } from "react"
import { formatCurrency } from "@/lib/booklet-pricing"
import type { BookletOrderItem } from "@/lib/booklet-types"

interface BookletReceiptProps {
  items: BookletOrderItem[]
}

export const BookletReceipt = forwardRef<HTMLDivElement, BookletReceiptProps>(function BookletReceipt({ items }, ref) {
  const subtotal = items.reduce((sum, item) => sum + item.summary.subtotal, 0)
  const grandTotal = subtotal
  const now = new Date()
  const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" })
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        top: 0,
        left: "-9999px",
        width: "3.5in",
        background: "#fff",
        padding: "0.2in",
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: "9pt",
        lineHeight: 1.3,
        border: "1px solid #333",
        color: "#000",
        boxSizing: "border-box",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "12pt", margin: 0, fontWeight: "bold" }}>MailCost Pro</h1>
        <p style={{ margin: "2pt 0", fontSize: "8pt" }}>Booklet Binding Services</p>
      </div>
      <div style={{ fontSize: "7.5pt", marginTop: "8pt" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Date: {dateStr}</span>
          <span>Time: {timeStr}</span>
        </div>
      </div>
      <div style={{ textAlign: "center", margin: "8pt 0", fontFamily: "monospace", whiteSpace: "pre" }}>
        {"================================"}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", marginBottom: "4px" }}>
        <span style={{ flex: "0 0 12%" }}>Qty</span>
        <span style={{ flex: "1 1 auto", padding: "0 5pt" }}>Description</span>
        <span style={{ flex: "0 0 25%", textAlign: "right" }}>Price</span>
      </div>
      {items.map((item) => (
        <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", margin: "6pt 0" }}>
          <span style={{ flex: "0 0 12%", textAlign: "left" }}>{item.inputs.bookQty}</span>
          <span style={{ flex: "1 1 auto", padding: "0 5pt" }}>
            <span style={{ fontWeight: "bold" }}>{item.summary.description}</span>
            <br />
            <span style={{ fontSize: "6.75pt", whiteSpace: "pre-wrap" }}>
              {Object.values(item.summary.details).slice(1).join("\n")}
            </span>
          </span>
          <span style={{ flex: "0 0 25%", whiteSpace: "nowrap", textAlign: "right" }}>
            {formatCurrency(item.summary.total)}
          </span>
        </div>
      ))}
      <div style={{ textAlign: "center", margin: "8pt 0", fontFamily: "monospace", whiteSpace: "pre" }}>
        {"================================"}
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", margin: "3pt 0" }}>
          <span>Subtotal:</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", margin: "3pt 0" }}>
          <span>Grand Total:</span>
          <span>{formatCurrency(grandTotal)}</span>
        </div>
      </div>
      <div style={{ textAlign: "center", margin: "8pt 0", fontFamily: "monospace", whiteSpace: "pre" }}>
        {"================================"}
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ margin: "2pt 0", fontSize: "8pt" }}>Thank you for your business!</p>
      </div>
    </div>
  )
})
