"use client"

import { useState, useCallback, useMemo } from "react"
import useSWR from "swr"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  X, Plus, Loader2, Trophy, Send, ShoppingCart, Check, ArrowRight,
} from "lucide-react"
import { formatCurrency } from "@/lib/pricing"
import { useQuote } from "@/lib/quote-context"
import { useMailing, PIECE_TYPE_META, getFlatSize, type MailPiece } from "@/lib/mailing-context"
import type { VendorBid, VendorBidPrice, Vendor } from "@/lib/vendor-types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function describePiece(piece: MailPiece, qty: number) {
  const meta = PIECE_TYPE_META[piece.type]
  const sizeStr = piece.width && piece.height ? `${piece.width}" x ${piece.height}"` : ""
  const flat = getFlatSize(piece)
  const flatStr = flat.w && flat.h && (flat.w !== piece.width || flat.h !== piece.height) ? ` (flat: ${flat.w}" x ${flat.h}")` : ""
  const label = `${qty.toLocaleString()} - ${sizeStr} ${meta.label}${flatStr}`
  const parts: string[] = []
  if (piece.envelopeId && piece.envelopeId !== "custom") parts.push(piece.envelopeId)
  const category = meta.calc === "booklet" ? "booklet" : meta.calc === "envelope" ? "envelope" : "flat"
  return { label, desc: parts.join(" | "), category }
}

interface Props { quoteId: string; onClose?: () => void; inline?: boolean }

