"use client"

import { useState, useCallback } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  X, Plus, Loader2, Trophy, DollarSign, Send, Factory, ChevronDown, ChevronUp,
  Check, Clock, AlertCircle,
} from "lucide-react"
import { formatCurrency } from "@/lib/pricing"
import type { VendorBid, VendorBidPrice, Vendor } from "@/lib/vendor-types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Props {
  quoteId: string
  onClose: () => void
}

export function VendorBidPanel({ quoteId, onClose }: Props) {
  const { data: bids, isLoading, mutate: mutateBids } = useSWR<VendorBid[]>(
    `/api/vendor-bids?quote_id=${quoteId}`,
    fetcher
  )
  const { data: vendors } = useSWR<Vendor[]>("/api/vendors", fetcher)
  const [showNewBid, setShowNewBid] = useState(false)
  const [newLabel, setNewLabel] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [newCategory, setNewCategory] = useState("flat")
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
        item_category: newCategory,
      }),
    })
    setNewLabel("")
    setNewDesc("")
    setShowNewBid(false)
    mutateBids()
    setCreating(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center p-4 pt-[4vh] overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <Card className="w-full max-w-3xl border-border shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
                <Send className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Vendor Bids</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Send items to vendors and compare prices
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {bids?.map((bid) => (
                <BidCard key={bid.id} bid={bid} vendors={vendors ?? []} onUpdate={() => mutateBids()} />
              ))}

              {(!bids || bids.length === 0) && !showNewBid && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Send className="h-8 w-8 opacity-40 mb-2" />
                  <p className="text-sm">No bid requests yet</p>
                  <p className="text-xs mt-0.5">Create a bid request to start comparing vendor prices</p>
                </div>
              )}

              {showNewBid && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex flex-col gap-3">
                  <h4 className="text-xs font-semibold text-foreground">New Bid Request</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-medium text-foreground mb-1 block">Item Name *</label>
                      <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. 8.5x11 Tri-Fold Brochure" className="h-8 text-sm" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-medium text-foreground mb-1 block">Description / Specs</label>
                      <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Qty, paper, colors, finishing..." className="h-8 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground mb-1 block">Category</label>
                      <Select value={newCategory} onValueChange={setNewCategory}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="flat">Flat Printing</SelectItem>
                          <SelectItem value="booklet">Fold & Staple</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-8 text-xs gap-1" onClick={createBid} disabled={creating || !newLabel.trim()}>
                      <Plus className="h-3 w-3" /> {creating ? "Creating..." : "Create Bid Request"}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setShowNewBid(false)}>Cancel</Button>
                  </div>
                </div>
              )}

              {!showNewBid && (
                <Button variant="outline" className="gap-2 h-10 border-dashed" onClick={() => setShowNewBid(true)}>
                  <Plus className="h-4 w-4" /> New Bid Request
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ==== Individual Bid Card with Price Comparison ==== */
function BidCard({ bid, vendors, onUpdate }: { bid: VendorBid; vendors: Vendor[]; onUpdate: () => void }) {
  const { data: prices, mutate: mutatePrices } = useSWR<VendorBidPrice[]>(
    `/api/vendor-bids/${bid.id}/prices`,
    fetcher
  )
  const [expanded, setExpanded] = useState(true)
  const [addingVendor, setAddingVendor] = useState(false)
  const [selectedVendorId, setSelectedVendorId] = useState("")
  const [saving, setSaving] = useState(false)

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
    setSelectedVendorId("")
    setAddingVendor(false)
    mutatePrices()
    setSaving(false)
  }

  const updatePrice = async (priceId: string, price: number | null, status: string) => {
    await fetch(`/api/bid-prices/${priceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        price,
        status,
        responded_at: status === "received" ? new Date().toISOString() : null,
      }),
    })
    mutatePrices()
  }

  const awardBid = async (vendorId: string, price: number) => {
    await fetch(`/api/vendor-bids/${bid.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "awarded",
        winning_vendor_id: vendorId,
        winning_price: price,
      }),
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

  // Find cheapest price
  const receivedPrices = prices?.filter((p) => p.status === "received" && p.price != null) ?? []
  const cheapestPrice = receivedPrices.length > 0 ? Math.min(...receivedPrices.map((p) => Number(p.price))) : null

  const statusColor = bid.status === "awarded" ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/30" :
    bid.status === "open" ? "text-blue-600 bg-blue-500/10 border-blue-500/30" :
    "text-muted-foreground bg-muted/60 border-border"

  return (
    <div className="rounded-lg border border-border bg-card">
      <button className="w-full flex items-center justify-between gap-3 p-4 text-left" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{bid.item_label}</span>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 capitalize ${statusColor}`}>{bid.status}</Badge>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{bid.item_category}</Badge>
          </div>
          {bid.item_description && <p className="text-xs text-muted-foreground mt-0.5">{bid.item_description}</p>}
          {bid.winning_price != null && (
            <div className="flex items-center gap-1.5 mt-1">
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-semibold text-foreground">Awarded: {formatCurrency(Number(bid.winning_price))}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{prices?.length ?? 0} vendor{(prices?.length ?? 0) !== 1 ? "s" : ""}</span>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 flex flex-col gap-3">
          {/* Price comparison grid */}
          {prices && prices.length > 0 ? (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left font-medium text-muted-foreground px-3 py-2">Vendor</th>
                    <th className="text-left font-medium text-muted-foreground px-3 py-2">Status</th>
                    <th className="text-right font-medium text-muted-foreground px-3 py-2">Price</th>
                    <th className="text-right font-medium text-muted-foreground px-3 py-2 w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {prices.map((p) => {
                    const isCheapest = p.status === "received" && p.price != null && Number(p.price) === cheapestPrice
                    const isWinner = bid.winning_vendor_id === p.vendor_id
                    return (
                      <PriceRow
                        key={p.id}
                        entry={p}
                        isCheapest={isCheapest}
                        isWinner={isWinner}
                        bidStatus={bid.status}
                        onUpdatePrice={updatePrice}
                        onAward={awardBid}
                        onRemove={removePrice}
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-3">No vendors added to this bid yet.</p>
          )}

          {/* Add vendor */}
          <div className="flex items-center gap-2 flex-wrap">
            {addingVendor ? (
              <>
                <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                  <SelectTrigger className="h-8 text-xs w-48"><SelectValue placeholder="Select vendor..." /></SelectTrigger>
                  <SelectContent>
                    {availableVendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>)}
                    {availableVendors.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">All vendors already added</div>
                    )}
                  </SelectContent>
                </Select>
                <Button size="sm" className="h-8 text-xs gap-1" onClick={addVendor} disabled={saving || !selectedVendorId}>
                  <Plus className="h-3 w-3" /> {saving ? "Adding..." : "Add"}
                </Button>
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setAddingVendor(false)}>Cancel</Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setAddingVendor(true)}>
                  <Factory className="h-3 w-3" /> Add Vendor
                </Button>
                <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:bg-destructive/10 gap-1" onClick={deleteBid}>
                  <X className="h-3 w-3" /> Remove Bid
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ==== Price Row with inline editing ==== */
function PriceRow({
  entry, isCheapest, isWinner, bidStatus, onUpdatePrice, onAward, onRemove,
}: {
  entry: VendorBidPrice
  isCheapest: boolean
  isWinner: boolean
  bidStatus: string
  onUpdatePrice: (id: string, price: number | null, status: string) => void
  onAward: (vendorId: string, price: number) => void
  onRemove: (id: string) => void
}) {
  const [editPrice, setEditPrice] = useState(entry.price != null ? String(entry.price) : "")
  const [saving, setSaving] = useState(false)

  const handleSavePrice = async () => {
    const num = parseFloat(editPrice)
    if (isNaN(num)) return
    setSaving(true)
    await onUpdatePrice(entry.id, num, "received")
    setSaving(false)
  }

  const vendorName = entry.vendors?.company_name ?? "Unknown Vendor"

  return (
    <tr className={`border-b border-border last:border-0 transition-colors ${
      isWinner ? "bg-emerald-500/5" : isCheapest ? "bg-amber-500/5" : "hover:bg-muted/30"
    }`}>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          {isWinner && <Trophy className="h-3 w-3 text-emerald-500" />}
          {isCheapest && !isWinner && <DollarSign className="h-3 w-3 text-amber-500" />}
          <span className="font-medium text-foreground">{vendorName}</span>
        </div>
      </td>
      <td className="px-3 py-2">
        {entry.status === "received" ? (
          <span className="flex items-center gap-1 text-emerald-600"><Check className="h-3 w-3" /> Received</span>
        ) : entry.status === "declined" ? (
          <span className="flex items-center gap-1 text-destructive"><AlertCircle className="h-3 w-3" /> Declined</span>
        ) : (
          <span className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" /> Pending</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <span className="text-muted-foreground">$</span>
          <Input
            type="number"
            step="0.01"
            value={editPrice}
            onChange={(e) => setEditPrice(e.target.value)}
            onBlur={handleSavePrice}
            onKeyDown={(e) => e.key === "Enter" && handleSavePrice()}
            placeholder="0.00"
            className="h-7 text-xs w-24 text-right tabular-nums"
          />
        </div>
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          {entry.status === "received" && entry.price != null && bidStatus === "open" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] gap-0.5 text-emerald-600 hover:bg-emerald-500/10 px-1.5"
              onClick={() => onAward(entry.vendor_id, Number(entry.price))}
            >
              <Trophy className="h-3 w-3" /> Award
            </Button>
          )}
          <button
            onClick={() => onRemove(entry.id)}
            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            aria-label="Remove"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </td>
    </tr>
  )
}
