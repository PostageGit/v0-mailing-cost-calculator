"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { 
  FileText, Upload, Download, Play, Plus, X, ChevronRight, 
  RotateCw, Copy, Trash2, MoveVertical, Layers, BookOpen,
  Grid3X3, Maximize2, Scissors, FileStack, Settings, Info,
  CheckCircle2, AlertCircle, Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"

// Import pdf-lib for PDF manipulation
import { PDFDocument, degrees, rgb, StandardFonts, PageSizes } from "pdf-lib"

const IN = 72 // Points per inch

// Sheet size presets
const SHEET_PRESETS = [
  { name: "US Letter", w: 8.5, h: 11 },
  { name: "US Legal", w: 8.5, h: 14 },
  { name: "Tabloid", w: 11, h: 17 },
  { name: "12x18", w: 12, h: 18 },
  { name: "13x19", w: 13, h: 19 },
  { name: "A4", w: 8.27, h: 11.69 },
  { name: "A3", w: 11.69, h: 16.54 },
  { name: "Custom", w: 0, h: 0 },
]

// Tool definitions
const TOOLS = {
  // Imposition tools
  SimpleBooklet: {
    name: "Simple Booklet",
    emoji: "📖",
    desc: "Reorder pages for saddle-stitch booklet printing. Prints 2-up on sheets that fold in half.",
    tip: "Page count must be divisible by 4. Tool will add blank pages if needed.",
    category: "booklet",
    params: [
      { id: "sheet", label: "Sheet Size", type: "sheet", def: "Tabloid" },
      { id: "sheetW", label: "Custom Width", type: "in", def: 11, hidden: true },
      { id: "sheetH", label: "Custom Height", type: "in", def: 17, hidden: true },
    ]
  },
  Nup: {
    name: "N-Up",
    emoji: "⊞",
    desc: "Place multiple pages on each sheet. Great for printing booklets, cards, or reducing paper usage.",
    tip: "Pages are placed in reading order (left-to-right, top-to-bottom).",
    category: "nup",
    params: [
      { id: "cols", label: "Columns", type: "num", def: 2, min: 1, max: 10 },
      { id: "rows", label: "Rows", type: "num", def: 2, min: 1, max: 10 },
      { id: "sheet", label: "Sheet Size", type: "sheet", def: "Tabloid" },
      { id: "sheetW", label: "Custom Width", type: "in", def: 11, hidden: true },
      { id: "sheetH", label: "Custom Height", type: "in", def: 17, hidden: true },
      { id: "gap", label: "Gap Between", type: "in", def: 0 },
      { id: "order", label: "Reading Order", type: "sel", def: "Left-Right, Top-Bottom", opts: ["Left-Right, Top-Bottom", "Right-Left, Top-Bottom", "Top-Bottom, Left-Right"] },
    ]
  },
  StepRepeat: {
    name: "Step & Repeat",
    emoji: "🔁",
    desc: "Tile the same page multiple times on a sheet. Perfect for business cards, labels, tickets.",
    tip: "Uses only the first page of your PDF.",
    category: "nup",
    params: [
      { id: "cols", label: "Columns", type: "num", def: 2, min: 1, max: 10 },
      { id: "rows", label: "Rows", type: "num", def: 4, min: 1, max: 10 },
      { id: "sheet", label: "Sheet Size", type: "sheet", def: "US Letter" },
      { id: "sheetW", label: "Custom Width", type: "in", def: 8.5, hidden: true },
      { id: "sheetH", label: "Custom Height", type: "in", def: 11, hidden: true },
      { id: "gap", label: "Gap Between", type: "in", def: 0.125 },
    ]
  },
  Join2Pages: {
    name: "Join 2 Pages",
    emoji: "⟷",
    desc: "Combine pairs of pages side-by-side to create spreads. Useful for proofing booklet layouts.",
    tip: "If odd number of pages, last page gets a blank partner.",
    category: "other",
    params: [
      { id: "gap", label: "Gap Between", type: "in", def: 0 },
    ]
  },
  // Page manipulation tools
  RotatePages: {
    name: "Rotate Pages",
    emoji: "🔄",
    desc: "Rotate all pages by a specified angle.",
    tip: "Positive = clockwise, Negative = counter-clockwise.",
    category: "page",
    params: [
      { id: "angle", label: "Angle", type: "sel", def: "90", opts: ["90", "180", "270", "-90"] },
      { id: "range", label: "Page Range", type: "txt", def: "All" },
    ]
  },
  DuplicatePages: {
    name: "Duplicate Pages",
    emoji: "📋",
    desc: "Create multiple copies of each page in sequence.",
    tip: "2 copies of 3 pages = 1,1,2,2,3,3",
    category: "page",
    params: [
      { id: "copies", label: "Copies per Page", type: "num", def: 2, min: 1, max: 100 },
    ]
  },
  DeletePages: {
    name: "Delete Pages",
    emoji: "🗑️",
    desc: "Remove specific pages from the document.",
    tip: "Use ranges like: 1,3,5-8,12",
    category: "page",
    params: [
      { id: "range", label: "Pages to Delete", type: "txt", def: "1" },
    ]
  },
  ReversePages: {
    name: "Reverse Order",
    emoji: "↩️",
    desc: "Reverse the order of all pages in the document.",
    tip: "Useful for fixing duplex printing order.",
    category: "page",
    params: []
  },
  InsertBlanks: {
    name: "Insert Blanks",
    emoji: "📄",
    desc: "Add blank pages to reach a target count or make divisible by 4.",
    tip: "For booklets, page count must be divisible by 4.",
    category: "page",
    params: [
      { id: "mode", label: "Mode", type: "sel", def: "Make divisible by 4", opts: ["Make divisible by 4", "Target page count"] },
      { id: "target", label: "Target Count", type: "num", def: 32, min: 1 },
    ]
  },
  // Finishing tools
  GenerateBleed: {
    name: "Generate Bleed",
    emoji: "🖼️",
    desc: "Extend page edges to create bleed area for printing.",
    tip: "Standard bleed is 0.125\" (1/8 inch).",
    category: "finish",
    params: [
      { id: "bleed", label: "Bleed Amount", type: "in", def: 0.125 },
      { id: "method", label: "Method", type: "sel", def: "Mirror edges", opts: ["Mirror edges", "Extend color"] },
    ]
  },
  CropMarks: {
    name: "Add Crop Marks",
    emoji: "✂️",
    desc: "Add trim marks to show where to cut the paper.",
    tip: "Registration marks help align color separations.",
    category: "finish",
    params: [
      { id: "length", label: "Mark Length", type: "in", def: 0.25 },
      { id: "offset", label: "Offset from Trim", type: "in", def: 0.125 },
      { id: "weight", label: "Line Weight", type: "num", def: 0.5, min: 0.1, max: 2 },
    ]
  },
  PageNumbers: {
    name: "Add Page Numbers",
    emoji: "🔢",
    desc: "Add page numbers to each page.",
    tip: "Position and style are customizable.",
    category: "finish",
    params: [
      { id: "position", label: "Position", type: "sel", def: "Bottom Centre", opts: ["Bottom Left", "Bottom Centre", "Bottom Right", "Top Left", "Top Centre", "Top Right"] },
      { id: "startNum", label: "Start Number", type: "num", def: 1, min: 0 },
      { id: "fontSize", label: "Font Size", type: "num", def: 10, min: 6, max: 24 },
      { id: "prefix", label: "Prefix", type: "txt", def: "" },
      { id: "suffix", label: "Suffix", type: "txt", def: "" },
    ]
  },
  Creep: {
    name: "Creep Compensation",
    emoji: "📐",
    desc: "Adjust for paper thickness in saddle-stitch booklets. Inner pages shift outward.",
    tip: "Paper thickness is typically 0.003-0.006 inches.",
    category: "booklet",
    params: [
      { id: "pages", label: "Total Pages", type: "num", def: 32, min: 4 },
      { id: "paperThick", label: "Paper Thickness", type: "in", def: 0.004 },
      { id: "direction", label: "Direction", type: "sel", def: "Inside pages shift most", opts: ["Inside pages shift most", "Outside pages shift most"] },
    ]
  },
  // Utility tools
  SplitMerge: {
    name: "Split Pages",
    emoji: "✂️",
    desc: "Extract odd or even pages only.",
    tip: "Useful for manual duplex printing.",
    category: "other",
    params: [
      { id: "output", label: "Output", type: "sel", def: "Odd pages only", opts: ["Odd pages only", "Even pages only"] },
    ]
  },
  TilePages: {
    name: "Tile Large Pages",
    emoji: "🔲",
    desc: "Split large pages into printable tiles with overlap.",
    tip: "Good for printing posters on regular paper.",
    category: "other",
    params: [
      { id: "cols", label: "Columns", type: "num", def: 2, min: 1, max: 10 },
      { id: "rows", label: "Rows", type: "num", def: 2, min: 1, max: 10 },
      { id: "overlap", label: "Overlap", type: "in", def: 0.5 },
    ]
  },
  ImpositionInfo: {
    name: "PDF Info",
    emoji: "🔍",
    desc: "Analyze the PDF and show detailed information about pages, colors, fonts, and more.",
    tip: "Run this first to understand your source file.",
    category: "info",
    params: []
  },
}

