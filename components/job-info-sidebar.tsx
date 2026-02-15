"use client"

import { useState, useEffect } from "react"
import { useQuote } from "@/lib/quote-context"
import { useMailing, type PieceType, type InsertType } from "@/lib/mailing-context"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Cloud, Loader2, ChevronLeft, ChevronRight, Plus, X, User, Briefcase, Mail } from "lucide-react"
import useSWR from "swr"
import type { Customer } from "@/lib/customer-types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())
interface Contact { id: string; name: string; email?: string; phone?: string }

// ─── Pill button ─────────────────────────────────────────
function Pill({ label, active, onClick, className = "" }: { label: string; active: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-all whitespace-nowrap ${
        active ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:text-foreground"
      } ${className}`}
    >
      {label}
    </button>
  )
}

// ─── Constants ───────────────────────────────────────────
const PIECE_TYPES: { value: PieceType; label: string }[] = [
  { value: "postcard",    label: "Postcard" },
  { value: "flat_card",   label: "Flat Card" },
  { value: "folded_card", label: "Folded Card" },
  { value: "envelope",    label: "In Envelope" },
  { value: "self_mailer", label: "Self-Mailer" },
  { value: "booklet",     label: "Booklet" },
]

const INSERT_TYPES: { value: InsertType; label: string }[] = [
  { value: "flat",    label: "Flat" },
  { value: "folded",  label: "Folded" },
  { value: "booklet", label: "Booklet" },
  { value: "card",    label: "Card" },
]

const INSERT_COLORS: Record<InsertType, string> = {
  flat:    "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  folded:  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  booklet: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  card:    "bg-secondary text-foreground",
}

export function JobInfoSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const quote = useQuote()
  const mailing = useMailing()
  const { data: customers } = useSWR<Customer[]>("/api/customers", fetcher)
  const { data: contacts } = useSWR<Contact[]>(
    quote.customerId ? `/api/customers/${quote.customerId}/contacts` : null, fetcher,
  )

  const customerName = customers?.find((c) => c.id === quote.customerId)?.company_name
  const shapes = mailing.suggestedShapes
  const hasDims = !!(mailing.mailerWidth && mailing.mailerHeight)

  const saveIcon = mailing ? (
    quote.isSaving
      ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      : quote.savedId
        ? <Cloud className="h-3 w-3 text-chart-2" />
        : null
  ) : null

  // Collapsed = thin icon strip
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-3 pt-3 w-10 shrink-0">
        <button
          onClick={onToggle}
          className="h-8 w-8 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:shadow-sm transition-all"
          aria-label="Open job info"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        {customerName && (
          <div className="flex flex-col items-center gap-1 mt-1">
            <User className="h-3 w-3 text-muted-foreground" />
            <span className="text-[8px] text-muted-foreground font-medium [writing-mode:vertical-lr] rotate-180 max-h-16 truncate">{customerName}</span>
          </div>
        )}
        {quote.projectName && (
          <div className="flex flex-col items-center gap-1">
            <Briefcase className="h-3 w-3 text-muted-foreground" />
            <span className="text-[8px] text-muted-foreground font-medium [writing-mode:vertical-lr] rotate-180 max-h-16 truncate">{quote.projectName}</span>
          </div>
        )}
        {mailing.pieceType && (
          <div className="flex flex-col items-center gap-1">
            <Mail className="h-3 w-3 text-muted-foreground" />
            <span className="text-[8px] text-muted-foreground font-medium [writing-mode:vertical-lr] rotate-180 max-h-16 truncate">
              {hasDims ? `${mailing.mailerWidth}x${mailing.mailerHeight}` : mailing.pieceType}
            </span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-60 shrink-0 flex flex-col">
      <div className="rounded-2xl bg-card border border-border flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 h-9 border-b border-border/60 bg-secondary/30 shrink-0">
          <span className="text-[11px] font-semibold text-foreground tracking-tight">Job Info</span>
          <div className="flex items-center gap-1.5">
            {saveIcon}
            <button onClick={onToggle} className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors" aria-label="Collapse">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4" style={{ overscrollBehavior: "contain" }}>
          {/* Customer */}
          <Section label="Customer">
            <Field label="Company">
              <Select
                value={quote.customerId || "none"}
                onValueChange={(v) => { quote.setCustomerId(v === "none" ? null : v); if (v === "none") quote.setContactName("") }}
              >
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
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {contacts.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input placeholder={quote.customerId ? "Type name" : "Pick company"} value={quote.contactName} onChange={(e) => quote.setContactName(e.target.value)} className="h-7 text-[11px] border-border/60 bg-background rounded-lg" disabled={!quote.customerId} />
              )}
            </Field>
          </Section>

          {/* Job Details */}
          <Section label="Job">
            <Field label="Name">
              <Input placeholder="Project name" value={quote.projectName} onChange={(e) => quote.setProjectName(e.target.value)} className="h-7 text-[11px] border-border/60 bg-background rounded-lg" />
            </Field>
            <Field label="PO / Ref #">
              <Input placeholder="Reference" value={quote.referenceNumber} onChange={(e) => quote.setReferenceNumber(e.target.value)} className="h-7 text-[11px] border-border/60 bg-background rounded-lg" />
            </Field>
          </Section>

          {/* ─── MAIL PIECE (the star) ─── */}
          <div className="flex flex-col gap-2.5 rounded-xl bg-secondary/40 border border-border p-2.5">
            <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">Mail Piece</span>

            {/* What is it? */}
            <div className="flex flex-wrap gap-1">
              {PIECE_TYPES.map((pt) => (
                <Pill
                  key={pt.value}
                  label={pt.label}
                  active={mailing.pieceType === pt.value}
                  onClick={() => {
                    mailing.setPieceType(mailing.pieceType === pt.value ? "" : pt.value)
                    if (pt.value !== "envelope") mailing.setEnvelopeKind("")
                  }}
                />
              ))}
            </div>

            {/* Envelope sub-type */}
            {mailing.pieceType === "envelope" && (
              <div className="flex gap-1">
                <Pill label="Paper" active={mailing.envelopeKind === "paper"} onClick={() => mailing.setEnvelopeKind(mailing.envelopeKind === "paper" ? "" : "paper")} />
                <Pill label="Plastic" active={mailing.envelopeKind === "plastic"} onClick={() => mailing.setEnvelopeKind(mailing.envelopeKind === "plastic" ? "" : "plastic")} />
              </div>
            )}

            {/* Dimensions */}
            <div className="grid grid-cols-2 gap-1.5">
              <Field label="Width (in)">
                <Input type="number" step="0.125" min="0" placeholder="6" value={mailing.mailerWidth ?? ""} onChange={(e) => mailing.setMailerWidth(e.target.value ? parseFloat(e.target.value) : null)} className="h-7 text-[11px] border-border/60 bg-background rounded-lg font-mono" />
              </Field>
              <Field label="Height (in)">
                <Input type="number" step="0.125" min="0" placeholder="9" value={mailing.mailerHeight ?? ""} onChange={(e) => mailing.setMailerHeight(e.target.value ? parseFloat(e.target.value) : null)} className="h-7 text-[11px] border-border/60 bg-background rounded-lg font-mono" />
              </Field>
            </div>

            {/* Shape badges */}
            {hasDims && (
              <div className="flex flex-wrap gap-1">
                {shapes.includes("POSTCARD") && <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-3.5 rounded-full border-0 bg-chart-2/10 text-chart-2 font-semibold">Postcard</Badge>}
                {shapes.includes("LETTER") && <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-3.5 rounded-full border-0 bg-primary/10 text-primary font-semibold">Letter</Badge>}
                {shapes.includes("FLAT") && <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-3.5 rounded-full border-0 bg-chart-4/10 text-chart-4 font-semibold">Flat</Badge>}
                {shapes.length === 0 && (
                  <span className="text-[9px] text-destructive font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                    Out of range
                  </span>
                )}
              </div>
            )}

            {/* ─── Inserts ─── */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-muted-foreground">Inserts ({mailing.inserts.length})</span>
                {/* Quick-add */}
                <div className="flex gap-0.5">
                  {INSERT_TYPES.map((it) => (
                    <button
                      key={it.value}
                      type="button"
                      onClick={() => mailing.addInsert(it.value)}
                      title={`Add ${it.label} insert`}
                      className="p-0.5 rounded text-[8px] font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      +{it.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Insert list */}
              {mailing.inserts.length > 0 && (
                <div className="flex flex-col gap-1">
                  {mailing.inserts.map((ins, idx) => (
                    <div key={ins.id} className="flex items-center gap-1.5 bg-background rounded-lg border border-border/60 px-2 py-1">
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded leading-none ${INSERT_COLORS[ins.type]}`}>
                        {ins.type.toUpperCase()}
                      </span>
                      <Input
                        placeholder={`Insert ${idx + 1} desc`}
                        value={ins.description}
                        onChange={(e) => {
                          const updated = [...mailing.inserts]
                          updated[idx] = { ...ins, description: e.target.value }
                          mailing.setInserts(updated)
                        }}
                        className="h-5 text-[10px] border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 flex-1"
                      />
                      <button onClick={() => mailing.removeInsert(ins.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Customer provides printing toggle */}
            <div className="flex flex-col gap-1 pt-1 border-t border-border/60">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mailing.customerProvidesPrinting}
                  onChange={(e) => mailing.setCustomerProvidesPrinting(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border accent-foreground cursor-pointer"
                />
                <span className="text-[10px] font-medium text-muted-foreground">Customer provides printing</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mailing.customerProvidesInserts}
                  onChange={(e) => mailing.setCustomerProvidesInserts(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border accent-foreground cursor-pointer"
                />
                <span className="text-[10px] font-medium text-muted-foreground">Customer provides inserts</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}
