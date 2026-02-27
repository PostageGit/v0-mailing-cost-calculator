"use client"

import { useState, useCallback, useMemo, useRef } from "react"
import useSWR from "swr"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  X, Plus, Loader2, Send, ShoppingCart, Check, ArrowRight, Star, ClipboardCopy,
} from "lucide-react"
import { formatCurrency } from "@/lib/pricing"
import { buildCustomerSpecs } from "@/lib/build-quote-text"
import { useQuote } from "@/lib/quote-context"
import type { QuoteCategory } from "@/lib/quote-types"
import { useMailing, PIECE_TYPE_META, getFlatSize, type MailPiece } from "@/lib/mailing-context"
import type { VendorBid, VendorBidPrice, Vendor } from "@/lib/vendor-types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function describePiece(piece: MailPiece, qty: number) {
  const meta = PIECE_TYPE_META[piece.type]
  const sizeStr = piece.width && piece.height ? `${piece.width}" x ${piece.height}"` : ""
  const flat = getFlatSize(piece)
  const flatStr = flat.w && flat.h && (flat.w !== piece.width || flat.h !== piece.height) ? ` (flat: ${flat.w}" x ${flat.h}")` : ""
  const label = `${qty.toLocaleString()} - ${sizeStr} ${meta.label}${flatStr}`
  // Build a richer description from piece data
  const parts: string[] = []
  if (piece.envelopeId && piece.envelopeId !== "custom") parts.push(piece.envelopeId)
  if (piece.envelopeKind) parts.push(piece.envelopeKind === "plastic" ? "Plastic" : "Paper")
  if (piece.paperName) parts.push(piece.paperName)
  if (piece.sides) parts.push(piece.sides)
  if (piece.hasBleed) parts.push("Bleed")
  if (piece.pageCount && piece.pageCount > 1) parts.push(`${piece.pageCount}pg`)
  if (piece.foldType && piece.foldType !== "none") {
    parts.push(String(piece.foldType).replace("x3long","Tri-Fold").replace("x2h","Half Fold").replace("x2w","Half Fold").replace("x3h","Tri-Fold").replace("x3w","Tri-Fold"))
  }
  const category = meta.calc === "booklet" ? "booklet" : meta.calc === "spiral" ? "spiral" : meta.calc === "perfect" ? "perfect" : meta.calc === "envelope" ? "envelope" : "flat"
  return { label, desc: parts.join(", "), category }
}

/** Build a customer-facing copyable spec description for an OHP bid.
 *  Only includes what the customer cares about:
 *  Qty, Size, Paper, Color (4/0 4/4 etc.), Fold, Score, Lamination.
 *  No internal details (sort levels, buffers, vendors, entry points). */
/** Piece type to customer-facing label */
const PIECE_TYPE_LABELS: Record<string, string> = {
  postcard: "Postcard",
  flat_card: "Flat Card",
  folded_card: "Folded Card",
  self_mailer: "Self Mailer",
  letter: "Letter",
  booklet: "Saddle Stitch Book",
  spiral_book: "Spiral Book",
  perfect_bound: "Perfect Bound Book",
  envelope: "Envelope",
}

