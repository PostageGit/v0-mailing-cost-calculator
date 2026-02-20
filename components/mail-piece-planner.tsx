"use client"

import { useState } from "react"
import { useMailing, PIECE_TYPE_META, STANDARD_ENVELOPES, FOLD_OPTIONS, getFlatSize, type PieceType, type ProductionRoute, type FoldType } from "@/lib/mailing-context"
import { useQuote } from "@/lib/quote-context"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import useSWR from "swr"
import type { Customer } from "@/lib/customer-types"
import { CustomerSearchCombobox } from "@/components/customer-search-combobox"
import {
  Plus, X, Mail, ArrowRight, User, Package, AlertCircle,
  ChevronDown, Check, Printer, Send, Layers, Loader2,
  CalendarDays, HandMetal,
} from "lucide-react"
import type { Vendor } from "@/lib/vendor-types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())
interface Contact { id: string; name: string; email?: string; phone?: string }

const ADDABLE_TYPES: PieceType[] = ["envelope", "flat_card", "folded_card", "postcard", "booklet", "spiral_book", "perfect_bound", "pad", "self_mailer", "letter", "other"]

// ─── Grouped categories for the add-piece menu ────────────
interface CategoryItem {
  id: string
  label: string
  description: string
  icon: string  // short badge text
  color: string // badge color classes
  type?: PieceType  // direct add (no sub-menu)
  subItems?: { type: PieceType; label: string; description: string }[]
}

const ADD_CATEGORIES: CategoryItem[] = [
  {
    id: "envelope", label: "Envelope", description: "Paper or plastic mailer",
    icon: "ENV", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    type: "envelope",
  },
  {
    id: "flat", label: "Flat Printing", description: "Cards, postcards, letters & self-mailers",
    icon: "FLT", color: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    subItems: [
      { type: "flat_card",   label: "Flat Card",    description: "Printed flat -- any size" },
      { type: "postcard",    label: "Postcard",     description: "Standard postcard sizes" },
      { type: "folded_card", label: "Folded Card",  description: "Printed flat, then folded" },
      { type: "self_mailer", label: "Self-Mailer",  description: "Folds & mails without envelope" },
      { type: "letter",      label: "Letter",       description: "8.5 x 11 letter insert" },
    ],
  },
  {
    id: "book_staple", label: "Book -- Fold & Staple", description: "Saddle-stitched booklet",
    icon: "BKL", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    type: "booklet",
  },
  {
    id: "book_spiral", label: "Book -- Spiral", description: "Wire or coil bound",
    icon: "SPR", color: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    type: "spiral_book",
  },
  {
    id: "book_perfect", label: "Book -- Perfect Bound", description: "Glue-bound soft cover",
    icon: "PB", color: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    type: "perfect_bound",
  },
  {
    id: "pad", label: "Pad", description: "Stacked sheets with chip board backing",
    icon: "PAD", color: "bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300",
    type: "pad",
  },
  {
    id: "other", label: "Other / Manual", description: "Custom or OHP piece",
    icon: "OTH", color: "bg-secondary text-foreground",
    type: "other",
  },
]

