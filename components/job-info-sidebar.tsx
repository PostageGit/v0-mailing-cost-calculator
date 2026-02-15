"use client"

import { useState } from "react"
import { useQuote } from "@/lib/quote-context"
import { useMailing, STANDARD_ENVELOPES, PIECE_TYPE_META, type PieceType } from "@/lib/mailing-context"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Cloud, Loader2, ChevronLeft, ChevronRight, X, User, Briefcase, Mail, Plus, GripVertical, AlertCircle } from "lucide-react"
import useSWR from "swr"
import type { Customer } from "@/lib/customer-types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())
interface Contact { id: string; name: string; email?: string; phone?: string }

const ADDABLE_TYPES: PieceType[] = ["envelope", "flat_card", "folded_card", "postcard", "booklet", "self_mailer", "letter", "other"]

export function JobInfoSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const q = useQuote()
  const m = useMailing()
  const { data: customers } = useSWR<Customer[]>("/api/customers", fetcher)
  const { data: contacts } = useSWR<Contact[]>(
    q.customerId ? `/api/customers/${q.customerId}/contacts` : null, fetcher,
  )

  const customerName = customers?.find((c) => c.id === q.customerId)?.company_name
  const shapes = m.suggestedShapes
  const hasDims = !!(m.mailerWidth && m.mailerHeight)
  const [addOpen, setAddOpen] = useState(false)

  const saveIcon = q.isSaving
    ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
    : q.savedId ? <Cloud className="h-3 w-3 text-chart-2" /> : null

  // ─── Collapsed ───
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-3 pt-3 w-10 shrink-0">
        <button onClick={onToggle} className="h-8 w-8 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-all" aria-label="Open">
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        {customerName && <CLabel icon={<User className="h-3 w-3" />} text={customerName} />}
        {q.projectName && <CLabel icon={<Briefcase className="h-3 w-3" />} text={q.projectName} />}
        {m.pieces.length > 0 && <CLabel icon={<Mail className="h-3 w-3" />} text={`${m.pieces.length} pc${m.pieces.length > 1 ? "s" : ""}`} />}
      </div>
    )
  }

  // ─── Expanded ───
  return (
    <div className="w-60 shrink-0 flex flex-col">
      <div className="rounded-2xl bg-card border border-border flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 h-9 border-b border-border/60 bg-secondary/30 shrink-0">
          <span className="text-[11px] font-semibold text-foreground tracking-tight">Job Info</span>
          <div className="flex items-center gap-1.5">{saveIcon}
            <button onClick={onToggle} className="p-1 rounded-lg text-muted-foreground hover:text-foreground"><ChevronLeft className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3" style={{ overscrollBehavior: "contain" }}>
          {/* ─── CUSTOMER ─── */}
          <Sec label="Customer">
            <F label="Company">
              <Select value={q.customerId || "none"} onValueChange={(v) => { q.setCustomerId(v === "none" ? null : v); if (v === "none") q.setContactName("") }}>
                <SelectTrigger className="h-7 text-[11px] border-border/60 bg-background rounded-lg"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(customers || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
            {q.customerId && (
              <F label="Contact">
                {contacts && contacts.length > 0 ? (
                  <Select value={q.contactName || "none"} onValueChange={(v) => q.setContactName(v === "none" ? "" : v)}>
                    <SelectTrigger className="h-7 text-[11px] border-border/60 bg-background rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">None</SelectItem>{contacts.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input placeholder="Name" value={q.contactName} onChange={(e) => q.setContactName(e.target.value)} className="h-7 text-[11px] border-border/60 bg-background rounded-lg" />
                )}
              </F>
            )}
          </Sec>

          {/* ─── JOB ─── */}
          <Sec label="Job">
            <F label="Name"><Input placeholder="Project" value={q.projectName} onChange={(e) => q.setProjectName(e.target.value)} className="h-7 text-[11px] border-border/60 bg-background rounded-lg" /></F>
            <div className="grid grid-cols-2 gap-1.5">
              <F label="Qty"><Input type="number" min="1" placeholder="5000" value={m.quantity || ""} onChange={(e) => m.setQuantity(parseInt(e.target.value) || 0)} className="h-7 text-[11px] border-border/60 bg-background rounded-lg font-mono" /></F>
              <F label="PO / Ref"><Input placeholder="#" value={q.referenceNumber} onChange={(e) => q.setReferenceNumber(e.target.value)} className="h-7 text-[11px] border-border/60 bg-background rounded-lg" /></F>
            </div>
          </Sec>

          {/* ═══════════════════════════════════════════════
              MAIL PIECES -- the heart of the job definition
             ═══════════════════════════════════════════════ */}
          <div className="flex flex-col gap-2 rounded-xl bg-secondary/40 border border-foreground/10 p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                Pieces ({m.pieces.length})
              </span>
              <div className="relative">
                <button onClick={() => setAddOpen(!addOpen)} className="flex items-center gap-0.5 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors">
                  <Plus className="h-3 w-3" />Add
                </button>
                {addOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-card rounded-xl border border-border shadow-xl p-1.5 flex flex-col gap-0.5 min-w-[130px]">
                    {ADDABLE_TYPES.map((type) => {
                      const meta = PIECE_TYPE_META[type]
                      return (
                        <button key={type} onClick={() => { m.addPiece(type); setAddOpen(false) }}
                          className="flex items-center gap-2 text-left text-[11px] font-medium px-2 py-1.5 rounded-lg hover:bg-secondary transition-colors">
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${meta.color}`}>{meta.short}</span>
                          {meta.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {m.pieces.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                <Mail className="h-5 w-5 mx-auto mb-1.5 opacity-40" />
                <p className="text-[10px] font-medium">No pieces defined</p>
                <p className="text-[9px] mt-0.5 opacity-70">Add the outer piece first, then inserts</p>
              </div>
            )}

            {/* Each piece as a compact card */}
            {m.pieces.map((piece, idx) => {
              const meta = PIECE_TYPE_META[piece.type]
              const isOuter = piece.position === 1
              const outerW = m.mailerWidth
              const outerH = m.mailerHeight
              const tooWide = !isOuter && piece.width && outerW && piece.width >= outerW
              const tooTall = !isOuter && piece.height && outerH && piece.height >= outerH
              const sizeWarn = tooWide || tooTall

              return (
                <div key={piece.id} className={`flex flex-col gap-1.5 rounded-lg border p-2 ${isOuter ? "bg-background border-foreground/15" : "bg-background border-border/60"}`}>
                  {/* Top row: position, type badge, label, remove */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] font-bold text-muted-foreground w-3 shrink-0">#{piece.position}</span>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded shrink-0 ${meta.color}`}>{meta.short}</span>
                    <Input
                      value={piece.label}
                      onChange={(e) => m.updatePiece(piece.id, { label: e.target.value })}
                      className="h-5 text-[10px] font-medium border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 flex-1"
                      placeholder={meta.label}
                    />
                    {m.pieces.length > 1 && (
                      <button onClick={() => m.removePiece(piece.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>

                  {/* Envelope-specific: kind + standard size */}
                  {piece.type === "envelope" && (
                    <div className="flex flex-col gap-1">
                      <div className="flex gap-1">
                        {(["paper", "plastic"] as const).map((k) => (
                          <button key={k} type="button"
                            onClick={() => m.updatePiece(piece.id, { envelopeKind: piece.envelopeKind === k ? "" : k })}
                            className={`px-2 py-0.5 text-[9px] font-semibold rounded-md transition-all ${
                              piece.envelopeKind === k ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:text-foreground"
                            }`}>
                            {k === "paper" ? "Paper" : "Plastic"}
                          </button>
                        ))}
                      </div>
                      <Select value={piece.envelopeId || "none"} onValueChange={(v) => { if (v !== "none") m.updatePiece(piece.id, { envelopeId: v }) }}>
                        <SelectTrigger className="h-6 text-[10px] border-border/40 bg-secondary/30 rounded-lg">
                          <SelectValue placeholder="Size..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Pick size...</SelectItem>
                          {STANDARD_ENVELOPES.map((env) => (
                            <SelectItem key={env.id} value={env.id}>
                              {env.name} {env.id !== "custom" ? `(${env.width}" x ${env.height}")` : ""} {env.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Dimensions (always, but auto-filled for standard envelopes) */}
                  {(piece.type !== "envelope" || piece.envelopeId === "custom" || !piece.envelopeId) && (
                    <div className="grid grid-cols-2 gap-1">
                      <Input type="number" step="0.125" min="0" placeholder='W"'
                        value={piece.width ?? ""}
                        onChange={(e) => m.updatePiece(piece.id, { width: e.target.value ? parseFloat(e.target.value) : null })}
                        className="h-6 text-[10px] border-border/40 bg-secondary/30 rounded font-mono px-1.5" />
                      <Input type="number" step="0.125" min="0" placeholder='H"'
                        value={piece.height ?? ""}
                        onChange={(e) => m.updatePiece(piece.id, { height: e.target.value ? parseFloat(e.target.value) : null })}
                        className="h-6 text-[10px] border-border/40 bg-secondary/30 rounded font-mono px-1.5" />
                    </div>
                  )}

                  {/* Show auto-filled dims for standard envelopes */}
                  {piece.type === "envelope" && piece.envelopeId && piece.envelopeId !== "custom" && piece.width && piece.height && (
                    <span className="text-[9px] font-mono text-muted-foreground">{piece.width}" x {piece.height}"</span>
                  )}

                  {/* Outer piece badge */}
                  {isOuter && <span className="text-[8px] font-bold text-primary uppercase">Outer -- sets USPS mail size</span>}

                  {/* Size warning for inner pieces */}
                  {sizeWarn && (
                    <div className="flex items-center gap-1 text-[8px] text-destructive font-semibold">
                      <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                      Too big for outer ({outerW}" x {outerH}")
                    </div>
                  )}

                  {/* Calculator routing indicator */}
                  <span className="text-[8px] text-muted-foreground">
                    Calculator: <strong className="text-foreground">{meta.calc === "flat" ? "Flat Printing" : meta.calc === "booklet" ? "Booklet" : meta.calc === "envelope" ? "Envelope" : "OHP"}</strong>
                  </span>
                </div>
              )
            })}

            {/* USPS shape qualification */}
            {hasDims && m.pieces.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1.5 border-t border-border/40">
                <span className="text-[8px] text-muted-foreground mr-1">USPS:</span>
                {shapes.includes("POSTCARD") && <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-3.5 rounded-full border-0 bg-chart-2/10 text-chart-2 font-semibold">Postcard</Badge>}
                {shapes.includes("LETTER") && <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-3.5 rounded-full border-0 bg-primary/10 text-primary font-semibold">Letter</Badge>}
                {shapes.includes("FLAT") && <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-3.5 rounded-full border-0 bg-chart-4/10 text-chart-4 font-semibold">Flat</Badge>}
                {shapes.length === 0 && <span className="text-[8px] text-destructive font-semibold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />Out of range</span>}
              </div>
            )}

            {/* Customer provides printing */}
            <label className="flex items-center gap-2 cursor-pointer pt-1 border-t border-border/40">
              <input type="checkbox" checked={m.customerProvidesPrinting} onChange={(e) => m.setCustomerProvidesPrinting(e.target.checked)} className="h-3 w-3 rounded border-border accent-foreground cursor-pointer" />
              <span className="text-[10px] font-medium text-muted-foreground">Customer provides printing</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tiny helpers ────────────────────────────────────────
function CLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-[8px] text-muted-foreground font-medium [writing-mode:vertical-lr] rotate-180 max-h-16 truncate">{text}</span>
    </div>
  )
}
function Sec({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-2"><span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>{children}</div>
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-0.5"><label className="text-[10px] text-muted-foreground">{label}</label>{children}</div>
}