function buildFullDescription(bid: VendorBid, matchedPiece: MailPiece | undefined, qty: number, quoteItems: { label: string; category: string; amount: number; description: string; metadata?: Record<string, unknown> }[]): string {
  const lines: string[] = []
  lines.push(`Qty: ${qty.toLocaleString()}`)

  // Try to get full specs from matching quote item metadata (includes OHP spec items)
  const matchingItem = quoteItems.find((it) => {
    const cat = it.category?.toLowerCase()
    const specCats = ["flat", "booklet", "spiral", "perfect", "envelope", "ohp"]
    if (!specCats.includes(cat)) return false
    if (!matchedPiece) return bid.item_label.includes(it.label.replace(/^\d[\d,]*\s*-\s*/, ""))
    // Match by dimensions in label OR in metadata.pieceDimensions
    const dims = [`${matchedPiece.width}x${matchedPiece.height}`, `${matchedPiece.height}x${matchedPiece.width}`]
    const labelMatch = dims.some((d) => it.label.includes(d))
    if (labelMatch) return true
    // Also match by metadata pieceDimensions (OHP items store dims in metadata, not label)
    const md = it.metadata as Record<string, unknown> | undefined
    if (md?.pieceDimensions) {
      const mdDim = String(md.pieceDimensions)
      return dims.some((d) => mdDim === d)
    }
    return false
  })

  const m = matchingItem?.metadata as Record<string, unknown> | undefined

  // Add piece type label (e.g. "Saddle Stitch Book", "Postcard")
  const pieceType = m?.pieceType ? String(m.pieceType) : matchedPiece?.type
  if (pieceType && PIECE_TYPE_LABELS[pieceType]) {
    lines.push(PIECE_TYPE_LABELS[pieceType])
  }

  if (m) {
    // buildCustomerSpecs returns newline-separated specs by default
    const specs = buildCustomerSpecs(m, matchingItem?.category as QuoteCategory)
    if (specs) lines.push(specs)
  } else if (matchedPiece) {
    // Fallback: build from piece data (MailPiece only has dimensions + fold)
    if (matchedPiece.width && matchedPiece.height) lines.push(`${matchedPiece.width}" x ${matchedPiece.height}"`)
    if (matchedPiece.foldType && matchedPiece.foldType !== "none") {
      lines.push(String(matchedPiece.foldType).replace("x3long","Tri-Fold").replace("x2h","Half Fold").replace("x2w","Half Fold"))
    }
  }

  return lines.join("\n")
}

interface Props { quoteId: string; onClose?: () => void; inline?: boolean }

