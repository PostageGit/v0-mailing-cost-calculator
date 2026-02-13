"use client"

import { formatCurrency, type CostBreakdown } from "@/lib/pricing"
import { DollarSign, Receipt, CircleDollarSign } from "lucide-react"

interface TotalsDisplayProps {
  costs: CostBreakdown
}

export function TotalsDisplay({ costs }: TotalsDisplayProps) {
  if (!costs.isValid) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Total for entire job */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Receipt className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Entire Job</span>
        </div>
        <span className="text-2xl font-semibold font-mono text-foreground tabular-nums">
          {formatCurrency(costs.totalForEntireJob)}
        </span>
      </div>

      {/* Total for each mailing */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CircleDollarSign className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Each Mailing</span>
        </div>
        <span className="text-2xl font-semibold font-mono text-foreground tabular-nums">
          {formatCurrency(costs.totalForEachMailing)}
        </span>
      </div>

      {/* Total per piece - highlighted */}
      <div className="flex flex-col gap-2 rounded-xl bg-primary p-5">
        <div className="flex items-center gap-2 text-primary-foreground/70">
          <DollarSign className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Per Piece</span>
        </div>
        <span className="text-3xl font-bold font-mono text-primary-foreground tabular-nums">
          {formatCurrency(costs.totalPerPiece)}
        </span>
      </div>
    </div>
  )
}