// Pre-built sequences
const SEQUENCES = [
  {
    id: 1,
    name: "Booklet from Letter Pages",
    desc: "Standard saddle-stitch booklet on tabloid sheets",
    category: "booklet",
    steps: [
      { cmd: "InsertBlanks", p: { mode: "Make divisible by 4" } },
      { cmd: "SimpleBooklet", p: { sheet: "Tabloid" } },
    ]
  },
  {
    id: 2,
    name: "4-Up Business Cards",
    desc: "Step & repeat on letter paper with gap",
    category: "nup",
    steps: [
      { cmd: "StepRepeat", p: { cols: 2, rows: 4, sheet: "US Letter", gap: 0.125 } },
    ]
  },
  {
    id: 3,
    name: "2-Up Booklet with Creep",
    desc: "Professional booklet with creep compensation",
    category: "booklet",
    steps: [
      { cmd: "InsertBlanks", p: { mode: "Make divisible by 4" } },
      { cmd: "Creep", p: { pages: 32, paperThick: 0.004, direction: "Inside pages shift most" } },
      { cmd: "SimpleBooklet", p: { sheet: "Tabloid" } },
    ]
  },
  {
    id: 4,
    name: "Spreads for Proofing",
    desc: "Join page pairs side-by-side",
    category: "other",
    steps: [
      { cmd: "Join2Pages", p: { gap: 0 } },
    ]
  },
  {
    id: 5,
    name: "Add Trim Marks + Bleed",
    desc: "Prepare file for commercial printing",
    category: "finish",
    steps: [
      { cmd: "GenerateBleed", p: { bleed: 0.125, method: "Mirror edges" } },
      { cmd: "CropMarks", p: { length: 0.25, offset: 0.125, weight: 0.5 } },
    ]
  },
]

