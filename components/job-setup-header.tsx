"use client"

import { useQuote } from "@/lib/quote-context"
import { useMailing } from "@/lib/mailing-context"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Cloud, Loader2 } from "lucide-react"
import useSWR from "swr"
import type { Customer } from "@/lib/customer-types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Contact { id: string; name: string; email?: string; phone?: string }

export function JobSetupHeader() {
  const quote = useQuote()
  const mailing = useMailing()
  const { data: customers } = useSWR<Customer[]>("/api/customers", fetcher)
  const { data: contacts } = useSWR<Contact[]>(
    quote.customerId ? `/api/customers/${quote.customerId}/contacts` : null, fetcher,
  )

  const shapes = mailing.suggestedShapes
  const hasDims = !!(mailing.mailerWidth && mailing.mailerHeight)

  const saveStatus = quote.isSaving
    ? "Saving..."
    : quote.lastSavedAt
    ? `Saved ${timeSince(quote.lastSavedAt)}`
    : quote.savedId
    ? "Saved"
    : null

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 h-9 bg-secondary/50 border-b border-border/60">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
          Job Info
        </span>
        {saveStatus && (
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {quote.isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Cloud className="h-3 w-3 text-chart-2" />}
            {saveStatus}
          </span>
        )}
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* Row 1: Customer / Contact / Job / PO */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="Customer">
            <Select
              value={quote.customerId || "none"}
              onValueChange={(v) => {
                quote.setCustomerId(v === "none" ? null : v)
                if (v === "none") quote.setContactName("")
              }}
            >
              <SelectTrigger className="h-10 text-sm border-border/60 bg-background rounded-xl">
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
                <SelectTrigger className="h-10 text-sm border-border/60 bg-background rounded-xl">
                  <SelectValue placeholder="Pick contact..." />
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
                className="h-10 text-sm border-border/60 bg-background rounded-xl"
                disabled={!quote.customerId}
              />
            )}
          </Field>

          <Field label="Job Name">
            <Input
              placeholder="Project name"
              value={quote.projectName}
              onChange={(e) => quote.setProjectName(e.target.value)}
              className="h-10 text-sm border-border/60 bg-background rounded-xl"
            />
          </Field>

          <Field label="PO / Ref #">
            <Input
              placeholder="Reference"
              value={quote.referenceNumber}
              onChange={(e) => quote.setReferenceNumber(e.target.value)}
              className="h-10 text-sm border-border/60 bg-background rounded-xl"
            />
          </Field>
        </div>

        {/* Row 2: Mailer Size + Inserts + Shape Badges */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Field label="Width (in)">
            <Input
              type="number" step="0.125" min="0" placeholder="6"
              value={mailing.mailerWidth ?? ""}
              onChange={(e) => mailing.setMailerWidth(e.target.value ? parseFloat(e.target.value) : null)}
              className="h-10 text-sm border-border/60 bg-background rounded-xl font-mono"
            />
          </Field>
          <Field label="Height (in)">
            <Input
              type="number" step="0.125" min="0" placeholder="9"
              value={mailing.mailerHeight ?? ""}
              onChange={(e) => mailing.setMailerHeight(e.target.value ? parseFloat(e.target.value) : null)}
              className="h-10 text-sm border-border/60 bg-background rounded-xl font-mono"
            />
          </Field>
          <Field label="Inserts">
            <Input
              type="number" min="0" step="1" placeholder="0"
              value={mailing.inserts || ""}
              onChange={(e) => mailing.setInserts(parseInt(e.target.value) || 0)}
              className="h-10 text-sm border-border/60 bg-background rounded-xl font-mono"
            />
          </Field>
          <div className="flex flex-col gap-1.5 lg:col-span-2 justify-end">
            <label className="text-[11px] font-medium text-muted-foreground">Qualifies For</label>
            <div className="flex items-center gap-2 h-10">
              {hasDims ? (
                <>
                  {shapes.includes("POSTCARD") && <ShapeBadge label="Postcard" color="bg-chart-2/10 text-chart-2" />}
                  {shapes.includes("LETTER") && <ShapeBadge label="Letter" color="bg-accent/10 text-accent" />}
                  {shapes.includes("FLAT") && <ShapeBadge label="Flat" color="bg-chart-4/10 text-chart-4" />}
                  {shapes.length === 0 && <span className="text-xs text-destructive font-medium">Out of USPS range</span>}
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Enter dimensions</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

function ShapeBadge({ label, color }: { label: string; color: string }) {
  return (
    <Badge variant="secondary" className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${color} border-0`}>
      {label}
    </Badge>
  )
}

function timeSince(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 10) return "just now"
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}
