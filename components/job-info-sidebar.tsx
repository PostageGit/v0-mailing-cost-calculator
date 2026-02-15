"use client"

import { useState, useEffect } from "react"
import { useQuote } from "@/lib/quote-context"
import { useMailing, STANDARD_ENVELOPES, type SinglePieceType, type InsertType } from "@/lib/mailing-context"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Cloud, Loader2, ChevronLeft, ChevronRight, X, User, Briefcase, Mail, Plus } from "lucide-react"
import useSWR from "swr"
import type { Customer } from "@/lib/customer-types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())
interface Contact { id: string; name: string; email?: string; phone?: string }

function Pill({ label, active, onClick, small, className = "" }: { label: string; active: boolean; onClick: () => void; small?: boolean; className?: string }) {
  return (
    <button
      type="button" onClick={onClick}
      className={`${small ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]"} font-semibold rounded-lg transition-all whitespace-nowrap ${
        active ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:text-foreground"
      } ${className}`}
    >{label}</button>
  )
}

const SINGLE_TYPES: { value: SinglePieceType; label: string; desc: string }[] = [
  { value: "postcard",    label: "Postcard",     desc: "Single flat card" },
  { value: "flat_card",   label: "Flat Card",    desc: "Flat sheet" },
  { value: "folded_card", label: "Folded Card",  desc: "Single fold" },
  { value: "self_mailer", label: "Self-Mailer",  desc: "No envelope" },
  { value: "booklet",     label: "Booklet",      desc: "Saddle stitch" },
]

