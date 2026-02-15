"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useQuote } from "@/lib/quote-context"
import { useMailing } from "@/lib/mailing-context"
import { formatCurrency } from "@/lib/pricing"
import { Plus, Check, AlertCircle, ArrowRight } from "lucide-react"

/**
 * Standard envelope sizes.
 * clearance = minimum extra space (width & height) the envelope must have
 * beyond the card dimensions for the card to fit comfortably.
 */
const ENVELOPES = [
  { id: "a2",    name: "A2",           w: 4.375,  h: 5.75,  desc: "RSVP / Note card" },
  { id: "a6",    name: "A6",           w: 4.75,   h: 6.5,   desc: "4x6 cards" },
  { id: "a7",    name: "A7",           w: 5.25,   h: 7.25,  desc: "5x7 invitations" },
  { id: "a8",    name: "A8",           w: 5.5,    h: 8.125,  desc: "Large invitations" },
  { id: "a9",    name: "A9",           w: 5.75,   h: 8.75,  desc: "Large greeting cards" },
  { id: "a10",   name: "A10",          w: 6,      h: 9.5,   desc: "6x9 programs" },
  { id: "9",     name: "#9 Reply",     w: 3.875,  h: 8.875, desc: "Reply / return" },
  { id: "10",    name: "#10 Standard", w: 4.125,  h: 9.5,   desc: "Business / letter" },
  { id: "11",    name: "#11",          w: 4.5,    h: 10.375, desc: "Policy / legal" },
  { id: "12",    name: "#12",          w: 4.75,   h: 11,    desc: "Large legal" },
  { id: "14",    name: "#14",          w: 5,      h: 11.5,  desc: "Extra-large letter" },
  { id: "6x9",   name: "6x9 Booklet", w: 6,      h: 9,     desc: "Booklet style" },
  { id: "9x12",  name: "9x12 Catalog", w: 9,     h: 12,    desc: "Catalog / flat" },
  { id: "10x13", name: "10x13 Catalog", w: 10,    h: 13,    desc: "Large catalog" },
  { id: "custom", name: "Custom",      w: 0,      h: 0,     desc: "Enter dimensions" },
]

/** Minimum clearance (in inches) on each dimension for a card to fit */
const CLEARANCE = 0.125

function cardFitsEnvelope(cardW: number, cardH: number, envW: number, envH: number): boolean {
  // Try both orientations of the card
  const shortCard = Math.min(cardW, cardH)
  const longCard = Math.max(cardW, cardH)
  const shortEnv = Math.min(envW, envH)
  const longEnv = Math.max(envW, envH)
  return shortCard + CLEARANCE <= shortEnv && longCard + CLEARANCE <= longEnv
}

