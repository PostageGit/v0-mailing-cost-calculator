"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { CalculatorForm } from "@/components/calculator-form"
import { CostBreakdownTable } from "@/components/cost-breakdown"
import { TotalsDisplay } from "@/components/totals-display"
import { calculateCosts, type MailingInputs } from "@/lib/pricing"
import { Calculator, LayoutGrid, Info } from "lucide-react"

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

  const handleInputChange = (partial: Partial<MailingInputs>) => {
    setInputs((prev) => ({ ...prev, ...partial }))
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary text-primary-foreground">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground tracking-tight">MailCost Pro</h1>
              <p className="text-xs text-muted-foreground">Direct Mail Cost Calculator</p>
            </div>
          </div>
          <Badge variant="secondary" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5">
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="text-xs">Calculator</span>
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 py-8 flex flex-col gap-6">
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

        {/* Bottom Totals (Desktop) */}
        {costs.isValid && (
          <div className="block lg:hidden">
            <TotalsDisplay costs={costs} />
          </div>
        )}
      </main>
    </div>
  )
}
