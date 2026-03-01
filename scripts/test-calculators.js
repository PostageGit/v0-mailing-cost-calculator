const { execSync } = require("child_process")

const testCode = `
import { calculatePerfect } from './lib/perfect-pricing.ts';
import { calculateBooklet } from './lib/booklet-pricing.ts';
import { calculateSpiral } from './lib/spiral-pricing.ts';
import { calculateAllSheetOptions, buildFullResult } from './lib/printing-pricing.ts';

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
  if ("error" in r) console.log("ERROR:", r.error);
  else console.log("OK - Total:", r.grandTotal?.toFixed(2), "Per Book:", r.pricePerBook?.toFixed(2), "Inside sheet:", r.insideResult?.sheetSize, "Cover sheet:", r.coverResult?.sheetSize);
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
  else console.log("OK - Total:", r.grandTotal?.toFixed(2), "Per Book:", r.pricePerBook?.toFixed(2), "Inside sheet:", r.insideResult?.sheetSize, "Cover sheet:", r.coverResult?.sheetSize);
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
  if ("error" in r) console.log("ERROR:", r.error);
  else console.log("OK - Total:", r.grandTotal?.toFixed(2), "Per Book:", r.pricePerBook?.toFixed(2), "Printing:", r.totalPrintingCost?.toFixed(2), "Binding:", r.totalBindingPrice?.toFixed(2));
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
    console.log("OK - Total:", result.grandTotal?.toFixed(2), "Per Unit:", (result.grandTotal/1000).toFixed(2), "Sheet:", best.size, "Ups:", best.result.ups);
  }
} catch(e) { console.log("EXCEPTION:", e.message); }
`

try {
  const result = execSync(`npx tsx -e ${JSON.stringify(testCode)}`, {
    cwd: "/vercel/share/v0-project",
    encoding: "utf-8",
    timeout: 30000,
  })
  console.log(result)
} catch (e) {
  console.log(e.stdout || "")
  console.log(e.stderr || "")
  console.log("Exit code:", e.status)
}