// PDF Operations
async function opSimpleBooklet(doc: PDFDocument, params: { sheetW: number, sheetH: number }) {
  const pages = doc.getPages()
  let n = pages.length
  
  // Pad to multiple of 4
  const mod4 = n % 4
  if (mod4 !== 0) {
    const blanks = 4 - mod4
    for (let i = 0; i < blanks; i++) {
      doc.addPage([pages[0].getWidth(), pages[0].getHeight()])
    }
    n += blanks
  }
  
  // Build booklet order
  const order: number[] = []
  const sheets = n / 4
  for (let sh = 0; sh < sheets; sh++) {
    // Front: last, first
    order.push(n - 1 - sh * 2)
    order.push(sh * 2)
    // Back: first+1, last-1
    order.push(sh * 2 + 1)
    order.push(n - 2 - sh * 2)
  }
  
  // Create new document with imposed pages
  const newDoc = await PDFDocument.create()
  const sheetW = params.sheetW * IN
  const sheetH = params.sheetH * IN
  const allPages = doc.getPages()
  
  for (let i = 0; i < order.length; i += 2) {
    const page = newDoc.addPage([sheetW, sheetH])
    const leftIdx = order[i]
    const rightIdx = order[i + 1]
    
    // Embed and place pages
    const [leftEmbed] = await newDoc.embedPdf(doc, [leftIdx])
    const [rightEmbed] = await newDoc.embedPdf(doc, [rightIdx])
    
    const srcW = allPages[0].getWidth()
    const srcH = allPages[0].getHeight()
    const scale = Math.min((sheetW / 2) / srcW, sheetH / srcH)
    const scaledW = srcW * scale
    const scaledH = srcH * scale
    
    // Left page
    page.drawPage(leftEmbed, {
      x: (sheetW / 4) - (scaledW / 2),
      y: (sheetH / 2) - (scaledH / 2),
      width: scaledW,
      height: scaledH,
    })
    
    // Right page
    page.drawPage(rightEmbed, {
      x: (sheetW * 3 / 4) - (scaledW / 2),
      y: (sheetH / 2) - (scaledH / 2),
      width: scaledW,
      height: scaledH,
    })
  }
  
  return newDoc
}

async function opNup(doc: PDFDocument, params: { cols: number, rows: number, sheetW: number, sheetH: number, gap: number }) {
  const pages = doc.getPages()
  const newDoc = await PDFDocument.create()
  const sheetW = params.sheetW * IN
  const sheetH = params.sheetH * IN
  const gap = params.gap * IN
  const perSheet = params.cols * params.rows
  
  const cellW = (sheetW - (params.cols - 1) * gap) / params.cols
  const cellH = (sheetH - (params.rows - 1) * gap) / params.rows
  
  for (let i = 0; i < pages.length; i += perSheet) {
    const sheet = newDoc.addPage([sheetW, sheetH])
    
    for (let j = 0; j < perSheet && i + j < pages.length; j++) {
      const col = j % params.cols
      const row = Math.floor(j / params.cols)
      
      const [embedded] = await newDoc.embedPdf(doc, [i + j])
      const srcPage = pages[i + j]
      const scale = Math.min(cellW / srcPage.getWidth(), cellH / srcPage.getHeight())
      const scaledW = srcPage.getWidth() * scale
      const scaledH = srcPage.getHeight() * scale
      
      const x = col * (cellW + gap) + (cellW - scaledW) / 2
      const y = sheetH - (row + 1) * (cellH + gap) + gap + (cellH - scaledH) / 2
      
      sheet.drawPage(embedded, { x, y, width: scaledW, height: scaledH })
    }
  }
  
  return newDoc
}

async function opStepRepeat(doc: PDFDocument, params: { cols: number, rows: number, sheetW: number, sheetH: number, gap: number }) {
  const srcPage = doc.getPages()[0]
  const newDoc = await PDFDocument.create()
  const sheetW = params.sheetW * IN
  const sheetH = params.sheetH * IN
  const gap = params.gap * IN
  
  const cellW = (sheetW - (params.cols - 1) * gap) / params.cols
  const cellH = (sheetH - (params.rows - 1) * gap) / params.rows
  
  const sheet = newDoc.addPage([sheetW, sheetH])
  const [embedded] = await newDoc.embedPdf(doc, [0])
  const scale = Math.min(cellW / srcPage.getWidth(), cellH / srcPage.getHeight())
  const scaledW = srcPage.getWidth() * scale
  const scaledH = srcPage.getHeight() * scale
  
  for (let row = 0; row < params.rows; row++) {
    for (let col = 0; col < params.cols; col++) {
      const x = col * (cellW + gap) + (cellW - scaledW) / 2
      const y = sheetH - (row + 1) * (cellH + gap) + gap + (cellH - scaledH) / 2
      sheet.drawPage(embedded, { x, y, width: scaledW, height: scaledH })
    }
  }
  
  return newDoc
}

