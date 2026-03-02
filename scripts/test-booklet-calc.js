const { calculateBooklet } = require("../lib/booklet-pricing.ts");

function fmt(n) {
  return "$" + n.toFixed(2);
}

// Test 1: Exact UI screenshot specs -- 4/0 cover, S/S inside (what the UI uses)
console.log("=== TEST 1: UI screenshot (100 booklets, 8x10, 40 inside, 4/0 cover, S/S inside) ===");
const result1 = calculateBooklet({
  bookQty: 100,
  pagesPerBook: 40,
  pageWidth: 8,
  pageHeight: 10,
  separateCover: true,
  coverPaper: "12pt Matte",
  coverSides: "4/0",
  coverBleed: true,
  coverSheetSize: "cheapest",
  insidePaper: "20lb Offset",
  insideSides: "S/S",
  insideBleed: true,
  insideSheetSize: "cheapest",
  laminationType: "Matte",
  customLevel: "auto",
  isBroker: false,
  printingMarkupPct: 0,
});

if (!result1.isValid) {
  console.log("ERROR:", result1.error);
} else {
  console.log("Total:", fmt(result1.grandTotal), "(should be $423.00)");
  console.log("Per booklet:", fmt(result1.pricePerBook));
  console.log("Printing:", fmt(result1.totalPrintingCost));
  console.log("Binding:", fmt(result1.totalBindingPrice));
  console.log("Lamination:", fmt(result1.totalLaminationCost));
  console.log("Inside level:", result1.insideResult?.level, "(auto:", result1.insideResult?.autoLevel, ")");
  console.log("Inside sheets:", result1.insideResult?.sheets);
  console.log("Cover level:", result1.coverResult?.level, "(auto:", result1.coverResult?.autoLevel, ")");
  console.log("Cover sheets:", result1.coverResult?.sheets);
}

// Test 2: Chat auto-corrected sides (4/4 cover, D/S inside)
console.log("\n=== TEST 2: Chat auto-corrected (4/4 cover, D/S inside) ===");
const result2 = calculateBooklet({
  bookQty: 100,
  pagesPerBook: 40,
  pageWidth: 8,
  pageHeight: 10,
  separateCover: true,
  coverPaper: "12pt Matte",
  coverSides: "4/4",
  coverBleed: true,
  coverSheetSize: "cheapest",
  insidePaper: "20lb Offset",
  insideSides: "D/S",
  insideBleed: true,
  insideSheetSize: "cheapest",
  laminationType: "Matte",
  customLevel: "auto",
  isBroker: false,
  printingMarkupPct: 0,
});

if (!result2.isValid) {
  console.log("ERROR:", result2.error);
} else {
  console.log("Total:", fmt(result2.grandTotal));
  console.log("Per booklet:", fmt(result2.pricePerBook));
  console.log("Printing:", fmt(result2.totalPrintingCost));
  console.log("Binding:", fmt(result2.totalBindingPrice));
  console.log("Lamination:", fmt(result2.totalLaminationCost));
  console.log("DIFFERENCE from UI:", fmt(result2.grandTotal - result1.grandTotal));
}

// Test 3: Broker pricing
console.log("\n=== TEST 3: Broker = true (4/0 cover, S/S inside) ===");
const result3 = calculateBooklet({
  bookQty: 100,
  pagesPerBook: 40,
  pageWidth: 8,
  pageHeight: 10,
  separateCover: true,
  coverPaper: "12pt Matte",
  coverSides: "4/0",
  coverBleed: true,
  coverSheetSize: "cheapest",
  insidePaper: "20lb Offset",
  insideSides: "S/S",
  insideBleed: true,
  insideSheetSize: "cheapest",
  laminationType: "Matte",
  customLevel: "auto",
  isBroker: true,
  printingMarkupPct: 0,
});

if (!result3.isValid) {
  console.log("ERROR:", result3.error);
} else {
  console.log("Total:", fmt(result3.grandTotal));
  console.log("Per booklet:", fmt(result3.pricePerBook));
  console.log("Level (broker=10):", result3.insideResult?.level);
  console.log("DIFFERENCE from non-broker:", fmt(result3.grandTotal - result1.grandTotal));
}
