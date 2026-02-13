"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CalculatorForm } from "@/components/calculator-form"
import { CostBreakdownTable } from "@/components/cost-breakdown"
import { TotalsDisplay } from "@/components/totals-display"
import { calculateCosts, formatCurrency, type MailingInputs } from "@/lib/pricing"
import { useQuote } from "@/lib/quote-context"
import { Info, Plus } from "lucide-react"

export function MailingCalculator() {
  const [inputs, setInputs] = useState<MailingInputs>({
    mailPiece: "",
    quantity: 0,
    mailingClass: "",
    matchingNames: false,
    splitMailingInto: 0,
    includePrinting: false,
  })

  const costs = useMemo(() => calculateCosts(inputs), [inputs])
  const quote = useQuote()

  const handleInputChange = (partial: Partial<MailingInputs>) => {
    setInputs((prev) => ({ ...prev, ...partial }))
  }

  // Compute the split totals for the quote
  const listWorkTotal = costs.isValid
    ? costs.addressing + costs.computerWork + costs.cass2nd + costs.inserting + costs.stamping + costs.printing
    : 0
  const postageTotal = costs.isValid ? costs.postage : 0

  const handleAddListWork = () => {
    if (!costs.isValid) return
    const parts: string[] = []
    if (costs.addressing > 0) parts.push(`Addressing: ${formatCurrency(costs.addressing)}`)
    if (costs.computerWork > 0) parts.push(`Computer Work: ${formatCurrency(costs.computerWork)}`)
    if (costs.cass2nd > 0) parts.push(`CASS 2nd: ${formatCurrency(costs.cass2nd)}`)
    if (costs.inserting > 0) parts.push(`Inserting: ${formatCurrency(costs.inserting)}`)
    if (costs.stamping > 0) parts.push(`Stamping: ${formatCurrency(costs.stamping)}`)
    if (costs.printing > 0) parts.push(`Printing: ${formatCurrency(costs.printing)}`)

    quote.addItem({
      category: "listwork",
      label: `${inputs.quantity.toLocaleString()} pc ${inputs.mailPiece} - ${inputs.mailingClass}`,
      description: parts.join(", "),
      amount: listWorkTotal,
    })
  }

  const handleAddPostage = () => {
    if (!costs.isValid) return
    quote.addItem({
      category: "postage",
      label: `Postage - ${inputs.mailingClass} (${inputs.quantity.toLocaleString()} pc)`,
      description: `${inputs.mailPiece}, ${formatCurrency(costs.postage / inputs.quantity)}/pc`,
      amount: postageTotal,
    })
  }

  return (
    <div className="mx-auto max-w-5xl flex flex-col gap-6">
        {/* Input Card */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <span className="flex items-center justify-center h-6 w-6 rounded-md bg-primary/10 text-primary text-xs font-bold">1</span>
              Job Configuration
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Select your mail piece type, quantity, and mailing class to calculate costs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CalculatorForm inputs={inputs} onInputChange={handleInputChange} />
          </CardContent>
        </Card>

        {/* Results */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Cost Breakdown Card */}
          <Card className="border-border bg-card shadow-sm lg:col-span-3">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-md bg-primary/10 text-primary text-xs font-bold">2</span>
                Cost Breakdown
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Itemized costs for your mailing job.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CostBreakdownTable costs={costs} includePrinting={inputs.includePrinting} />
            </CardContent>
          </Card>

          {/* Summary Card */}
          <Card className="border-border bg-card shadow-sm lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-md bg-primary/10 text-primary text-xs font-bold">3</span>
                Summary
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Your calculated totals.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {costs.isValid ? (
                <>
                  {/* Per Piece - Hero */}
                  <div className="rounded-xl bg-primary p-6 text-center">
                    <p className="text-xs font-medium uppercase tracking-wider text-primary-foreground/70 mb-1">Total Per Piece</p>
                    <p className="text-4xl font-bold font-mono text-primary-foreground tabular-nums">
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(costs.totalPerPiece)}
                    </p>
                  </div>

                  <Separator className="bg-border" />

                  {/* Line totals */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Entire Job</span>
                      <span className="text-sm font-mono font-semibold text-foreground tabular-nums">
                        {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(costs.totalForEntireJob)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Each Mailing</span>
                      <span className="text-sm font-mono font-semibold text-foreground tabular-nums">
                        {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(costs.totalForEachMailing)}
                      </span>
                    </div>
                    {inputs.quantity > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Quantity</span>
                        <span className="text-sm font-mono font-semibold text-foreground tabular-nums">
                          {inputs.quantity.toLocaleString()} pieces
                        </span>
                      </div>
                    )}
                    {inputs.splitMailingInto > 1 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Split Into</span>
                        <span className="text-sm font-mono font-semibold text-foreground tabular-nums">
                          {inputs.splitMailingInto} mailings
                        </span>
                      </div>
                    )}
                  </div>

                  <Separator className="bg-border" />

                  {/* Config summary */}
                  <div className="flex flex-wrap gap-2">
                    {inputs.mailPiece && (
                      <Badge variant="outline" className="text-xs">{inputs.mailPiece}</Badge>
                    )}
                    {inputs.mailingClass && (
                      <Badge variant="outline" className="text-xs">{inputs.mailingClass}</Badge>
                    )}
                    {inputs.matchingNames && (
                      <Badge variant="outline" className="text-xs">Matching Names</Badge>
                    )}
                    {inputs.includePrinting && (
                      <Badge variant="outline" className="text-xs">Printing</Badge>
                    )}
                  </div>

                  <Separator className="bg-border" />

                  {/* Add to Quote buttons */}
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Add to Quote</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="justify-between h-9 text-xs"
                      onClick={handleAddListWork}
                    >
                      <span className="flex items-center gap-1.5">
                        <Plus className="h-3 w-3" />
                        List Work & Labor
                      </span>
                      <span className="font-mono tabular-nums">{formatCurrency(listWorkTotal)}</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="justify-between h-9 text-xs"
                      onClick={handleAddPostage}
                    >
                      <span className="flex items-center gap-1.5">
                        <Plus className="h-3 w-3" />
                        Postage / USPS
                      </span>
                      <span className="font-mono tabular-nums">{formatCurrency(postageTotal)}</span>
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="rounded-full bg-muted p-3 mb-3">
                    <Info className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground max-w-[200px]">
                    {costs.validationMessage || "Configure your job to see the cost summary."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom Totals (Mobile) */}
        {costs.isValid && (
          <div className="block lg:hidden">
            <TotalsDisplay costs={costs} />
          </div>
        )}
    </div>
  )
}
