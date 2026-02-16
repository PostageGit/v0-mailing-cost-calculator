"use client"

import { useState, useCallback } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  X, Plus, Loader2, Trophy, Send, Factory, ChevronDown, ChevronUp,
  Check, ShoppingCart, Truck, Zap, Hash,
} from "lucide-react"
import { formatCurrency } from "@/lib/pricing"
import { useQuote } from "@/lib/quote-context"
import { useMailing, PIECE_TYPE_META, getFlatSize, type MailPiece } from "@/lib/mailing-context"
import type { VendorBid, VendorBidPrice, Vendor } from "@/lib/vendor-types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function describePiece(piece: MailPiece, qty: number) {
  const meta = PIECE_TYPE_META[piece.type]
  const flat = getFlatSize(piece)
  const sizeStr = piece.width && piece.height ? `${piece.width}" x ${piece.height}"` : ""
  const flatStr = flat.w && flat.h && (flat.w !== piece.width || flat.h !== piece.height) ? ` (flat: ${flat.w}" x ${flat.h}")` : ""
  const label = `${qty.toLocaleString()} - ${sizeStr} ${meta.label}${flatStr}`
  const parts: string[] = []
  if (piece.foldType && piece.foldType !== "none") parts.push(`Fold: ${piece.foldType}`)
  if (piece.envelopeKind) parts.push(`Kind: ${piece.envelopeKind}`)
  if (piece.envelopeId && piece.envelopeId !== "custom") parts.push(`Size: ${piece.envelopeId}`)
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
  const bothPieces = mailing.pieces.filter((p) => p.production === "both")
  const existingBidLabels = new Set(bids?.map((b) => b.item_label) ?? [])

  const [showNew, setShowNew] = useState(false)
  const [newLabel, setNewLabel] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [creating, setCreating] = useState(false)
  const [creatingPieceId, setCreatingPieceId] = useState<string | null>(null)

  const createBid = async (label?: string, desc?: string, category?: string) => {
    const finalLabel = label || newLabel.trim()
    if (!finalLabel) return
    setCreating(true)
    await fetch("/api/vendor-bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quote_id: quoteId, item_label: finalLabel, item_description: desc || newDesc.trim() || null, item_category: category || "flat" }),
    })
    setNewLabel(""); setNewDesc(""); setShowNew(false)
    mutateBids(); setCreating(false); setCreatingPieceId(null)
  }

  const createBidFromPiece = async (piece: MailPiece) => {
    setCreatingPieceId(piece.id)
    const { label, desc, category } = describePiece(piece, mailing.quantity)
    await createBid(label, desc, category)
  }

  // Get in-house cost for a "Both" piece from the quote items (flat/booklet categories)
  const getInhouseCost = (piece: MailPiece): number | null => {
    const meta = PIECE_TYPE_META[piece.type]
    const cat = meta.calc === "booklet" ? "booklet" : "flat"
    const sizeStr = piece.width && piece.height ? `${piece.width}" x ${piece.height}"` : ""
    const match = quote.items.find((i) => i.category === cat && i.label.includes(sizeStr))
    return match ? match.amount : null
  }

  const inner = (
    <div className="flex flex-col gap-3">
      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Active bids */}
          {bids?.map((bid) => (
            <BidCard key={bid.id} bid={bid} vendors={vendors ?? []} onUpdate={() => mutateBids()} />
          ))}

          {/* OHP pieces from planner */}
          {ohpPieces.length > 0 && (
            <div className="rounded-xl border border-dashed border-border p-3">
              <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                <Zap className="h-3 w-3" /> Planner Pieces
              </p>
              {ohpPieces.map((piece) => {
                const meta = PIECE_TYPE_META[piece.type]
                const { label } = describePiece(piece, mailing.quantity)
                const exists = existingBidLabels.has(label)
                const busy = creatingPieceId === piece.id
                const inhouseCost = piece.production === "both" ? getInhouseCost(piece) : null
                return (
                  <div key={piece.id} className="flex items-center gap-2 py-1.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${meta.color}`}>{meta.short}</span>
                    <span className="text-xs font-medium text-foreground flex-1 min-w-0 truncate">{label}</span>
                    {inhouseCost != null && (
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">in-house {formatCurrency(inhouseCost)}</span>
                    )}
                    {exists ? (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 shrink-0"><Check className="h-3 w-3" /> Done</span>
                    ) : busy ? (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
                    ) : (
                      <button onClick={() => createBidFromPiece(piece)}
                        className="text-[10px] font-bold text-foreground bg-secondary hover:bg-secondary/80 px-2 py-0.5 rounded-md shrink-0 transition-colors">
                        + Bid
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* "Both" comparison */}
          {bothPieces.length > 0 && bids && bids.length > 0 && (
            <ComparisonTable pieces={bothPieces} bids={bids} vendors={vendors ?? []} quote={quote} qty={mailing.quantity} />
          )}

          {(!bids || bids.length === 0) && ohpPieces.length === 0 && !showNew && (
            <div className="text-center py-8">
              <Send className="h-5 w-5 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm font-medium text-muted-foreground">No OHP pieces yet</p>
              <p className="text-xs text-muted-foreground mt-1">Mark pieces as OHP in the Planner, or add manually.</p>
            </div>
          )}

          {showNew && (
            <div className="rounded-xl border border-border p-3 flex flex-col gap-2">
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Job description..." className="h-9 text-sm rounded-lg" autoFocus />
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Paper, colors, finishing..." className="h-9 text-sm rounded-lg" />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => createBid()} disabled={creating || !newLabel.trim()}
                  className="gap-1.5 rounded-lg h-8 text-xs"><Plus className="h-3 w-3" /> Create</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowNew(false)} className="rounded-lg h-8 text-xs">Cancel</Button>
              </div>
            </div>
          )}

          {!showNew && (
            <button onClick={() => setShowNew(true)}
              className="w-full flex items-center justify-center gap-1.5 h-9 rounded-xl border border-dashed border-border text-xs font-medium text-muted-foreground hover:border-foreground/20 hover:text-foreground transition-all">
              <Plus className="h-3 w-3" /> Manual Bid
            </button>
          )}
        </>
      )}
    </div>
  )

  if (inline) {
    return (
      <div className="w-full">
        <div className="mb-4">
          <h3 className="text-base font-bold text-foreground">Out of House Production</h3>
          <p className="text-sm text-muted-foreground">Compare vendor prices, mark up, and add to quote.</p>
        </div>
        {inner}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-foreground/10 backdrop-blur-sm flex items-start justify-center p-4 pt-[4vh] overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-base font-bold text-foreground">Out of House Production</h3>
            <p className="text-sm text-muted-foreground">Compare vendor prices and push to quote.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5">{inner}</div>
      </div>
    </div>
  )
}

/* ═══ Comparison Table for "Both" pieces ═══ */
function ComparisonTable({ pieces, bids, vendors, quote, qty }: {
  pieces: MailPiece[]; bids: VendorBid[]; vendors: Vendor[]; quote: ReturnType<typeof useQuote>; qty: number
}) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="bg-secondary/30 px-3 py-2 border-b border-border">
        <p className="text-xs font-bold text-foreground">In-House vs OHP Comparison</p>
      </div>
      <div className="divide-y divide-border">
        {pieces.map((piece) => {
          const meta = PIECE_TYPE_META[piece.type]
          const { label } = describePiece(piece, qty)
          const cat = meta.calc === "booklet" ? "booklet" : "flat"
          const sizeStr = piece.width && piece.height ? `${piece.width}" x ${piece.height}"` : ""
          const inhouseItem = quote.items.find((i) => i.category === cat && i.label.includes(sizeStr))
          const inhouseCost = inhouseItem?.amount ?? null

          // Find matching bid
          const matchBid = bids.find((b) => b.item_label === label)
          const ohpCost = matchBid?.winning_price != null ? Number(matchBid.winning_price) : null
          const winVendor = matchBid?.winning_vendor_id ? vendors.find((v) => v.id === matchBid.winning_vendor_id) : null
          const pickup = winVendor?.pickup_cost ?? 100
          const ohpTotal = ohpCost != null ? ohpCost + pickup : null

          const cheaper = inhouseCost != null && ohpTotal != null
            ? inhouseCost < ohpTotal ? "inhouse" : ohpTotal < inhouseCost ? "ohp" : "tie"
            : null

          return (
            <div key={piece.id} className="px-3 py-2.5 grid grid-cols-[1fr_auto_auto] gap-3 items-center">
              <div className="min-w-0">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${meta.color} mr-1.5`}>{meta.short}</span>
                <span className="text-xs font-medium text-foreground">{sizeStr} {meta.label}</span>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground">In-House</p>
                <p className={`text-sm font-mono font-bold tabular-nums ${cheaper === "inhouse" ? "text-emerald-600" : "text-foreground"}`}>
                  {inhouseCost != null ? formatCurrency(inhouseCost) : "--"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground">OHP{ohpCost != null ? ` +${formatCurrency(pickup)} pickup` : ""}</p>
                <p className={`text-sm font-mono font-bold tabular-nums ${cheaper === "ohp" ? "text-emerald-600" : "text-foreground"}`}>
                  {ohpTotal != null ? formatCurrency(ohpTotal) : "--"}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═══ BidCard -- compact bid with inline vendor rows ═══ */
function BidCard({ bid, vendors, onUpdate }: { bid: VendorBid; vendors: Vendor[]; onUpdate: () => void }) {
  const quote = useQuote()
  const { data: prices, mutate: mutatePrices } = useSWR<VendorBidPrice[]>(`/api/vendor-bids/${bid.id}/prices`, fetcher)
  const [expanded, setExpanded] = useState(true)
  const [addingVendor, setAddingVendor] = useState(false)
  const [selectedVendorId, setSelectedVendorId] = useState("")
  const [saving, setSaving] = useState(false)
  const [markupPct, setMarkupPct] = useState(20)
  const [pushed, setPushed] = useState(false)

  const existingVendorIds = new Set(prices?.map((p) => p.vendor_id) ?? [])
  const availableVendors = vendors.filter((v) => !existingVendorIds.has(v.id))

  const addVendor = async () => {
    if (!selectedVendorId) return; setSaving(true)
    await fetch(`/api/vendor-bids/${bid.id}/prices`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vendor_id: selectedVendorId }) })
    setSelectedVendorId(""); setAddingVendor(false); mutatePrices(); setSaving(false)
  }

  const updatePrice = async (priceId: string, price: number | null, quoteNum?: string) => {
    await fetch(`/api/bid-prices/${priceId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price, notes: quoteNum || null, status: price != null ? "received" : "pending", responded_at: price != null ? new Date().toISOString() : null }),
    })
    mutatePrices()
  }

  const awardBid = async (vendorId: string, price: number) => {
    await fetch(`/api/vendor-bids/${bid.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "awarded", winning_vendor_id: vendorId, winning_price: price }) })
    onUpdate()
  }

  const removePrice = async (priceId: string) => { await fetch(`/api/bid-prices/${priceId}`, { method: "DELETE" }); mutatePrices() }
  const deleteBid = async () => { await fetch(`/api/vendor-bids/${bid.id}`, { method: "DELETE" }); onUpdate() }

  const handlePushToQuote = useCallback(() => {
    if (bid.winning_price == null || !bid.winning_vendor_id) return
    const winVendor = vendors.find((v) => v.id === bid.winning_vendor_id)
    const pickupCost = winVendor?.pickup_cost ?? 100
    const base = Number(bid.winning_price)
    const markedUp = base * (1 + markupPct / 100)
    const customerTotal = markedUp + pickupCost
    quote.addItem({ category: "ohp", label: `OHP: ${bid.item_label}`, description: `Vendor: ${winVendor?.company_name ?? "Unknown"} | Markup: ${markupPct}%`, amount: customerTotal })
    setPushed(true); setTimeout(() => setPushed(false), 2500)
  }, [bid, vendors, markupPct, quote])

  const receivedPrices = prices?.filter((p) => p.price != null) ?? []
  const cheapestPrice = receivedPrices.length > 0 ? Math.min(...receivedPrices.map((p) => Number(p.price))) : null
  const winVendor = bid.winning_vendor_id ? vendors.find((v) => v.id === bid.winning_vendor_id) : null
  const pickupCost = winVendor?.pickup_cost ?? 100
  const basePrice = bid.winning_price != null ? Number(bid.winning_price) : 0
  const markedUpPrice = basePrice * (1 + markupPct / 100)
  const customerTotal = markedUpPrice + pickupCost

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Header row -- tight, everything visible */}
      <button className="w-full flex items-center gap-2 px-3 py-2.5 text-left bg-secondary/20 hover:bg-secondary/40 transition-colors"
        onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground leading-tight truncate">{bid.item_label}</p>
          {bid.item_description && <p className="text-xs text-muted-foreground truncate mt-0.5">{bid.item_description}</p>}
        </div>
        {bid.status === "awarded" && winVendor && (
          <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 shrink-0">
            <Trophy className="h-3 w-3" /> {winVendor.company_name} {formatCurrency(basePrice)}
          </span>
        )}
        <span className="text-[10px] text-muted-foreground shrink-0">{prices?.length ?? 0} vendor{(prices?.length ?? 0) !== 1 ? "s" : ""}</span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-border">
          {/* Vendor price table -- tight grid */}
          {prices && prices.length > 0 && (
            <div className="divide-y divide-border/50">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_80px_80px_80px_auto] gap-2 px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-secondary/10">
                <span>Vendor</span>
                <span className="text-right">Quote #</span>
                <span className="text-right">Price</span>
                <span className="text-right">Customer</span>
                <span className="w-16"></span>
              </div>
              {prices.map((p) => {
                const vendor = vendors.find((v) => v.id === p.vendor_id)
                const vendorName = vendor?.company_name ?? "Unknown"
                const vPickup = vendor?.pickup_cost ?? 100
                const isCheapest = p.price != null && Number(p.price) === cheapestPrice
                const isWinner = bid.winning_vendor_id === p.vendor_id
                return (
                  <VendorRow key={p.id} entry={p} vendorName={vendorName} pickupCost={vPickup}
                    isCheapest={isCheapest} isWinner={isWinner} bidAwarded={bid.status === "awarded"}
                    markupPct={markupPct} onUpdatePrice={updatePrice}
                    onAward={(price) => awardBid(p.vendor_id, price)} onRemove={() => removePrice(p.id)} />
                )
              })}
            </div>
          )}

          {/* Award block */}
          {bid.status === "awarded" && bid.winning_price != null && (
            <div className="bg-foreground text-background px-3 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4 text-xs">
                  <span>Vendor: <strong className="font-mono">{formatCurrency(basePrice)}</strong></span>
                  <span className="flex items-center gap-1">
                    Markup:
                    <input type="number" step="1" min="0" max="200" value={markupPct}
                      onChange={(e) => setMarkupPct(parseFloat(e.target.value) || 0)}
                      className="w-12 h-6 text-xs text-center rounded bg-background/10 border border-background/20 text-background font-mono" />%
                  </span>
                  <span>Pickup: <strong className="font-mono">{formatCurrency(pickupCost)}</strong></span>
                </div>
                <span className="text-lg font-black font-mono tabular-nums">{formatCurrency(customerTotal)}</span>
              </div>
              <button onClick={handlePushToQuote} disabled={pushed}
                className="w-full h-9 rounded-lg bg-background text-foreground text-sm font-bold flex items-center justify-center gap-1.5 hover:bg-background/90 disabled:opacity-50 transition-all">
                {pushed ? <><Check className="h-3.5 w-3.5" /> Added</> : <><ShoppingCart className="h-3.5 w-3.5" /> Add to Quote -- {formatCurrency(customerTotal)}</>}
              </button>
            </div>
          )}

          {/* Add vendor + delete */}
          <div className="flex items-center gap-2 px-3 py-2 bg-secondary/5">
            {addingVendor ? (
              <>
                <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                  <SelectTrigger className="h-8 text-xs w-44 rounded-lg"><SelectValue placeholder="Select vendor..." /></SelectTrigger>
                  <SelectContent>
                    {availableVendors.map((v) => (<SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>))}
                    {availableVendors.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">All vendors added</div>}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={addVendor} disabled={saving || !selectedVendorId} className="h-8 gap-1 rounded-lg text-xs">
                  <Plus className="h-3 w-3" /> Add
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAddingVendor(false)} className="h-8 rounded-lg text-xs">Cancel</Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setAddingVendor(true)} className="h-8 gap-1 rounded-lg text-xs">
                  <Factory className="h-3 w-3" /> Add Vendor
                </Button>
                <Button variant="ghost" size="sm" onClick={deleteBid} className="h-8 gap-1 rounded-lg text-xs text-destructive hover:bg-destructive/10">
                  <X className="h-3 w-3" /> Remove
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══ Vendor Row -- inline within the table grid ═══ */
function VendorRow({ entry, vendorName, pickupCost, isCheapest, isWinner, bidAwarded, markupPct, onUpdatePrice, onAward, onRemove }: {
  entry: VendorBidPrice; vendorName: string; pickupCost: number; isCheapest: boolean; isWinner: boolean;
  bidAwarded: boolean; markupPct: number;
  onUpdatePrice: (id: string, price: number | null, quoteNum?: string) => void;
  onAward: (price: number) => void; onRemove: () => void
}) {
  const [editPrice, setEditPrice] = useState(entry.price != null ? String(entry.price) : "")
  const [quoteNum, setQuoteNum] = useState(entry.notes ?? "")

  const handleSave = () => {
    const num = parseFloat(editPrice)
    if (!isNaN(num) && num >= 0) onUpdatePrice(entry.id, num, quoteNum)
  }

  const price = entry.price != null ? Number(entry.price) : null
  const markedUp = price != null ? price * (1 + markupPct / 100) + pickupCost : null

  const rowBg = isWinner ? "bg-emerald-500/5" : isCheapest ? "bg-amber-500/5" : ""

  return (
    <div className={`grid grid-cols-[1fr_80px_80px_80px_auto] gap-2 px-3 py-2 items-center ${rowBg}`}>
      {/* Vendor */}
      <div className="min-w-0 flex items-center gap-1.5">
        {isWinner && <Trophy className="h-3 w-3 text-emerald-500 shrink-0" />}
        <span className="text-xs font-bold text-foreground truncate">{vendorName}</span>
        <span className="text-[10px] text-muted-foreground shrink-0 font-mono">+{formatCurrency(pickupCost)}</span>
      </div>

      {/* Quote # */}
      <input type="text" value={quoteNum} onChange={(e) => setQuoteNum(e.target.value)}
        onBlur={handleSave} placeholder="#"
        className="h-7 text-xs text-right rounded border border-border bg-background px-1.5 font-mono w-full" />

      {/* Price */}
      <div className="relative">
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
        <input type="number" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)}
          onBlur={handleSave} onKeyDown={(e) => e.key === "Enter" && handleSave()} placeholder="0"
          className="h-7 text-xs text-right rounded border border-border bg-background pl-4 pr-1.5 font-mono font-bold tabular-nums w-full" />
      </div>

      {/* Customer price */}
      <span className="text-xs font-mono font-bold tabular-nums text-right text-foreground">
        {markedUp != null ? formatCurrency(markedUp) : "--"}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-0.5 w-16 justify-end">
        {price != null && !bidAwarded && (
          <button onClick={() => onAward(price)}
            className="h-6 px-1.5 rounded bg-emerald-500/10 text-emerald-600 text-[10px] font-bold hover:bg-emerald-500/20 transition-colors flex items-center gap-0.5">
            <Trophy className="h-2.5 w-2.5" /> Award
          </button>
        )}
        <button onClick={onRemove} className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"><X className="h-3 w-3" /></button>
      </div>
    </div>
  )
}