const INSERT_TYPES: { value: InsertType; label: string; color: string }[] = [
  { value: "flat_card",       label: "Flat",     color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  { value: "folded_card",     label: "Folded",   color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  { value: "booklet",         label: "Booklet",  color: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300" },
  { value: "letter",          label: "Letter",   color: "bg-secondary text-foreground" },
  { value: "small_envelope",  label: "Envelope", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
]

export function JobInfoSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const quote = useQuote()
  const m = useMailing()
  const { data: customers } = useSWR<Customer[]>("/api/customers", fetcher)
  const { data: contacts } = useSWR<Contact[]>(
    quote.customerId ? `/api/customers/${quote.customerId}/contacts` : null, fetcher,
  )

  const customerName = customers?.find((c) => c.id === quote.customerId)?.company_name
  const shapes = m.suggestedShapes
  const hasDims = !!(m.outerWidth && m.outerHeight)

  // Filter envelopes that fit based on largest insert
  const maxInsertW = m.inserts.reduce((mx, ins) => Math.max(mx, ins.width || 0), 0)
  const maxInsertH = m.inserts.reduce((mx, ins) => Math.max(mx, ins.height || 0), 0)

  const saveIcon = quote.isSaving
    ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
    : quote.savedId ? <Cloud className="h-3 w-3 text-chart-2" /> : null

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-3 pt-3 w-10 shrink-0">
        <button onClick={onToggle} className="h-8 w-8 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:shadow-sm transition-all" aria-label="Open job info">
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        {customerName && <CollapsedLabel icon={<User className="h-3 w-3" />} text={customerName} />}
        {quote.projectName && <CollapsedLabel icon={<Briefcase className="h-3 w-3" />} text={quote.projectName} />}
        {(m.singlePieceType || m.isMultiPiece) && (
          <CollapsedLabel icon={<Mail className="h-3 w-3" />} text={
            m.isMultiPiece
              ? `${m.pieceCount}pc ${hasDims ? `${m.outerWidth}x${m.outerHeight}` : ""}`
              : `${m.singlePieceType} ${hasDims ? `${m.outerWidth}x${m.outerHeight}` : ""}`
          } />
        )}
      </div>
    )
  }

  return (
    <div className="w-60 shrink-0 flex flex-col">
      <div className="rounded-2xl bg-card border border-border flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-3 h-9 border-b border-border/60 bg-secondary/30 shrink-0">
          <span className="text-[11px] font-semibold text-foreground tracking-tight">Job Info</span>
          <div className="flex items-center gap-1.5">{saveIcon}
            <button onClick={onToggle} className="p-1 rounded-lg text-muted-foreground hover:text-foreground"><ChevronLeft className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3" style={{ overscrollBehavior: "contain" }}>
          {/* ─── CUSTOMER ─── */}
          <Section label="Customer">
            <Field label="Company">
              <Select value={quote.customerId || "none"} onValueChange={(v) => { quote.setCustomerId(v === "none" ? null : v); if (v === "none") quote.setContactName("") }}>
                <SelectTrigger className="h-7 text-[11px] border-border/60 bg-background rounded-lg"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(customers || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Contact">
              {quote.customerId && contacts && contacts.length > 0 ? (
                <Select value={quote.contactName || "none"} onValueChange={(v) => quote.setContactName(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-7 text-[11px] border-border/60 bg-background rounded-lg"><SelectValue placeholder="Pick..." /></SelectTrigger>
                  <SelectContent><SelectItem value="none">None</SelectItem>{contacts.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input placeholder={quote.customerId ? "Type name" : "Pick company"} value={quote.contactName} onChange={(e) => quote.setContactName(e.target.value)} className="h-7 text-[11px] border-border/60 bg-background rounded-lg" disabled={!quote.customerId} />
              )}
            </Field>
          </Section>

          {/* ─── JOB ─── */}
          <Section label="Job">
            <Field label="Name"><Input placeholder="Project name" value={quote.projectName} onChange={(e) => quote.setProjectName(e.target.value)} className="h-7 text-[11px] border-border/60 bg-background rounded-lg" /></Field>
            <Field label="PO / Ref"><Input placeholder="Reference" value={quote.referenceNumber} onChange={(e) => quote.setReferenceNumber(e.target.value)} className="h-7 text-[11px] border-border/60 bg-background rounded-lg" /></Field>
          </Section>

          {/* ═══════════════════════════════════════════════
              MAIL PIECE -- The star of the show
             ═══════════════════════════════════════════════ */}
          <div className="flex flex-col gap-2.5 rounded-xl bg-secondary/40 border border-foreground/10 p-2.5">
            <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">Mail Piece</span>

            {/* Step 1: How many pieces? */}
            <Field label="How many pieces in the mail?">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pill
                    key={n} label={n === 5 ? "5+" : String(n)}
                    active={m.pieceCount === n}
                    onClick={() => {
                      m.setPieceCount(n)
                      // Reset inserts to match count - 1 (outer doesn't count)
                      if (n <= 1) { m.setSinglePieceType(""); }
                    }}
                    small
                  />
                ))}
              </div>
            </Field>

            {/* ─── SINGLE PIECE (count = 1) ─── */}
            {m.pieceCount === 1 && (
              <>
                <Field label="What is it?">
                  <div className="flex flex-wrap gap-1">
                    {SINGLE_TYPES.map((t) => (
                      <Pill key={t.value} label={t.label} active={m.singlePieceType === t.value}
                        onClick={() => m.setSinglePieceType(m.singlePieceType === t.value ? "" : t.value)} small />
                    ))}
                  </div>
                </Field>
                {m.singlePieceType && (
                  <div className="grid grid-cols-2 gap-1.5">
                    <Field label="Width"><Input type="number" step="0.125" min="0" placeholder="W" value={m.outerWidth ?? ""} onChange={(e) => m.setOuterWidth(e.target.value ? parseFloat(e.target.value) : null)} className="h-7 text-[11px] border-border/60 bg-background rounded-lg font-mono" /></Field>
                    <Field label="Height"><Input type="number" step="0.125" min="0" placeholder="H" value={m.outerHeight ?? ""} onChange={(e) => m.setOuterHeight(e.target.value ? parseFloat(e.target.value) : null)} className="h-7 text-[11px] border-border/60 bg-background rounded-lg font-mono" /></Field>
                  </div>
                )}
              </>
            )}

            {/* ─── MULTI PIECE (count > 1) = Envelope + inserts ─── */}
            {m.pieceCount > 1 && (
              <>
                {/* Outer envelope */}
                <div className="flex flex-col gap-1.5 rounded-lg bg-background border border-border/60 p-2">
                  <span className="text-[9px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-foreground" />
                    Outer Envelope
                  </span>
                  <div className="flex gap-1">
                    <Pill label="Paper" active={m.envelopeKind === "paper"} onClick={() => m.setEnvelopeKind(m.envelopeKind === "paper" ? "" : "paper")} small />
                    <Pill label="Plastic" active={m.envelopeKind === "plastic"} onClick={() => m.setEnvelopeKind(m.envelopeKind === "plastic" ? "" : "plastic")} small />
                  </div>
                  <Field label="Envelope size">
                    <Select value={m.outerEnvelopeId || "none"} onValueChange={(v) => { if (v !== "none") m.setOuterEnvelopeId(v) }}>
                      <SelectTrigger className="h-7 text-[11px] border-border/60 bg-background rounded-lg">
                        <SelectValue placeholder="Select size..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select...</SelectItem>
                        {STANDARD_ENVELOPES.map((env) => (
                          <SelectItem key={env.id} value={env.id}>
                            {env.name} ({env.width}" x {env.height}") - {env.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  {m.outerEnvelopeId === "custom" && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <Field label="W"><Input type="number" step="0.125" min="0" value={m.outerWidth ?? ""} onChange={(e) => m.setOuterWidth(e.target.value ? parseFloat(e.target.value) : null)} className="h-7 text-[11px] border-border/60 bg-background rounded-lg font-mono" /></Field>
                      <Field label="H"><Input type="number" step="0.125" min="0" value={m.outerHeight ?? ""} onChange={(e) => m.setOuterHeight(e.target.value ? parseFloat(e.target.value) : null)} className="h-7 text-[11px] border-border/60 bg-background rounded-lg font-mono" /></Field>
                    </div>
                  )}
                  {hasDims && (
                    <span className="text-[9px] font-mono text-muted-foreground">{m.outerWidth}" x {m.outerHeight}" -- USPS mail piece size</span>
                  )}
                </div>

                {/* Inner pieces */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-foreground uppercase tracking-wider">
                      Inside ({m.inserts.length} of {m.pieceCount - 1})
                    </span>
                    {m.inserts.length < m.pieceCount - 1 && (
                      <InsertAddMenu onAdd={m.addInsert} />
                    )}
                  </div>

                  {m.inserts.map((ins) => {
                    const it = INSERT_TYPES.find((t) => t.value === ins.type)
                    return (
                      <div key={ins.id} className="flex flex-col gap-1 rounded-lg bg-background border border-border/60 p-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${it?.color || "bg-secondary text-foreground"}`}>
                            {it?.label || ins.type}
                          </span>
                          <Input
                            placeholder="Description..."
                            value={ins.description}
                            onChange={(e) => m.updateInsert(ins.id, { description: e.target.value })}
                            className="h-5 text-[10px] border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 flex-1"
                          />
                          <button onClick={() => m.removeInsert(ins.id)} className="text-muted-foreground hover:text-destructive"><X className="h-2.5 w-2.5" /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          <Input type="number" step="0.125" placeholder="W" value={ins.width ?? ""}
                            onChange={(e) => m.updateInsert(ins.id, { width: e.target.value ? parseFloat(e.target.value) : null })}
                            className="h-6 text-[10px] border-border/40 bg-secondary/30 rounded font-mono px-1.5" />
                          <Input type="number" step="0.125" placeholder="H" value={ins.height ?? ""}
                            onChange={(e) => m.updateInsert(ins.id, { height: e.target.value ? parseFloat(e.target.value) : null })}
                            className="h-6 text-[10px] border-border/40 bg-secondary/30 rounded font-mono px-1.5" />
                        </div>
                        {/* Size warning */}
                        {ins.width && ins.height && m.outerWidth && m.outerHeight && (ins.width >= m.outerWidth || ins.height >= m.outerHeight) && (
                          <span className="text-[8px] text-destructive font-semibold">Too big for {m.outerWidth}" x {m.outerHeight}" envelope</span>
                        )}
                      </div>
                    )
                  })}

                  {m.inserts.length < m.pieceCount - 1 && (
                    <span className="text-[9px] text-muted-foreground italic">
                      Add {m.pieceCount - 1 - m.inserts.length} more insert{m.pieceCount - 1 - m.inserts.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </>
            )}

            {/* Shape qualification badges */}
            {hasDims && (
              <div className="flex flex-wrap gap-1 pt-1 border-t border-border/40">
                <span className="text-[8px] text-muted-foreground mr-1">USPS:</span>
                {shapes.includes("POSTCARD") && <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-3.5 rounded-full border-0 bg-chart-2/10 text-chart-2 font-semibold">Postcard</Badge>}
                {shapes.includes("LETTER") && <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-3.5 rounded-full border-0 bg-primary/10 text-primary font-semibold">Letter</Badge>}
                {shapes.includes("FLAT") && <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-3.5 rounded-full border-0 bg-chart-4/10 text-chart-4 font-semibold">Flat</Badge>}
                {shapes.length === 0 && <span className="text-[8px] text-destructive font-semibold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />Out of range</span>}
              </div>
            )}

            {/* Customer provides printing */}
            <div className="pt-1 border-t border-border/40">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={m.customerProvidesPrinting} onChange={(e) => m.setCustomerProvidesPrinting(e.target.checked)} className="h-3 w-3 rounded border-border accent-foreground cursor-pointer" />
                <span className="text-[10px] font-medium text-muted-foreground">Customer provides printing</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InsertAddMenu({ onAdd }: { onAdd: (type: InsertType) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-0.5 text-[9px] font-semibold text-primary hover:text-primary/80">
        <Plus className="h-2.5 w-2.5" />Add
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-card rounded-lg border border-border shadow-lg p-1 flex flex-col gap-0.5 min-w-[100px]">
          {INSERT_TYPES.map((t) => (
            <button key={t.value} onClick={() => { onAdd(t.value); setOpen(false) }}
              className="text-left text-[10px] font-medium px-2 py-1 rounded hover:bg-secondary transition-colors">
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CollapsedLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-[8px] text-muted-foreground font-medium [writing-mode:vertical-lr] rotate-180 max-h-16 truncate">{text}</span>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-2"><span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>{children}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-0.5"><label className="text-[10px] text-muted-foreground">{label}</label>{children}</div>
}
