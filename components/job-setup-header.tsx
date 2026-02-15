"use client"

import { useQuote } from "@/lib/quote-context"
import { useMailing } from "@/lib/mailing-context"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Users, FileText, Hash, Ruler, Layers } from "lucide-react"
import useSWR from "swr"
import type { Customer } from "@/lib/customer-types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function JobSetupHeader() {
  const quote = useQuote()
  const mailing = useMailing()
  const { data: customers } = useSWR<Customer[]>("/api/customers", fetcher)

  const shapes = mailing.suggestedShapes

  return (
    <Card className="border-border bg-card/60 p-4">
      <div className="flex flex-col gap-3">
        {/* Row 1: Customer + Contact + Job Name + PO */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" /> Customer
            </label>
            <Select
              value={quote.customerId || "none"}
              onValueChange={(v) => quote.setCustomerId(v === "none" ? null : v)}
            >
              <SelectTrigger className="h-8 text-xs">
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
            <Input
              placeholder="Contact name..."
              value={quote.contactName}
              onChange={(e) => quote.setContactName(e.target.value)}
              className="h-8 text-xs"
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
              <FileText className="h-3 w-3" /> Job Name
            </label>
            <Input
              placeholder="Project name..."
              value={quote.projectName}
              onChange={(e) => quote.setProjectName(e.target.value)}
              className="h-8 text-xs"
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
              className="h-8 text-xs"
              autoComplete="off"
            />
          </div>
        </div>

        {/* Row 2: Mailer dimensions + Inserts + Shape hint */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
              className="h-8 text-xs"
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
              className="h-8 text-xs"
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
              className="h-8 text-xs"
            />
          </div>

          {/* Shape hints */}
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-[10px] font-medium text-muted-foreground">
              Qualifies For
            </label>
            <div className="flex items-center gap-1.5 h-8">
              {mailing.mailerWidth && mailing.mailerHeight ? (
                <>
                  {shapes.includes("POSTCARD") && (
                    <Badge variant="secondary" className="text-[10px] bg-chart-2/10 text-chart-2 border-chart-2/20">Postcard</Badge>
                  )}
                  {shapes.includes("LETTER") && (
                    <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">Letter</Badge>
                  )}
                  {shapes.includes("FLAT") && (
                    <Badge variant="secondary" className="text-[10px] bg-chart-4/10 text-chart-4 border-chart-4/20">Flat</Badge>
                  )}
                  {shapes.length === 0 && (
                    <span className="text-[10px] text-destructive">Size out of USPS range</span>
                  )}
                </>
              ) : (
                <span className="text-[10px] text-muted-foreground">Enter dimensions to see eligible mail classes</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
