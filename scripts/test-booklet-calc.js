// Test booklet calculation via API
// 5000 copies, 6x9, 96 total pages (92 inside + 4 cover), 
// 60lb Offset D/S inside with bleed, 14pt Gloss 4/0 cover with bleed, 
// fold & staple binding, broker pricing

const inputs = {
  bookQty: 5000,
  pagesPerBook: 96, // Total pages including cover
  pageWidth: 6,
  pageHeight: 9,
  separateCover: true,
  coverPaper: "14pt Gloss",
  coverSides: "4/0",
  coverBleed: true,
  insidePaper: "60lb Offset",
  insideSides: "4/4", // D/S = double sided
  insideBleed: true,
  laminationType: "none",
  isBroker: true,
}

console.log("=== BOOKLET QUOTE CALCULATION ===")
console.log("")
console.log("SPECIFICATIONS:")
console.log(`  Quantity: ${inputs.bookQty.toLocaleString()} booklets`)
console.log(`  Size: ${inputs.pageWidth}" x ${inputs.pageHeight}"`)
console.log(`  Total Pages: ${inputs.pagesPerBook} (${inputs.pagesPerBook - 4} inside + 4 cover)`)
console.log(`  Cover: ${inputs.coverPaper} ${inputs.coverSides}${inputs.coverBleed ? " with bleed" : ""}`)
console.log(`  Inside: ${inputs.insidePaper} ${inputs.insideSides}${inputs.insideBleed ? " with bleed" : ""}`)
console.log(`  Binding: Saddle Stitch (fold & staple)`)
console.log(`  Pricing: ${inputs.isBroker ? "Broker" : "Retail"}`)
console.log("")

// Make API call to calculate
fetch("http://localhost:3000/api/booklet-calc", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(inputs)
})
.then(res => res.json())
.then(result => {
  if (result.error) {
    console.log("ERROR:", result.error)
    return
  }
  
  console.log("=== COST BREAKDOWN ===")
  console.log("")
  
  if (result.coverResult) {
    console.log("COVER PRINTING:")
    console.log(`  Paper: ${result.coverResult.sheetSize} ${inputs.coverPaper}`)
    console.log(`  Sheets: ${result.coverResult.sheets?.toLocaleString() || "N/A"}`)
    console.log(`  Cost: $${result.coverResult.cost?.toFixed(2) || "N/A"}`)
    console.log("")
  }
  
  console.log("INSIDE PRINTING:")
  console.log(`  Paper: ${result.insideResult?.sheetSize || "N/A"} ${inputs.insidePaper}`)
  console.log(`  Sheets: ${result.insideResult?.sheets?.toLocaleString() || "N/A"}`)
  console.log(`  Cost: $${result.insideResult?.cost?.toFixed(2) || "N/A"}`)
  console.log("")
  
  console.log("BINDING (Saddle Stitch):")
  console.log(`  Per Book: $${result.bindingPricePerBook?.toFixed(4) || "N/A"}`)
  console.log(`  Total: $${result.totalBindingPrice?.toFixed(2) || "N/A"}`)
  console.log("")
  
  if (result.brokerDiscountAmount > 0) {
    console.log("BROKER DISCOUNT:")
    console.log(`  Discount: -$${result.brokerDiscountAmount?.toFixed(2) || "0.00"}`)
    console.log("")
  }
  
  console.log("=== TOTALS ===")
  console.log(`  Subtotal: $${(result.grandTotal + (result.brokerDiscountAmount || 0)).toFixed(2)}`)
  if (result.brokerDiscountAmount > 0) {
    console.log(`  Broker Discount: -$${result.brokerDiscountAmount.toFixed(2)}`)
  }
  console.log(`  GRAND TOTAL: $${result.grandTotal?.toFixed(2) || "N/A"}`)
  console.log(`  PER BOOKLET: $${result.perBooklet?.toFixed(4) || "N/A"}`)
})
.catch(err => {
  console.log("API Error:", err.message)
})