export function VendorBidPanel({ quoteId, onClose, inline }: Props) {
  const { data: bids, isLoading, mutate: mutateBids } = useSWR<VendorBid[]>(`/api/vendor-bids?quote_id=${quoteId}`, fetcher)
  const { data: vendors } = useSWR<Vendor[]>("/api/vendors", fetcher)
  const mailing = useMailing()
  const quote = useQuote()

  const ohpPieces = mailing.pieces.filter((p) => p.production === "ohp" || p.production === "both")
  const [autoCreating, setAutoCreating] = useState<Set<string>>(new Set())
  const existingLabels = useMemo(() => new Set(bids?.map((b) => b.item_label) ?? []), [bids])

  const autoCreateBid = async (piece: MailPiece) => {
    const { label, desc, category } = describePiece(piece, mailing.quantity)
    if (existingLabels.has(label)) return
    setAutoCreating((s) => new Set(s).add(piece.id))
    await fetch("/api/vendor-bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quote_id: quoteId, item_label: label, item_description: desc || null, item_category: category }),
    })
    mutateBids()
    setAutoCreating((s) => { const n = new Set(s); n.delete(piece.id); return n })
  }

  const [showManual, setShowManual] = useState(false)
  const [manualLabel, setManualLabel] = useState("")
  const [manualCreating, setManualCreating] = useState(false)

  const createManualBid = async () => {
    if (!manualLabel.trim()) return
    setManualCreating(true)
    await fetch("/api/vendor-bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quote_id: quoteId, item_label: manualLabel.trim(), item_category: "flat" }),
    })
    setManualLabel(""); setShowManual(false); mutateBids(); setManualCreating(false)
  }

  // Pull REAL in-house cost from quote line items for a piece
  // Flat labels:     "1,500 - 8.5x11 Flat Prints"
  // Booklet labels:  "500 - 16pg Booklet 5.5x8.5 Self-Cover"
  // Envelope labels: "Paper Envelope: 4.125" x 9.5""  (category: "item")
  const getInhouseCost = useCallback((piece: MailPiece): number | null => {
    if (!piece.width || !piece.height) return null
    const w = piece.width
    const h = piece.height
    const meta = PIECE_TYPE_META[piece.type]
    const flat = getFlatSize(piece)

    // Build ALL dimension patterns -- finished size + flat size
    const allDims: string[] = [
      `${w}x${h}`, `${h}x${w}`,
      `${w}" x ${h}"`, `${h}" x ${w}"`,
      `${w}"x${h}"`, `${h}"x${w}"`,
    ]
    // Add flat size patterns if different from finished
    if (flat.w && flat.h && (flat.w !== w || flat.h !== h)) {
      allDims.push(
        `${flat.w}x${flat.h}`, `${flat.h}x${flat.w}`,
        `${flat.w}" x ${flat.h}"`, `${flat.h}" x ${flat.w}"`,
        `${flat.w}"x${flat.h}"`, `${flat.h}"x${flat.w}"`,
      )
    }
    const hasDim = (label: string) => allDims.some((p) => label.includes(p))

    let match: typeof quote.items[0] | undefined

    if (meta.calc === "envelope") {
      // Envelopes: category "envelope" (or legacy "item") with "envelope" in label
      // First try dimension match, then fall back to just finding ANY envelope item
      match = quote.items.find((item) =>
        (item.category === "envelope" || item.category === "item") && item.label.toLowerCase().includes("envelope") && hasDim(item.label)
      )
      if (!match) {
        match = quote.items.find((item) =>
          item.category === "envelope" && item.label.toLowerCase().includes("envelope")
        )
      }
    } else if (meta.calc === "booklet") {
      match = quote.items.find((item) => item.category === "booklet" && hasDim(item.label))
    } else if (meta.calc === "spiral") {
      match = quote.items.find((item) => item.category === "spiral" && hasDim(item.label))
    } else if (meta.calc === "perfect") {
      match = quote.items.find((item) => item.category === "perfect" && hasDim(item.label))
    } else {
      // Flat printing
      match = quote.items.find((item) => item.category === "flat" && hasDim(item.label))
    }

    return match ? match.amount : null
  }, [quote.items])

  const content = (
    <div className="flex flex-col gap-4">
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Planner pieces that still need bids */}
          {ohpPieces.some((p) => !existingLabels.has(describePiece(p, mailing.quantity).label)) && (
            <div className="flex flex-wrap gap-2">
              {ohpPieces.filter((p) => !existingLabels.has(describePiece(p, mailing.quantity).label)).map((piece) => {
                const meta = PIECE_TYPE_META[piece.type]
                const { label } = describePiece(piece, mailing.quantity)
                const busy = autoCreating.has(piece.id)
                return (
                  <button key={piece.id} onClick={() => autoCreateBid(piece)} disabled={busy}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed border-border bg-card hover:border-foreground/30 hover:bg-secondary/30 transition-all text-left">
                    <span className={`text-xs font-black px-1.5 py-0.5 rounded ${meta.color}`}>{meta.short}</span>
                    <span className="text-sm font-semibold text-foreground">{label}</span>
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> : <Plus className="h-3.5 w-3.5 text-muted-foreground ml-1" />}
                  </button>
                )
              })}
            </div>
          )}

          {/* Bid cards */}
          {bids?.map((bid) => (
            <BidCard key={bid.id} bid={bid} vendors={vendors ?? []} quote={quote}
              ohpPieces={ohpPieces} qty={mailing.quantity} getInhouseCost={getInhouseCost}
              onUpdate={() => mutateBids()} />
          ))}

          {(!bids || bids.length === 0) && ohpPieces.length === 0 && !showManual && (
            <div className="text-center py-16">
              <Send className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-base font-bold text-foreground">No OHP pieces</p>
              <p className="text-sm text-muted-foreground mt-1">Mark pieces as "OHP" or "Both" in the Planner.</p>
            </div>
          )}

          {showManual ? (
            <div className="flex items-center gap-2">
              <Input value={manualLabel} onChange={(e) => setManualLabel(e.target.value)}
                placeholder="Custom job description..." className="flex-1 h-10 text-sm rounded-xl" autoFocus
                onKeyDown={(e) => e.key === "Enter" && createManualBid()} />
              <button onClick={createManualBid} disabled={manualCreating || !manualLabel.trim()}
                className="h-10 px-4 rounded-xl bg-foreground text-background text-sm font-bold hover:bg-foreground/90 disabled:opacity-40 transition-all">
                Create
              </button>
              <button onClick={() => setShowManual(false)} className="h-10 px-3 rounded-xl text-sm text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setShowManual(true)}
              className="w-full h-10 rounded-xl border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:border-foreground/20 hover:text-foreground transition-all">
              + Custom Bid
            </button>
          )}
        </>
      )}
    </div>
  )

  if (inline) return (
    <div className="w-full max-w-3xl">
      <div className="mb-5">
        <h3 className="text-xl font-black text-foreground tracking-tight">Out of House Production</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Compare vendor prices with in-house, push best to quote.</p>
      </div>
      {content}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 bg-foreground/10 backdrop-blur-sm flex items-start justify-center p-4 pt-[4vh] overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-xl font-black text-foreground">Out of House Production</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6">{content}</div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   BidCard -- one card per OHP piece
   ═══════════════════════════════════════════════ */
function BidCard({ bid, vendors, quote, ohpPieces, qty, getInhouseCost, onUpdate }: {
  bid: VendorBid; vendors: Vendor[]; quote: ReturnType<typeof useQuote>;
  ohpPieces: MailPiece[]; qty: number; getInhouseCost: (p: MailPiece) => number | null;
  onUpdate: () => void
}) {
  const { data: prices, mutate: mutatePrices } = useSWR<VendorBidPrice[]>(`/api/vendor-bids/${bid.id}/prices`, fetcher)
  const [addingVendor, setAddingVendor] = useState(false)
  const [markupPct, setMarkupPct] = useState(20)
  const [pushed, setPushed] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [descCopied, setDescCopied] = useState(false)

  // Allow adding ANY vendor -- even duplicates if user wants to re-bid
  const quickAddVendor = async (vendorId: string) => {
    setAddingVendor(true)
    await fetch(`/api/vendor-bids/${bid.id}/prices`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendor_id: vendorId }),
    })
    setAddingVendor(false); mutatePrices()
  }

  const updatePrice = async (priceId: string, price: number | null, quoteNum?: string) => {
    // Optimistic update -- mutate local cache first so inputs stay stable
    mutatePrices(
      (prev) => prev?.map((p) => p.id === priceId ? { ...p, price: price as number, notes: quoteNum || null, status: price != null ? "received" : "pending" } : p),
      { revalidate: false }
    )
    await fetch(`/api/bid-prices/${priceId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price, notes: quoteNum || null, status: price != null ? "received" : "pending", responded_at: price != null ? new Date().toISOString() : null }),
    })
    // Revalidate in background without resetting state
    mutatePrices()
  }

  const removePrice = async (priceId: string) => {
    await fetch(`/api/bid-prices/${priceId}`, { method: "DELETE" }); mutatePrices()
  }

  const deleteBid = async () => {
    setDeleting(true)
    await fetch(`/api/vendor-bids/${bid.id}`, { method: "DELETE" }); onUpdate()
  }

  // Find matching planner piece for "Both" comparison
  const matchedPiece = ohpPieces.find((p) => describePiece(p, qty).label === bid.item_label)
  const isBoth = matchedPiece?.production === "both"
  const inhouseCost = matchedPiece ? getInhouseCost(matchedPiece) : null

  // Find the BEST (cheapest) vendor price
  const receivedPrices = prices?.filter((p) => p.price != null) ?? []
  const bestPrice = receivedPrices.length > 0 ? Math.min(...receivedPrices.map((p) => Number(p.price))) : null
  const bestVendorEntry = receivedPrices.find((p) => Number(p.price) === bestPrice)
  const bestVendor = bestVendorEntry ? vendors.find((v) => v.id === bestVendorEntry.vendor_id) : null

  // Customer total for best price
  const bestPickup = bestVendor?.pickup_cost ?? 0
  const bestCustomerTotal = bestPrice != null ? bestPrice * (1 + markupPct / 100) + bestPickup : null

  // Push best price to quote -- customer-facing description uses print specs, not vendor/markup
  const handlePushToQuote = useCallback(() => {
    if (bestPrice == null || !bestVendor) return
    const total = bestPrice * (1 + markupPct / 100) + (bestVendor.pickup_cost ?? 0)

    // Try to find the matching in-house quote item to copy print spec metadata
    // In-house items have metadata with paperName, pieceDimensions, sides, etc.
    const existingItems = quote.items ?? []
    const matchingItem = existingItems.find((it) => {
      const specCats = ["flat", "booklet", "spiral", "perfect", "printing", "ohp"]
      if (!specCats.includes(it.category)) return false
      const md = it.metadata as Record<string, unknown> | undefined
      if (!md?.pieceDimensions) return false
      return bid.item_label.includes(String(md.pieceDimensions).replace("x", "x"))
    })
    const inhouseMeta = (matchingItem?.metadata ?? {}) as Record<string, unknown>

    // Build customer-facing description from print specs
    let description = ""
    if (Object.keys(inhouseMeta).length > 0) {
      // Use the same buildCustomerSpecs that in-house printing uses
      description = buildCustomerSpecs(inhouseMeta, matchingItem?.category as any, ", ") || bid.item_description || ""
    } else {
      // Fallback: use the bid label itself (e.g. "2,850 - 8.11x11 Booklet")
      description = bid.item_description || bid.item_label
    }

    quote.addItem({
      category: "ohp",
      label: bid.item_label,
      description,
      amount: total,
      metadata: {
        // Internal-only fields -- not shown to customer
        vendorName: bestVendor.company_name,
        vendorId: bestVendor.id,
        markupPct,
        vendorCost: bestPrice,
        pickupCost: bestVendor.pickup_cost ?? 0,
        // Copy print specs for buildCustomerSpecs to work on PDF/email
        ...inhouseMeta,
        production: "ohp",
      },
    })
    setPushed(true); setTimeout(() => setPushed(false), 2500)
  }, [bid, bestPrice, bestVendor, markupPct, quote])

  // Is in-house cheaper?
  const inhouseWins = inhouseCost != null && bestPrice != null && inhouseCost <= bestPrice
  const ohpWins = bestPrice != null && (inhouseCost == null || bestPrice < inhouseCost)

  return (
    <div className="rounded-2xl border border-border overflow-hidden bg-card">
      {/* HEADER */}
      <div className="px-5 py-3.5 flex items-center justify-between bg-secondary/20 border-b border-border">
        <div className="min-w-0 flex-1">
          <h4 className="text-lg font-black text-foreground leading-snug">{bid.item_label}</h4>
          {bid.item_description && <p className="text-sm text-muted-foreground mt-0.5">{bid.item_description}</p>}
          {/* Full print specs from quote metadata */}
          {(() => {
            const specLines = buildFullDescription(bid, matchedPiece, qty, quote.items as any).split("\n").filter(l => !l.startsWith("Job:") && !l.startsWith("Qty:"))
            return specLines.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {specLines.map((line, i) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-secondary/80 text-xs font-semibold text-muted-foreground leading-snug">{line}</span>
                ))}
              </div>
            ) : null
          })()}
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-3">
          <button
            onClick={async () => {
              const text = buildFullDescription(bid, matchedPiece, qty, quote.items as any)
              try { await navigator.clipboard.writeText(text) } catch { /* fallback */ }
              setDescCopied(true); setTimeout(() => setDescCopied(false), 2000)
            }}
            className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-secondary transition-colors"
            title="Copy full description"
          >
            {descCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <ClipboardCopy className="h-4 w-4" />}
          </button>
          <button onClick={deleteBid} disabled={deleting}
            className="p-1.5 rounded-lg text-muted-foreground/30 hover:text-destructive hover:bg-destructive/5 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* "BOTH" COMPARISON: In-House vs OHP Best -- big bold split */}
      {isBoth && (
        <div className="grid grid-cols-2 border-b border-border">
          <div className={`px-5 py-3 text-center border-r border-border transition-colors ${inhouseWins ? "bg-emerald-50" : "bg-card"}`}>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">In-House</p>
            <p className={`text-2xl font-black font-mono tabular-nums mt-0.5 ${inhouseWins ? "text-emerald-600" : "text-foreground"}`}>
              {inhouseCost != null ? formatCurrency(inhouseCost) : "---"}
            </p>
            {inhouseWins && <p className="text-xs font-bold text-emerald-600 mt-0.5">BEST PRICE</p>}
          </div>
          <div className={`px-5 py-3 text-center transition-colors ${ohpWins ? "bg-emerald-50" : "bg-card"}`}>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">OHP Best</p>
            <p className={`text-2xl font-black font-mono tabular-nums mt-0.5 ${ohpWins ? "text-emerald-600" : "text-foreground"}`}>
              {bestPrice != null ? formatCurrency(bestPrice) : "---"}
            </p>
            {ohpWins && <p className="text-xs font-bold text-emerald-600 mt-0.5">BEST PRICE</p>}
          </div>
        </div>
      )}

      {/* COLUMN LABELS -- desktop only */}
      {(prices?.length ?? 0) > 0 && (
        <div className="hidden sm:flex px-5 pt-3 pb-1 items-center gap-3 text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
          <span className="w-32 shrink-0">Vendor</span>
          <span className="w-16 shrink-0 text-center">Qty</span>
          <span className="w-20 shrink-0">Ref #</span>
          <span className="w-24 shrink-0 text-right">Price</span>
          <span className="w-24 shrink-0 text-right">Customer</span>
          <span className="ml-auto" />
        </div>
      )}

      {/* VENDOR ROWS */}
      <div className="divide-y divide-border/40">
        {prices?.map((p) => {
          const vendor = vendors.find((v) => v.id === p.vendor_id)
          const vName = vendor?.company_name ?? "Unknown"
          const vPickup = vendor?.pickup_cost ?? 0
          const price = p.price != null ? Number(p.price) : null
          const isBest = price != null && price === bestPrice
          const customerTotal = price != null ? price * (1 + markupPct / 100) + vPickup : null

          return (
            <VendorRow key={p.id} entry={p} vendorName={vName} pickupCost={vPickup}
              isBest={isBest} markupPct={markupPct} customerTotal={customerTotal}
              orderQty={qty}
              onUpdate={(pr, qn) => updatePrice(p.id, pr, qn)}
              onRemove={() => removePrice(p.id)} />
          )
        })}
      </div>

      {/* ADD VENDOR -- always available, no "all added" blocking */}
      <div className="px-4 sm:px-5 py-2.5 border-t border-border/40 bg-secondary/5 flex items-center gap-2">
        <Select value="" onValueChange={(v) => quickAddVendor(v)}>
          <SelectTrigger className="h-10 sm:h-9 text-sm flex-1 rounded-xl sm:max-w-[16rem]">
            <SelectValue placeholder={addingVendor ? "Adding..." : "+ Add vendor"} />
          </SelectTrigger>
          <SelectContent>
            {(vendors ?? []).filter((v) => !v.is_internal).map((v) => (
              <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {addingVendor && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {/* PUSH TO QUOTE BAR -- auto shows when there's a best price, no "award" needed */}
      {bestPrice != null && (
        <div className="px-4 sm:px-5 py-3.5 bg-foreground text-background border-t border-foreground/10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-background/40 block">Best</span>
                <span className="text-lg font-black font-mono tabular-nums">{formatCurrency(bestPrice)}</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-background/20 hidden sm:block" />
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-background/40">+</span>
                <input type="number" step="1" min="0" max="200" value={markupPct}
                  onChange={(e) => setMarkupPct(parseFloat(e.target.value) || 0)}
                  className="w-14 h-8 text-sm text-center rounded-md bg-background/10 border border-background/20 text-background font-mono font-bold" />
                <span className="text-xs text-background/50 font-bold">%</span>
              </div>
              {bestPickup > 0 && (
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-background/40 block">Pickup</span>
                  <span className="text-sm font-mono font-bold text-background/70">{formatCurrency(bestPickup)}</span>
                </div>
              )}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-background/40 block">Customer</span>
                <span className="text-xl font-black font-mono tabular-nums">{bestCustomerTotal != null ? formatCurrency(bestCustomerTotal) : "---"}</span>
              </div>
            </div>
            <button onClick={handlePushToQuote} disabled={pushed}
              className="h-11 px-5 rounded-xl bg-background text-foreground text-sm font-black flex items-center justify-center gap-2 hover:bg-background/90 disabled:opacity-50 transition-all w-full sm:w-auto min-h-[44px]">
              {pushed ? <><Check className="h-4 w-4" /> Added</> : <><ShoppingCart className="h-4 w-4" /> Add to Quote</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════
   VendorRow -- compact inline row per vendor
   ═══════════════════════════════════════════════ */
function VendorRow({ entry, vendorName, pickupCost, isBest, markupPct, customerTotal, orderQty, onUpdate, onRemove }: {
  entry: VendorBidPrice; vendorName: string; pickupCost: number;
  isBest: boolean; markupPct: number; customerTotal: number | null; orderQty: number;
  onUpdate: (price: number | null, quoteNum?: string) => void; onRemove: () => void
}) {
  const [editPrice, setEditPrice] = useState(entry.price != null ? String(entry.price) : "")
  const [quoteNum, setQuoteNum] = useState(entry.notes ?? "")
  const [qty, setQty] = useState(String(orderQty))
  const [saving, setSaving] = useState(false)
  const priceRef = useRef(editPrice)
  const quoteNumRef = useRef(quoteNum)
  priceRef.current = editPrice
  quoteNumRef.current = quoteNum

  const handleSave = useCallback(async () => {
    const num = parseFloat(priceRef.current)
    if (!isNaN(num) && num >= 0) {
      setSaving(true)
      await onUpdate(num, quoteNumRef.current)
      setSaving(false)
    }
  }, [onUpdate])

  return (
    <div className={`px-4 sm:px-5 py-3 transition-colors ${isBest ? "bg-emerald-50" : ""}`}>
      {/* DESKTOP: single row */}
      <div className="hidden sm:flex items-center gap-3">
        <div className="min-w-0 w-32 shrink-0">
          <div className="flex items-center gap-1.5">
            {isBest && <Star className="h-3.5 w-3.5 text-emerald-600 fill-emerald-600 shrink-0" />}
            <span className="text-sm font-bold text-foreground truncate">{vendorName}</span>
          </div>
          {pickupCost > 0 && <span className="text-xs font-medium text-muted-foreground">+{formatCurrency(pickupCost)} pickup</span>}
        </div>
        <div className="w-16 shrink-0">
          <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)}
            className="h-8 w-full text-xs text-center rounded-lg border border-border bg-background px-1 font-mono font-bold tabular-nums" />
        </div>
        <div className="w-20 shrink-0">
          <input type="text" value={quoteNum} onChange={(e) => setQuoteNum(e.target.value)}
            onBlur={handleSave} placeholder="Ref #"
            className="h-8 w-full text-xs rounded-lg border border-border bg-background px-2 font-mono placeholder:text-muted-foreground/40" />
        </div>
        <div className="w-24 shrink-0">
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
            <input type="number" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)}
              onBlur={handleSave} onKeyDown={(e) => e.key === "Enter" && handleSave()} placeholder="0"
              className={`h-8 w-full text-sm text-right rounded-lg border bg-background pl-5 pr-2 font-mono font-bold tabular-nums ${isBest ? "border-emerald-300 bg-emerald-50" : "border-border"}`} />
          </div>
        </div>
        <div className="w-24 text-right shrink-0">
          <p className={`text-sm font-black font-mono tabular-nums ${isBest ? "text-emerald-700" : "text-foreground"}`}>
            {customerTotal != null ? formatCurrency(customerTotal) : "---"}
          </p>
          <p className="text-xs text-muted-foreground">customer</p>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          {isBest && <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md uppercase tracking-wider">Best</span>}
          <button onClick={onRemove} className="p-1.5 rounded-lg text-muted-foreground/30 hover:text-destructive hover:bg-destructive/5 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* MOBILE: stacked card */}
      <div className="flex sm:hidden flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {isBest && <Star className="h-3.5 w-3.5 text-emerald-600 fill-emerald-600 shrink-0" />}
            <span className="text-sm font-bold text-foreground">{vendorName}</span>
            {pickupCost > 0 && <span className="text-xs font-medium text-muted-foreground ml-1">+{formatCurrency(pickupCost)}</span>}
          </div>
          <div className="flex items-center gap-1">
            {isBest && <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md uppercase">Best</span>}
            <button onClick={onRemove} className="p-2 rounded-lg text-muted-foreground/40 hover:text-destructive min-h-[44px] min-w-[44px] flex items-center justify-center">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Qty</label>
            <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)}
              className="h-10 w-full text-sm text-center rounded-lg border border-border bg-background px-1 font-mono font-bold tabular-nums" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Ref #</label>
            <input type="text" value={quoteNum} onChange={(e) => setQuoteNum(e.target.value)}
              onBlur={handleSave} placeholder="---"
              className="h-10 w-full text-sm rounded-lg border border-border bg-background px-2 font-mono" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Price</label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <input type="number" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)}
                onBlur={handleSave} onKeyDown={(e) => e.key === "Enter" && handleSave()} placeholder="0"
                className={`h-10 w-full text-sm text-right rounded-lg border bg-background pl-6 pr-2 font-mono font-bold tabular-nums ${isBest ? "border-emerald-300 bg-emerald-50" : "border-border"}`} />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">Customer total:</span>
          <span className={`text-base font-black font-mono tabular-nums ${isBest ? "text-emerald-700" : "text-foreground"}`}>
            {customerTotal != null ? formatCurrency(customerTotal) : "---"}
          </span>
        </div>
      </div>
    </div>
  )
}
