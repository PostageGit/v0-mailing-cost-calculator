"use client"

import { useState, useMemo, useEffect } from "react"
import useSWR from "swr"
import { useQuote } from "@/lib/quote-context"
import { useMailing, PIECE_TYPE_META, FOLD_OPTIONS, getFlatSize, type MailPiece } from "@/lib/mailing-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

import { 
  Calculator, Plus, Trophy, Check, Building2, Trash2, RefreshCw, Copy, Pencil, Package
} from "lucide-react"
import { PrintingCalculator } from "@/components/printing/printing-calculator"
import { BookletCalculator } from "@/components/booklet/booklet-calculator"
import { SpiralCalculator } from "@/components/spiral/spiral-calculator"
import { PerfectCalculator } from "@/components/perfect/perfect-calculator"
import { PadCalculator } from "@/components/pad/pad-calculator"
import { EnvelopeTab } from "@/components/envelope-tab"
import { formatCurrency } from "@/lib/pricing"
import { cn } from "@/lib/utils"
import type { Vendor } from "@/lib/vendor-types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const PAPER_OPTIONS = [
  "100# Gloss Text", "100# Gloss Cover", "80# Gloss Text", "80# Gloss Cover",
  "70# Uncoated Text", "80# Uncoated Cover", "100# Uncoated Cover", 
  "60# Offset Text", "24# Bond", "28# Bond"
]

// FLAT PRINTING colors
const FLAT_COLOR_OPTIONS = [
  { value: "4/4", label: "4/4 (Color Both)" },
  { value: "4/0", label: "4/0 (Color Front)" },
  { value: "4/1", label: "4/1 (Color / Black)" },
  { value: "1/1", label: "1/1 (Black Both)" },
  { value: "1/0", label: "1/0 (Black Front)" },
]

// BOOKLET COVER colors (full color options)
const BOOKLET_COVER_COLOR_OPTIONS = [
  { value: "4/4", label: "4/4 (Color Both)" },
  { value: "4/0", label: "4/0 (Color Front)" },
  { value: "1/1", label: "1/1 (Black Both)" },
  { value: "1/0", label: "1/0 (Black Front)" },
]

// BOOKLET INSIDE colors (double-sided / single-sided only)
const BOOKLET_INSIDE_COLOR_OPTIONS = [
  { value: "D/S", label: "D/S (Double-Sided)" },
  { value: "S/S", label: "S/S (Single-Sided)" },
]

// SPIRAL / PERFECT / PAD colors (all options)
const FULL_COLOR_OPTIONS = [
  { value: "4/4", label: "4/4 (Color Both)" },
  { value: "4/0", label: "4/0 (Color Front)" },
  { value: "1/1", label: "1/1 (Black Both)" },
  { value: "1/0", label: "1/0 (Black Front)" },
  { value: "D/S", label: "D/S (Double-Sided)" },
  { value: "S/S", label: "S/S (Single-Sided)" },
]

// LAMINATION options
const LAMINATION_OPTIONS = [
  { value: "", label: "None" },
  { value: "gloss", label: "Gloss" },
  { value: "matte", label: "Matte" },
  { value: "silk", label: "Silk" },
  { value: "leather", label: "Leather" },
  { value: "linen", label: "Linen" },
]

// FOLD options for flat printing
const FOLD_OPTIONS = [
  { value: "", label: "No Fold" },
  { value: "half", label: "Half Fold" },
  { value: "tri", label: "Tri-Fold" },
  { value: "z", label: "Z-Fold" },
  { value: "gate", label: "Gate Fold" },
  { value: "double_parallel", label: "Double Parallel" },
  { value: "accordion", label: "Accordion" },
  { value: "roll", label: "Roll Fold" },
]

// BINDING options for booklet
const BINDING_OPTIONS = [
  { value: "staple", label: "Saddle Stitch (Staple)" },
  { value: "fold", label: "Fold Only" },
  { value: "perfect", label: "Perfect Bound" },
]

interface PieceSpecs {
  // Common fields
  quantity: number
  width: number
  height: number
  notes: string
  
  // Flat printing fields (postcards, letters, self-mailers)
  paper: string
  colors: string        // "4/4", "4/0", "4/1", "1/1", "1/0"
  hasBleed: boolean
  fold: string          // "half", "tri", "z", "gate", "double_parallel", "accordion", "roll"
  lamination: string    // "Gloss", "Matte", "Silk", "Leather", "Linen"
  laminationSides?: string  // "S/S", "D/S"
  
  // Booklet specific fields
  pages?: number
  separateCover?: boolean   // Booklet: has separate cover? (Yes/No toggle)
  coverPaper?: string
  coverColors?: string      // Booklet: "4/4", "4/0", "1/1", "1/0"
  coverBleed?: boolean
  coverLamination?: string  // "none", "gloss", "matte", "silk", "leather"
  insidePaper?: string
  insideColors?: string     // Booklet: "D/S", "S/S" | Others: "4/4", "4/0", etc
  insideBleed?: boolean
  bindingType?: string      // "staple", "fold", "perfect", "spiral"
  
  // Spiral specific fields
  useFrontCover?: boolean   // Has front cover? (Yes/No toggle)
  useBackCover?: boolean    // Has back cover? (Yes/No toggle)
  backCoverPaper?: string
  backCoverColors?: string
  backCoverBleed?: boolean
  clearPlastic?: boolean    // Clear plastic cover option
  blackVinyl?: boolean      // Black vinyl cover option
  
  // Pad specific
  sheetsPerPad?: number
  useChipBoard?: boolean    // Has chip board backing? (Yes/No toggle)
}

interface VendorQuote {
  vendorId: string
  vendorName: string
  isInternal: boolean
  cost: number
  shipping: number
  markupPercent: number
  price: number
  priceOverride: boolean
  calcState?: any
}

interface PrintItem {
  id: string
  pieceId: string
  pieceLabel: string
  calcType: string
  specs: PieceSpecs
  vendorQuotes: VendorQuote[]
  selectedVendorId: string | null
  addedToQuote: boolean
}

function getCalcType(piece: MailPiece): string | null {
  if (piece.type === "envelope") return "envelope"
  const meta = PIECE_TYPE_META[piece.type]
  return meta?.calc || null
}

function buildSpecsText(specs: PieceSpecs): string {
  const parts: string[] = []
  parts.push(`${specs.quantity.toLocaleString()} pcs`)
  if (specs.width && specs.height) parts.push(`${specs.width}" x ${specs.height}"${specs.hasBleed ? " +bleed" : ""}`)
  if (specs.pages) parts.push(`${specs.pages}pp`)
  if (specs.paper) parts.push(specs.paper)
  if (specs.colors) parts.push(specs.colors)
  if (specs.fold) parts.push(FOLD_OPTIONS.find(f => f.value === specs.fold)?.label || specs.fold)
  if (specs.lamination) parts.push(LAMINATION_OPTIONS.find(l => l.value === specs.lamination)?.label || specs.lamination)
  // Booklet/spiral specific
  if (specs.coverPaper) parts.push(`Cover: ${specs.coverPaper}`)
  if (specs.coverColors) parts.push(specs.coverColors)
  if (specs.insidePaper) parts.push(`Inside: ${specs.insidePaper}`)
  if (specs.insideColors) parts.push(specs.insideColors)
  if (specs.bindingType) parts.push(BINDING_OPTIONS.find(b => b.value === specs.bindingType)?.label || specs.bindingType)
  if (specs.notes) parts.push(specs.notes)
  return parts.join(" | ")
}

