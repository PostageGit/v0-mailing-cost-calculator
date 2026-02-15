"use client"

import { useState, useCallback } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  X, Plus, Loader2, Trophy, Send, Factory, ChevronDown, ChevronUp,
  Check, ShoppingCart, Truck, Printer, BookOpen, Mail, Package,
} from "lucide-react"
import { formatCurrency } from "@/lib/pricing"
import { useQuote } from "@/lib/quote-context"
import type { VendorBid, VendorBidPrice, Vendor } from "@/lib/vendor-types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

// Type tag icons + colors
const TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  flat:     { icon: <Printer className="h-3 w-3" />,  label: "Flat Print",    color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  booklet:  { icon: <BookOpen className="h-3 w-3" />, label: "Saddle Stitch", color: "bg-violet-500/10 text-violet-600 border-violet-500/20" },
  envelope: { icon: <Mail className="h-3 w-3" />,     label: "Envelope",      color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  item:     { icon: <Package className="h-3 w-3" />,  label: "Item",          color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  other:    { icon: <Send className="h-3 w-3" />,     label: "Other",         color: "bg-secondary text-muted-foreground border-border" },
}

interface Props {
  quoteId: string
  onClose?: () => void
  inline?: boolean
}

export function VendorBidPanel({ quoteId, onClose, inline }: Props) {
  const { data: bids, isLoading, mutate: mutateBids } = useSWR<VendorBid[]>(
    `/api/vendor-bids?quote_id=${quoteId}`, fetcher
  )
  const { data: vendors } = useSWR<Vendor[]>("/api/vendors", fetcher)

  // New bid form
  const [showNew, setShowNew] = useState(false)
  const [newLabel, setNewLabel] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [newType, setNewType] = useState("flat")
  const [creating, setCreating] = useState(false)

  const createBid = async () => {
    if (!newLabel.trim()) return
    setCreating(true)
    await fetch("/api/vendor-bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quote_id: quoteId,
        item_label: newLabel.trim(),
        item_description: newDesc.trim() || null,
        item_category: newType,
      }),
    })
    setNewLabel(""); setNewDesc(""); setShowNew(false)
    mutateBids()
    setCreating(false)
  }

  const content = (
    <CardContent className="flex flex-col gap-4">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {bids?.map((bid) => (
            <BidCard key={bid.id} bid={bid} vendors={vendors ?? []} onUpdate={() => mutateBids()} />
          ))}

          {(!bids || bids.length === 0) && !showNew && (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="rounded-2xl bg-secondary p-4 mb-4">
                <Send className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">No bid requests yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create a bid to start comparing vendor prices.</p>
            </div>
          )}

          {/* New bid form */}
          {showNew && (
            <div className="rounded-2xl border border-border bg-secondary/30 p-5 flex flex-col gap-4">
              <h4 className="text-sm font-semibold text-foreground">New Bid Request</h4>

              {/* Type selector -- big pill buttons */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Job Type</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setNewType(key)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                        newType === key
                          ? "bg-foreground text-background border-foreground"
                          : "bg-card border-border text-muted-foreground hover:border-foreground/20"
                      }`}
                    >
                      {cfg.icon} {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Job Description *</label>
                  <Input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder='e.g. 8.5x11 Tri-Fold Brochure, 5000 qty'
                    className="h-10 text-sm rounded-xl"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Details / Specs</label>
                  <Input
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Paper stock, colors, finishing, etc."
                    className="h-10 text-sm rounded-xl"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  onClick={createBid}
                  disabled={creating || !newLabel.trim()}
                  className="gap-2 rounded-full bg-foreground text-background hover:bg-foreground/90"
                >
                  <Plus className="h-4 w-4" /> {creating ? "Creating..." : "Create Bid"}
                </Button>
                <Button variant="ghost" onClick={() => setShowNew(false)} className="rounded-full">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {!showNew && (
            <button
              onClick={() => setShowNew(true)}
              className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:border-foreground/20 hover:text-foreground transition-all"
            >
              <Plus className="h-4 w-4" /> New Bid Request
            </button>
          )}
        </>
      )}
    </CardContent>
  )

  if (inline) {
    return (
      <Card className="w-full border-border rounded-2xl overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-foreground">Out of House Production</CardTitle>
          <p className="text-sm text-muted-foreground">
            Build job descriptions, get vendor prices, mark up and add to your quote.
          </p>
        </CardHeader>
        {content}
      </Card>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-foreground/10 backdrop-blur-sm flex items-start justify-center p-4 pt-[4vh] overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <Card className="w-full max-w-3xl border-border rounded-2xl overflow-hidden shadow-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-foreground">Out of House Production</CardTitle>
              <p className="text-sm text-muted-foreground">Compare vendor prices and push to quote.</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary transition-colors" aria-label="Close">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </CardHeader>
        {content}
      </Card>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   BidCard -- The core OHP experience per bid
   ════════════════════════════════════════════════════════════════ */
function BidCard({ bid, vendors, onUpdate }: { bid: VendorBid; vendors: Vendor[]; onUpdate: () => void }) {
  const quote = useQuote()
  const { data: prices, mutate: mutatePrices } = useSWR<VendorBidPrice[]>(
    `/api/vendor-bids/${bid.id}/prices`, fetcher
  )
  const [expanded, setExpanded] = useState(true)
  const [addingVendor, setAddingVendor] = useState(false)
  const [selectedVendorId, setSelectedVendorId] = useState("")
  const [saving, setSaving] = useState(false)
  const [markupPct, setMarkupPct] = useState(20)
  const [pushed, setPushed] = useState(false)

  const existingVendorIds = new Set(prices?.map((p) => p.vendor_id) ?? [])
  const availableVendors = vendors.filter((v) => !existingVendorIds.has(v.id))

  const addVendor = async () => {
    if (!selectedVendorId) return
    setSaving(true)
    await fetch(`/api/vendor-bids/${bid.id}/prices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendor_id: selectedVendorId }),
    })
    setSelectedVendorId(""); setAddingVendor(false)
    mutatePrices(); setSaving(false)
  }

  const updatePrice = async (priceId: string, price: number | null) => {
    await fetch(`/api/bid-prices/${priceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        price,
        status: price != null ? "received" : "pending",
        responded_at: price != null ? new Date().toISOString() : null,
      }),
    })
    mutatePrices()
  }

  const awardBid = async (vendorId: string, price: number) => {
    await fetch(`/api/vendor-bids/${bid.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "awarded", winning_vendor_id: vendorId, winning_price: price }),
    })
    onUpdate()
  }

  const removePrice = async (priceId: string) => {
    await fetch(`/api/bid-prices/${priceId}`, { method: "DELETE" })
    mutatePrices()
  }

  const deleteBid = async () => {
    await fetch(`/api/vendor-bids/${bid.id}`, { method: "DELETE" })
    onUpdate()
  }

  // Push to quote
  const handlePushToQuote = useCallback(() => {
    if (bid.winning_price == null || !bid.winning_vendor_id) return
    const winVendor = vendors.find((v) => v.id === bid.winning_vendor_id)
    const pickupCost = winVendor?.pickup_cost ?? 100
    const base = Number(bid.winning_price)
    const markedUp = base * (1 + markupPct / 100)
    const customerTotal = markedUp + pickupCost

    quote.addItem({
      category: "ohp",
      label: `OHP: ${bid.item_label}`,
      description: bid.item_description || "",
      amount: customerTotal,
    })
    setPushed(true)
    setTimeout(() => setPushed(false), 2500)
  }, [bid, vendors, markupPct, quote])

  // Price calculations
  const receivedPrices = prices?.filter((p) => p.price != null) ?? []
  const cheapestPrice = receivedPrices.length > 0 ? Math.min(...receivedPrices.map((p) => Number(p.price))) : null
  const winVendor = bid.winning_vendor_id ? vendors.find((v) => v.id === bid.winning_vendor_id) : null
  const pickupCost = winVendor?.pickup_cost ?? 100
  const basePrice = bid.winning_price != null ? Number(bid.winning_price) : 0
  const markedUpPrice = basePrice * (1 + markupPct / 100)
  const customerTotal = markedUpPrice + pickupCost

  const typeCfg = TYPE_CONFIG[bid.item_category] ?? TYPE_CONFIG.other

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header -- type tag, job name, description, collapse */}
      <button className="w-full flex items-start gap-3 p-4 text-left hover:bg-secondary/30 transition-colors"
        onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="outline" className={`text-[10px] gap-1 border ${typeCfg.color}`}>
              {typeCfg.icon} {typeCfg.label}
            </Badge>
            {bid.status === "awarded" && (
              <Badge variant="outline" className="text-[10px] gap-1 border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
                <Trophy className="h-2.5 w-2.5" /> Awarded
              </Badge>
            )}
          </div>
          <p className="text-sm font-semibold text-foreground leading-tight">{bid.item_label}</p>
          {bid.item_description && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{bid.item_description}</p>
          )}
          {bid.winning_price != null && winVendor && (
            <p className="text-xs font-medium text-foreground mt-1.5">
              Winner: {winVendor.company_name} at {formatCurrency(basePrice)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 pt-1 shrink-0">
          <span className="text-xs text-muted-foreground tabular-nums">{prices?.length ?? 0}</span>
          <Factory className="h-3.5 w-3.5 text-muted-foreground" />
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 flex flex-col gap-4">
          {/* ── Vendor price grid ── */}
          {prices && prices.length > 0 ? (
            <div className="flex flex-col gap-2">
              {prices.map((p) => {
                const vendor = vendors.find((v) => v.id === p.vendor_id)
                const vendorName = vendor?.company_name ?? "Unknown"
                const vPickup = vendor?.pickup_cost ?? 100
                const isCheapest = p.price != null && Number(p.price) === cheapestPrice
                const isWinner = bid.winning_vendor_id === p.vendor_id
                return (
                  <VendorPriceRow
                    key={p.id}
                    entry={p}
                    vendorName={vendorName}
                    pickupCost={vPickup}
                    isCheapest={isCheapest}
                    isWinner={isWinner}
                    bidAwarded={bid.status === "awarded"}
                    markupPct={markupPct}
                    onUpdatePrice={updatePrice}
                    onAward={(price) => awardBid(p.vendor_id, price)}
                    onRemove={() => removePrice(p.id)}
                  />
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-3">Add vendors to compare prices.</p>
          )}

          {/* ── Markup + Push to Quote ── */}
          {bid.status === "awarded" && bid.winning_price != null && (
            <div className="rounded-2xl bg-foreground p-4 flex flex-col gap-3 text-background">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  <ShoppingCart className="h-3.5 w-3.5" /> Customer Price
                </span>
                <span className="text-lg font-bold font-mono tabular-nums">{formatCurrency(customerTotal)}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-background/50 text-[10px]">Vendor Price</span>
                  <p className="font-mono font-semibold tabular-nums">{formatCurrency(basePrice)}</p>
                </div>
                <div>
                  <span className="text-background/50 text-[10px]">Markup %</span>
                  <Input
                    type="number" step="1" min="0" max="200" value={markupPct}
                    onChange={(e) => setMarkupPct(parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs w-16 rounded-lg bg-background/10 border-background/20 text-background mt-0.5"
                  />
                </div>
                <div>
                  <span className="text-background/50 text-[10px] flex items-center gap-1"><Truck className="h-2.5 w-2.5" /> Pickup</span>
                  <p className="font-mono font-semibold tabular-nums">{formatCurrency(pickupCost)}</p>
                </div>
              </div>
              <button
                onClick={handlePushToQuote}
                disabled={pushed}
                className="w-full h-10 rounded-full bg-background text-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:bg-background/90 disabled:opacity-50 transition-all"
              >
                {pushed
                  ? <><Check className="h-4 w-4" /> Added to Quote</>
                  : <><ShoppingCart className="h-4 w-4" /> Add to Quote -- {formatCurrency(customerTotal)}</>
                }
              </button>
            </div>
          )}

          {/* ── Add vendor row ── */}
          <div className="flex items-center gap-2 flex-wrap">
            {addingVendor ? (
              <>
                <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                  <SelectTrigger className="h-9 text-xs w-52 rounded-xl"><SelectValue placeholder="Select vendor..." /></SelectTrigger>
                  <SelectContent>
                    {availableVendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        <span className="flex items-center gap-2">
                          {v.company_name}
                          <span className="text-muted-foreground text-[10px]">pickup {formatCurrency(v.pickup_cost ?? 100)}</span>
                        </span>
                      </SelectItem>
                    ))}
                    {availableVendors.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">All vendors added</div>
                    )}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={addVendor} disabled={saving || !selectedVendorId}
                  className="h-9 gap-1.5 rounded-full bg-foreground text-background hover:bg-foreground/90 text-xs">
                  <Plus className="h-3 w-3" /> {saving ? "Adding..." : "Add"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setAddingVendor(false)} className="h-9 rounded-full text-xs">Cancel</Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setAddingVendor(true)}
                  className="h-9 gap-1.5 rounded-xl text-xs">
                  <Factory className="h-3 w-3" /> Add Vendor
                </Button>
                <Button variant="ghost" size="sm" onClick={deleteBid}
                  className="h-9 gap-1.5 rounded-xl text-xs text-destructive hover:bg-destructive/10">
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

/* ════════════════════════════════════════════════════════════════
   VendorPriceRow -- Inline price entry per vendor
   ════════════════════════════════════════════════════════════════ */
function VendorPriceRow({
  entry, vendorName, pickupCost, isCheapest, isWinner, bidAwarded,
  markupPct, onUpdatePrice, onAward, onRemove,
}: {
  entry: VendorBidPrice
  vendorName: string
  pickupCost: number
  isCheapest: boolean
  isWinner: boolean
  bidAwarded: boolean
  markupPct: number
  onUpdatePrice: (id: string, price: number | null) => void
  onAward: (price: number) => void
  onRemove: () => void
}) {
  const [editPrice, setEditPrice] = useState(entry.price != null ? String(entry.price) : "")

  const handleSave = () => {
    const num = parseFloat(editPrice)
    if (!isNaN(num) && num >= 0) onUpdatePrice(entry.id, num)
  }

  const price = entry.price != null ? Number(entry.price) : null
  const totalWithPickup = price != null ? price + pickupCost : null
  const markedUp = price != null ? price * (1 + markupPct / 100) + pickupCost : null

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
      isWinner
        ? "border-emerald-500/30 bg-emerald-500/5"
        : isCheapest
        ? "border-amber-500/20 bg-amber-500/5"
        : "border-border bg-secondary/20 hover:bg-secondary/40"
    }`}>
      {/* Vendor name + pickup */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {isWinner && <Trophy className="h-3 w-3 text-emerald-500 shrink-0" />}
          <span className="text-xs font-semibold text-foreground truncate">{vendorName}</span>
        </div>
        <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
          <Truck className="h-2.5 w-2.5" /> {formatCurrency(pickupCost)} pickup
        </span>
      </div>

      {/* Price input */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">$</span>
        <Input
          type="number" step="0.01" value={editPrice}
          onChange={(e) => setEditPrice(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="0.00"
          className="h-8 text-xs w-24 text-right tabular-nums font-mono rounded-lg"
        />
      </div>

      {/* Customer sees (with markup) */}
      {markedUp != null && (
        <div className="text-right shrink-0 hidden sm:block">
          <p className="text-[10px] text-muted-foreground">Customer</p>
          <p className="text-xs font-bold font-mono tabular-nums text-foreground">{formatCurrency(markedUp)}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {price != null && !bidAwarded && (
          <button
            onClick={() => onAward(price)}
            className="h-7 px-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 text-[10px] font-semibold hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
          >
            <Trophy className="h-3 w-3" /> Award
          </button>
        )}
        <button onClick={onRemove} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" aria-label="Remove">
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
