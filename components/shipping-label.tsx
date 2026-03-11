"use client"

import { useState, useRef, useCallback } from "react"
import { useQuote } from "@/lib/quote-context"
import { cn } from "@/lib/utils"
import { Printer, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatShippingWeight, type BoxRecommendation, type ShippingEstimate } from "@/lib/shipping-boxes"
import type { Customer, DeliveryAddress } from "@/lib/customer-types"
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface ShippingLabelModalProps {
  open: boolean
  onClose: () => void
  estimate: ShippingEstimate
}

export function ShippingLabelModal({ open, onClose, estimate }: ShippingLabelModalProps) {
  const { quoteNumber, projectName, contactName, customerId, quantity } = useQuote()
  const printRef = useRef<HTMLDivElement>(null)

  // Fetch customer details for address
  const { data: customer } = useSWR<Customer>(
    customerId ? `/api/customers/${customerId}` : null,
    fetcher
  )

  // Fetch delivery addresses for the customer
  const { data: deliveryAddresses } = useSWR<DeliveryAddress[]>(
    customerId ? `/api/customers/${customerId}/deliveries` : null,
    fetcher
  )

  const [selectedAddress, setSelectedAddress] = useState<"billing" | number>(
    "billing"
  )

  const getAddress = useCallback(() => {
    if (!customer) return null

    if (selectedAddress === "billing") {
      return {
        company: customer.company_name,
        contact: customer.contact_name || contactName,
        street: customer.street || "",
        city: customer.city || "",
        state: customer.state || "",
        zip: customer.postal_code || "",
      }
    }

    const da = deliveryAddresses?.[selectedAddress as number]
    if (!da) return null
    return {
      company: da.company_name || customer.company_name,
      contact: da.delivery_contact || customer.contact_name || contactName,
      street: da.street || "",
      city: da.city || "",
      state: da.state || "",
      zip: da.postal_code || "",
    }
  }, [customer, deliveryAddresses, selectedAddress, contactName])

  // Build list of all boxes with individual indices
  const allBoxes: Array<{ rec: BoxRecommendation; boxIndex: number; totalBoxes: number }> = []
  let globalIndex = 0
  for (const rec of estimate.recommendations) {
    for (let i = 0; i < rec.count; i++) {
      allBoxes.push({ rec, boxIndex: ++globalIndex, totalBoxes: estimate.totalBoxes })
    }
  }

  const handlePrint = () => {
    if (!printRef.current) return
    const printWindow = window.open("", "_blank", "width=800,height=600")
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Shipping Labels - Q-${quoteNumber || "---"}</title>
          <style>
            @page { size: 4in 6in; margin: 0; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, Helvetica, sans-serif; }
            .label-page {
              width: 4in;
              height: 6in;
              padding: 0.25in;
              page-break-after: always;
              display: flex;
              flex-direction: column;
              position: relative;
              border: 1px solid #ddd;
            }
            .label-page:last-child { page-break-after: auto; }
            .from-section {
              font-size: 9pt;
              line-height: 1.3;
              padding-bottom: 0.15in;
              border-bottom: 1px solid #ccc;
              margin-bottom: 0.15in;
            }
            .from-section .company { font-weight: 700; }
            .to-section {
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: center;
              padding: 0.15in 0.25in;
            }
            .to-section .company {
              font-size: 16pt;
              font-weight: 800;
              letter-spacing: -0.02em;
              line-height: 1.2;
              margin-bottom: 2pt;
            }
            .to-section .contact {
              font-size: 11pt;
              font-weight: 600;
              margin-bottom: 4pt;
              color: #333;
            }
            .to-section .address {
              font-size: 12pt;
              line-height: 1.4;
              font-weight: 500;
            }
            .to-section .city-state {
              font-size: 12pt;
              font-weight: 600;
              text-transform: uppercase;
            }
            .job-bar {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              border-top: 2px solid #000;
              padding-top: 0.1in;
              margin-top: auto;
            }
            .job-number {
              font-size: 18pt;
              font-weight: 900;
              letter-spacing: -0.03em;
              font-family: 'Arial Black', Arial, sans-serif;
            }
            .box-count {
              font-size: 14pt;
              font-weight: 800;
              font-family: 'Arial Black', Arial, sans-serif;
              background: #000;
              color: #fff;
              padding: 2pt 8pt;
              border-radius: 4pt;
            }
            .meta-row {
              display: flex;
              justify-content: space-between;
              font-size: 8pt;
              color: #666;
              margin-top: 4pt;
            }
            .meta-row .weight { font-weight: 600; }
            .meta-row .box-type { font-weight: 600; }
            .project-name {
              font-size: 9pt;
              color: #555;
              font-weight: 600;
              margin-top: 2pt;
            }
            .pieces-info {
              font-size: 10pt;
              font-weight: 600;
              color: #444;
              margin-top: 2pt;
            }
            @media print {
              .label-page { border: none; }
            }
          </style>
        </head>
        <body>
          ${printRef.current.innerHTML}
        </body>
      </html>
    `)
    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
    }, 300)
  }

  if (!open) return null

  const addr = getAddress()
  const jobId = quoteNumber ? `Q-${quoteNumber}` : "Q----"
  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background rounded-2xl shadow-2xl border border-border max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div>
            <h2 className="text-sm font-bold text-foreground">Shipping Labels</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {estimate.totalBoxes} label{estimate.totalBoxes !== 1 ? "s" : ""} for {jobId}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              size="sm"
              className="gap-1.5 h-8 text-xs bg-foreground text-background hover:bg-foreground/90"
            >
              <Printer className="h-3.5 w-3.5" />
              Print All
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Address selector */}
        {(deliveryAddresses && deliveryAddresses.length > 0) && (
          <div className="px-5 py-2.5 border-b border-border/50 bg-secondary/20">
            <label className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider block mb-1.5">
              Ship To Address
            </label>
            <select
              value={String(selectedAddress)}
              onChange={(e) => {
                const v = e.target.value
                setSelectedAddress(v === "billing" ? "billing" : parseInt(v))
              }}
              className="w-full h-8 text-xs rounded-lg border border-border/60 bg-background px-2.5 text-foreground"
            >
              <option value="billing">
                Billing - {customer?.street || "No address"}
                {customer?.city ? `, ${customer.city}` : ""}
              </option>
              {deliveryAddresses.map((da, i) => (
                <option key={da.id} value={i}>
                  {da.label || `Delivery ${i + 1}`} - {da.street}
                  {da.city ? `, ${da.city}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Label preview */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-4">
            {allBoxes.map(({ rec, boxIndex, totalBoxes }) => (
              <div
                key={boxIndex}
                className="border border-border rounded-xl shadow-sm overflow-hidden"
                style={{ aspectRatio: "4 / 6", maxWidth: 340 }}
              >
                <div className="h-full flex flex-col p-4">
                  {/* From */}
                  <div className="text-[9px] leading-tight pb-2 border-b border-border/50 mb-2 text-muted-foreground">
                    <p className="font-bold text-foreground">POSTAGE PLUS</p>
                    <p>Your Return Address Line 1</p>
                    <p>City, State ZIP</p>
                  </div>

                  {/* To */}
                  <div className="flex-1 flex flex-col justify-center px-2">
                    {addr?.company && (
                      <p className="text-base font-extrabold text-foreground leading-tight tracking-tight">
                        {addr.company}
                      </p>
                    )}
                    {addr?.contact && addr.contact !== addr.company && (
                      <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">
                        {addr.contact}
                      </p>
                    )}
                    {addr?.street && (
                      <p className="text-xs font-medium text-foreground mt-1">
                        {addr.street}
                      </p>
                    )}
                    {(addr?.city || addr?.state || addr?.zip) && (
                      <p className="text-xs font-semibold text-foreground uppercase">
                        {[addr.city, addr.state].filter(Boolean).join(", ")}
                        {addr.zip ? ` ${addr.zip}` : ""}
                      </p>
                    )}
                    {!addr && (
                      <p className="text-xs italic text-muted-foreground">
                        No customer address on file
                      </p>
                    )}
                  </div>

                  {/* Job name - BIG */}
                  {projectName && (
                    <div className="border-t border-border/50 pt-1.5 mt-auto">
                      <p className="text-xl font-black tracking-tight text-foreground leading-tight truncate" title={projectName}>
                        {projectName}
                      </p>
                    </div>
                  )}

                  {/* Bottom bar */}
                  <div className={cn("border-t-2 border-foreground pt-2", !projectName && "mt-auto")}>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-lg font-black tracking-tight text-foreground leading-none">
                          {jobId}
                        </p>
                      </div>
                      <div className="bg-foreground text-background text-sm font-black px-2 py-0.5 rounded">
                        {boxIndex}/{totalBoxes}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[8px] text-muted-foreground">
                      <span className="font-semibold">
                        {rec.box.name} ({rec.box.lengthIn}&quot;x{rec.box.widthIn}&quot;x{rec.box.heightIn}&quot;)
                      </span>
                      <span className="font-semibold">
                        {formatShippingWeight(rec.weightPerBoxOz)} | {rec.piecesPerBox.toLocaleString()} pcs
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hidden printable version */}
        <div ref={printRef} className="hidden">
          {allBoxes.map(({ rec, boxIndex, totalBoxes }) => (
            <div key={boxIndex} className="label-page">
              <div className="from-section">
                <p className="company">POSTAGE PLUS</p>
                <p>Your Return Address Line 1</p>
                <p>City, State ZIP</p>
              </div>

              <div className="to-section">
                {addr?.company && <p className="company">{addr.company}</p>}
                {addr?.contact && addr.contact !== addr.company && (
                  <p className="contact">{addr.contact}</p>
                )}
                {addr?.street && <p className="address">{addr.street}</p>}
                {(addr?.city || addr?.state || addr?.zip) && (
                  <p className="city-state">
                    {[addr.city, addr.state].filter(Boolean).join(", ")}
                    {addr.zip ? ` ${addr.zip}` : ""}
                  </p>
                )}
              </div>

              <div>
                {projectName && (
                  <div style={{ borderTop: "1px solid #ccc", paddingTop: "4pt", marginBottom: "4pt" }}>
                    <p style={{ fontSize: "22pt", fontWeight: 900, fontFamily: "'Arial Black', Arial, sans-serif", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
                      {projectName}
                    </p>
                  </div>
                )}
                <div className="job-bar">
                  <div>
                    <span className="job-number">{jobId}</span>
                    <p className="pieces-info">{rec.piecesPerBox.toLocaleString()} pieces</p>
                  </div>
                  <span className="box-count">{boxIndex} / {totalBoxes}</span>
                </div>
                <div className="meta-row">
                  <span className="box-type">
                    Box {rec.box.name} ({rec.box.lengthIn}&quot;x{rec.box.widthIn}&quot;x{rec.box.heightIn}&quot;)
                  </span>
                  <span className="weight">{formatShippingWeight(rec.weightPerBoxOz)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