export function EnvelopeTab() {
  const quote = useQuote()
  const mailing = useMailing()

  const [selectedId, setSelectedId] = useState("")
  const [quantity, setQuantity] = useState(mailing.quantity || 5000)
  const [unitCost, setUnitCost] = useState("")
  const [customW, setCustomW] = useState("")
  const [customH, setCustomH] = useState("")
  const [added, setAdded] = useState(false)

  const cardW = mailing.mailerWidth
  const cardH = mailing.mailerHeight
  const hasDims = !!(cardW && cardH)

  // Split envelopes into "fits" and "doesn't fit" based on card dimensions
  const { fits, tooSmall } = useMemo(() => {
    if (!hasDims) return { fits: ENVELOPES, tooSmall: [] as typeof ENVELOPES }
    const f: typeof ENVELOPES = []
    const t: typeof ENVELOPES = []
    for (const env of ENVELOPES) {
      if (env.id === "custom") { f.push(env); continue }
      if (cardFitsEnvelope(cardW!, cardH!, env.w, env.h)) {
        f.push(env)
      } else {
        t.push(env)
      }
    }
    return { fits: f, tooSmall: t }
  }, [hasDims, cardW, cardH])

  // Find the smallest envelope that fits (best match)
  const bestMatch = useMemo(() => {
    if (!hasDims) return null
    const sorted = fits
      .filter((e) => e.id !== "custom")
      .sort((a, b) => a.w * a.h - b.w * b.h)
    return sorted.length > 0 ? sorted[0].id : null
  }, [fits, hasDims])

  const selected = ENVELOPES.find((e) => e.id === selectedId)
  const cost = parseFloat(unitCost) || 0
  const totalCost = cost * quantity

  const handleAdd = () => {
    if (!selected || cost <= 0) return
    const envLabel = selected.id === "custom"
      ? `Custom ${customW}" x ${customH}"`
      : `${selected.name} (${selected.w}" x ${selected.h}")`

    quote.addItem({
      category: "item",
      label: `Envelope: ${envLabel} x ${quantity.toLocaleString()}`,
      description: `${formatCurrency(cost)} / each`,
      amount: totalCost,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Card size context */}
      {hasDims && (
        <div className="flex items-center gap-3 rounded-xl bg-secondary/60 border border-border px-4 py-2.5">
          <span className="text-xs font-medium text-muted-foreground">Mail piece:</span>
          <span className="text-xs font-bold text-foreground font-mono">{cardW}" x {cardH}"</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {fits.filter((e) => e.id !== "custom").length} envelope{fits.filter((e) => e.id !== "custom").length !== 1 ? "s" : ""} fit
          </span>
        </div>
      )}

      {!hasDims && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 px-4 py-2.5">
          <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          <span className="text-xs text-amber-700 dark:text-amber-400">
            Enter mail piece dimensions in Job Info to auto-filter envelopes that fit.
          </span>
        </div>
      )}

      {/* Envelopes that fit */}
      <Card className="border-border rounded-2xl overflow-hidden">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-foreground">
            {hasDims ? "Envelopes That Fit" : "All Envelopes"}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-1.5">
            {fits.map((env) => {
              const isSelected = selectedId === env.id
              const isBest = env.id === bestMatch
              return (
                <button
                  key={env.id}
                  type="button"
                  onClick={() => setSelectedId(env.id)}
                  className={`relative flex flex-col items-start rounded-xl border px-3 py-2 text-left transition-all ${
                    isSelected
                      ? "border-foreground bg-foreground text-background"
                      : isBest
                        ? "border-foreground/40 bg-foreground/5 hover:bg-foreground/10"
                        : "border-border bg-card hover:border-foreground/20"
                  }`}
                >
                  {isBest && !isSelected && (
                    <span className="absolute -top-1.5 right-2 text-[8px] font-bold bg-foreground text-background px-1.5 py-0.5 rounded-full leading-none">
                      BEST FIT
                    </span>
                  )}
                  <span className={`text-[11px] font-semibold leading-tight ${isSelected ? "text-background" : "text-foreground"}`}>
                    {env.name}
                  </span>
                  {env.id !== "custom" && (
                    <span className={`text-[9px] font-mono leading-tight mt-0.5 ${isSelected ? "text-background/60" : "text-muted-foreground"}`}>
                      {env.w}" x {env.h}"
                    </span>
                  )}
                  <span className={`text-[9px] leading-tight ${isSelected ? "text-background/50" : "text-muted-foreground"}`}>
                    {env.desc}
                  </span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Too small -- collapsed, secondary */}
      {hasDims && tooSmall.length > 0 && (
        <details className="group">
          <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
            {tooSmall.length} envelope{tooSmall.length !== 1 ? "s" : ""} too small for {cardW}" x {cardH}" &mdash; show anyway
          </summary>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mt-2 opacity-50">
            {tooSmall.map((env) => (
              <button
                key={env.id}
                type="button"
                onClick={() => setSelectedId(env.id)}
                className={`flex flex-col items-start rounded-xl border px-3 py-2 text-left transition-all ${
                  selectedId === env.id
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card hover:border-foreground/20"
                }`}
              >
                <span className={`text-[11px] font-semibold leading-tight ${selectedId === env.id ? "text-background" : "text-foreground"}`}>
                  {env.name}
                </span>
                <span className={`text-[9px] font-mono leading-tight mt-0.5 ${selectedId === env.id ? "text-background/60" : "text-muted-foreground"}`}>
                  {env.w}" x {env.h}"
                </span>
              </button>
            ))}
          </div>
        </details>
      )}

      {/* Custom dimensions */}
      {selectedId === "custom" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-muted-foreground">Width (in)</label>
            <Input type="number" step="0.125" min="0" value={customW} onChange={(e) => setCustomW(e.target.value)} className="h-8 text-xs" placeholder="4.125" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-muted-foreground">Height (in)</label>
            <Input type="number" step="0.125" min="0" value={customH} onChange={(e) => setCustomH(e.target.value)} className="h-8 text-xs" placeholder="9.5" />
          </div>
        </div>
      )}

      {/* Pricing row -- only when envelope selected */}
      {selected && (
        <div className="flex items-end gap-3 rounded-xl border border-border bg-secondary/30 px-4 py-3">
          <div className="flex flex-col gap-1 w-24">
            <label className="text-[10px] font-medium text-muted-foreground">Qty</label>
            <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 0)} className="h-8 text-xs" />
          </div>
          <div className="flex flex-col gap-1 w-28">
            <label className="text-[10px] font-medium text-muted-foreground">Cost / each ($)</label>
            <Input type="number" step="0.001" min="0" placeholder="0.00" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="flex flex-col gap-0.5 min-w-[80px]">
            <span className="text-[10px] text-muted-foreground">Total</span>
            <span className="text-base font-bold font-mono text-foreground tabular-nums">{formatCurrency(totalCost)}</span>
          </div>
          <button
            onClick={handleAdd}
            disabled={cost <= 0 || added}
            className="flex items-center gap-1.5 bg-foreground text-background text-xs font-semibold px-4 py-2 rounded-full hover:bg-foreground/90 disabled:opacity-30 transition-all ml-auto shrink-0"
          >
            {added ? <><Check className="h-3.5 w-3.5" />Added</> : <><Plus className="h-3.5 w-3.5" />Add to Quote</>}
          </button>
        </div>
      )}
    </div>
  )
}
