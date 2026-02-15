"use client"

import { useState, useEffect } from "react"
import { useQuote } from "@/lib/quote-context"
import { useMailing } from "@/lib/mailing-context"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Cloud, Loader2, User, Briefcase, ChevronLeft, ChevronRight } from "lucide-react"
import useSWR from "swr"
import type { Customer } from "@/lib/customer-types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())
interface Contact { id: string; name: string; email?: string; phone?: string }

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

  const saveIcon = quote.isSaving
    ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
    : quote.savedId
    ? <Cloud className="h-3 w-3 text-chart-2" />
    : null

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
        {/* Vertical summary icons */}
        {customerName && (
          <div className="flex flex-col items-center gap-1 mt-1">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[9px] text-muted-foreground font-medium [writing-mode:vertical-lr] rotate-180 max-h-20 truncate">
              {customerName}
            </span>
          </div>
        )}
        {quote.projectName && (
          <div className="flex flex-col items-center gap-1">
            <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[9px] text-muted-foreground font-medium [writing-mode:vertical-lr] rotate-180 max-h-20 truncate">
              {quote.projectName}
            </span>
          </div>
        )}
        {hasDims && (
          <span className="text-[9px] text-muted-foreground font-mono [writing-mode:vertical-lr] rotate-180">
            {mailing.mailerWidth}&times;{mailing.mailerHeight}
          </span>
        )}
      </div>
    )
  }

  // Expanded = full left sidebar panel
  return (
    <div className="w-56 shrink-0 flex flex-col">
      <div className="rounded-2xl bg-card border border-border flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 h-10 border-b border-border/60 bg-secondary/30 shrink-0">
          <span className="text-[11px] font-semibold text-foreground tracking-tight">Job Info</span>
          <div className="flex items-center gap-1.5">
            {saveIcon}
            <button
              onClick={onToggle}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Collapse job info"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4" style={{ overscrollBehavior: "contain" }}>
          {/* Customer Section */}
          <Section label="Customer">
            <Field label="Company">
              <Select
                value={quote.customerId || "none"}
                onValueChange={(v) => {
                  quote.setCustomerId(v === "none" ? null : v)
                  if (v === "none") quote.setContactName("")
                }}
              >
                <SelectTrigger className="h-7 text-[11px] border-border/60 bg-background rounded-lg">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(customers || []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Contact">
              {quote.customerId && contacts && contacts.length > 0 ? (
                <Select
                  value={quote.contactName || "none"}
                  onValueChange={(v) => quote.setContactName(v === "none" ? "" : v)}
                >
                  <SelectTrigger className="h-7 text-[11px] border-border/60 bg-background rounded-lg">
                    <SelectValue placeholder="Pick..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder={quote.customerId ? "Type name" : "Pick company first"}
                  value={quote.contactName}
                  onChange={(e) => quote.setContactName(e.target.value)}
                  className="h-7 text-[11px] border-border/60 bg-background rounded-lg"
                  disabled={!quote.customerId}
                />
              )}
            </Field>
          </Section>

          {/* Job Section */}
          <Section label="Job Details">
            <Field label="Job Name">
              <Input
                placeholder="Project name"
                value={quote.projectName}
                onChange={(e) => quote.setProjectName(e.target.value)}
                className="h-7 text-[11px] border-border/60 bg-background rounded-lg"
              />
            </Field>
            <Field label="PO / Ref #">
              <Input
                placeholder="Reference"
                value={quote.referenceNumber}
                onChange={(e) => quote.setReferenceNumber(e.target.value)}
                className="h-7 text-[11px] border-border/60 bg-background rounded-lg"
              />
            </Field>
          </Section>

          {/* Mail Piece Section */}
          <Section label="Mail Piece">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Width">
                <Input
                  type="number" step="0.125" min="0" placeholder="6"
                  value={mailing.mailerWidth ?? ""}
                  onChange={(e) => mailing.setMailerWidth(e.target.value ? parseFloat(e.target.value) : null)}
                  className="h-7 text-[11px] border-border/60 bg-background rounded-lg font-mono"
                />
              </Field>
              <Field label="Height">
                <Input
                  type="number" step="0.125" min="0" placeholder="9"
                  value={mailing.mailerHeight ?? ""}
                  onChange={(e) => mailing.setMailerHeight(e.target.value ? parseFloat(e.target.value) : null)}
                  className="h-7 text-[11px] border-border/60 bg-background rounded-lg font-mono"
                />
              </Field>
            </div>
            <Field label="Inserts">
              <Input
                type="number" min="0" step="1" placeholder="0"
                value={mailing.inserts || ""}
                onChange={(e) => mailing.setInserts(parseInt(e.target.value) || 0)}
                className="h-7 text-[11px] border-border/60 bg-background rounded-lg font-mono"
              />
            </Field>
            {/* Shape qualifications */}
            {hasDims && (
              <div className="flex flex-wrap gap-1 mt-1">
                {shapes.includes("POSTCARD") && <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 rounded-full border-0 bg-chart-2/10 text-chart-2 font-medium">Postcard</Badge>}
                {shapes.includes("LETTER") && <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 rounded-full border-0 bg-primary/10 text-primary font-medium">Letter</Badge>}
                {shapes.includes("FLAT") && <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 rounded-full border-0 bg-chart-4/10 text-chart-4 font-medium">Flat</Badge>}
                {shapes.length === 0 && <span className="text-[10px] text-destructive font-medium">Out of range</span>}
              </div>
            )}
          </Section>
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
