import { put } from "@vercel/blob"

function fmt(n: number) {
  return "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

export async function POST(req: Request) {
  try {
    const {
      quoteNumber,
      customerName,
      jobType,
      jobDetails,
      totalPrice,
      perUnitPrice,
      expiresAt,
    } = await req.json()

    // Dynamic import -- jsPDF accesses DOM globals at module level so it must be lazy-loaded
    const { jsPDF } = await import("jspdf")

    // Create PDF
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" })
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 20
    const contentWidth = pageWidth - margin * 2
    let y = margin

    // --- Header ---
    doc.setFillColor(30, 41, 59) // slate-800
    doc.rect(0, 0, pageWidth, 42, "F")

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(22)
    doc.setFont("helvetica", "bold")
    doc.text("POSTAGE PLUS", margin, 18)

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text("Print Shop Quote", margin, 26)

    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.text(quoteNumber, pageWidth - margin, 18, { align: "right" })

    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    const createdDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    const expiryDate = new Date(expiresAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    doc.text(`Date: ${createdDate}`, pageWidth - margin, 26, { align: "right" })
    doc.text(`Valid until: ${expiryDate}`, pageWidth - margin, 32, { align: "right" })

    y = 55

    // --- Customer info ---
    if (customerName) {
      doc.setTextColor(100, 116, 139) // slate-500
      doc.setFontSize(9)
      doc.text("CUSTOMER", margin, y)
      y += 6
      doc.setTextColor(30, 41, 59)
      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text(customerName, margin, y)
      y += 10
    }

    // --- Job type header ---
    doc.setTextColor(100, 116, 139)
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.text("JOB TYPE", margin, y)
    y += 6
    doc.setTextColor(30, 41, 59)
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.text(jobType, margin, y)
    y += 12

    // --- Divider ---
    doc.setDrawColor(226, 232, 240) // slate-200
    doc.setLineWidth(0.5)
    doc.line(margin, y, pageWidth - margin, y)
    y += 10

    // --- Job details table ---
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 116, 139)
    doc.text("JOB SPECIFICATIONS", margin, y)
    y += 8

    const details: [string, string][] = []
    if (jobDetails.quantity) details.push(["Quantity", jobDetails.quantity.toLocaleString()])
    if (jobDetails.size) details.push(["Finished Size", jobDetails.size])
    if (jobDetails.pages) details.push(["Pages", jobDetails.pages.toString()])
    if (jobDetails.binding) details.push(["Binding", jobDetails.binding])
    if (jobDetails.paper) details.push(["Paper", jobDetails.paper])
    if (jobDetails.cover) details.push(["Cover", jobDetails.cover])
    if (jobDetails.sides) details.push(["Print Sides", describeSides(jobDetails.sides)])
    if (jobDetails.lamination && jobDetails.lamination !== "none") details.push(["Lamination", jobDetails.lamination])
    if (jobDetails.extras) details.push(["Extras", jobDetails.extras])

    const rowHeight = 8
    const labelWidth = 45

    details.forEach(([label, value], i) => {
      // Alternate row background
      if (i % 2 === 0) {
        doc.setFillColor(248, 250, 252) // slate-50
        doc.rect(margin, y - 5, contentWidth, rowHeight, "F")
      }

      doc.setFont("helvetica", "bold")
      doc.setTextColor(71, 85, 105) // slate-600
      doc.setFontSize(10)
      doc.text(label, margin + 4, y)

      doc.setFont("helvetica", "normal")
      doc.setTextColor(30, 41, 59) // slate-800
      doc.text(value, margin + labelWidth, y)

      y += rowHeight
    })

    y += 8

    // --- Divider ---
    doc.setDrawColor(226, 232, 240)
    doc.line(margin, y, pageWidth - margin, y)
    y += 10

    // --- Pricing box ---
    doc.setFillColor(240, 249, 255) // sky-50
    doc.setDrawColor(56, 189, 248) // sky-400
    doc.setLineWidth(0.3)
    doc.roundedRect(margin, y, contentWidth, 28, 3, 3, "FD")

    doc.setTextColor(30, 41, 59)
    doc.setFontSize(11)
    doc.setFont("helvetica", "normal")
    doc.text("Total Price", margin + 8, y + 10)
    doc.setFontSize(20)
    doc.setFont("helvetica", "bold")
    doc.text(fmt(totalPrice), margin + 8, y + 22)

    if (perUnitPrice) {
      doc.setTextColor(100, 116, 139)
      doc.setFontSize(11)
      doc.setFont("helvetica", "normal")
      doc.text(`${fmt(perUnitPrice)} per unit`, pageWidth - margin - 8, y + 16, { align: "right" })
    }

    y += 38

    // --- Footer ---
    doc.setTextColor(148, 163, 184) // slate-400
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.text("This quote is valid for 30 days from the date of issue.", margin, y)
    y += 4
    doc.text("Prices may vary based on final artwork and specifications.", margin, y)
    y += 4
    doc.text(`Quote reference: ${quoteNumber}`, margin, y)

    // Generate buffer
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"))

    // Upload to Vercel Blob
    const blob = await put(`quotes/${quoteNumber}.pdf`, pdfBuffer, {
      access: "public",
      contentType: "application/pdf",
      addRandomSuffix: false,
    })

    return Response.json({ url: blob.url })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    console.error("[quote-pdf] Error:", msg)
    return Response.json({ error: msg }, { status: 500 })
  }
}

function describeSides(code: string): string {
  const map: Record<string, string> = {
    "4/4": "Full Color, Both Sides",
    "4/0": "Full Color, Front Only",
    "1/1": "Rich BW, Both Sides",
    "1/0": "Rich BW, Front Only",
    "S/S": "Black & White, Front Only",
    "D/S": "Black & White, Both Sides",
  }
  return map[code] || code
}