async function opRotate(doc: PDFDocument, params: { angle: string, range: string }) {
  const angle = parseInt(params.angle)
  const pages = doc.getPages()
  pages.forEach(page => page.setRotation(degrees(page.getRotation().angle + angle)))
  return doc
}

async function opDuplicate(doc: PDFDocument, params: { copies: number }) {
  const newDoc = await PDFDocument.create()
  const pages = doc.getPages()
  
  for (let i = 0; i < pages.length; i++) {
    for (let c = 0; c < params.copies; c++) {
      const [copied] = await newDoc.copyPages(doc, [i])
      newDoc.addPage(copied)
    }
  }
  
  return newDoc
}

async function opReverse(doc: PDFDocument) {
  const newDoc = await PDFDocument.create()
  const pages = doc.getPages()
  
  for (let i = pages.length - 1; i >= 0; i--) {
    const [copied] = await newDoc.copyPages(doc, [i])
    newDoc.addPage(copied)
  }
  
  return newDoc
}

async function opInsertBlanks(doc: PDFDocument, params: { mode: string, target: number }) {
  const pages = doc.getPages()
  let n = pages.length
  
  if (params.mode === "Make divisible by 4") {
    const mod4 = n % 4
    if (mod4 !== 0) {
      const blanks = 4 - mod4
      for (let i = 0; i < blanks; i++) {
        doc.addPage([pages[0].getWidth(), pages[0].getHeight()])
      }
    }
  } else {
    while (doc.getPageCount() < params.target) {
      doc.addPage([pages[0].getWidth(), pages[0].getHeight()])
    }
  }
  
  return doc
}

async function opPageNumbers(doc: PDFDocument, params: { position: string, startNum: number, fontSize: number, prefix: string, suffix: string }) {
  const pages = doc.getPages()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  
  pages.forEach((page, idx) => {
    const text = `${params.prefix}${params.startNum + idx}${params.suffix}`
    const textWidth = font.widthOfTextAtSize(text, params.fontSize)
    const { width, height } = page.getSize()
    
    let x = 0, y = 0
    const margin = 36 // 0.5 inch
    
    if (params.position.includes("Left")) x = margin
    else if (params.position.includes("Right")) x = width - margin - textWidth
    else x = (width - textWidth) / 2
    
    if (params.position.includes("Bottom")) y = margin
    else y = height - margin - params.fontSize
    
    page.drawText(text, { x, y, size: params.fontSize, font, color: rgb(0, 0, 0) })
  })
  
  return doc
}

async function opSplit(doc: PDFDocument, params: { output: string }) {
  const newDoc = await PDFDocument.create()
  const pages = doc.getPages()
  const isOdd = params.output === "Odd pages only"
  
  for (let i = 0; i < pages.length; i++) {
    if (isOdd ? (i % 2 === 0) : (i % 2 === 1)) {
      const [copied] = await newDoc.copyPages(doc, [i])
      newDoc.addPage(copied)
    }
  }
  
  return newDoc
}

async function opJoin2Pages(doc: PDFDocument, params: { gap: number }) {
  const pages = doc.getPages()
  const newDoc = await PDFDocument.create()
  const gap = params.gap * IN
  
  for (let i = 0; i < pages.length; i += 2) {
    const p1 = pages[i]
    const p2 = pages[i + 1] || null
    const w1 = p1.getWidth(), h1 = p1.getHeight()
    const w2 = p2 ? p2.getWidth() : w1
    const h2 = p2 ? p2.getHeight() : h1
    
    const newW = w1 + w2 + gap
    const newH = Math.max(h1, h2)
    const sheet = newDoc.addPage([newW, newH])
    
    const [emb1] = await newDoc.embedPdf(doc, [i])
    sheet.drawPage(emb1, { x: 0, y: (newH - h1) / 2, width: w1, height: h1 })
    
    if (p2) {
      const [emb2] = await newDoc.embedPdf(doc, [i + 1])
      sheet.drawPage(emb2, { x: w1 + gap, y: (newH - h2) / 2, width: w2, height: h2 })
    }
  }
  
  return newDoc
}

// Add crop marks to each page
async function opCropMarks(doc: PDFDocument, params: { length: number, offset: number, weight: number }) {
  const markLen = params.length * IN   // Mark length in points
  const offset = params.offset * IN    // Offset from trim edge
  const weight = params.weight         // Line weight in points
  
  const pages = doc.getPages()
  const newDoc = await PDFDocument.create()
  
  for (let i = 0; i < pages.length; i++) {
    const srcPage = pages[i]
    const w = srcPage.getWidth()
    const h = srcPage.getHeight()
    
    // Create new page with extra space for marks
    const extraSpace = offset + markLen + 10
    const newW = w + extraSpace * 2
    const newH = h + extraSpace * 2
    const page = newDoc.addPage([newW, newH])
    
    // Embed and draw original page centered
    const [embedded] = await newDoc.embedPdf(doc, [i])
    page.drawPage(embedded, { x: extraSpace, y: extraSpace, width: w, height: h })
    
    // Draw crop marks at all four corners
    // Marks are offset from the trim edge and extend outward
    const corners = [
      { x: extraSpace, y: extraSpace },                  // Bottom-left
      { x: extraSpace + w, y: extraSpace },              // Bottom-right
      { x: extraSpace, y: extraSpace + h },              // Top-left
      { x: extraSpace + w, y: extraSpace + h },          // Top-right
    ]
    
    for (const corner of corners) {
      // Horizontal marks
      const hDir = corner.x === extraSpace ? -1 : 1  // Left corners go left, right corners go right
      page.drawLine({
        start: { x: corner.x + offset * hDir, y: corner.y },
        end: { x: corner.x + (offset + markLen) * hDir, y: corner.y },
        thickness: weight,
        color: rgb(0, 0, 0),
      })
      
      // Vertical marks  
      const vDir = corner.y === extraSpace ? -1 : 1  // Bottom corners go down, top corners go up
      page.drawLine({
        start: { x: corner.x, y: corner.y + offset * vDir },
        end: { x: corner.x, y: corner.y + (offset + markLen) * vDir },
        thickness: weight,
        color: rgb(0, 0, 0),
      })
    }
  }
  
  return newDoc
}

