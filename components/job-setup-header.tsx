"use client"

import { useState } from "react"
import { useQuote } from "@/lib/quote-context"
import { useMailing } from "@/lib/mailing-context"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Cloud, Loader2, ChevronDown, ChevronUp } from "lucide-react"
import useSWR from "swr"
import type { Customer } from "@/lib/customer-types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Contact { id: string; name: string; email?: string; phone?: string }

export function JobSetupHeader() {
  const [expanded, setExpanded] = useState(false)
  const quote = useQuote()
  const mailing = useMailing()
  const { data: customers } = useSWR<Customer[]>("/api/customers", fetcher)
  const { data: contacts } = useSWR<Contact[]>(
    quote.customerId ? `/api/customers/${quote.customerId}/contacts` : null, fetcher,
  )

  const customerName = customers?.find((c) => c.id === quote.customerId)?.company_name
  const shapes = mailing.suggestedShapes
  const hasDims = !!(mailing.mailerWidth && mailing.mailerHeight)
  const hasBasicInfo = !!(quote.customerId || quote.projectName)

  const saveIcon = quote.isSaving
    ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
    : quote.savedId
    ? <Cloud className="h-3 w-3 text-chart-2" />
    : null

  // Collapsed = one slim clickable row with summary
  // Expanded = full form fields below
  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      {/* Collapsed summary bar -- always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {saveIcon}
          {hasBasicInfo ? (
            <div className="flex items-center gap-2 min-w-0">
              {customerName && (
                <span className="text-xs font-semibold text-foreground truncate max-w-[140px]">
                  {customerName}
                </span>
              )}
              {customerName && quote.projectName && (
                <span className="text-muted-foreground text-xs">/</span>
              )}
              {quote.projectName && (
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {quote.projectName}
                </span>
              )}
              {quote.contactName && (
                <span className="text-[11px] text-muted-foreground truncate max-w-[120px] hidden sm:inline">
                  ({quote.contactName})
                </span>
              )}
              {hasDims && (
                <span className="text-[11px] text-muted-foreground font-mono hidden md:inline">
                  {mailing.mailerWidth}&times;{mailing.mailerHeight}&quot;
                </span>
              )}
              {shapes.length > 0 && hasDims && (
                <div className="hidden lg:flex items-center gap-1">
                  {shapes.map((s) => (
                    <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0 h-4 rounded-full border-0 bg-secondary text-muted-foreground">
                      {s === "POSTCARD" ? "PC" : s === "LETTER" ? "LTR" : "FLT"}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">
              Set up job details
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium hidden sm:inline">
            Job Info
          </span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded form */}
      {expanded && (
        <div className="border-t border-border/60 p-4 flex flex-col gap-3 animate-in slide-in-from-top-1 duration-150">
          {/* Row 1: Customer / Contact / Job / PO */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Customer">
              <Select
                value={quote.customerId || "none"}
                onValueChange={(v) => {
                  quote.setCustomerId(v === "none" ? null : v)
                  if (v === "none") quote.setContactName("")
                }}
              >
                <SelectTrigger className="h-8 text-xs border-border/60 bg-background rounded-lg">
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
                  <SelectTrigger className="h-8 text-xs border-border/60 bg-background rounded-lg">
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
                  placeholder={quote.customerId ? "No contacts" : "Select customer"}
                  value={quote.contactName}
                  onChange={(e) => quote.setContactName(e.target.value)}
                  className="h-8 text-xs border-border/60 bg-background rounded-lg"
                  disabled={!quote.customerId}
                />
              )}
            </Field>

            <Field label="Job Name">
              <Input
                placeholder="Project name"
                value={quote.projectName}
                onChange={(e) => quote.setProjectName(e.target.value)}
                className="h-8 text-xs border-border/60 bg-background rounded-lg"
              />
            </Field>

            <Field label="PO / Ref #">
              <Input
                placeholder="Reference"
                value={quote.referenceNumber}
                onChange={(e) => quote.setReferenceNumber(e.target.value)}
                className="h-8 text-xs border-border/60 bg-background rounded-lg"
              />
            </Field>
          </div>

          {/* Row 2: Dimensions + Inserts + Shape hints */}
          <div className="grid grid-cols-4 lg:grid-cols-6 gap-3">
            <Field label="Width (in)">
              <Input
                type="number" step="0.125" min="0" placeholder="6"
                value={mailing.mailerWidth ?? ""}
                onChange={(e) => mailing.setMailerWidth(e.target.value ? parseFloat(e.target.value) : null)}
                className="h-8 text-xs border-border/60 bg-background rounded-lg font-mono"
              />
            </Field>
            <Field label="Height (in)">
              <Input
                type="number" step="0.125" min="0" placeholder="9"
                value={mailing.mailerHeight ?? ""}
                onChange={(e) => mailing.setMailerHeight(e.target.value ? parseFloat(e.target.value) : null)}
                className="h-8 text-xs border-border/60 bg-background rounded-lg font-mono"
              />
            </Field>
            <Field label="Inserts">
              <Input
                type="number" min="0" step="1" placeholder="0"
                value={mailing.inserts || ""}
                onChange={(e) => mailing.setInserts(parseInt(e.target.value) || 0)}
                className="h-8 text-xs border-border/60 bg-background rounded-lg font-mono"
              />
            </Field>
            <div className="flex flex-col gap-1 lg:col-span-3 justify-end">
              <label className="text-[10px] font-medium text-muted-foreground">Qualifies For</label>
              <div className="flex items-center gap-1.5 h-8">
                {hasDims ? (
                  <>
                    {shapes.includes("POSTCARD") && <Badge variant="secondary" className="text-[10px] px-2 py-0.5 rounded-full border-0 bg-chart-2/10 text-chart-2">Postcard</Badge>}
                    {shapes.includes("LETTER") && <Badge variant="secondary" className="text-[10px] px-2 py-0.5 rounded-full border-0 bg-accent/10 text-accent">Letter</Badge>}
                    {shapes.includes("FLAT") && <Badge variant="secondary" className="text-[10px] px-2 py-0.5 rounded-full border-0 bg-chart-4/10 text-chart-4">Flat</Badge>}
                    {shapes.length === 0 && <span className="text-[11px] text-destructive font-medium">Out of USPS range</span>}
                  </>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Enter dimensions</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}
