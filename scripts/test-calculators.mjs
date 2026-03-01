// We can't import TS directly, so let's test via the API endpoint
const BASE = "http://localhost:3000"

async function testChat(message) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: message }],
    }),
  })
  if (!res.ok) {
    console.log("HTTP Error:", res.status, await res.text())
    return null
  }
  const text = await res.text()
  return text
}

// Test: directly call the calculators via a Node script that uses tsx
console.log("Testing calculators via inline evaluation...")

// Use child_process to run tsx
import { execSync } from "child_process"

const testCode = `
const { calculatePerfect } = require('./lib/perfect-pricing.ts') || {};
const { calculateBooklet } = require('./lib/booklet-pricing.ts') || {};
const { calculateSpiral } = require('./lib/spiral-pricing.ts') || {};
const { calculateAllSheetOptions, buildFullResult } = require('./lib/printing-pricing.ts') || {};

// Test 1: Perfect Bound
console.log("=== TEST 1: Perfect Bound ===");
console.log("500 copies, 8.5x11, 100 inside pages BW, color cover");
try {
  const r = calculatePerfect({
    bookQty: 500, pagesPerBook: 100, pageWidth: 8.5, pageHeight: 11,
    inside: { paperName: "80lb Text Gloss", sides: "1/1", hasBleed: false, sheetSize: "cheapest" },
    cover: { paperName: "80 Gloss", sides: "4/4", hasBleed: true, sheetSize: "cheapest" },
    laminationType: "none", customLevel: "auto", isBroker: false,
  });
  if (r.error) console.log("ERROR:", r.error);
  else console.log("Total:", r.grandTotal, "Per Book:", r.pricePerBook, "Inside sheets:", r.insideResult?.sheets, "Sheet:", r.insideResult?.sheetSize);
} catch(e) { console.log("EXCEPTION:", e.message); }

// Test 2: Booklet
console.log("\\n=== TEST 2: Saddle-Stitch Booklet ===");
console.log("500 copies, 8.5x11, 16 inside pages, separate 80 Gloss cover");
try {
  const r = calculateBooklet({
    bookQty: 500, pagesPerBook: 16, pageWidth: 8.5, pageHeight: 11,
    separateCover: true, coverPaper: "80 Gloss", coverSides: "4/4", coverBleed: true, coverSheetSize: "cheapest",
    insidePaper: "80lb Text Gloss", insideSides: "4/4", insideBleed: false, insideSheetSize: "cheapest",
    laminationType: "none", customLevel: "auto", isBroker: false, printingMarkupPct: 10,
  });
  if (!r.isValid) console.log("ERROR:", r.error);
  else console.log("Total:", r.grandTotal, "Per Book:", r.pricePerBook, "Inside sheet:", r.insideResult?.sheetSize, "Cover sheet:", r.coverResult?.sheetSize);
} catch(e) { console.log("EXCEPTION:", e.message); }

// Test 3: Spiral
console.log("\\n=== TEST 3: Spiral Bound ===");
console.log("500 copies, 8.5x11, 100 inside pages BW, 80 Gloss covers");
try {
  const r = calculateSpiral({
    bookQty: 500, pagesPerBook: 100, pageWidth: 8.5, pageHeight: 11,
    inside: { paperName: "80lb Text Gloss", sides: "1/1", hasBleed: false, sheetSize: "cheapest" },
    useFrontCover: true, front: { paperName: "80 Gloss", sides: "4/4", hasBleed: false, sheetSize: "cheapest" },
    useBackCover: true, back: { paperName: "80 Gloss", sides: "4/4", hasBleed: false, sheetSize: "cheapest" },
    clearPlastic: false, blackVinyl: false, customLevel: "auto", isBroker: false,
  });
  if (r.error) console.log("ERROR:", r.error);
  else console.log("Total:", r.grandTotal, "Per Book:", r.pricePerBook, "Printing:", r.totalPrintingCost, "Binding:", r.totalBindingPrice);
} catch(e) { console.log("EXCEPTION:", e.message); }

// Test 4: Flat Print
console.log("\\n=== TEST 4: Flat Print ===");
console.log("1000 flyers, 8.5x11, 80lb Text Gloss, color both sides");
try {
  const inputs = {
    qty: 1000, width: 8.5, height: 11, paperName: "80lb Text Gloss", sidesValue: "4/4",
    hasBleed: false, addOnCharge: 0, addOnDescription: "", printingMarkupPct: 10, isBroker: false,
    lamination: { enabled: false, type: "Gloss", sides: "S/S" }, scoreFoldOperation: "", scoreFoldType: "",
  };
  const options = calculateAllSheetOptions(inputs);
  if (!options.length) console.log("ERROR: No sheet options");
  else {
    const best = options[0];
    const result = buildFullResult(inputs, best.result);
    console.log("Total:", result.grandTotal, "Per Unit:", (result.grandTotal/1000).toFixed(2), "Sheet:", best.size, "Ups:", best.result.ups);
  }
} catch(e) { console.log("EXCEPTION:", e.message); }
`

try {
  const result = execSync(`npx tsx -e '${testCode.replace(/'/g, "'\\''")}'`, {
    cwd: "/vercel/share/v0-project",
    encoding: "utf-8",
    timeout: 30000,
  })
  console.log(result)
} catch (e) {
  console.log("Exec error:", e.stdout || e.stderr || e.message)
}