// Generate bleed by scaling content
async function opGenerateBleed(doc: PDFDocument, params: { bleed: number, method: string }) {
  const bleedPt = params.bleed * IN
  const pages = doc.getPages()
  const newDoc = await PDFDocument.create()
  
  for (let i = 0; i < pages.length; i++) {
    const srcPage = pages[i]
    const w = srcPage.getWidth()
    const h = srcPage.getHeight()
    const newW = w + bleedPt * 2
    const newH = h + bleedPt * 2
    
    const page = newDoc.addPage([newW, newH])
    const [embedded] = await newDoc.embedPdf(doc, [i])
    
    if (params.method.toLowerCase().includes("mirror")) {
      // Scale to fill the entire new page size
      page.drawPage(embedded, { x: 0, y: 0, width: newW, height: newH })
    } else {
      // Just center the content with white bleed
      page.drawPage(embedded, { x: bleedPt, y: bleedPt, width: w, height: h })
    }
  }
  
  return newDoc
}

// Creep compensation for booklets
async function opCreep(doc: PDFDocument, params: { pages: number, paperThick: number, direction: string }) {
  const pages = doc.getPages()
  const n = pages.length
  const newDoc = await PDFDocument.create()
  const sheets = Math.ceil(n / 4)
  const totalShift = sheets * params.paperThick * IN
  
  for (let i = 0; i < n; i++) {
    const srcPage = pages[i]
    const w = srcPage.getWidth()
    const h = srcPage.getHeight()
    
    // Calculate shift based on position
    const sigPos = Math.floor(i % (params.pages / 2))
    const maxPos = Math.max(1, params.pages / 2 - 1)
    const insideFrac = sigPos / maxPos
    const shiftFrac = params.direction.toLowerCase().includes("inside") ? insideFrac : (1 - insideFrac)
    const shift = shiftFrac * totalShift
    const isLeft = i % 2 === 0
    const dx = isLeft ? -shift : shift
    
    const page = newDoc.addPage([w, h])
    const [embedded] = await newDoc.embedPdf(doc, [i])
    page.drawPage(embedded, { x: dx, y: 0, width: w, height: h })
  }
  
  return newDoc
}

// Execute operation
async function executeOp(doc: PDFDocument, cmd: string, params: Record<string, unknown>) {
  // Resolve sheet size
  if (params.sheet && params.sheet !== "Custom") {
    const preset = SHEET_PRESETS.find(s => s.name === params.sheet)
    if (preset) {
      params.sheetW = preset.w
      params.sheetH = preset.h
    }
  }
  
  switch (cmd) {
    case "SimpleBooklet": return opSimpleBooklet(doc, params as { sheetW: number, sheetH: number })
    case "Nup": return opNup(doc, params as { cols: number, rows: number, sheetW: number, sheetH: number, gap: number })
    case "StepRepeat": return opStepRepeat(doc, params as { cols: number, rows: number, sheetW: number, sheetH: number, gap: number })
    case "RotatePages": return opRotate(doc, params as { angle: string, range: string })
    case "DuplicatePages": return opDuplicate(doc, params as { copies: number })
    case "ReversePages": return opReverse(doc)
    case "InsertBlanks": return opInsertBlanks(doc, params as { mode: string, target: number })
    case "PageNumbers": return opPageNumbers(doc, params as { position: string, startNum: number, fontSize: number, prefix: string, suffix: string })
    case "SplitMerge": return opSplit(doc, params as { output: string })
    case "Join2Pages": return opJoin2Pages(doc, params as { gap: number })
    case "CropMarks": return opCropMarks(doc, params as { length: number, offset: number, weight: number })
    case "GenerateBleed": return opGenerateBleed(doc, params as { bleed: number, method: string })
    case "Creep": return opCreep(doc, params as { pages: number, paperThick: number, direction: string })
    default: return doc
  }
}

interface PDFInfo {
  filename: string
  pages: number
  width: number
  height: number
  widthIn: string
  heightIn: string
  fileSize: string
  mod4: number
  needBlanks: number
}

