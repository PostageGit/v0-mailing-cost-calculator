"use client"

import { useQuote } from "@/lib/quote-context"
import { useMailing } from "@/lib/mailing-context"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Users, FileText, Hash, Ruler, Layers, Cloud, Loader2 } from "lucide-react"
import useSWR from "swr"
import type { Customer } from "@/lib/customer-types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Contact {
  id: string
  name: string
  email?: string
  phone?: string
}

export function JobSetupHeader() {
  const quote = useQuote()
  const mailing = useMailing()
  const { data: customers } = useSWR<Customer[]>("/api/customers", fetcher)
  // Fetch contacts for selected customer
  const { data: contacts } = useSWR<Contact[]>(
    quote.customerId ? `/api/customers/${quote.customerId}/contacts` : null,
    fetcher,
  )

  const shapes = mailing.suggestedShapes

  // Auto-save status
  const saveStatus = quote.isSaving
    ? "Saving..."
    : quote.lastSavedAt
    ? `Saved ${formatTimeSince(quote.lastSavedAt)}`
    : quote.savedId
    ? "Saved"
    : null

  return (
    <Card className="border-border bg-card p-0 overflow-hidden">
      {/* Save status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-muted/40 border-b border-border">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Job Setup
        </span>
        {saveStatus && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            {quote.isSaving ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
            ) : (
              <Cloud className="h-2.5 w-2.5 text-accent" />
            )}
            {saveStatus}
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col gap-3">
        {/* Row 1: Customer + Contact + Job Name + PO */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" /> Customer
            </label>
            <Select
              value={quote.customerId || "none"}
              onValueChange={(v) => {
                quote.setCustomerId(v === "none" ? null : v)
                // Clear contact when customer changes
                if (v === "none") quote.setContactName("")
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select customer..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No customer</SelectItem>
                {(customers || []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" /> Contact
            </label>
            {quote.customerId && contacts && contacts.length > 0 ? (
              <Select
                value={quote.contactName || "none"}
                onValueChange={(v) => quote.setContactName(v === "none" ? "" : v)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Pick contact..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No contact</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder={quote.customerId ? "No contacts yet..." : "Select customer first"}
                value={quote.contactName}
                onChange={(e) => quote.setContactName(e.target.value)}
                className="h-9 text-xs"
                autoComplete="off"
                disabled={!quote.customerId}
              />
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
              <FileText className="h-3 w-3" /> Job Name
            </label>
            <Input
              placeholder="Project name..."
              value={quote.projectName}
              onChange={(e) => quote.setProjectName(e.target.value)}
              className="h-9 text-xs"
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
              <Hash className="h-3 w-3" /> PO / Ref #
            </label>
            <Input
              placeholder="Reference..."
              value={quote.referenceNumber}
              onChange={(e) => quote.setReferenceNumber(e.target.value)}
              className="h-9 text-xs"
              autoComplete="off"
            />
          </div>
        </div>

        {/* Row 2: Mailer dimensions + Inserts + Shape hint */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
              <Ruler className="h-3 w-3" /> Width (in)
            </label>
            <Input
              type="number"
              step="0.125"
              min="0"
              placeholder="e.g. 6"
              value={mailing.mailerWidth ?? ""}
              onChange={(e) => mailing.setMailerWidth(e.target.value ? parseFloat(e.target.value) : null)}
              className="h-9 text-xs"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
              <Ruler className="h-3 w-3" /> Height (in)
            </label>
            <Input
              type="number"
              step="0.125"
              min="0"
              placeholder="e.g. 9"
              value={mailing.mailerHeight ?? ""}
              onChange={(e) => mailing.setMailerHeight(e.target.value ? parseFloat(e.target.value) : null)}
              className="h-9 text-xs"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
              <Layers className="h-3 w-3" /> Inserts
            </label>
            <Input
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={mailing.inserts || ""}
              onChange={(e) => mailing.setInserts(parseInt(e.target.value) || 0)}
              className="h-9 text-xs"
            />
          </div>

          {/* Shape hints */}
          <div className="flex flex-col gap-1 lg:col-span-2">
            <label className="text-[10px] font-medium text-muted-foreground">
              Qualifies For
            </label>
            <div className="flex items-center gap-1.5 h-9">
              {mailing.mailerWidth && mailing.mailerHeight ? (
                <>
                  {shapes.includes("POSTCARD") && (
                    <Badge variant="secondary" className="text-[10px] bg-accent/10 text-accent border-accent/20">Postcard</Badge>
                  )}
                  {shapes.includes("LETTER") && (
                    <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">Letter</Badge>
                  )}
                  {shapes.includes("FLAT") && (
                    <Badge variant="secondary" className="text-[10px] bg-chart-4/10 text-chart-4 border-chart-4/20">Flat</Badge>
                  )}
                  {shapes.length === 0 && (
                    <span className="text-[10px] text-destructive font-medium">Size out of USPS range</span>
                  )}
                </>
              ) : (
                <span className="text-[10px] text-muted-foreground italic">Enter dimensions above</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

function formatTimeSince(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 10) return "just now"
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ago`
}
