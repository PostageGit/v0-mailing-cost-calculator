"use client"

import { formatCurrency, type CostBreakdown } from "@/lib/pricing"
import {
  MapPin,
  Monitor,
  Shield,
  Package,
  Mail,
  Printer,
  Bookmark,
} from "lucide-react"

interface CostBreakdownProps {
  costs: CostBreakdown
  includePrinting: boolean
}

const lineItems = [
  { key: "addressing" as const, label: "Addressing", icon: MapPin, description: "Address formatting & application" },
  { key: "computerWork" as const, label: "Computer Work", icon: Monitor, description: "Data processing & setup" },
  { key: "cass2nd" as const, label: "CASS 2nd", icon: Shield, description: "Address verification" },
  { key: "inserting" as const, label: "Inserting", icon: Package, description: "Envelope stuffing & assembly" },
  { key: "postage" as const, label: "Postage", icon: Mail, description: "USPS mailing costs" },
]

export function CostBreakdownTable({ costs, includePrinting }: CostBreakdownProps) {
  if (!costs.isValid) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <MapPin className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground text-sm max-w-xs">
          {costs.validationMessage}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {lineItems.map((item) => {
        const value = costs[item.key]
        return (
          <div
            key={item.key}
            className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
                <item.icon className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.description}</span>
              </div>
            </div>
            <span className="text-sm font-mono font-semibold text-foreground tabular-nums">
              {formatCurrency(value)}
            </span>
          </div>
        )
      })}

      {/* Stamping - auto-calculated for small jobs */}
      {costs.stamping > 0 && (
        <div
          className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-chart-4/10 text-chart-4 group-hover:bg-chart-4/15 transition-colors">
              <Bookmark className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">Stamping</span>
              <span className="text-xs text-muted-foreground">Applying physical stamps (small qty)</span>
            </div>
          </div>
          <span className="text-sm font-mono font-semibold text-foreground tabular-nums">
            {formatCurrency(costs.stamping)}
          </span>
        </div>
      )}

      {/* Printing - optional, checkbox-controlled */}
      <div
        className={`flex items-center justify-between py-3 px-3 rounded-lg transition-colors group ${
          includePrinting ? "hover:bg-muted/50" : "opacity-40"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center h-9 w-9 rounded-lg transition-colors ${
            includePrinting ? "bg-primary/10 text-primary group-hover:bg-primary/15" : "bg-muted text-muted-foreground"
          }`}>
            <Printer className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">Printing</span>
            <span className="text-xs text-muted-foreground">
              {includePrinting ? "Printing mail pieces" : "Not included (toggle in options)"}
            </span>
          </div>
        </div>
        <span className="text-sm font-mono font-semibold text-foreground tabular-nums">
          {formatCurrency(costs.printing)}
        </span>
      </div>
    </div>
  )
}