export function MailPiecePlanner({ onContinue }: { onContinue: () => void }) {
  const m = useMailing()
  const q = useQuote()

  // Sync: if quote context has a saved quantity and mailing context doesn't, hydrate it
  const [hydrated, setHydrated] = useState(false)
  if (!hydrated && q.quantity > 0 && m.quantity === 0) {
    m.setQuantity(q.quantity)
    setHydrated(true)
  }
  const { data: customers } = useSWR<Customer[]>("/api/customers", fetcher)
  const { data: vendors } = useSWR<Vendor[]>("/api/vendors", fetcher)
  const [cpCustomVendors, setCpCustomVendors] = useState<Record<string, string>>({})
  const { data: contacts, mutate: mutateContacts } = useSWR<Contact[]>(
    q.customerId ? `/api/customers/${q.customerId}/contacts` : null, fetcher,
  )
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [showAddContact, setShowAddContact] = useState(false)
  const [newContactName, setNewContactName] = useState("")
  const [newContactEmail, setNewContactEmail] = useState("")
  const [newContactPhone, setNewContactPhone] = useState("")
  const [savingContact, setSavingContact] = useState(false)

  const handleAddContact = async () => {
    if (!newContactName.trim() || !q.customerId) return
    setSavingContact(true)
    try {
      const res = await fetch(`/api/customers/${q.customerId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newContactName.trim(),
          email: newContactEmail.trim() || null,
          office_phone: newContactPhone.trim() || null,
        }),
      })
      if (res.ok) {
        const created = await res.json()
        mutateContacts()
        q.setContactName(created.name || newContactName.trim())
        setNewContactName("")
        setNewContactEmail("")
        setNewContactPhone("")
        setShowAddContact(false)
      }
    } finally {
      setSavingContact(false)
    }
  }

  const hasDims = !!(m.mailerWidth && m.mailerHeight)
  const shapes = m.suggestedShapes
  const canContinue = m.pieces.length > 0 && m.quantity > 0

  // Summary of what steps will be shown
  const stepSummary: string[] = []
  if (m.needsEnvelope) stepSummary.push("Envelope")
  stepSummary.push("Postage", "Labor")
  if (m.needsPrinting) stepSummary.push("Printing")
  if (m.needsBooklet) stepSummary.push("Booklet")
  if (m.needsSpiral) stepSummary.push("Spiral")
  if (m.needsPerfect) stepSummary.push("Perfect")
  if (m.needsPad) stepSummary.push("Pad")
  if (m.needsOHP) stepSummary.push("OHP")
  stepSummary.push("Items")

  return (
    <div className="max-w-4xl mx-auto w-full">
      {/* ─── Header ─── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Mail Piece Planner</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Define what you are mailing. Each piece drives the quoting process.
        </p>
      </div>

      {/* ─── Top row: Customer + Job basics ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Customer Card */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-xl bg-secondary flex items-center justify-center">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="text-sm font-semibold text-foreground">Customer</span>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Company</label>
              <CustomerSearchCombobox
                customers={customers}
                selectedId={q.customerId}
                onSelect={(id) => { q.setCustomerId(id); if (!id) q.setContactName("") }}
              />
            </div>
            {q.customerId && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-muted-foreground">Contact</label>
                  {!showAddContact && (
                    <button
                      type="button"
                      onClick={() => setShowAddContact(true)}
                      className="flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  )}
                </div>
                {contacts && contacts.length > 0 ? (
                  <Select value={q.contactName || "none"} onValueChange={(v) => q.setContactName(v === "none" ? "" : v)}>
                    <SelectTrigger className="h-9 text-sm border-border bg-background rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">None</SelectItem>{contacts.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input placeholder="Contact name" value={q.contactName} onChange={(e) => q.setContactName(e.target.value)} className="h-9 text-sm border-border bg-background rounded-xl" />
                )}
                {/* Inline add contact form */}
                {showAddContact && (
                  <div className="mt-2 rounded-xl border border-border bg-secondary/40 p-3 flex flex-col gap-2">
                    <Input
                      placeholder="Name *"
                      value={newContactName}
                      onChange={(e) => setNewContactName(e.target.value)}
                      className="h-8 text-xs border-border bg-background rounded-lg"
                      autoFocus
                    />
                    <Input
                      placeholder="Email"
                      type="email"
                      value={newContactEmail}
                      onChange={(e) => setNewContactEmail(e.target.value)}
                      className="h-8 text-xs border-border bg-background rounded-lg"
                    />
                    <Input
                      placeholder="Phone"
                      value={newContactPhone}
                      onChange={(e) => setNewContactPhone(e.target.value)}
                      className="h-8 text-xs border-border bg-background rounded-lg"
                    />
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <button
                        type="button"
                        onClick={handleAddContact}
                        disabled={!newContactName.trim() || savingContact}
                        className="flex items-center gap-1 h-7 px-3 bg-foreground text-background text-[11px] font-semibold rounded-lg hover:bg-foreground/90 disabled:opacity-40 transition-all"
                      >
                        {savingContact ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowAddContact(false); setNewContactName(""); setNewContactEmail(""); setNewContactPhone("") }}
                        className="h-7 px-2.5 text-[11px] font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Job Card */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-xl bg-secondary flex items-center justify-center">
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="text-sm font-semibold text-foreground">Job Details</span>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Job Name</label>
              <Input placeholder="Spring Mailer 2026" value={q.projectName} onChange={(e) => q.setProjectName(e.target.value)} className="h-9 text-sm border-border bg-background rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Quantity</label>
                <Input type="number" min="0" placeholder="0" value={m.quantity || ""} onChange={(e) => { const v = parseInt(e.target.value) || 0; m.setQuantity(v); q.setQuantity(v) }} className="h-9 text-sm border-border bg-background rounded-xl font-mono" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">PO / Ref #</label>
                <Input placeholder="Optional" value={q.referenceNumber} onChange={(e) => q.setReferenceNumber(e.target.value)} className="h-9 text-sm border-border bg-background rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          MAIL PIECES -- the heart of the planner
         ═══════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border-2 border-foreground/10 bg-card p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-foreground flex items-center justify-center">
              <Layers className="h-4.5 w-4.5 text-background" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Mail Pieces</h2>
              <p className="text-xs text-muted-foreground">
                {m.pieces.length === 0 ? "Add each physical piece in the mailing" : `${m.pieces.length} piece${m.pieces.length > 1 ? "s" : ""} defined`}
              </p>
            </div>
          </div>

          {/* Add piece button */}
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="flex items-center gap-1.5 h-9 px-4 bg-foreground text-background text-xs font-semibold rounded-full hover:bg-foreground/90 transition-all"
            >
              <Plus className="h-3.5 w-3.5" /> Add Piece <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
            {showAddMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => { setShowAddMenu(false); setExpandedCategory(null) }} />
                <div className="absolute right-0 top-full mt-2 z-50 bg-card rounded-2xl border border-border shadow-2xl p-1.5 w-[280px]">
                  {ADD_CATEGORIES.map((cat) => {
                    const isExpanded = expandedCategory === cat.id
                    const hasSubs = !!cat.subItems

                    return (
                      <div key={cat.id}>
                        <button
                          onClick={() => {
                            if (cat.type && !hasSubs) {
                              m.addPiece(cat.type)
                              setShowAddMenu(false)
                              setExpandedCategory(null)
                            } else {
                              setExpandedCategory(isExpanded ? null : cat.id)
                            }
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl transition-all",
                            isExpanded ? "bg-secondary" : "hover:bg-secondary/60",
                          )}
                        >
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${cat.color}`}>
                            {cat.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold text-foreground block">{cat.label}</span>
                            <span className="text-[10px] text-muted-foreground leading-tight">{cat.description}</span>
                          </div>
                          {hasSubs && (
                            <ChevronDown className={cn(
                              "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform",
                              isExpanded && "rotate-180",
                            )} />
                          )}
                        </button>

                        {/* Sub-items for Flat */}
                        {hasSubs && isExpanded && (
                          <div className="ml-4 mr-1 mb-1 mt-0.5 border-l-2 border-border pl-2 flex flex-col gap-0.5">
                            {cat.subItems!.map((sub) => {
                              const subMeta = PIECE_TYPE_META[sub.type]
                              return (
                                <button
                                  key={sub.type}
                                  onClick={() => {
                                    m.addPiece(sub.type)
                                    setShowAddMenu(false)
                                    setExpandedCategory(null)
                                  }}
                                  className="w-full flex items-center gap-2.5 text-left px-2.5 py-2 rounded-lg hover:bg-secondary/80 transition-colors"
                                >
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${subMeta.color}`}>
                                    {subMeta.short}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-[13px] font-medium text-foreground block">{sub.label}</span>
                                    <span className="text-[10px] text-muted-foreground leading-tight">{sub.description}</span>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Empty state */}
        {m.pieces.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-border/60 rounded-2xl">
            <Mail className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-semibold text-foreground">No pieces yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed">
              Click "Add Piece" to define what is being mailed -- start with the outermost piece (envelope, postcard, booklet), then add any inserts inside it.
            </p>
          </div>
        )}

        {/* ─── Piece Cards ─── */}
        <div className="flex flex-col gap-3">
          {m.pieces.map((piece) => {
            const meta = PIECE_TYPE_META[piece.type]
            const isOuter = piece.position === 1
            const outerW = m.mailerWidth
            const outerH = m.mailerHeight
            // Inner pieces must be at least 0.25" total (both sides) smaller than outer
            const minClearance = 0.25
            const tooWide = !isOuter && piece.width && outerW && piece.width > (outerW - minClearance)
            const tooTall = !isOuter && piece.height && outerH && piece.height > (outerH - minClearance)
            const sizeWarn = tooWide || tooTall
            const maxInnerW = outerW ? outerW - minClearance : null
            const maxInnerH = outerH ? outerH - minClearance : null

            return (
              <div key={piece.id} className={`rounded-xl border p-4 transition-all ${
                isOuter ? "border-foreground/20 bg-secondary/30" : "border-border bg-background"
              }`}>
                {/* Row 1: Position, type badge, label, size, remove */}
                <div className="flex items-start gap-3">
                  {/* Position number */}
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold ${
                    isOuter ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
                  }`}>
                    {piece.position}
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    {/* Type badge + label */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${meta.color}`}>{meta.short}</span>
                      <Input
                        value={piece.label}
                        onChange={(e) => m.updatePiece(piece.id, { label: e.target.value })}
                        className="h-7 text-sm font-semibold border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                        placeholder={meta.label}
                      />
                      {isOuter && (
                        <Badge variant="outline" className="text-[9px] font-bold border-foreground/20 text-foreground shrink-0">
                          OUTER
                        </Badge>
                      )}
                    </div>

                    {/* Envelope-specific: kind + standard size */}
                    {piece.type === "envelope" && (() => {
                      const activeKind = piece.envelopeKind || "paper"
                      const filteredEnvelopes = STANDARD_ENVELOPES.filter((e) => e.kind === activeKind)
                      return (
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <div className="flex gap-1">
                          {(["paper", "plastic"] as const).map((k) => (
                            <button key={k} type="button"
                              onClick={() => {
                                // Switching kind -- clear the selected envelope since sizes differ
                                if (piece.envelopeKind !== k) {
                                  const patch: Record<string, unknown> = { envelopeKind: k, envelopeId: undefined, width: null, height: null }
                                  // Can't print on plastic -- no printing involved, but we supply the bag
                                  if (k === "plastic" && piece.position === 1) patch.production = "no_print"
                                  m.updatePiece(piece.id, patch)
                                }
                              }}
                              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                                activeKind === k ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:text-foreground"
                              }`}>
                              {k === "paper" ? "Paper" : "Plastic"}
                            </button>
                          ))}
                        </div>
                        <Select
                          value={piece.envelopeId || "none"}
                          onValueChange={(v) => { if (v !== "none") m.updatePiece(piece.id, { envelopeId: v }) }}
                        >
                          <SelectTrigger className="h-8 text-xs border-border bg-background rounded-lg w-[160px]">
                            <SelectValue placeholder="Size..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Size...</SelectItem>
                            {filteredEnvelopes.map((env) => (
                              <SelectItem key={env.id} value={env.id}>
                                {env.name}{env.sku ? ` (${env.sku})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {piece.envelopeId && piece.envelopeId !== "none" && piece.envelopeId !== "custom" && piece.envelopeId !== "p-custom" && (() => {
                          const sel = STANDARD_ENVELOPES.find((e) => e.id === piece.envelopeId)
                          if (!sel) return null
                          return (
                            <span className="text-[10px] text-muted-foreground" title={`Actual: ${sel.width}" x ${sel.height}"${sel.fitsWidth ? ` | Fits: ${sel.fitsWidth}" x ${sel.fitsHeight}"` : ""}`}>
                              {sel.width}" x {sel.height}"
                            </span>
                          )
                        })()}
                      </div>
                      )
                    })()}

                    {/* Fold type selector -- simplified: Flat, x2, x3, Custom */}
                    {["folded_card", "self_mailer"].includes(piece.type) && (
                      <div className="mb-3">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Fold</label>
                        <div className="flex gap-1">
                          {FOLD_OPTIONS.map((f) => (
                            <button key={f.id} type="button"
                              onClick={() => m.updatePiece(piece.id, { foldType: f.id })}
                              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                                piece.foldType === f.id
                                  ? "bg-foreground text-background"
                                  : "bg-secondary text-muted-foreground hover:text-foreground"
                              }`}
                              title={f.desc}>
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggested size verify banner */}
                    {piece._suggested && piece.width && piece.height && (() => {
                      const sugFlat = getFlatSize(piece)
                      const isSugFolded = piece.foldType !== "none" && ["folded_card", "self_mailer"].includes(piece.type)
                      const hasSugFlat = isSugFolded && sugFlat.w && sugFlat.h
                      return (
                        <div className="flex items-center gap-3 mb-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 px-4 py-3">
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                              {"Suggested: "}
                              <span className="font-mono">{piece.width}" x {piece.height}"</span>
                              <span className="font-normal text-blue-600 dark:text-blue-400"> (finished)</span>
                            </p>
                            {hasSugFlat && (
                              <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mt-0.5">
                                {"Flat sheet: "}
                                <span className="font-mono">{sugFlat.w}" x {sugFlat.h}"</span>
                              </p>
                            )}
                            <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">
                              {"0.25\" total clearance from piece above. "}
                              {maxInnerW && maxInnerH && <span className="font-mono">Max allowed: {maxInnerW}" x {maxInnerH}"</span>}
                            </p>
                          </div>
                          <button
                            onClick={() => m.updatePiece(piece.id, { _suggested: undefined })}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
                          >
                            <Check className="h-3 w-3 inline mr-1" />OK
                          </button>
                        </div>
                      )
                    })()}

                    {/* Dimensions row */}
                    {(() => {
                      const isFolded = piece.foldType !== "none" && ["folded_card", "self_mailer"].includes(piece.type)
                      const flat = getFlatSize(piece)
                      const hasFlat = isFolded && flat.w && flat.h
                      return (
                        <div className="mb-3">
                          {isFolded && (
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                              Finished Size <span className="normal-case font-normal">(as mailed / folded)</span>
                            </label>
                          )}
                          <div className="flex items-center gap-3">
                            {(piece.type !== "envelope" || piece.envelopeId === "custom" || !piece.envelopeId) ? (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <label className="text-xs text-muted-foreground">W</label>
                                  <Input type="number" step="0.125" min="0" placeholder={'0"'}
                                    value={piece.width ?? ""}
                                    onChange={(e) => m.updatePiece(piece.id, { width: e.target.value ? parseFloat(e.target.value) : null, _suggested: undefined })}
                                    className={`h-8 w-20 text-xs border-border bg-background rounded-lg font-mono ${piece._suggested ? "ring-2 ring-blue-400" : ""}`} />
                                </div>
                                <span className="text-muted-foreground text-xs">x</span>
                                <div className="flex items-center gap-1.5">
                                  <label className="text-xs text-muted-foreground">H</label>
                                  <Input type="number" step="0.125" min="0" placeholder={'0"'}
                                    value={piece.height ?? ""}
                                    onChange={(e) => m.updatePiece(piece.id, { height: e.target.value ? parseFloat(e.target.value) : null, _suggested: undefined })}
                                    className={`h-8 w-20 text-xs border-border bg-background rounded-lg font-mono ${piece._suggested ? "ring-2 ring-blue-400" : ""}`} />
                                </div>
                                {piece.width && piece.height && !piece._suggested && !isFolded && (
                                  <span className="text-xs font-mono text-muted-foreground ml-1">{piece.width}" x {piece.height}"</span>
                                )}
                              </>
                            ) : (
                              <span className="text-sm font-mono text-foreground font-semibold">{piece.width}" x {piece.height}"</span>
                            )}
                          </div>
                          {/* Flat print size callout */}
                          {hasFlat && piece.foldType !== "custom" && (
                            <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 px-3 py-2">
                              <Printer className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span className="text-xs text-amber-800 dark:text-amber-300">
                                <strong>Flat print size:</strong>{" "}
                                <span className="font-mono font-bold">{flat.w}" x {flat.h}"</span>
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 ml-1.5">
                                  ({FOLD_OPTIONS.find(f => f.id === piece.foldType)?.label})
                                </span>
                              </span>
                            </div>
                          )}
                          {/* Custom fold: manual flat size inputs */}
                          {isFolded && piece.foldType === "custom" && (
                            <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 px-3 py-2.5">
                              <Printer className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 mr-1">Flat:</span>
                              <Input type="number" step="0.125" min="0" placeholder="W"
                                value={piece.flatWidth ?? ""}
                                onChange={(e) => m.updatePiece(piece.id, { flatWidth: e.target.value ? parseFloat(e.target.value) : null })}
                                className="h-7 w-16 text-xs font-mono bg-background border-amber-300 rounded-md" />
                              <span className="text-xs text-amber-600">x</span>
                              <Input type="number" step="0.125" min="0" placeholder="H"
                                value={piece.flatHeight ?? ""}
                                onChange={(e) => m.updatePiece(piece.id, { flatHeight: e.target.value ? parseFloat(e.target.value) : null })}
                                className="h-7 w-16 text-xs font-mono bg-background border-amber-300 rounded-md" />
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {/* Size warning -- must be 0.25" total smaller than outer */}
                    {sizeWarn && (
                      <div className="flex items-center gap-2 rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-xs font-medium mb-3">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        {"Must be 0.25\" total smaller than outer. "}
                        {maxInnerW && maxInnerH && <span className="font-mono font-bold">Max: {maxInnerW}" x {maxInnerH}"</span>}
                      </div>
                    )}

                    {/* Production routing */}
                    {(() => {
                      const isPlasticOuter = piece.position === 1 && piece.type === "envelope" && piece.envelopeKind === "plastic"
                      if (isPlasticOuter) return (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground shrink-0">Production:</span>
                        <span className="px-3 py-1 text-xs font-semibold rounded-lg bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
                          No Print -- We Supply Bag
                        </span>
                      </div>
                    </div>
                      )
                      return (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground shrink-0">Production:</span>
                        <div className="flex gap-1 flex-wrap">
                          {(["inhouse", "ohp", "both", "customer"] as const).map((r) => (
                            <button key={r} type="button"
                              onClick={() => m.updatePiece(piece.id, { production: r })}
                              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                                piece.production === r
                                  ? r === "inhouse" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                    : r === "ohp" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                    : r === "customer" ? "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300"
                                    : "bg-primary/10 text-primary"
                                  : "bg-secondary text-muted-foreground hover:text-foreground"
                              }`}>
                              {r === "inhouse" ? "In-House (PrintOut)" : r === "ohp" ? "OHP" : r === "both" ? "Both" : "Customer"}
                            </button>
                          ))}
                        </div>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {piece.production === "inhouse" && (
                            <span className="flex items-center gap-1">
                              <Printer className="h-3 w-3" />
                              PrintOut pricing
                            </span>
                          )}
                          {piece.production === "ohp" && <span className="flex items-center gap-1"><Send className="h-3 w-3" />Vendor bid</span>}
                          {piece.production === "both" && (
                            <span className="flex items-center gap-1">
                              <Printer className="h-3 w-3" />PrintOut + <Send className="h-3 w-3" />OHP
                            </span>
                          )}
                          {piece.production === "customer" && <span className="flex items-center gap-1"><HandMetal className="h-3 w-3" />Customer provides</span>}
                        </span>
                      </div>

                      {/* Customer Provided -- two clean rows */}
                      {piece.production === "customer" && (() => {
                        const cpVendorId = vendors?.find(v2 => v2.company_name === piece.customerProvidedVendor)?.id
                        const isCustomText = piece.customerProvidedVendor && piece.customerProvidedVendor !== "__custom__" && !cpVendorId
                        const selectVal = piece.customerProvidedVendor === "__custom__" ? "__custom__" : cpVendorId || "none"
                        return (
                          <div className="flex flex-col gap-3 mt-2 pl-1">
                            {/* Row 1: Expected date */}
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">When</span>
                              <Input
                                type="date"
                                value={piece.customerProvidedDate || ""}
                                onChange={(e) => m.updatePiece(piece.id, { customerProvidedDate: e.target.value })}
                                className="h-8 text-xs w-40 px-2.5"
                              />
                              <button type="button"
                                onClick={() => m.updatePiece(piece.id, { customerProvidedDate: new Date().toISOString().slice(0, 10) })}
                                className="h-8 px-3 text-[11px] font-medium rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-all">
                                Today
                              </button>
                              <button type="button"
                                onClick={() => { const d = new Date(); d.setDate(d.getDate() + 1); m.updatePiece(piece.id, { customerProvidedDate: d.toISOString().slice(0, 10) }) }}
                                className="h-8 px-3 text-[11px] font-medium rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-all">
                                Tomorrow
                              </button>
                            </div>

                            {/* Row 2: Vendor / source */}
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">From</span>
                              <Select
                                value={selectVal}
                                onValueChange={(val) => {
                                  if (val === "__custom__") m.updatePiece(piece.id, { customerProvidedVendor: "__custom__" })
                                  else if (val === "none") m.updatePiece(piece.id, { customerProvidedVendor: "" })
                                  else { const vnd = vendors?.find(v2 => v2.id === val); m.updatePiece(piece.id, { customerProvidedVendor: vnd?.company_name || val }) }
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs w-48 px-2.5">
                                  <SelectValue placeholder="Select vendor" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  <SelectItem value="__custom__">Custom...</SelectItem>
                                  {vendors?.map((vnd) => (
                                    <SelectItem key={vnd.id} value={vnd.id}>{vnd.company_name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {piece.customerProvidedVendor === "__custom__" && (
                                <Input
                                  type="text"
                                  placeholder="Enter vendor name"
                                  value={cpCustomVendors[piece.id] ?? ""}
                                  onChange={(e) => setCpCustomVendors(prev => ({ ...prev, [piece.id]: e.target.value }))}
                                  onBlur={(e) => {
                                    if (e.target.value.trim()) {
                                      m.updatePiece(piece.id, { customerProvidedVendor: e.target.value.trim() })
                                      setCpCustomVendors(prev => { const n = { ...prev }; delete n[piece.id]; return n })
                                    }
                                  }}
                                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                                  className="h-8 text-xs w-40 px-2.5"
                                  autoFocus
                                />
                              )}
                              {isCustomText && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-foreground">{piece.customerProvidedVendor}</span>
                                  <button type="button"
                                    onClick={() => {
                                      setCpCustomVendors(prev => ({ ...prev, [piece.id]: piece.customerProvidedVendor || "" }))
                                      m.updatePiece(piece.id, { customerProvidedVendor: "__custom__" })
                                    }}
                                    className="text-[10px] text-muted-foreground hover:text-foreground underline">
                                    edit
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                      )
                    })()}
                  </div>

                  {/* Remove button */}
                  <button onClick={() => m.removePiece(piece.id)}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>


      </div>

      {/* ─── USPS Shape Qualification ─── */}
      {hasDims && m.pieces.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">USPS Shape Qualification</h3>
          <div className="flex flex-wrap gap-2">
            {shapes.includes("POSTCARD") && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 px-4 py-2.5">
                <Check className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Postcard</span>
              </div>
            )}
            {shapes.includes("LETTER") && (
              <div className="flex items-center gap-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 px-4 py-2.5">
                <Check className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">Letter</span>
              </div>
            )}
            {shapes.includes("FLAT") && (
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-4 py-2.5">
                <Check className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">Flat</span>
              </div>
            )}
            {shapes.includes("PARCEL") && (
              <div className="flex items-center gap-2 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/40 px-4 py-2.5">
                <Check className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-semibold text-purple-800 dark:text-purple-300">Parcel</span>
              </div>
            )}
            {shapes.length === 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-2.5">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-semibold text-destructive">
                  {m.mailerWidth}" x {m.mailerHeight}" does not fit any USPS shape
                </span>
              </div>
            )}
          </div>
          {shapes.includes("PARCEL") && !shapes.includes("POSTCARD") && !shapes.includes("LETTER") && !shapes.includes("FLAT") && (
            <div className="mt-2 rounded-lg bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/20 px-3 py-2">
              <p className="text-xs text-purple-800 dark:text-purple-300 font-medium mb-1">
                This piece exceeds standard mail dimensions. Available shipping options:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["Parcel Select", "Media Mail", "Library Mail", "Bound Printed Matter (BPM)"].map((svc) => (
                  <span key={svc} className="inline-flex items-center rounded-full bg-purple-100 dark:bg-purple-800/30 px-2.5 py-0.5 text-[10px] font-medium text-purple-700 dark:text-purple-300">
                    {svc}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Use the "Parcels & Special" tab in postage pricing for rates.
              </p>
            </div>
          )}
          {m.outerPiece?.envelopeKind === "plastic" && (() => {
            const env = STANDARD_ENVELOPES.find((e) => e.id === m.outerPiece?.envelopeId)
            return (
            <div className="mt-3 rounded-lg bg-orange-50/80 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/30 px-3 py-2 flex items-center gap-2">
              <div className="shrink-0 h-5 w-5 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                <span className="text-orange-600 text-[10px] font-bold">!</span>
              </div>
              <div>
                <p className="text-xs font-medium text-orange-800 dark:text-orange-300">
                  Plastic / Clear Bag Outer
                  {env?.sku && <span className="ml-1.5 text-[10px] font-normal text-orange-600 dark:text-orange-400">({env.sku})</span>}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {env?.fitsWidth
                    ? `Fits ${env.fitsWidth}" x ${env.fitsHeight}" insert -- actual bag ${env.width}" x ${env.height}". Clear bag inserting flagged in Services.`
                    : "Clear bag inserting and materials will be flagged in the Services tab."}
                </p>
              </div>
            </div>
            )
          })()}
          {(() => {
            const isPlastic = m.outerPiece?.envelopeKind === "plastic"
            const env = isPlastic ? STANDARD_ENVELOPES.find((e) => e.id === m.outerPiece?.envelopeId) : null
            return (
              <p className="text-xs text-muted-foreground mt-2">
                {isPlastic && env?.fitsWidth
                  ? `${env.name} bag (${env.sku}) -- USPS dims: ${m.mailerWidth}" x ${m.mailerHeight}"`
                  : `Based on outer piece dimensions (${m.mailerWidth}" x ${m.mailerHeight}")`}
              </p>
            )
          })()}
        </div>
      )}

      {/* ─── Workflow Preview ─── */}
      {m.pieces.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">Quoting Steps</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Based on your pieces, these calculator steps will be available:
          </p>
          <div className="flex flex-wrap gap-2">
            {stepSummary.map((s) => (
              <div key={s} className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-foreground">
                <Check className="h-3 w-3 text-emerald-600" />
                {s}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Continue Button ─── */}
      <div className="flex justify-end">
        <button
          onClick={onContinue}
          disabled={!canContinue}
          className="flex items-center gap-2 h-12 px-8 bg-foreground text-background text-sm font-semibold rounded-full hover:bg-foreground/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg"
        >
          Continue to Pricing <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
