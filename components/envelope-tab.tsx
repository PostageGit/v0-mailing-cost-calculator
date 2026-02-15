"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { useQuote } from "@/lib/quote-context"
import { useMailing, PIECE_TYPE_META } from "@/lib/mailing-context"
import { formatCurrency } from "@/lib/pricing"
import { Plus, Check, Package, AlertCircle } from "lucide-react"

/**
 * Envelope Tab -- piece-aware.
 * Lists all envelope pieces from the planner, each with size pre-filled.
 * User enters cost/each, adds to quote. Simple and focused.
 */
export function EnvelopeTab() {
  const quote = useQuote()
  const m = useMailing()

  // Get all envelope pieces that are in-house or both
  const envPieces = m.pieces.filter(
    (p) => p.type === "envelope" && (p.production === "inhouse" || p.production === "both")
  )

  if (envPieces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center mb-4">
          <Package className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold text-foreground mb-1">No envelope pieces defined</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Go back to the Planner and add an envelope piece to price it here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-base font-bold text-foreground tracking-tight">Envelope Pricing</h2>
        <span className="text-xs text-muted-foreground">{envPieces.length} envelope{envPieces.length > 1 ? "s" : ""} to price</span>
      </div>

      {envPieces.map((piece) => (
        <EnvelopePriceCard key={piece.id} pieceId={piece.id} />
      ))}
    </div>
  )
}

function EnvelopePriceCard({ pieceId }: { pieceId: string }) {
  const quote = useQuote()
  const m = useMailing()
  const piece = m.pieces.find((p) => p.id === pieceId)!
  const meta = PIECE_TYPE_META[piece.type]

  const [unitCost, setUnitCost] = useState("")
  const [added, setAdded] = useState(false)

  const cost = parseFloat(unitCost) || 0
  const qty = m.quantity
  const total = cost * qty

  const sizeLabel = piece.width && piece.height
    ? `${piece.width}" x ${piece.height}"`
    : "No size set"

  const kindLabel = piece.envelopeKind === "plastic"
    ? "Plastic"
    : piece.envelopeKind === "paper"
      ? "Paper"
      : ""

  const handleAdd = () => {
    if (cost <= 0) return
    quote.addItem({
      category: "item",
      label: `${kindLabel ? kindLabel + " " : ""}Envelope: ${sizeLabel}`,
      description: `${formatCurrency(cost)}/ea x ${qty.toLocaleString()}`,
      amount: total,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60 bg-secondary/20">
        <span className={`text-[9px] font-bold px-2 py-1 rounded-md ${meta.color}`}>{meta.short}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground">{piece.label}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            {kindLabel && (
              <span className="text-[10px] font-semibold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                {kindLabel}
              </span>
            )}
            <span className="text-xs font-mono text-muted-foreground">{sizeLabel}</span>
            {piece.envelopeId && piece.envelopeId !== "custom" && (
              <span className="text-[10px] text-muted-foreground">({piece.envelopeId.toUpperCase()})</span>
            )}
          </div>
        </div>
        <span className="text-xs text-muted-foreground font-medium tabular-nums">{qty.toLocaleString()} pcs</span>
      </div>

      {/* No size warning */}
      {(!piece.width || !piece.height) && (
        <div className="flex items-center gap-2 px-5 py-3 bg-destructive/5 text-destructive text-xs font-medium border-b border-border/40">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Set envelope dimensions in the Planner first.
        </div>
      )}

      {/* Pricing row */}
      <div className="px-5 py-4 flex items-end gap-4">
        <div className="flex flex-col gap-1 w-32">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Cost / each</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
            <Input
              type="number" step="0.001" min="0" placeholder="0.000"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              className="h-10 text-sm font-mono pl-7 rounded-xl border-border bg-background"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1 min-w-[100px]">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Total</label>
          <span className="text-lg font-bold font-mono text-foreground tabular-nums h-10 flex items-center">
            {formatCurrency(total)}
          </span>
        </div>
        <div className="ml-auto">
          <button
            onClick={handleAdd}
            disabled={cost <= 0 || added}
            className="flex items-center gap-2 bg-foreground text-background text-xs font-semibold px-5 py-2.5 rounded-full hover:bg-foreground/90 disabled:opacity-30 transition-all"
          >
            {added ? <><Check className="h-3.5 w-3.5" />Added</> : <><Plus className="h-3.5 w-3.5" />Add to Quote</>}
          </button>
        </div>
      </div>
    </div>
  )
}