export function SimplePrintingEntry() {
  const { addItem, updateItem, items: quoteItems } = useQuote()
  const { pieces, printQty } = useMailing()
  const { data: vendors, isLoading: vendorsLoading } = useSWR<Vendor[]>("/api/vendors", fetcher)
  
  const [printItems, setPrintItems] = useState<PrintItem[]>([])
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [showCalc, setShowCalc] = useState(false)
  const [calcVendorId, setCalcVendorId] = useState<string | null>(null)
  
  // Edit mode: when editing an existing quote line item
  // editingQuoteItemId = the quote line item ID being edited (for Update)
  const [editingQuoteItemId, setEditingQuoteItemId] = useState<number | null>(null)
  
  const printablePieces = useMemo(() => {
    return pieces.filter(piece => {
      if (piece.type === "envelope" && piece.envelopeKind === "plastic") return false
      return getCalcType(piece) !== null
    })
  }, [pieces])
  
  useEffect(() => {
    if (printablePieces.length > 0 && printItems.length === 0) {
      const items: PrintItem[] = printablePieces.map((piece) => {
        const meta = PIECE_TYPE_META[piece.type]
        const flatSize = getFlatSize(piece)
        return {
          id: crypto.randomUUID(),
          pieceId: piece.id,
          pieceLabel: meta?.label || piece.type,
          calcType: getCalcType(piece) || "flat",
          specs: {
            // Only fill what we KNOW from the mail piece - everything else EMPTY
            quantity: printQty,
            width: piece.width || 0,
            height: piece.height || 0,
            pages: piece.pageCount,
            // ALL selection fields start EMPTY - forces user to choose
            paper: "",
            colors: "",           // empty = amber, user must select
            hasBleed: false,
            fold: "",             // empty = amber, user must select  
            lamination: "",       // empty = amber, user must select
            notes: "",
            // Booklet fields - all empty
            coverPaper: "",
            coverColors: "",
            insidePaper: "",
            insideColors: "",
          },
          vendorQuotes: [],
          selectedVendorId: null,
          addedToQuote: false
        }
      })
      setPrintItems(items)
      if (items.length > 0) setActiveItemId(items[0].id)
    }
  }, [printablePieces, printItems.length, printQty])
  
  const activeItem = printItems.find(i => i.id === activeItemId)
  
  const updateSpecs = (updates: Partial<PieceSpecs>) => {
    if (!activeItemId) return
    setPrintItems(prev => prev.map(item => 
      item.id === activeItemId ? { ...item, specs: { ...item.specs, ...updates } } : item
    ))
  }
  
  const updateVendorQuote = (vendorId: string, field: "cost" | "shipping" | "markupPercent" | "price", value: number) => {
    if (!activeItemId) return
    setPrintItems(prev => prev.map(item => {
      if (item.id !== activeItemId) return item
      return {
        ...item,
        vendorQuotes: item.vendorQuotes.map(vq => {
          if (vq.vendorId !== vendorId) return vq
          const updated = { ...vq, [field]: value }
          if (field === "price") updated.priceOverride = true
          if (!updated.priceOverride && ["cost", "shipping", "markupPercent"].includes(field)) {
            updated.price = Math.round((updated.cost + updated.shipping) * (1 + updated.markupPercent / 100) * 100) / 100
          }
          return updated
        })
      }
    }))
  }
  
  const recalculatePrice = (vendorId: string) => {
    if (!activeItemId) return
    setPrintItems(prev => prev.map(item => {
      if (item.id !== activeItemId) return item
      return {
        ...item,
        vendorQuotes: item.vendorQuotes.map(vq => {
          if (vq.vendorId !== vendorId) return vq
          return { ...vq, price: Math.round((vq.cost + vq.shipping) * (1 + vq.markupPercent / 100) * 100) / 100, priceOverride: false }
        })
      }
    }))
  }
  
  const addVendor = (vendorId: string) => {
    if (!activeItemId) return
    const vendor = vendors?.find(v => v.id === vendorId)
    if (!vendor) return
    setPrintItems(prev => prev.map(item => {
      if (item.id !== activeItemId || item.vendorQuotes.some(vq => vq.vendorId === vendorId)) return item
      return {
        ...item,
        vendorQuotes: [...item.vendorQuotes, {
          vendorId: vendor.id,
          vendorName: vendor.company_name,
          isInternal: vendor.is_internal,
          cost: 0,
          shipping: vendor.pickup_cost || 0,
          markupPercent: 30,
          price: 0,
          priceOverride: false
        }]
      }
    }))
  }
  
  const removeVendor = (vendorId: string) => {
    if (!activeItemId) return
    setPrintItems(prev => prev.map(item => {
      if (item.id !== activeItemId) return item
      return {
        ...item,
        vendorQuotes: item.vendorQuotes.filter(vq => vq.vendorId !== vendorId),
        selectedVendorId: item.selectedVendorId === vendorId ? null : item.selectedVendorId
      }
    }))
  }
  
  const selectVendor = (vendorId: string) => {
    if (!activeItemId) return
    setPrintItems(prev => prev.map(item => 
      item.id === activeItemId ? { ...item, selectedVendorId: vendorId } : item
    ))
  }
  
  const openCalculator = (vendorId: string) => {
    setCalcVendorId(vendorId)
    setShowCalc(true)
  }
  
  // Handler for when calculator returns a result - fills in the vendor's cost/price
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCalculatorResult = (result: { cost: number; price: number; description?: string; inputs?: any }) => {
    if (!activeItemId || !calcVendorId) return
    
    // Update the vendor quote with the calculated cost and price
    // The calculator already calculates the final price including markup
    // IMPORTANT: Store the inputs so we can reopen calculator with same settings
    setPrintItems(prev => prev.map(item => {
      if (item.id !== activeItemId) return item
      return {
        ...item,
        vendorQuotes: item.vendorQuotes.map(vq => {
          if (vq.vendorId !== calcVendorId) return vq
          return {
            ...vq,
            cost: result.cost,
            price: result.price,
            priceOverride: false,
            calcState: {
              inputs: result.inputs, // Store inputs to reopen calculator with same settings
              description: result.description
            }
          }
        })
      }
    }))
    
    // Close the calculator dialog
    setShowCalc(false)
    setCalcVendorId(null)
  }
  
  // Build the quote line item data (reused by add, update, and save-as-new)
  const buildQuoteItemData = () => {
    if (!activeItem || !activeItem.selectedVendorId) return null
    const selected = activeItem.vendorQuotes.find(vq => vq.vendorId === activeItem.selectedVendorId)
    if (!selected || selected.price <= 0) return null
    
    const sizeStr = activeItem.specs.width && activeItem.specs.height 
      ? `${activeItem.specs.width}x${activeItem.specs.height}` 
      : ""
    const label = `${activeItem.specs.quantity.toLocaleString()} - ${sizeStr} ${activeItem.pieceLabel}`.trim()
    
    return {
      category: activeItem.calcType as "flat" | "booklet" | "spiral" | "perfect" | "pad" | "envelope",
      label: label,
      description: buildSpecsText(activeItem.specs),
      amount: selected.price,
      vendor: selected.vendorName,
      vendorId: selected.vendorId,
      quantity: activeItem.specs.quantity,
      unitCost: (selected.cost + selected.shipping) / activeItem.specs.quantity,
      unitPrice: selected.price / activeItem.specs.quantity,
      specs: { ...activeItem.specs },
      calcState: selected.calcState,
      metadata: { 
        baseCost: selected.cost, 
        shipping: selected.shipping, 
        markupPercent: selected.markupPercent, 
        isInternal: selected.isInternal,
        calcType: activeItem.calcType,
        pieceName: activeItem.pieceLabel,
        pieceDimensions: `${activeItem.specs.width}x${activeItem.specs.height}`,
        hasBleed: activeItem.specs.hasBleed || activeItem.specs.insideBleed || activeItem.specs.coverBleed,
        pageCount: activeItem.specs.pages,
        paperName: activeItem.specs.paper || activeItem.specs.insidePaper,
        sides: activeItem.specs.colors || activeItem.specs.insideColors,
        foldType: activeItem.specs.fold,
        laminationEnabled: !!(activeItem.specs.lamination && activeItem.specs.lamination !== "none" && activeItem.specs.lamination !== ""),
        laminationType: activeItem.specs.lamination,
        coverPaper: activeItem.specs.coverPaper,
        coverSides: activeItem.specs.coverColors,
        bindingType: activeItem.specs.bindingType,
        sheetsPerPad: activeItem.specs.sheetsPerPad,
      }
    }
  }
  
  // ADD NEW: Creates a new quote line item
  const handleAddToQuote = () => {
    const data = buildQuoteItemData()
    if (!data) return
    addItem(data)
    setPrintItems(prev => prev.map(i => i.id === activeItemId ? { ...i, addedToQuote: true } : i))
    setEditingQuoteItemId(null)
  }
  
  // UPDATE: Overwrites the existing quote line item (no new revision)
  const handleUpdateQuoteItem = () => {
    if (!editingQuoteItemId) return
    const data = buildQuoteItemData()
    if (!data) return
    updateItem(editingQuoteItemId, data)
    setPrintItems(prev => prev.map(i => i.id === activeItemId ? { ...i, addedToQuote: true } : i))
    setEditingQuoteItemId(null)
  }
  
  // SAVE AS NEW VERSION: Keeps old item, adds new one (user explicitly chose new version)
  const handleSaveAsNewVersion = () => {
    const data = buildQuoteItemData()
    if (!data) return
    addItem(data)
    setPrintItems(prev => prev.map(i => i.id === activeItemId ? { ...i, addedToQuote: true } : i))
    setEditingQuoteItemId(null)
  }
  
  // Load an existing quote item for editing
  const handleEditQuoteItem = (quoteItemId: number) => {
    const item = quoteItems.find(i => i.id === quoteItemId)
    console.log("[v0] handleEditQuoteItem called with quoteItemId:", quoteItemId)
    console.log("[v0] Found quote item:", item)
    
    if (!item) {
      console.log("[v0] No item found, returning")
      return
    }
    
    // Build specs from calcState.inputs (FULL calculator data) when available
    const inputs = item.calcState?.inputs as Record<string, unknown> | undefined
    const calcType = item.category || item.metadata?.calcType || "flat"
    console.log("[v0] calcState.inputs:", inputs)
    console.log("[v0] calcType:", calcType)
    
    let savedSpecs: PieceSpecs
    
    if (inputs) {
      // Use FULL calculator inputs - this has ALL the fields the calculator needs
      if (calcType === "booklet" || calcType === "perfect") {
        savedSpecs = {
          quantity: (inputs.bookQty as number) || item.quantity || 0,
          width: (inputs.pageWidth as number) || 0,
          height: (inputs.pageHeight as number) || 0,
          pages: (inputs.pagesPerBook as number) || 0,
          coverPaper: (inputs.coverPaper as string) || "",
          coverColors: (inputs.coverSides as string) || "",
          coverBleed: (inputs.coverBleed as boolean) || false,
          insidePaper: (inputs.insidePaper as string) || "",
          insideColors: (inputs.insideSides as string) || "",
          insideBleed: (inputs.insideBleed as boolean) || false,
          bindingType: (inputs.bindingType as string) || "",
          lamination: (inputs.laminationType as string) || "",
          paper: "",
          colors: "",
          hasBleed: false,
          fold: "",
          notes: item.specs?.notes || "",
          sheetsPerPad: 0,
        }
      } else if (calcType === "spiral") {
        const inside = inputs.inside as Record<string, unknown> | undefined
        const front = inputs.front as Record<string, unknown> | undefined
        savedSpecs = {
          quantity: (inputs.bookQty as number) || item.quantity || 0,
          width: (inputs.pageWidth as number) || 0,
          height: (inputs.pageHeight as number) || 0,
          pages: (inputs.pagesPerBook as number) || 0,
          insidePaper: (inside?.paperName as string) || "",
          insideColors: (inside?.sides as string) || "",
          insideBleed: (inside?.hasBleed as boolean) || false,
          coverPaper: (front?.paperName as string) || "",
          coverColors: (front?.sides as string) || "",
          coverBleed: (front?.hasBleed as boolean) || false,
          bindingType: "spiral",
          lamination: "",
          paper: "",
          colors: "",
          hasBleed: false,
          fold: "",
          notes: item.specs?.notes || "",
          sheetsPerPad: 0,
        }
      } else if (calcType === "pad") {
        const inside = inputs.inside as Record<string, unknown> | undefined
        savedSpecs = {
          quantity: (inputs.padQty as number) || item.quantity || 0,
          width: (inputs.pageWidth as number) || 0,
          height: (inputs.pageHeight as number) || 0,
          sheetsPerPad: (inputs.pagesPerPad as number) || 0,
          paper: (inside?.paperName as string) || "",
          colors: (inside?.sides as string) || "",
          hasBleed: (inside?.hasBleed as boolean) || false,
          pages: 0,
          coverPaper: "",
          coverColors: "",
          coverBleed: false,
          insidePaper: "",
          insideColors: "",
          insideBleed: false,
          bindingType: "",
          lamination: "",
          fold: "",
          notes: item.specs?.notes || "",
        }
      } else {
        // Flat / envelope
        const lam = inputs.lamination as Record<string, unknown> | undefined
        savedSpecs = {
          quantity: (inputs.qty as number) || (inputs.amount as number) || item.quantity || 0,
          width: (inputs.width as number) || 0,
          height: (inputs.height as number) || 0,
          paper: (inputs.paperName as string) || "",
          colors: (inputs.sidesValue as string) || "",
          hasBleed: (inputs.hasBleed as boolean) || false,
          fold: "",
          lamination: (lam?.type as string) || "",
          notes: item.specs?.notes || "",
          pages: 0,
          coverPaper: "",
          coverColors: "",
          coverBleed: false,
          insidePaper: "",
          insideColors: "",
          insideBleed: false,
          bindingType: "",
          sheetsPerPad: 0,
        }
      }
    } else {
      // Fallback to item.specs if no calcState.inputs
      savedSpecs = {
        quantity: item.specs?.quantity || item.quantity || 0,
        width: item.specs?.width || 0,
        height: item.specs?.height || 0,
        paper: item.specs?.paper || "",
        colors: item.specs?.colors || "",
        hasBleed: item.specs?.hasBleed || false,
        fold: item.specs?.fold || "",
        lamination: item.specs?.lamination || "",
        notes: item.specs?.notes || "",
        pages: item.specs?.pages || 0,
        coverPaper: item.specs?.coverPaper || "",
        coverColors: item.specs?.coverColors || "",
        coverBleed: item.specs?.coverBleed || false,
        insidePaper: item.specs?.insidePaper || "",
        insideColors: item.specs?.insideColors || "",
        insideBleed: item.specs?.insideBleed || false,
        bindingType: item.specs?.bindingType || "",
        sheetsPerPad: item.specs?.sheetsPerPad || 0,
      }
    }
    console.log("[v0] Rebuilt savedSpecs:", savedSpecs)
    
    // Build vendor quote from saved data - MUST include calcState with full inputs
    const savedVendorQuote: VendorQuote | null = item.vendor && item.vendorId ? {
      vendorId: item.vendorId,
      vendorName: item.vendor,
      isInternal: item.metadata?.isInternal || false,
      cost: item.metadata?.baseCost || 0,
      shipping: item.metadata?.shipping || 0,
      markupPercent: item.metadata?.markupPercent || 30,
      price: item.amount,
      priceOverride: false,
      calcState: item.calcState,  // THIS is where the full inputs are stored
    } : null
    console.log("[v0] Rebuilt vendor quote:", savedVendorQuote)
    console.log("[v0] Rebuilt vendor calcState:", item.calcState)
    console.log("[v0] Rebuilt vendor calcState.inputs:", item.calcState?.inputs)
    
    // Find matching print item by calcType (calcType already defined above)
    const existingPrintItem = printItems.find(pi => pi.calcType === calcType)
    console.log("[v0] Looking for calcType:", calcType, "Found:", existingPrintItem?.id)
    
    if (existingPrintItem) {
      // Update existing print item with ALL saved data
      setPrintItems(prev => prev.map(pi => 
        pi.id === existingPrintItem.id 
          ? { 
              ...pi, 
              specs: savedSpecs,
              vendorQuotes: savedVendorQuote ? [savedVendorQuote] : [],
              selectedVendorId: item.vendorId || null,
              addedToQuote: true,
            }
          : pi
      ))
      setActiveItemId(existingPrintItem.id)
      console.log("[v0] Updated print item, set activeItemId:", existingPrintItem.id)
    } else {
      // Create a new print item for this quote item
      const newId = `edit-${quoteItemId}-${Date.now()}`
      const newPrintItem: PrintItem = {
        id: newId,
        pieceId: `quote-${quoteItemId}`,
        pieceLabel: item.label || item.metadata?.pieceName || "Print Item",
        calcType: calcType,
        specs: savedSpecs,
        vendorQuotes: savedVendorQuote ? [savedVendorQuote] : [],
        selectedVendorId: item.vendorId || null,
        addedToQuote: true,
      }
      setPrintItems(prev => [...prev, newPrintItem])
      setActiveItemId(newId)
      console.log("[v0] Created new print item:", newId)
    }
    
    setEditingQuoteItemId(quoteItemId)
    console.log("[v0] Set editingQuoteItemId:", quoteItemId)
  }
  
  const getCheapestId = (item: PrintItem) => {
    const withPrices = item.vendorQuotes.filter(vq => vq.price > 0)
    if (withPrices.length === 0) return null
    return withPrices.reduce((min, vq) => vq.price < min.price ? vq : min).vendorId
  }
  
  const isBooklet = activeItem && ["booklet", "spiral", "perfect"].includes(activeItem.calcType)

  if (printablePieces.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-center">
        <div>
          <Package className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-medium">No Printable Pieces</p>
          <p className="text-sm text-muted-foreground">Add pieces to your mailer first</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full">
      {/* TWO-COLUMN LAYOUT - Pieces sidebar + Main content */}
      <div className="flex h-full">
        {/* LEFT SIDEBAR - Pieces List */}
        <div className="w-56 shrink-0 border-r bg-muted/30 p-4 overflow-y-auto">
          {/* SAVED QUOTE ITEMS - Items already in quote that can be edited */}
          {(() => {
            const printingCategories = ["flat", "booklet", "spiral", "perfect", "pad", "envelope"]
            const savedPrintItems = quoteItems.filter(qi => printingCategories.includes(qi.category))
            if (savedPrintItems.length === 0) return null
            
            return (
              <div className="mb-6">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">In Quote</h3>
                <div className="space-y-1.5">
                  {savedPrintItems.map((qi) => (
                    <button
                      key={qi.id}
                      onClick={() => handleEditQuoteItem(qi.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all border",
                        editingQuoteItemId === qi.id
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-950/50"
                      )}
                    >
                      <Check className={cn("h-3.5 w-3.5 shrink-0", editingQuoteItemId === qi.id ? "text-white" : "text-green-600")} />
                      <div className="flex-1 min-w-0">
                        <div className={cn("text-xs font-bold truncate", editingQuoteItemId === qi.id ? "text-white" : "text-foreground")}>{qi.label}</div>
                        <div className={cn("text-[10px]", editingQuoteItemId === qi.id ? "text-white/70" : "text-green-700 dark:text-green-400")}>
                          {formatCurrency(qi.amount)}
                        </div>
                      </div>
                      <Pencil className={cn("h-3 w-3 shrink-0", editingQuoteItemId === qi.id ? "text-white/70" : "text-muted-foreground")} />
                    </button>
                  ))}
                </div>
              </div>
            )
          })()}
          
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Pieces</h3>
            <Badge variant="outline" className="text-[10px] h-5 font-semibold">
              {printItems.filter(i => i.addedToQuote).length}/{printItems.length}
            </Badge>
          </div>
          <div className="space-y-1.5">
            {printItems.map((item, idx) => {
              const isActive = item.id === activeItemId
              const selectedVendor = item.vendorQuotes.find(vq => vq.vendorId === item.selectedVendorId)
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveItemId(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all",
                    isActive 
                      ? "bg-foreground text-background shadow-md" 
                      : item.addedToQuote 
                        ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                        : "bg-background hover:bg-muted border border-border/50"
                  )}
                >
                  <span className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                    item.addedToQuote ? "bg-green-600 text-white" : isActive ? "bg-background/20 text-background" : "bg-muted-foreground/10 text-muted-foreground"
                  )}>
                    {item.addedToQuote ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={cn("font-semibold text-sm truncate", isActive && "text-background")}>{item.pieceLabel}</div>
                    {selectedVendor && selectedVendor.price > 0 ? (
                      <div className={cn("text-xs truncate", isActive ? "text-background/70" : "text-muted-foreground")}>
                        {formatCurrency(selectedVendor.price)}
                      </div>
                    ) : (
                      <div className={cn("text-xs", isActive ? "text-background/50" : "text-muted-foreground/50")}>No price yet</div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        {activeItem && (
          <div className="flex-1 p-6 overflow-y-auto">
            {/* PIECE HEADER */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">{activeItem.pieceLabel}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{buildSpecsText(activeItem.specs) || "Configure specifications below"}</p>
              </div>
              {activeItem.addedToQuote && (
                <Badge className="bg-green-600 text-white gap-1.5 px-3 py-1">
                  <Check className="h-3.5 w-3.5" /> Added to Quote
                </Badge>
              )}
            </div>

            {/* SPECIFICATIONS CARD - Shows different fields based on calcType */}
            {/* Helper: styling for unfilled vs filled fields */}
            {(() => {
              // Unfilled fields get amber border to show they need attention
              const inputUnfilled = "h-11 text-base font-semibold text-center rounded-xl border-2 border-amber-400 bg-amber-50/50 dark:bg-amber-950/20 focus:border-foreground focus:ring-0 shadow-sm placeholder:text-amber-600/70"
              const inputFilled = "h-11 text-base font-semibold text-center rounded-xl border-2 border-green-500/60 bg-background focus:border-foreground focus:ring-0 shadow-sm"
              const selectUnfilled = "h-11 text-sm font-semibold rounded-xl border-2 border-amber-400 bg-amber-50/50 dark:bg-amber-950/20 focus:border-foreground focus:ring-0 w-full shadow-sm text-amber-700 dark:text-amber-400"
              const selectFilled = "h-11 text-sm font-semibold rounded-xl border-2 border-green-500/60 bg-background focus:border-foreground focus:ring-0 w-full shadow-sm"
              
              const specs = activeItem.specs
              const isQtyFilled = specs.quantity > 0
              const isWidthFilled = specs.width > 0
              const isHeightFilled = specs.height > 0
              const isPaperFilled = !!specs.paper && specs.paper !== ""
              const isColorsFilled = !!specs.colors && specs.colors !== ""
              const isFoldFilled = !!specs.fold && specs.fold !== ""
              const isLamFilled = !!specs.lamination && specs.lamination !== ""
              const isCoverPaperFilled = !!specs.coverPaper && specs.coverPaper !== ""
              const isCoverColorsFilled = !!specs.coverColors && specs.coverColors !== ""
              const isInsidePaperFilled = !!specs.insidePaper && specs.insidePaper !== ""
              const isInsideColorsFilled = !!specs.insideColors && specs.insideColors !== ""
              const isPagesFilled = (specs.pages || 0) > 0
              const isSheetsFilled = (specs.sheetsPerPad || 0) > 0
              
              return (
            <div className={cn(
              "rounded-2xl border-2 bg-card p-6 mb-6",
              activeItem.addedToQuote ? "border-green-300 bg-green-50/20 dark:border-green-800 dark:bg-green-950/10" : "border-border/50"
            )}>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Specifications</h4>
              
              {/* COMMON FIELDS: Qty + Size */}
              <div className="flex flex-wrap items-end gap-5 mb-4">
                <div className="w-28">
                  <label className={cn("block text-[11px] font-semibold uppercase tracking-wide mb-1.5", isQtyFilled ? "text-muted-foreground" : "text-amber-600")}>
                    Quantity {!isQtyFilled && <span className="text-amber-500">*</span>}
                  </label>
                  <Input 
                    type="number" 
                    value={activeItem.specs.quantity || ""} 
                    onChange={(e) => updateSpecs({ quantity: parseInt(e.target.value) || 0 })} 
                    disabled={activeItem.addedToQuote} 
                    placeholder="0"
                    className={isQtyFilled ? inputFilled : inputUnfilled} 
                  />
                </div>
                
                <div>
                  <label className={cn("block text-[11px] font-semibold uppercase tracking-wide mb-1.5", (isWidthFilled && isHeightFilled) ? "text-muted-foreground" : "text-amber-600")}>
                    Finished Size (W × H) {(!isWidthFilled || !isHeightFilled) && <span className="text-amber-500">*</span>}
                  </label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      step={0.125} 
                      value={activeItem.specs.width || ""} 
                      onChange={(e) => updateSpecs({ width: parseFloat(e.target.value) || 0 })} 
                      disabled={activeItem.addedToQuote} 
                      placeholder="W"
                      className={cn(isWidthFilled ? inputFilled : inputUnfilled, "w-20")} 
                    />
                    <span className="text-muted-foreground font-bold text-lg">×</span>
                    <Input 
                      type="number" 
                      step={0.125} 
                      value={activeItem.specs.height || ""} 
                      onChange={(e) => updateSpecs({ height: parseFloat(e.target.value) || 0 })} 
                      disabled={activeItem.addedToQuote} 
                      placeholder="H"
                      className={cn(isHeightFilled ? inputFilled : inputUnfilled, "w-20")} 
                    />
                  </div>
                </div>
                
                {/* Pages - for booklets/spirals/pads */}
                {(isBooklet || activeItem.calcType === "spiral" || activeItem.calcType === "pad") && (
                  <div className="w-24">
                    <label className={cn("block text-[11px] font-semibold uppercase tracking-wide mb-1.5", (activeItem.calcType === "pad" ? isSheetsFilled : isPagesFilled) ? "text-muted-foreground" : "text-amber-600")}>
                      {activeItem.calcType === "pad" ? "Sheets" : "Pages"} {!(activeItem.calcType === "pad" ? isSheetsFilled : isPagesFilled) && <span className="text-amber-500">*</span>}
                    </label>
                    <Input 
                      type="number" 
                      step={activeItem.calcType === "pad" ? 25 : 4} 
                      min={activeItem.calcType === "pad" ? 25 : 4} 
                      value={activeItem.calcType === "pad" ? (activeItem.specs.sheetsPerPad || "") : (activeItem.specs.pages || "")} 
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0
                        if (activeItem.calcType === "pad") {
                          updateSpecs({ sheetsPerPad: val })
                        } else {
                          updateSpecs({ pages: val })
                        }
                      }} 
                      disabled={activeItem.addedToQuote} 
                      placeholder="0"
                      className={(activeItem.calcType === "pad" ? isSheetsFilled : isPagesFilled) ? inputFilled : inputUnfilled} 
                    />
                  </div>
                )}
              </div>
              
              {/* ═══════════════════════════════════���═══════════════════════════ */}
              {/* FLAT PRINTING SPECS (postcards, letters, self-mailers, etc) */}
              {/* ═══════════════════════════════════════════════════════════════ */}
              {(activeItem.calcType === "flat" || activeItem.calcType === "printing") && (
                <div className="flex flex-wrap items-end gap-5">
                  <div className="min-w-[185px]">
                    <label className={cn("block text-[11px] font-semibold uppercase tracking-wide mb-1.5", isPaperFilled ? "text-muted-foreground" : "text-amber-600")}>
                      Paper Stock {!isPaperFilled && <span className="text-amber-500">*</span>}
                    </label>
                    <Select value={activeItem.specs.paper} onValueChange={(v) => updateSpecs({ paper: v })} disabled={activeItem.addedToQuote}>
                      <SelectTrigger className={isPaperFilled ? selectFilled : selectUnfilled}>
                        <SelectValue placeholder="— Select —" />
                      </SelectTrigger>
                      <SelectContent>{PAPER_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  
                  <div className="min-w-[170px]">
                    <label className={cn("block text-[11px] font-semibold uppercase tracking-wide mb-1.5", isColorsFilled ? "text-muted-foreground" : "text-amber-600")}>
                      Colors {!isColorsFilled && <span className="text-amber-500">*</span>}
                    </label>
                    <Select value={activeItem.specs.colors} onValueChange={(v) => updateSpecs({ colors: v })} disabled={activeItem.addedToQuote}>
                      <SelectTrigger className={isColorsFilled ? selectFilled : selectUnfilled}>
                        <SelectValue placeholder="— Select —" />
                      </SelectTrigger>
                      <SelectContent>{FLAT_COLOR_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  
                  <div className="min-w-[160px]">
                    <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Fold</label>
                    <Select value={activeItem.specs.fold || ""} onValueChange={(v) => updateSpecs({ fold: v })} disabled={activeItem.addedToQuote}>
                      <SelectTrigger className={selectFilled}>
                        <SelectValue placeholder="No Fold" />
                      </SelectTrigger>
                      <SelectContent>{FOLD_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  
                  <div className="min-w-[130px]">
                    <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Lamination</label>
                    <Select value={activeItem.specs.lamination || ""} onValueChange={(v) => updateSpecs({ lamination: v })} disabled={activeItem.addedToQuote}>
                      <SelectTrigger className={selectFilled}>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>{LAMINATION_OPTIONS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  
                  <button 
                    type="button"
                    onClick={() => !activeItem.addedToQuote && updateSpecs({ hasBleed: !activeItem.specs.hasBleed })}
                    disabled={activeItem.addedToQuote}
                    className={cn(
                      "h-11 px-5 rounded-xl text-sm font-semibold transition-all border-2 flex items-center gap-2 shadow-sm",
                      activeItem.specs.hasBleed 
                        ? "bg-foreground text-background border-foreground" 
                        : "bg-background text-muted-foreground border-border/60 hover:border-foreground/30"
                    )}
                  >
                    {activeItem.specs.hasBleed && <Check className="h-4 w-4" />}
                    Bleed
                  </button>
                </div>
              )}
              
              {/* ═══════════════════════════════════════════════════════════════ */}
              {/* BOOKLET SPECS - Saddle Stitch / Perfect Bound */}
              {/* ═══════════════════════════════════════════════════════════════ */}
              {isBooklet && (
                <div className="space-y-4">
                  {/* SEPARATE COVER TOGGLE */}
                  <div className="flex items-center gap-4">
                    <button 
                      type="button"
                      onClick={() => !activeItem.addedToQuote && updateSpecs({ separateCover: !activeItem.specs.separateCover })}
                      disabled={activeItem.addedToQuote}
                      className={cn(
                        "h-10 px-4 rounded-xl text-sm font-semibold transition-all border-2 flex items-center gap-2",
                        activeItem.specs.separateCover 
                          ? "bg-foreground text-background border-foreground" 
                          : "bg-background text-muted-foreground border-border/60 hover:border-foreground/30"
                      )}
                    >
                      {activeItem.specs.separateCover && <Check className="h-4 w-4" />}
                      Separate Cover
                    </button>
                    
                    <div className="min-w-[180px]">
                      <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Binding</label>
                      <Select value={activeItem.specs.bindingType || "staple"} onValueChange={(v) => updateSpecs({ bindingType: v })} disabled={activeItem.addedToQuote}>
                        <SelectTrigger className={selectFilled}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>{BINDING_OPTIONS.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* COVER - Only show if separateCover is true */}
                  {activeItem.specs.separateCover && (
                    <div className="p-4 bg-muted/30 rounded-xl">
                      <h5 className={cn("text-[11px] font-bold uppercase tracking-wide mb-3", isCoverPaperFilled ? "text-muted-foreground" : "text-amber-600")}>
                        Cover {!isCoverPaperFilled && <span className="text-amber-500">— needs paper selection</span>}
                      </h5>
                      <div className="flex flex-wrap items-end gap-4">
                        <div className="min-w-[185px]">
                          <label className={cn("block text-[11px] font-semibold uppercase tracking-wide mb-1.5", isCoverPaperFilled ? "text-muted-foreground" : "text-amber-600")}>
                            Cover Paper {!isCoverPaperFilled && <span className="text-amber-500">*</span>}
                          </label>
                          <Select value={activeItem.specs.coverPaper || ""} onValueChange={(v) => updateSpecs({ coverPaper: v })} disabled={activeItem.addedToQuote}>
                            <SelectTrigger className={isCoverPaperFilled ? selectFilled : selectUnfilled}>
                              <SelectValue placeholder="— Select —" />
                            </SelectTrigger>
                            <SelectContent>{PAPER_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        
                        <div className="min-w-[170px]">
                          <label className={cn("block text-[11px] font-semibold uppercase tracking-wide mb-1.5", isCoverColorsFilled ? "text-muted-foreground" : "text-amber-600")}>
                            Cover Colors {!isCoverColorsFilled && <span className="text-amber-500">*</span>}
                          </label>
                          <Select value={activeItem.specs.coverColors || ""} onValueChange={(v) => updateSpecs({ coverColors: v })} disabled={activeItem.addedToQuote}>
                            <SelectTrigger className={isCoverColorsFilled ? selectFilled : selectUnfilled}>
                              <SelectValue placeholder="— Select —" />
                            </SelectTrigger>
                            <SelectContent>{BOOKLET_COVER_COLOR_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        
                        <button 
                          type="button"
                          onClick={() => !activeItem.addedToQuote && updateSpecs({ coverBleed: !activeItem.specs.coverBleed })}
                          disabled={activeItem.addedToQuote}
                          className={cn(
                            "h-11 px-5 rounded-xl text-sm font-semibold transition-all border-2 flex items-center gap-2 shadow-sm",
                            activeItem.specs.coverBleed 
                              ? "bg-foreground text-background border-foreground" 
                              : "bg-background text-muted-foreground border-border/60 hover:border-foreground/30"
                          )}
                        >
                          {activeItem.specs.coverBleed && <Check className="h-4 w-4" />}
                          Bleed
                        </button>
                        
                        <div className="min-w-[130px]">
                          <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Cover Lam</label>
                          <Select value={activeItem.specs.coverLamination || ""} onValueChange={(v) => updateSpecs({ coverLamination: v })} disabled={activeItem.addedToQuote}>
                            <SelectTrigger className={selectFilled}>
                              <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent>{LAMINATION_OPTIONS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* INSIDE PAGES */}
                  <div className="p-4 bg-muted/30 rounded-xl">
                    <h5 className={cn("text-[11px] font-bold uppercase tracking-wide mb-3", isInsidePaperFilled ? "text-muted-foreground" : "text-amber-600")}>
                      Inside Pages {!isInsidePaperFilled && <span className="text-amber-500">— needs paper selection</span>}
                    </h5>
                    <div className="flex flex-wrap items-end gap-4">
                      <div className="min-w-[185px]">
                        <label className={cn("block text-[11px] font-semibold uppercase tracking-wide mb-1.5", isInsidePaperFilled ? "text-muted-foreground" : "text-amber-600")}>
                          Inside Paper {!isInsidePaperFilled && <span className="text-amber-500">*</span>}
                        </label>
                        <Select value={activeItem.specs.insidePaper || ""} onValueChange={(v) => updateSpecs({ insidePaper: v })} disabled={activeItem.addedToQuote}>
                          <SelectTrigger className={isInsidePaperFilled ? selectFilled : selectUnfilled}>
                            <SelectValue placeholder="— Select —" />
                          </SelectTrigger>
                          <SelectContent>{PAPER_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      
                      <div className="min-w-[170px]">
                        <label className={cn("block text-[11px] font-semibold uppercase tracking-wide mb-1.5", isInsideColorsFilled ? "text-muted-foreground" : "text-amber-600")}>
                          Inside Colors {!isInsideColorsFilled && <span className="text-amber-500">*</span>}
                        </label>
                        <Select value={activeItem.specs.insideColors || ""} onValueChange={(v) => updateSpecs({ insideColors: v })} disabled={activeItem.addedToQuote}>
                          <SelectTrigger className={isInsideColorsFilled ? selectFilled : selectUnfilled}>
                            <SelectValue placeholder="— Select —" />
                          </SelectTrigger>
                          <SelectContent>{BOOKLET_INSIDE_COLOR_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      
                      <button 
                        type="button"
                        onClick={() => !activeItem.addedToQuote && updateSpecs({ insideBleed: !activeItem.specs.insideBleed })}
                        disabled={activeItem.addedToQuote}
                        className={cn(
                          "h-11 px-5 rounded-xl text-sm font-semibold transition-all border-2 flex items-center gap-2 shadow-sm",
                          activeItem.specs.insideBleed 
                            ? "bg-foreground text-background border-foreground" 
                            : "bg-background text-muted-foreground border-border/60 hover:border-foreground/30"
                        )}
                      >
                        {activeItem.specs.insideBleed && <Check className="h-4 w-4" />}
                        Bleed
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* ═══════════════════════════════════════════════════════════════ */}
              {/* SPIRAL SPECS - Front/Back Cover Toggles + Inside */}
              {/* ═══════════════════════════════════════════════════════════════ */}
              {activeItem.calcType === "spiral" && (
                <div className="space-y-4">
                  {/* COVER TOGGLES */}
                  <div className="flex flex-wrap items-center gap-3">
                    <button 
                      type="button"
                      onClick={() => !activeItem.addedToQuote && updateSpecs({ useFrontCover: !activeItem.specs.useFrontCover })}
                      disabled={activeItem.addedToQuote}
                      className={cn(
                        "h-10 px-4 rounded-xl text-sm font-semibold transition-all border-2 flex items-center gap-2",
                        activeItem.specs.useFrontCover 
                          ? "bg-foreground text-background border-foreground" 
                          : "bg-background text-muted-foreground border-border/60 hover:border-foreground/30"
                      )}
                    >
                      {activeItem.specs.useFrontCover && <Check className="h-4 w-4" />}
                      Front Cover
                    </button>
                    <button 
                      type="button"
                      onClick={() => !activeItem.addedToQuote && updateSpecs({ useBackCover: !activeItem.specs.useBackCover })}
                      disabled={activeItem.addedToQuote}
                      className={cn(
                        "h-10 px-4 rounded-xl text-sm font-semibold transition-all border-2 flex items-center gap-2",
                        activeItem.specs.useBackCover 
                          ? "bg-foreground text-background border-foreground" 
                          : "bg-background text-muted-foreground border-border/60 hover:border-foreground/30"
                      )}
                    >
                      {activeItem.specs.useBackCover && <Check className="h-4 w-4" />}
                      Back Cover
                    </button>
                    <button 
                      type="button"
                      onClick={() => !activeItem.addedToQuote && updateSpecs({ clearPlastic: !activeItem.specs.clearPlastic })}
                      disabled={activeItem.addedToQuote}
                      className={cn(
                        "h-10 px-4 rounded-xl text-sm font-semibold transition-all border-2 flex items-center gap-2",
                        activeItem.specs.clearPlastic 
                          ? "bg-foreground text-background border-foreground" 
                          : "bg-background text-muted-foreground border-border/60 hover:border-foreground/30"
                      )}
                    >
                      {activeItem.specs.clearPlastic && <Check className="h-4 w-4" />}
                      Clear Plastic
                    </button>
                    <button 
                      type="button"
                      onClick={() => !activeItem.addedToQuote && updateSpecs({ blackVinyl: !activeItem.specs.blackVinyl })}
                      disabled={activeItem.addedToQuote}
                      className={cn(
                        "h-10 px-4 rounded-xl text-sm font-semibold transition-all border-2 flex items-center gap-2",
                        activeItem.specs.blackVinyl 
                          ? "bg-foreground text-background border-foreground" 
                          : "bg-background text-muted-foreground border-border/60 hover:border-foreground/30"
                      )}
                    >
                      {activeItem.specs.blackVinyl && <Check className="h-4 w-4" />}
                      Black Vinyl
                    </button>
                  </div>
                  
                  {/* FRONT COVER - Only show if useFrontCover is true */}
                  {activeItem.specs.useFrontCover && (
                    <div className="p-4 bg-muted/30 rounded-xl">
                      <h5 className="text-[11px] font-bold uppercase tracking-wide mb-3 text-muted-foreground">Front Cover</h5>
                      <div className="flex flex-wrap items-end gap-4">
                        <div className="min-w-[185px]">
                          <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Paper</label>
                          <Select value={activeItem.specs.coverPaper || ""} onValueChange={(v) => updateSpecs({ coverPaper: v })} disabled={activeItem.addedToQuote}>
                            <SelectTrigger className={selectFilled}>
                              <SelectValue placeholder="— Select —" />
                            </SelectTrigger>
                            <SelectContent>{PAPER_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="min-w-[170px]">
                          <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Colors</label>
                          <Select value={activeItem.specs.coverColors || ""} onValueChange={(v) => updateSpecs({ coverColors: v })} disabled={activeItem.addedToQuote}>
                            <SelectTrigger className={selectFilled}>
                              <SelectValue placeholder="— Select —" />
                            </SelectTrigger>
                            <SelectContent>{FULL_COLOR_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <button 
                          type="button"
                          onClick={() => !activeItem.addedToQuote && updateSpecs({ coverBleed: !activeItem.specs.coverBleed })}
                          disabled={activeItem.addedToQuote}
                          className={cn(
                            "h-11 px-5 rounded-xl text-sm font-semibold transition-all border-2 flex items-center gap-2 shadow-sm",
                            activeItem.specs.coverBleed 
                              ? "bg-foreground text-background border-foreground" 
                              : "bg-background text-muted-foreground border-border/60 hover:border-foreground/30"
                          )}
                        >
                          {activeItem.specs.coverBleed && <Check className="h-4 w-4" />}
                          Bleed
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* BACK COVER - Only show if useBackCover is true */}
                  {activeItem.specs.useBackCover && (
                    <div className="p-4 bg-muted/30 rounded-xl">
                      <h5 className="text-[11px] font-bold uppercase tracking-wide mb-3 text-muted-foreground">Back Cover</h5>
                      <div className="flex flex-wrap items-end gap-4">
                        <div className="min-w-[185px]">
                          <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Paper</label>
                          <Select value={activeItem.specs.backCoverPaper || ""} onValueChange={(v) => updateSpecs({ backCoverPaper: v })} disabled={activeItem.addedToQuote}>
                            <SelectTrigger className={selectFilled}>
                              <SelectValue placeholder="— Select —" />
                            </SelectTrigger>
                            <SelectContent>{PAPER_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="min-w-[170px]">
                          <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Colors</label>
                          <Select value={activeItem.specs.backCoverColors || ""} onValueChange={(v) => updateSpecs({ backCoverColors: v })} disabled={activeItem.addedToQuote}>
                            <SelectTrigger className={selectFilled}>
                              <SelectValue placeholder="— Select —" />
                            </SelectTrigger>
                            <SelectContent>{FULL_COLOR_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <button 
                          type="button"
                          onClick={() => !activeItem.addedToQuote && updateSpecs({ backCoverBleed: !activeItem.specs.backCoverBleed })}
                          disabled={activeItem.addedToQuote}
                          className={cn(
                            "h-11 px-5 rounded-xl text-sm font-semibold transition-all border-2 flex items-center gap-2 shadow-sm",
                            activeItem.specs.backCoverBleed 
                              ? "bg-foreground text-background border-foreground" 
                              : "bg-background text-muted-foreground border-border/60 hover:border-foreground/30"
                          )}
                        >
                          {activeItem.specs.backCoverBleed && <Check className="h-4 w-4" />}
                          Bleed
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* INSIDE PAGES */}
                  <div className="p-4 bg-muted/30 rounded-xl">
                    <h5 className={cn("text-[11px] font-bold uppercase tracking-wide mb-3", isInsidePaperFilled ? "text-muted-foreground" : "text-amber-600")}>
                      Inside Pages {!isInsidePaperFilled && <span className="text-amber-500">— needs paper selection</span>}
                    </h5>
                    <div className="flex flex-wrap items-end gap-4">
                      <div className="min-w-[185px]">
                        <label className={cn("block text-[11px] font-semibold uppercase tracking-wide mb-1.5", isInsidePaperFilled ? "text-muted-foreground" : "text-amber-600")}>
                          Inside Paper {!isInsidePaperFilled && <span className="text-amber-500">*</span>}
                        </label>
                        <Select value={activeItem.specs.insidePaper || ""} onValueChange={(v) => updateSpecs({ insidePaper: v })} disabled={activeItem.addedToQuote}>
                          <SelectTrigger className={isInsidePaperFilled ? selectFilled : selectUnfilled}>
                            <SelectValue placeholder="— Select —" />
                          </SelectTrigger>
                          <SelectContent>{PAPER_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      
                      <div className="min-w-[170px]">
                        <label className={cn("block text-[11px] font-semibold uppercase tracking-wide mb-1.5", isInsideColorsFilled ? "text-muted-foreground" : "text-amber-600")}>
                          Inside Colors {!isInsideColorsFilled && <span className="text-amber-500">*</span>}
                        </label>
                        <Select value={activeItem.specs.insideColors || ""} onValueChange={(v) => updateSpecs({ insideColors: v })} disabled={activeItem.addedToQuote}>
                          <SelectTrigger className={isInsideColorsFilled ? selectFilled : selectUnfilled}>
                            <SelectValue placeholder="— Select —" />
                          </SelectTrigger>
                          <SelectContent>{FULL_COLOR_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      
                      <button 
                        type="button"
                        onClick={() => !activeItem.addedToQuote && updateSpecs({ insideBleed: !activeItem.specs.insideBleed })}
                        disabled={activeItem.addedToQuote}
                        className={cn(
                          "h-11 px-5 rounded-xl text-sm font-semibold transition-all border-2 flex items-center gap-2 shadow-sm",
                          activeItem.specs.insideBleed 
                            ? "bg-foreground text-background border-foreground" 
                            : "bg-background text-muted-foreground border-border/60 hover:border-foreground/30"
                        )}
                      >
                        {activeItem.specs.insideBleed && <Check className="h-4 w-4" />}
                        Bleed
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* ═══════════════════════════════════════════════════════════════ */}
              {/* PAD SPECS */}
              {/* ═══════════════════════════════════════════════════════════════ */}
              {activeItem.calcType === "pad" && (
                <div className="flex flex-wrap items-end gap-5">
                  <div className="min-w-[185px]">
                    <label className={cn("block text-[11px] font-semibold uppercase tracking-wide mb-1.5", isPaperFilled ? "text-muted-foreground" : "text-amber-600")}>
                      Paper Stock {!isPaperFilled && <span className="text-amber-500">*</span>}
                    </label>
                    <Select value={activeItem.specs.paper} onValueChange={(v) => updateSpecs({ paper: v })} disabled={activeItem.addedToQuote}>
                      <SelectTrigger className={isPaperFilled ? selectFilled : selectUnfilled}>
                        <SelectValue placeholder="— Select —" />
                      </SelectTrigger>
                      <SelectContent>{PAPER_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  
                  <div className="min-w-[170px]">
                    <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Colors</label>
                    <Select value={activeItem.specs.colors} onValueChange={(v) => updateSpecs({ colors: v })} disabled={activeItem.addedToQuote}>
                      <SelectTrigger className={selectFilled}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>{FULL_COLOR_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  
                  <button 
                    type="button"
                    onClick={() => !activeItem.addedToQuote && updateSpecs({ hasBleed: !activeItem.specs.hasBleed })}
                    disabled={activeItem.addedToQuote}
                    className={cn(
                      "h-11 px-5 rounded-xl text-sm font-semibold transition-all border-2 flex items-center gap-2 shadow-sm",
                      activeItem.specs.hasBleed 
                        ? "bg-foreground text-background border-foreground" 
                        : "bg-background text-muted-foreground border-border/60 hover:border-foreground/30"
                    )}
                  >
                    {activeItem.specs.hasBleed && <Check className="h-4 w-4" />}
                    Bleed
                  </button>
                  
                  <button 
                    type="button"
                    onClick={() => !activeItem.addedToQuote && updateSpecs({ useChipBoard: !activeItem.specs.useChipBoard })}
                    disabled={activeItem.addedToQuote}
                    className={cn(
                      "h-11 px-5 rounded-xl text-sm font-semibold transition-all border-2 flex items-center gap-2 shadow-sm",
                      activeItem.specs.useChipBoard 
                        ? "bg-foreground text-background border-foreground" 
                        : "bg-background text-muted-foreground border-border/60 hover:border-foreground/30"
                    )}
                  >
                    {activeItem.specs.useChipBoard && <Check className="h-4 w-4" />}
                    Chip Board
                  </button>
                </div>
              )}
              
              {/* ═══════════════════════════════════════════════════════════════ */}
              {/* ENVELOPE SPECS */}
              {/* ═══��═══════════════════════════════════════════════════════════ */}
              {activeItem.calcType === "envelope" && (
                <div className="flex flex-wrap items-end gap-5">
                  <div className="min-w-[185px]">
                    <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Colors</label>
                    <Select value={activeItem.specs.colors} onValueChange={(v) => updateSpecs({ colors: v })} disabled={activeItem.addedToQuote}>
                      <SelectTrigger className={selectFilled}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>{FLAT_COLOR_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              
              {/* Notes - shown for all types */}
              <div className="mt-5">
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Notes / Special Instructions</label>
                <Input 
                  value={activeItem.specs.notes} 
                  onChange={(e) => updateSpecs({ notes: e.target.value })} 
                  placeholder="Enter any special instructions..." 
                  disabled={activeItem.addedToQuote} 
                  className="h-11 text-sm rounded-xl border-2 border-border/60 bg-background focus:border-foreground focus:ring-0 shadow-sm" 
                />
              </div>
            </div>
              )
            })()}

            {/* VENDOR PRICING CARD */}
            <div className="rounded-2xl border-2 border-border/50 bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Vendor Pricing
                </h4>
                <Select onValueChange={addVendor} disabled={activeItem.addedToQuote || vendorsLoading}>
                  <SelectTrigger className="w-40 h-10 text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 border-0 rounded-xl gap-2">
                    <Plus className="h-4 w-4" />
                    <SelectValue placeholder="Add Vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {!vendors || vendors.length === 0 ? (
                      <SelectItem value="_none" disabled>No vendors</SelectItem>
                    ) : (
                      vendors.filter(v => !activeItem.vendorQuotes.some(vq => vq.vendorId === v.id)).map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {activeItem.vendorQuotes.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">No vendors added yet</p>
                  <p className="text-xs mt-1">Click "Add Vendor" to compare prices</p>
                </div>
              ) : (
                <div className="rounded-xl border-2 border-border/50 overflow-hidden">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-muted/50 text-[11px] uppercase text-muted-foreground font-bold tracking-wider">
                    <div className="col-span-3">Vendor</div>
                    <div className="col-span-2 text-right">Cost</div>
                    <div className="col-span-2 text-right">Shipping</div>
                    <div className="col-span-1 text-right">%</div>
                    <div className="col-span-2 text-right">Price</div>
                    <div className="col-span-2"></div>
                  </div>
                  {/* Rows */}
                  {activeItem.vendorQuotes.map((vq) => {
                    const isCheapest = getCheapestId(activeItem) === vq.vendorId
                    const isSelected = activeItem.selectedVendorId === vq.vendorId
                    return (
                      <div 
                        key={vq.vendorId} 
                        onClick={() => !activeItem.addedToQuote && selectVendor(vq.vendorId)}
                        className={cn(
                          "grid grid-cols-12 gap-3 px-4 py-3 items-center border-t-2 border-border/30 cursor-pointer transition-all",
                          isSelected 
                            ? "bg-foreground/5 ring-2 ring-inset ring-foreground/20" 
                            : isCheapest 
                              ? "bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-900/40" 
                              : "hover:bg-muted/50"
                        )}
                      >
                        <div className="col-span-3 flex items-center gap-2 min-w-0">
                          {isSelected && <div className="w-2 h-2 rounded-full bg-foreground shrink-0" />}
                          <span className={cn("font-semibold text-sm truncate", isSelected && "text-foreground")}>{vq.vendorName}</span>
                          {vq.isInternal && <Badge variant="outline" className="text-[9px] px-1.5 h-5 shrink-0 font-bold">P</Badge>}
                          {isCheapest && <Trophy className="h-4 w-4 text-green-600 shrink-0" />}
                        </div>
                        <div className="col-span-2" onClick={(e) => e.stopPropagation()}>
                          <Input type="number" min={0} step={0.01} value={vq.cost || ""} onChange={(e) => updateVendorQuote(vq.vendorId, "cost", parseFloat(e.target.value) || 0)} disabled={activeItem.addedToQuote} className="h-9 text-right text-sm font-semibold rounded-lg border-2 border-border/50 bg-background" />
                        </div>
                        <div className="col-span-2" onClick={(e) => e.stopPropagation()}>
                          <Input type="number" min={0} step={0.01} value={vq.shipping || ""} onChange={(e) => updateVendorQuote(vq.vendorId, "shipping", parseFloat(e.target.value) || 0)} disabled={activeItem.addedToQuote} className="h-9 text-right text-sm font-semibold rounded-lg border-2 border-border/50 bg-background" />
                        </div>
                        <div className="col-span-1" onClick={(e) => e.stopPropagation()}>
                          <Input type="number" min={0} step={1} value={vq.markupPercent || ""} onChange={(e) => updateVendorQuote(vq.vendorId, "markupPercent", parseFloat(e.target.value) || 0)} disabled={activeItem.addedToQuote} className="h-9 text-right text-sm font-semibold rounded-lg border-2 border-border/50 bg-background" />
                        </div>
                        <div className="col-span-2 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Input type="number" min={0} step={0.01} value={vq.price || ""} onChange={(e) => updateVendorQuote(vq.vendorId, "price", parseFloat(e.target.value) || 0)} disabled={activeItem.addedToQuote} className={cn("h-9 text-right text-sm font-bold rounded-lg border-2 border-border/50 bg-background", vq.price > 0 && "text-green-700 dark:text-green-400", vq.priceOverride && "border-amber-400")} />
                          {vq.priceOverride && <button onClick={() => recalculatePrice(vq.vendorId)} className="p-1 text-muted-foreground hover:text-foreground shrink-0"><RefreshCw className="h-3.5 w-3.5" /></button>}
                        </div>
                        <div className="col-span-2 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {vq.isInternal && (
                            <Button variant="outline" size="sm" onClick={() => openCalculator(vq.vendorId)} disabled={activeItem.addedToQuote} className="h-9 px-3 rounded-lg font-semibold gap-1.5">
                              <Calculator className="h-4 w-4" />
                              Calc
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => removeVendor(vq.vendorId)} disabled={activeItem.addedToQuote} className="h-9 w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* SAVE BUTTONS - different for new vs edit mode */}
              {(() => {
                const selectedVendor = activeItem.vendorQuotes.find(vq => vq.vendorId === activeItem.selectedVendorId)
                const hasValidPrice = selectedVendor && selectedVendor.price > 0
                const canSave = activeItem.selectedVendorId && hasValidPrice
                
                return (
                <div className="mt-4 space-y-2">
                  {editingQuoteItemId ? (
                    // EDIT MODE: Show Update + Save as New Version
                    <>
                      <div className="text-xs text-amber-600 font-medium text-center mb-2 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-lg">
                        Editing existing quote item
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleUpdateQuoteItem}
                          disabled={!canSave}
                          className="flex-1 h-12 gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base disabled:opacity-50"
                        >
                          <Check className="h-5 w-5" />
                          Update - {formatCurrency(selectedVendor?.price || 0)}
                        </Button>
                      </div>
                      <Button
                        onClick={handleSaveAsNewVersion}
                        disabled={!canSave}
                        variant="outline"
                        className="w-full h-10 gap-2 rounded-xl font-semibold text-sm"
                      >
                        <Copy className="h-4 w-4" />
                        Save as New Version
                      </Button>
                      <Button
                        onClick={() => setEditingQuoteItemId(null)}
                        variant="ghost"
                        className="w-full h-8 text-xs text-muted-foreground"
                      >
                        Cancel Edit
                      </Button>
                    </>
                  ) : !activeItem.addedToQuote ? (
                    // NEW MODE: Show Add to Quote
                    <Button
                      onClick={handleAddToQuote}
                      disabled={!canSave}
                      className="w-full h-12 gap-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-base disabled:opacity-50"
                    >
                      <Check className="h-5 w-5" />
                      Add to Quote - {formatCurrency(selectedVendor?.price || 0)}
                    </Button>
                  ) : (
                    // ALREADY ADDED: Show Edit option
                    <Button
                      onClick={() => {
                        // Find the matching quote item to edit
                        const matchingItem = quoteItems.find(qi => 
                          qi.category === activeItem.calcType &&
                          qi.specs?.width === activeItem.specs.width &&
                          qi.specs?.height === activeItem.specs.height
                        )
                        if (matchingItem) {
                          setEditingQuoteItemId(matchingItem.id)
                        }
                      }}
                      variant="outline"
                      className="w-full h-10 gap-2 rounded-xl font-semibold"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit Quote Item
                    </Button>
                  )}
                </div>
                )
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Calculator Dialog - passes onResult so price goes to vendor row, NOT directly to quote */}
      {/* Compute initialInputs from specs BEFORE the Dialog opens */}
      {(() => {
        // Get saved inputs from the vendor we're calculating for
        const vendorQuote = activeItem?.vendorQuotes.find(vq => vq.vendorId === calcVendorId)
        const savedInputs = vendorQuote?.calcState?.inputs
        
        console.log("[v0] Calculator Dialog - calcVendorId:", calcVendorId)
        console.log("[v0] Calculator Dialog - vendorQuote:", vendorQuote)
        console.log("[v0] Calculator Dialog - savedInputs from calcState:", savedInputs)
        
        // Map colors string to sidesValue: "4/4" → "D/S", "4/0" → "S/S"
        const colorsToSides = (colors: string | undefined): string => {
          if (!colors) return "S/S"
          if (colors.includes("/4") || colors.includes("/1")) return "D/S"
          return "S/S"
        }
        
        // Map lamination spec to lamination object
        const lamToObject = (lam: string | undefined) => {
          if (!lam || lam === "none" || lam === "") return { enabled: false, type: "Gloss" as const, sides: "S/S" as const, markupPct: 225, brokerDiscountPct: 30 }
          const isGloss = lam.toLowerCase().includes("gloss")
          const isTwoSide = lam.includes("2-Side") || lam.includes("2 Side")
          return { enabled: true, type: isGloss ? "Gloss" as const : "Matte" as const, sides: isTwoSide ? "D/S" as const : "S/S" as const, markupPct: 225, brokerDiscountPct: 30 }
        }
        
        // Map fold spec to foldFinish object for PrintingCalculator
        // Fold options in specs: "none", "half", "tri", "z", "gate", "accordion", "roll"
        const foldToObject = (fold: string | undefined) => {
          if (!fold || fold === "none" || fold === "") {
            return { enabled: false, finishType: "fold" as const, foldType: "half" as const, orientation: "width" as const }
          }
          return { 
            enabled: true, 
            finishType: "fold" as const,  // could be "score_and_fold" but default to "fold"
            foldType: fold as "half" | "tri" | "z" | "gate" | "accordion" | "roll",
            orientation: "width" as const  // default orientation
          }
        }
        
        // Build specsToInputs based on calculator type
        let specsToInputs: Record<string, unknown> | undefined = undefined
        
        if (activeItem?.specs) {
          const specs = activeItem.specs
          const calcType = activeItem.calcType
          
          if (calcType === "flat" || calcType === "printing") {
            // ONLY pass values user actually selected - empty stays empty!
            specsToInputs = {
              qty: specs.quantity || 0,
              width: specs.width || 0,
              height: specs.height || 0,
              paperName: specs.paper || "",  // empty if not selected
              sidesValue: specs.colors ? colorsToSides(specs.colors) : "",  // empty if not selected
              hasBleed: specs.hasBleed || false,
              addOnCharge: 0,
              addOnDescription: "",
              finishingIds: [],
              finishingCalcIds: [],
              isBroker: false,
              printingMarkupPct: 0,
              lamination: lamToObject(specs.lamination),
              foldFinish: foldToObject(specs.fold),  // NOW MAPPING FOLD!
            }
          } else if (calcType === "booklet") {
            // ONLY pass values user actually selected
            specsToInputs = {
              bookQty: specs.quantity || 0,
              pagesPerBook: specs.pages || 0,  // 0 if not set
              pageWidth: specs.width || 0,
              pageHeight: specs.height || 0,
              separateCover: true,
              coverPaper: specs.coverPaper || "",  // empty if not selected
              coverSides: specs.coverColors || "",  // empty if not selected
              coverBleed: specs.coverBleed || false,
              coverSheetSize: "cheapest",
              insidePaper: specs.insidePaper || "",  // empty if not selected
              insideSides: specs.insideColors || "",  // empty if not selected
              insideBleed: specs.insideBleed || false,
              insideSheetSize: "cheapest",
              bindingType: specs.bindingType || "staple",
              laminationType: specs.lamination ? (specs.lamination.toLowerCase().includes("gloss") ? "gloss" : "matte") : "none",
              insertSections: [],
              insertFeePerSection: 25,
              customLevel: "auto",
              isBroker: false,
              printingMarkupPct: 0,
            }
          } else if (calcType === "spiral") {
            // SpiralInputs uses nested objects: inside, front, back
            specsToInputs = {
              bookQty: specs.quantity || 0,
              pagesPerBook: specs.pages || 0,
              pageWidth: specs.width || 0,
              pageHeight: specs.height || 0,
              // Inside pages - nested object
              inside: {
                paperName: specs.insidePaper || "",
                sheetSize: "cheapest",
                sides: specs.insideColors || "",
                hasBleed: specs.insideBleed || false,
              },
              // Front cover - nested object
              useFrontCover: !!(specs.coverPaper),
              front: {
                paperName: specs.coverPaper || "",
                sheetSize: "cheapest",
                sides: specs.coverColors || "",
                hasBleed: specs.coverBleed || false,
              },
              // Back cover - not in specs UI, default off
              useBackCover: false,
              back: {
                paperName: "",
                sheetSize: "cheapest",
                sides: "",
                hasBleed: false,
              },
              clearPlastic: false,
              blackVinyl: false,
              isBroker: false,
              customLevel: "auto",
            }
          } else if (calcType === "pad") {
            // PadInputs uses nested inside object
            specsToInputs = {
              padQty: specs.quantity || 0,
              pagesPerPad: specs.sheetsPerPad || 0,  // FIXED: pagesPerPad not sheetsPerPad
              pageWidth: specs.width || 0,           // FIXED: pageWidth not padWidth
              pageHeight: specs.height || 0,         // FIXED: pageHeight not padHeight
              // Inside - nested object
              inside: {
                paperName: specs.paper || "",
                sheetSize: "cheapest",
                sides: specs.colors ? colorsToSides(specs.colors) : "",
                hasBleed: specs.hasBleed || false,
              },
              useChipBoard: true,
              isBroker: false,
              customLevel: "auto",
            }
          } else if (calcType === "envelope") {
            const w = specs.width || 0
            const h = specs.height || 0
            let itemName = "6x9"
            if (w === 9 && h === 12) itemName = "9x12"
            else if (w === 6 && h === 9) itemName = "6x9"
            else if (w === 9.5 && h === 4.125) itemName = "#10 no window"
            else if (w === 4.125 && h === 9.5) itemName = "#10 no window"
            else if (w > 0 && h > 0) itemName = `${w}x${h}`
            
            specsToInputs = {
              amount: specs.quantity || 0,
              itemName: itemName,
              inkType: "InkJet" as const,
              printType: "Text + Logo" as const,
              hasBleed: specs.hasBleed || false,
              customerType: "Regular" as const,
              customEnvCost: 0,
              customPrintCost: 0,
            }
          }
        }
        
        // Use saved inputs first, then fall back to specs-derived inputs
        const initialInputs = savedInputs || specsToInputs
        console.log("[v0] Calculator Dialog - FINAL initialInputs:", initialInputs)
        console.log("[v0] Calculator Dialog - Using savedInputs?", !!savedInputs, "specsToInputs?", !!specsToInputs)
        
        // Key forces remount when specs change
        const specsKey = activeItem?.specs ? `${activeItem.specs.quantity}-${activeItem.specs.width}-${activeItem.specs.height}-${activeItem.specs.paper || activeItem.specs.coverPaper}-${activeItem.specs.colors || activeItem.specs.coverColors}-${activeItem.specs.insidePaper}-${activeItem.specs.pages}` : "empty"
        
        return (
          <Dialog open={showCalc} onOpenChange={setShowCalc}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Printout Calculator</DialogTitle>
                <DialogDescription>Calculate in-house printing cost - price will be added to vendor comparison</DialogDescription>
              </DialogHeader>
              {showCalc && (
                <>
                  {(activeItem?.calcType === "flat" || activeItem?.calcType === "printing") && (
                    <PrintingCalculator key={specsKey} viewMode="detailed" onResult={handleCalculatorResult} initialInputs={initialInputs} />
                  )}
                  {activeItem?.calcType === "booklet" && (
                    <BookletCalculator key={specsKey} viewMode="detailed" onResult={handleCalculatorResult} initialInputs={initialInputs} />
                  )}
                  {activeItem?.calcType === "spiral" && (
                    <SpiralCalculator key={specsKey} viewMode="detailed" onResult={handleCalculatorResult} initialInputs={initialInputs} />
                  )}
                  {activeItem?.calcType === "perfect" && (
                    <PerfectCalculator key={specsKey} viewMode="detailed" onResult={handleCalculatorResult} initialInputs={initialInputs} />
                  )}
                  {activeItem?.calcType === "pad" && (
                    <PadCalculator key={specsKey} viewMode="detailed" onResult={handleCalculatorResult} initialInputs={initialInputs} />
                  )}
                  {activeItem?.calcType === "envelope" && (
                    <EnvelopeTab key={specsKey} onResult={handleCalculatorResult} initialInputs={initialInputs} />
                  )}
                </>
              )}
            </DialogContent>
          </Dialog>
        )
      })()}
    </div>
  )
}
