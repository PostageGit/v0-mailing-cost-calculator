import { put } from "@vercel/blob"

function fmt(n: number) {
  return "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
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

interface QuotePdfInput {
  quoteNumber: string
  customerName: string | null
  jobType: string
  jobDetails: Record<string, unknown>
  totalPrice: number
  perUnitPrice: number
  expiresAt: string
}

export async function generateQuotePdf(input: QuotePdfInput): Promise<string | null> {
  const { quoteNumber, customerName, jobType, jobDetails, totalPrice, perUnitPrice, expiresAt } = input

  // Dynamic import -- jsPDF accesses DOM globals at module level
  const { jsPDF } = await import("jspdf")

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // --- Header ---
  doc.setFillColor(30, 41, 59)
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
    doc.setTextColor(100, 116, 139)
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
  doc.setDrawColor(226, 232, 240)
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
  const jd = jobDetails as Record<string, unknown>

  // Handle new summary format
  if (typeof jd.summary === "string") {
    // Split summary into lines for display
    const summaryParts = (jd.summary as string).split(/,\s*/)
    summaryParts.forEach((part) => {
      const trimmed = part.trim()
      if (trimmed) details.push(["", trimmed])
    })
  } else {
    // Handle old structured format
    if (jd.quantity) details.push(["Quantity", String(jd.quantity)])
    if (jd.size) details.push(["Finished Size", String(jd.size)])
    if (jd.pages) details.push(["Pages", String(jd.pages)])
    if (jd.binding) details.push(["Binding", String(jd.binding)])
    if (jd.paper) details.push(["Paper", String(jd.paper)])
    if (jd.cover) details.push(["Cover", String(jd.cover)])
    if (jd.sides) details.push(["Print Sides", describeSides(String(jd.sides))])
    if (jd.lamination && jd.lamination !== "none") details.push(["Lamination", String(jd.lamination)])
    if (jd.extras) details.push(["Extras", String(jd.extras)])
  }

  const rowHeight = 8
  const labelWidth = 45

  details.forEach(([label, value], i) => {
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252)
      doc.rect(margin, y - 5, contentWidth, rowHeight, "F")
    }
    if (label) {
      doc.setFont("helvetica", "bold")
      doc.setTextColor(71, 85, 105)
      doc.setFontSize(10)
      doc.text(label, margin + 4, y)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(30, 41, 59)
      doc.text(value, margin + labelWidth, y)
    } else {
      doc.setFont("helvetica", "normal")
      doc.setTextColor(30, 41, 59)
      doc.setFontSize(10)
      doc.text(value, margin + 4, y)
    }
    y += rowHeight
  })

  y += 8

  // --- Divider ---
  doc.setDrawColor(226, 232, 240)
  doc.line(margin, y, pageWidth - margin, y)
  y += 10

  // --- Pricing box ---
  doc.setFillColor(240, 249, 255)
  doc.setDrawColor(56, 189, 248)
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
  doc.setTextColor(148, 163, 184)
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.text("This quote is valid for 30 days from the date of issue.", margin, y)
  y += 4
  doc.text("Prices may vary based on final artwork and specifications.", margin, y)
  y += 4
  doc.text(`Quote reference: ${quoteNumber}`, margin, y)

  // Generate buffer and upload
  const pdfBuffer = Buffer.from(doc.output("arraybuffer"))
  const blob = await put(`quotes/${quoteNumber}.pdf`, pdfBuffer, {
    access: "public",
    contentType: "application/pdf",
    addRandomSuffix: false,
  })

  return blob.url
}