export function VendorBidPanel({ quoteId, onClose, inline }: Props) {
  const { data: bids, isLoading, mutate: mutateBids } = useSWR<VendorBid[]>(`/api/vendor-bids?quote_id=${quoteId}`, fetcher)
  const { data: vendors } = useSWR<Vendor[]>("/api/vendors", fetcher)
  const mailing = useMailing()
  const quote = useQuote()

  const ohpPieces = mailing.pieces.filter((p) => p.production === "ohp" || p.production === "both")

  // Auto-create bids for planner pieces that don't have one yet
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

  // Manual bid
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

  // Get in-house cost for a piece from quote items
  const getInhouseCost = useCallback((piece: MailPiece): number | null => {
    const meta = PIECE_TYPE_META[piece.type]
    const cat = meta.calc === "booklet" ? "booklet" : "flat"
    const sizeStr = piece.width && piece.height ? `${piece.width}" x ${piece.height}"` : ""
    const match = quote.items.find((i) => i.category === cat && i.label.includes(sizeStr))
    return match ? match.amount : null
  }, [quote.items])

  const content = (
    <div className="flex flex-col gap-5">
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* ── Planner pieces that still need bids ── */}
          {ohpPieces.some((p) => !existingLabels.has(describePiece(p, mailing.quantity).label)) && (
            <div className="flex flex-wrap gap-2">
              {ohpPieces.filter((p) => !existingLabels.has(describePiece(p, mailing.quantity).label)).map((piece) => {
                const meta = PIECE_TYPE_META[piece.type]
                const { label } = describePiece(piece, mailing.quantity)
                const busy = autoCreating.has(piece.id)
                return (
                  <button key={piece.id} onClick={() => autoCreateBid(piece)} disabled={busy}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-border bg-card hover:border-foreground/30 hover:bg-secondary/30 transition-all text-left">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${meta.color}`}>{meta.short}</span>
                    <span className="text-sm font-semibold text-foreground">{label}</span>
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> :
                      <Plus className="h-3.5 w-3.5 text-muted-foreground ml-1" />}
                  </button>
                )
              })}
            </div>
          )}

          {/* ── Active bid cards ── */}
          {bids?.map((bid) => (
            <BidCard key={bid.id} bid={bid} vendors={vendors ?? []} quote={quote}
              ohpPieces={ohpPieces} qty={mailing.quantity} getInhouseCost={getInhouseCost}
              onUpdate={() => mutateBids()} />
          ))}

          {/* ── Empty state ── */}
          {(!bids || bids.length === 0) && ohpPieces.length === 0 && !showManual && (
            <div className="text-center py-16">
              <Send className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-base font-bold text-foreground">No OHP pieces</p>
              <p className="text-sm text-muted-foreground mt-1">Mark pieces as "OHP" or "Both" in the Planner.</p>
            </div>
          )}

          {/* ── Manual bid ── */}
          {showManual ? (
            <div className="flex items-center gap-2">
              <Input value={manualLabel} onChange={(e) => setManualLabel(e.target.value)}
                placeholder="Custom job description..." className="flex-1 h-10 text-sm rounded-xl" autoFocus
                onKeyDown={(e) => e.key === "Enter" && createManualBid()} />
              <button onClick={createManualBid} disabled={manualCreating || !manualLabel.trim()}
                className="h-10 px-4 rounded-xl bg-foreground text-background text-sm font-bold hover:bg-foreground/90 disabled:opacity-40 transition-all">
                Create
              </button>
              <button onClick={() => setShowManual(false)} className="h-10 px-3 rounded-xl text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
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
        <p className="text-sm text-muted-foreground mt-0.5">Get vendor prices, compare with in-house, push to quote.</p>
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

/* ═══════════════════════════════════════════════════════
   BidCard -- ONE card per piece, everything visible
   ═══════════════════════════════════════════════════════ */
function BidCard({ bid, vendors, quote, ohpPieces, qty, getInhouseCost, onUpdate }: {
  bid: VendorBid; vendors: Vendor[]; quote: ReturnType<typeof useQuote>;
  ohpPieces: MailPiece[]; qty: number; getInhouseCost: (p: MailPiece) => number | null;
  onUpdate: () => void
}) {
  const { data: prices, mutate: mutatePrices } = useSWR<VendorBidPrice[]>(`/api/vendor-bids/${bid.id}/prices`, fetcher)
  const [quickVendorId, setQuickVendorId] = useState("")
  const [markupPct, setMarkupPct] = useState(20)
  const [pushed, setPushed] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const existingVendorIds = new Set(prices?.map((p) => p.vendor_id) ?? [])
  const availableVendors = vendors.filter((v) => !existingVendorIds.has(v.id))

  // Quick-add vendor: select -> instantly added
  const quickAddVendor = async (vendorId: string) => {
    setQuickVendorId(vendorId)
    await fetch(`/api/vendor-bids/${bid.id}/prices`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendor_id: vendorId }),
    })
    setQuickVendorId(""); mutatePrices()
  }

  const updatePrice = async (priceId: string, price: number | null, quoteNum?: string) => {
    await fetch(`/api/bid-prices/${priceId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price, notes: quoteNum || null, status: price != null ? "received" : "pending", responded_at: price != null ? new Date().toISOString() : null }),
    })
    mutatePrices()
  }

  const awardBid = async (vendorId: string, price: number) => {
    await fetch(`/api/vendor-bids/${bid.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "awarded", winning_vendor_id: vendorId, winning_price: price }),
    })
    onUpdate()
  }

  const removePrice = async (priceId: string) => {
    await fetch(`/api/bid-prices/${priceId}`, { method: "DELETE" }); mutatePrices()
  }

  const deleteBid = async () => {
    setDeleting(true)
    await fetch(`/api/vendor-bids/${bid.id}`, { method: "DELETE" }); onUpdate()
  }

  const handlePushToQuote = useCallback(() => {
    if (bid.winning_price == null || !bid.winning_vendor_id) return
    const winVendor = vendors.find((v) => v.id === bid.winning_vendor_id)
    const pickupCost = winVendor?.pickup_cost ?? 100
    const base = Number(bid.winning_price)
    const markedUp = base * (1 + markupPct / 100) + pickupCost
    quote.addItem({
      category: "ohp",
      label: `OHP: ${bid.item_label}`,
      description: `${winVendor?.company_name ?? "Vendor"} | Markup ${markupPct}%`,
      amount: markedUp,
    })
    setPushed(true); setTimeout(() => setPushed(false), 2500)
  }, [bid, vendors, markupPct, quote])

  // Find matching planner piece for "Both" comparison
  const matchedPiece = ohpPieces.find((p) => {
    const { label } = describePiece(p, qty)
    return label === bid.item_label
  })
  const isBoth = matchedPiece?.production === "both"
  const inhouseCost = matchedPiece ? getInhouseCost(matchedPiece) : null

  // Best received price
  const receivedPrices = prices?.filter((p) => p.price != null) ?? []
  const cheapestPrice = receivedPrices.length > 0 ? Math.min(...receivedPrices.map((p) => Number(p.price))) : null

  // Award info
  const winVendor = bid.winning_vendor_id ? vendors.find((v) => v.id === bid.winning_vendor_id) : null
  const isAwarded = bid.status === "awarded" && bid.winning_price != null
  const awardedPrice = isAwarded ? Number(bid.winning_price) : 0
  const pickupCost = winVendor?.pickup_cost ?? 100
  const customerTotal = isAwarded ? awardedPrice * (1 + markupPct / 100) + pickupCost : 0

  return (
    <div className="rounded-2xl border border-border overflow-hidden bg-card">
      {/* ── HEADER: piece name + specs + delete ── */}
      <div className="px-5 py-4 border-b border-border bg-secondary/20">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="text-base font-black text-foreground leading-tight">{bid.item_label}</h4>
            {bid.item_description && (
              <p className="text-sm text-muted-foreground mt-0.5">{bid.item_description}</p>
            )}
          </div>
          {isAwarded && winVendor && (
            <div className="flex items-center gap-1.5 shrink-0 bg-emerald-500/10 text-emerald-700 px-3 py-1.5 rounded-xl">
              <Trophy className="h-3.5 w-3.5" />
              <span className="text-sm font-black">{winVendor.company_name}</span>
            </div>
          )}
          <button onClick={deleteBid} disabled={deleting}
            className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/5 transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── "Both" comparison bar ── */}
        {isBoth && (
          <div className="mt-3 flex items-center gap-0 rounded-xl overflow-hidden border border-border">
            <div className={`flex-1 px-4 py-2.5 text-center ${
              inhouseCost != null && (cheapestPrice == null || inhouseCost <= cheapestPrice)
                ? "bg-emerald-500/10 border-r border-emerald-500/20" : "bg-card border-r border-border"
            }`}>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">In-House</p>
              <p className={`text-lg font-black font-mono tabular-nums mt-0.5 ${
                inhouseCost != null && (cheapestPrice == null || inhouseCost <= cheapestPrice) ? "text-emerald-700" : "text-foreground"
              }`}>
                {inhouseCost != null ? formatCurrency(inhouseCost) : "---"}
              </p>
            </div>
            <div className={`flex-1 px-4 py-2.5 text-center ${
              cheapestPrice != null && (inhouseCost == null || cheapestPrice < inhouseCost)
                ? "bg-emerald-500/10" : "bg-card"
            }`}>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">OHP Best</p>
              <p className={`text-lg font-black font-mono tabular-nums mt-0.5 ${
                cheapestPrice != null && (inhouseCost == null || cheapestPrice < inhouseCost) ? "text-emerald-700" : "text-foreground"
              }`}>
                {cheapestPrice != null ? formatCurrency(cheapestPrice) : "---"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── VENDOR ROWS: each vendor is one clean row ── */}
      <div className="divide-y divide-border/50">
        {prices?.map((p) => {
          const vendor = vendors.find((v) => v.id === p.vendor_id)
          const vName = vendor?.company_name ?? "Unknown"
          const vPickup = vendor?.pickup_cost ?? 100
          const isCheapest = p.price != null && Number(p.price) === cheapestPrice
          const isWinner = bid.winning_vendor_id === p.vendor_id

          return (
            <VendorRow key={p.id} entry={p} vendorName={vName} pickupCost={vPickup}
              isCheapest={isCheapest} isWinner={isWinner} bidAwarded={isAwarded}
              markupPct={markupPct}
              onUpdate={(price, quoteNum) => updatePrice(p.id, price, quoteNum)}
              onAward={(price) => awardBid(p.vendor_id, price)}
              onRemove={() => removePrice(p.id)} />
          )
        })}
      </div>

      {/* ── QUICK ADD VENDOR: one-step dropdown ── */}
      <div className="px-5 py-3 border-t border-border/50 bg-secondary/5">
        {availableVendors.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground shrink-0">Add vendor:</span>
            <Select value="" onValueChange={(v) => quickAddVendor(v)}>
              <SelectTrigger className="h-9 text-sm flex-1 rounded-xl max-w-xs">
                <SelectValue placeholder={quickVendorId ? "Adding..." : "Select vendor..."} />
              </SelectTrigger>
              <SelectContent>
                {availableVendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {quickVendorId && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        ) : vendors.length > 0 ? (
          <p className="text-xs text-muted-foreground text-center">All vendors added</p>
        ) : (
          <p className="text-xs text-muted-foreground text-center">No vendors configured yet</p>
        )}
      </div>

      {/* ── PUSH TO QUOTE BAR ── */}
      {isAwarded && (
        <div className="px-5 py-4 bg-foreground text-background border-t border-foreground/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-background/50">Vendor Cost</p>
                <p className="text-lg font-black font-mono tabular-nums">{formatCurrency(awardedPrice)}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-background/30" />
              <div className="flex items-center gap-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-background/50 mr-1">Markup</p>
                <input type="number" step="1" min="0" max="200" value={markupPct}
                  onChange={(e) => setMarkupPct(parseFloat(e.target.value) || 0)}
                  className="w-14 h-8 text-sm text-center rounded-lg bg-background/10 border border-background/20 text-background font-mono font-bold" />
                <span className="text-sm text-background/70 font-bold">%</span>
              </div>
              <ArrowRight className="h-4 w-4 text-background/30" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-background/50">+ Pickup</p>
                <p className="text-sm font-mono font-bold text-background/80">{formatCurrency(pickupCost)}</p>
              </div>
            </div>
            <div className="text-right flex items-center gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-background/50">Customer Total</p>
                <p className="text-2xl font-black font-mono tabular-nums">{formatCurrency(customerTotal)}</p>
              </div>
              <button onClick={handlePushToQuote} disabled={pushed}
                className="h-11 px-5 rounded-xl bg-background text-foreground text-sm font-black flex items-center gap-2 hover:bg-background/90 disabled:opacity-50 transition-all">
                {pushed ? <><Check className="h-4 w-4" /> Added</> : <><ShoppingCart className="h-4 w-4" /> Add to Quote</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   VendorRow -- one clean inline row per vendor
   ═══════════════════════════════════════════════════════ */
function VendorRow({ entry, vendorName, pickupCost, isCheapest, isWinner, bidAwarded, markupPct, onUpdate, onAward, onRemove }: {
  entry: VendorBidPrice; vendorName: string; pickupCost: number;
  isCheapest: boolean; isWinner: boolean; bidAwarded: boolean; markupPct: number;
  onUpdate: (price: number | null, quoteNum?: string) => void;
  onAward: (price: number) => void; onRemove: () => void
}) {
  const [editPrice, setEditPrice] = useState(entry.price != null ? String(entry.price) : "")
  const [quoteNum, setQuoteNum] = useState(entry.notes ?? "")

  const handleSave = () => {
    const num = parseFloat(editPrice)
    if (!isNaN(num) && num >= 0) onUpdate(num, quoteNum)
  }

  const price = entry.price != null ? Number(entry.price) : null
  const customerPrice = price != null ? price * (1 + markupPct / 100) + pickupCost : null

  return (
    <div className={`px-5 py-3 flex items-center gap-4 ${
      isWinner ? "bg-emerald-500/5" : isCheapest ? "bg-amber-500/5" : ""
    }`}>
      {/* Vendor name + trophy */}
      <div className="min-w-0 w-36 shrink-0">
        <div className="flex items-center gap-1.5">
          {isWinner && <Trophy className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
          <span className="text-sm font-bold text-foreground truncate">{vendorName}</span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">+{formatCurrency(pickupCost)} pickup</span>
      </div>

      {/* Quote # */}
      <div className="w-24 shrink-0">
        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-0.5">Quote #</label>
        <input type="text" value={quoteNum} onChange={(e) => setQuoteNum(e.target.value)}
          onBlur={handleSave} placeholder="---"
          className="h-8 w-full text-sm rounded-lg border border-border bg-background px-2 font-mono" />
      </div>

      {/* Price */}
      <div className="w-28 shrink-0">
        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-0.5">Price</label>
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
          <input type="number" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)}
            onBlur={handleSave} onKeyDown={(e) => e.key === "Enter" && handleSave()} placeholder="0.00"
            className="h-8 w-full text-sm text-right rounded-lg border border-border bg-background pl-5 pr-2 font-mono font-bold tabular-nums" />
        </div>
      </div>

      {/* Customer price */}
      <div className="w-24 text-right shrink-0">
        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-0.5">Customer</label>
        <p className="text-sm font-black font-mono tabular-nums text-foreground h-8 flex items-center justify-end">
          {customerPrice != null ? formatCurrency(customerPrice) : "---"}
        </p>
      </div>

      {/* Award + remove */}
      <div className="flex items-center gap-1 ml-auto">
        {price != null && !bidAwarded && (
          <button onClick={() => onAward(price)}
            className="h-8 px-3 rounded-lg bg-foreground text-background text-xs font-black hover:bg-foreground/90 transition-colors flex items-center gap-1">
            <Trophy className="h-3 w-3" /> Award
          </button>
        )}
        <button onClick={onRemove} className="p-1.5 rounded-lg text-muted-foreground/30 hover:text-destructive hover:bg-destructive/5 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