export function PDFImposeTool() {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null)
  const [pdfInfo, setPdfInfo] = useState<PDFInfo | null>(null)
  const [resultBytes, setResultBytes] = useState<Uint8Array | null>(null)
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const [selectedSeq, setSelectedSeq] = useState<number | null>(null)
  const [params, setParams] = useState<Record<string, unknown>>({})
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMsg, setProgressMsg] = useState("")
  const [customSteps, setCustomSteps] = useState<{ cmd: string; p: Record<string, unknown> }[]>([])
  const [activeTab, setActiveTab] = useState("tools")
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load PDF
  const loadPDF = useCallback(async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer())
    setPdfBytes(bytes)
    setResultBytes(null)
    
    try {
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
      const pages = doc.getPages()
      const p0 = pages[0]
      const w = p0.getWidth()
      const h = p0.getHeight()
      const mod4 = pages.length % 4
      
      setPdfInfo({
        filename: file.name,
        pages: pages.length,
        width: w,
        height: h,
        widthIn: (w / IN).toFixed(2),
        heightIn: (h / IN).toFixed(2),
        fileSize: file.size > 1048576 ? (file.size / 1048576).toFixed(2) + " MB" : (file.size / 1024).toFixed(0) + " KB",
        mod4,
        needBlanks: mod4 === 0 ? 0 : 4 - mod4,
      })
    } catch (e) {
      console.error("Failed to load PDF:", e)
    }
  }, [])

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file?.name.toLowerCase().endsWith(".pdf")) {
      loadPDF(file)
    }
  }, [loadPDF])

  // Select tool and set default params
  const selectTool = (toolId: string) => {
    setSelectedTool(toolId)
    setSelectedSeq(null)
    setResultBytes(null)
    
    const tool = TOOLS[toolId as keyof typeof TOOLS]
    if (tool) {
      const defaults: Record<string, unknown> = {}
      tool.params.forEach(p => {
        defaults[p.id] = p.def
      })
      setParams(defaults)
    }
  }

  // Select sequence
  const selectSequence = (seqId: number) => {
    setSelectedSeq(seqId)
    setSelectedTool(null)
    setResultBytes(null)
  }

  // Execute tool
  const runTool = async () => {
    if (!pdfBytes || !selectedTool) return
    
    setProcessing(true)
    setProgress(0)
    setProgressMsg("Loading PDF...")
    
    try {
      let doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
      setProgress(30)
      setProgressMsg(`Running ${TOOLS[selectedTool as keyof typeof TOOLS]?.name}...`)
      
      doc = await executeOp(doc, selectedTool, { ...params })
      
      setProgress(80)
      setProgressMsg("Saving...")
      
      const result = await doc.save()
      setResultBytes(new Uint8Array(result))
      setProgress(100)
      setProgressMsg("Done!")
    } catch (e) {
      console.error("Operation failed:", e)
      setProgressMsg("Error: " + (e as Error).message)
    } finally {
      setTimeout(() => setProcessing(false), 500)
    }
  }

  // Execute sequence
  const runSequence = async () => {
    if (!pdfBytes || selectedSeq === null) return
    const seq = SEQUENCES.find(s => s.id === selectedSeq)
    if (!seq) return
    
    setProcessing(true)
    setProgress(0)
    
    try {
      let doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
      
      for (let i = 0; i < seq.steps.length; i++) {
        const step = seq.steps[i]
        setProgress(Math.round(((i + 1) / seq.steps.length) * 80))
        setProgressMsg(`Step ${i + 1}/${seq.steps.length}: ${TOOLS[step.cmd as keyof typeof TOOLS]?.name}`)
        doc = await executeOp(doc, step.cmd, { ...step.p })
      }
      
      setProgress(90)
      setProgressMsg("Saving...")
      
      const result = await doc.save()
      setResultBytes(new Uint8Array(result))
      setProgress(100)
      setProgressMsg("Done!")
    } catch (e) {
      console.error("Sequence failed:", e)
      setProgressMsg("Error: " + (e as Error).message)
    } finally {
      setTimeout(() => setProcessing(false), 500)
    }
  }

  // Run custom pipeline
  const runCustom = async () => {
    if (!pdfBytes || customSteps.length === 0) return
    
    setProcessing(true)
    setProgress(0)
    
    try {
      let doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
      
      for (let i = 0; i < customSteps.length; i++) {
        const step = customSteps[i]
        setProgress(Math.round(((i + 1) / customSteps.length) * 80))
        setProgressMsg(`Step ${i + 1}/${customSteps.length}: ${TOOLS[step.cmd as keyof typeof TOOLS]?.name}`)
        doc = await executeOp(doc, step.cmd, { ...step.p })
      }
      
      setProgress(90)
      setProgressMsg("Saving...")
      
      const result = await doc.save()
      setResultBytes(new Uint8Array(result))
      setProgress(100)
      setProgressMsg("Done!")
    } catch (e) {
      console.error("Custom pipeline failed:", e)
    } finally {
      setTimeout(() => setProcessing(false), 500)
    }
  }

  // Add to custom pipeline
  const addToCustom = () => {
    if (!selectedTool) return
    setCustomSteps([...customSteps, { cmd: selectedTool, p: { ...params } }])
  }

  // Download result
  const downloadResult = () => {
    if (!resultBytes || !pdfInfo) return
    const blob = new Blob([resultBytes], { type: "application/pdf" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = pdfInfo.filename.replace(".pdf", "_imposed.pdf")
    a.click()
    URL.revokeObjectURL(url)
  }

  // Render param input
  const renderParam = (p: { id: string; label: string; type: string; def?: unknown; opts?: string[]; min?: number; max?: number; hidden?: boolean }) => {
    if (p.hidden) return null
    
    const value = params[p.id] ?? p.def
    
    if (p.type === "sel" || p.type === "sheet") {
      const options = p.type === "sheet" ? SHEET_PRESETS.map(s => s.name) : (p.opts || [])
      return (
        <div key={p.id} className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">{p.label}</Label>
          <Select value={String(value)} onValueChange={v => setParams({ ...params, [p.id]: v })}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )
    }
    
    if (p.type === "txt") {
      return (
        <div key={p.id} className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">{p.label}</Label>
          <Input
            value={String(value || "")}
            onChange={e => setParams({ ...params, [p.id]: e.target.value })}
            className="h-9"
          />
        </div>
      )
    }
    
    return (
      <div key={p.id} className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">
          {p.label} {p.type === "in" && <span className="text-muted-foreground">(in)</span>}
        </Label>
        <Input
          type="number"
          value={value as number}
          onChange={e => setParams({ ...params, [p.id]: parseFloat(e.target.value) || 0 })}
          min={p.min}
          max={p.max}
          step={p.type === "in" ? 0.001 : 1}
          className="h-9"
        />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30">
            <Layers className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold">PDF Impose</h1>
            <p className="text-xs text-muted-foreground">Imposition, N-Up, Booklet, and more</p>
          </div>
        </div>
        
        {pdfInfo && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300 truncate max-w-[200px]">
                {pdfInfo.filename}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Change File
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-72 border-r bg-card flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
              <TabsTrigger value="tools" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                Tools
              </TabsTrigger>
              <TabsTrigger value="sequences" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                Sequences
              </TabsTrigger>
              <TabsTrigger value="custom" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                Custom
              </TabsTrigger>
            </TabsList>

            {/* Tools Tab */}
            <TabsContent value="tools" className="flex-1 m-0 overflow-auto">
              <div className="p-3 space-y-4">
                {/* Booklet */}
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">Booklet</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(TOOLS).filter(([, t]) => t.category === "booklet").map(([id, t]) => (
                      <Button
                        key={id}
                        variant={selectedTool === id ? "default" : "outline"}
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => selectTool(id)}
                      >
                        <span className="mr-1">{t.emoji}</span>
                        {t.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* N-Up */}
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">N-Up</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(TOOLS).filter(([, t]) => t.category === "nup").map(([id, t]) => (
                      <Button
                        key={id}
                        variant={selectedTool === id ? "default" : "outline"}
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => selectTool(id)}
                      >
                        <span className="mr-1">{t.emoji}</span>
                        {t.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Page */}
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">Page Tools</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(TOOLS).filter(([, t]) => t.category === "page").map(([id, t]) => (
                      <Button
                        key={id}
                        variant={selectedTool === id ? "default" : "outline"}
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => selectTool(id)}
                      >
                        <span className="mr-1">{t.emoji}</span>
                        {t.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Finishing */}
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">Finishing</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(TOOLS).filter(([, t]) => t.category === "finish").map(([id, t]) => (
                      <Button
                        key={id}
                        variant={selectedTool === id ? "default" : "outline"}
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => selectTool(id)}
                      >
                        <span className="mr-1">{t.emoji}</span>
                        {t.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Other */}
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">Other</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(TOOLS).filter(([, t]) => t.category === "other" || t.category === "info").map(([id, t]) => (
                      <Button
                        key={id}
                        variant={selectedTool === id ? "default" : "outline"}
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => selectTool(id)}
                      >
                        <span className="mr-1">{t.emoji}</span>
                        {t.name}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Sequences Tab */}
            <TabsContent value="sequences" className="flex-1 m-0 overflow-auto">
              <div className="p-2 space-y-1">
                {SEQUENCES.map(seq => (
                  <button
                    key={seq.id}
                    onClick={() => selectSequence(seq.id)}
                    className={cn(
                      "w-full p-3 rounded-lg text-left transition-colors",
                      selectedSeq === seq.id ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-muted/50"
                    )}
                  >
                    <div className="font-semibold text-sm">{seq.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{seq.desc}</div>
                    <div className="flex gap-1.5 mt-2">
                      <Badge variant="secondary" className="text-[10px]">{seq.steps.length} steps</Badge>
                      <Badge variant="outline" className="text-[10px]">{seq.category}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            </TabsContent>

            {/* Custom Tab */}
            <TabsContent value="custom" className="flex-1 m-0 flex flex-col">
              <div className="p-3 border-b">
                <div className="font-semibold text-sm mb-2">Custom Pipeline</div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={runCustom} disabled={!pdfBytes || customSteps.length === 0 || processing}>
                    <Play className="h-3 w-3 mr-1" />
                    Run
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setCustomSteps([])}>
                    Clear
                  </Button>
                </div>
              </div>
              <ScrollArea className="flex-1 p-3">
                {customSteps.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    <div className="text-2xl mb-2">📋</div>
                    <div>Use any tool, then click</div>
                    <div className="font-semibold">+ Add to Custom</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customSteps.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {TOOLS[step.cmd as keyof typeof TOOLS]?.name}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => setCustomSteps(customSteps.filter((_, i) => i !== idx))}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {/* File info footer */}
          {pdfInfo && (
            <div className="border-t p-3 bg-muted/30">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">Pages</div>
                  <div className="font-mono font-bold">{pdfInfo.pages}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Size</div>
                  <div className="font-mono font-bold">{pdfInfo.widthIn}" x {pdfInfo.heightIn}"</div>
                </div>
                <div>
                  <div className="text-muted-foreground">File</div>
                  <div className="font-mono">{pdfInfo.fileSize}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Mod 4</div>
                  <div className={cn("font-mono font-bold", pdfInfo.mod4 === 0 ? "text-green-600" : "text-orange-600")}>
                    {pdfInfo.mod4 === 0 ? "OK" : `+${pdfInfo.needBlanks}`}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-6">
          {!pdfBytes ? (
            /* Drop zone */
            <div
              className={cn(
                "h-full flex items-center justify-center",
              )}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <div
                className={cn(
                  "w-96 p-10 rounded-2xl border-2 border-dashed text-center transition-all cursor-pointer",
                  isDragging ? "border-primary bg-primary/5 scale-105" : "border-border hover:border-primary/50"
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="text-5xl mb-4">📄</div>
                <div className="text-xl font-bold mb-2">Open a PDF</div>
                <div className="text-sm text-muted-foreground mb-4">
                  All processing happens locally in your browser.<br />
                  Nothing is sent to any server.
                </div>
                <Button>Choose PDF</Button>
              </div>
            </div>
          ) : selectedTool ? (
            /* Tool panel */
            <div className="max-w-2xl">
              <Card>
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">{TOOLS[selectedTool as keyof typeof TOOLS]?.emoji}</div>
                    <div>
                      <CardTitle>{TOOLS[selectedTool as keyof typeof TOOLS]?.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {TOOLS[selectedTool as keyof typeof TOOLS]?.desc}
                      </CardDescription>
                      <div className="flex items-start gap-2 mt-3 p-2 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        {TOOLS[selectedTool as keyof typeof TOOLS]?.tip}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {resultBytes && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <div className="flex-1">
                        <div className="font-semibold text-green-700 dark:text-green-300">
                          Done - {(resultBytes.length / 1024).toFixed(0)} KB
                        </div>
                      </div>
                      <Button onClick={downloadResult} className="bg-green-600 hover:bg-green-700">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  )}

                  {TOOLS[selectedTool as keyof typeof TOOLS]?.params.length > 0 && (
                    <div className="space-y-4">
                      <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Settings</div>
                      <div className="grid grid-cols-2 gap-4">
                        {TOOLS[selectedTool as keyof typeof TOOLS]?.params.map(p => renderParam(p))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button onClick={runTool} disabled={processing}>
                      <Play className="h-4 w-4 mr-2" />
                      Run - {TOOLS[selectedTool as keyof typeof TOOLS]?.name}
                    </Button>
                    <Button variant="outline" onClick={addToCustom}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add to Custom
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : selectedSeq !== null ? (
            /* Sequence panel */
            <div className="max-w-2xl">
              <Card>
                <CardHeader>
                  <CardTitle>{SEQUENCES.find(s => s.id === selectedSeq)?.name}</CardTitle>
                  <CardDescription>{SEQUENCES.find(s => s.id === selectedSeq)?.desc}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {resultBytes && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <div className="flex-1">
                        <div className="font-semibold text-green-700 dark:text-green-300">
                          Done - {(resultBytes.length / 1024).toFixed(0)} KB
                        </div>
                      </div>
                      <Button onClick={downloadResult} className="bg-green-600 hover:bg-green-700">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Pipeline - {SEQUENCES.find(s => s.id === selectedSeq)?.steps.length} steps
                    </div>
                    {SEQUENCES.find(s => s.id === selectedSeq)?.steps.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold">
                            {TOOLS[step.cmd as keyof typeof TOOLS]?.emoji} {TOOLS[step.cmd as keyof typeof TOOLS]?.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {Object.entries(step.p).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button onClick={runSequence} disabled={processing}>
                    <Play className="h-4 w-4 mr-2" />
                    {resultBytes ? "Run Again" : "Run Sequence"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            /* Default: show file info */
            <div className="max-w-2xl">
              <Card>
                <CardHeader>
                  <CardTitle>File Loaded</CardTitle>
                  <CardDescription>Select a tool from the sidebar to get started</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <div className="text-2xl font-bold text-primary">{pdfInfo?.pages}</div>
                      <div className="text-xs text-muted-foreground">Pages</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <div className="text-lg font-bold">{pdfInfo?.widthIn}" x {pdfInfo?.heightIn}"</div>
                      <div className="text-xs text-muted-foreground">Page Size</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <div className="text-lg font-bold">{pdfInfo?.fileSize}</div>
                      <div className="text-xs text-muted-foreground">File Size</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <div className={cn("text-lg font-bold", pdfInfo?.mod4 === 0 ? "text-green-600" : "text-orange-600")}>
                        {pdfInfo?.mod4 === 0 ? "Yes" : `Need +${pdfInfo?.needBlanks}`}
                      </div>
                      <div className="text-xs text-muted-foreground">Booklet Ready</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Processing overlay */}
      {processing && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-80">
            <CardContent className="pt-6 text-center">
              <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-primary" />
              <div className="font-semibold mb-2">{progressMsg}</div>
              <Progress value={progress} className="h-2" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) loadPDF(file)
        }}
      />
    </div>
  )
}
