"use client"

import { useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useQuote } from "@/lib/quote-context"
import { formatCurrency } from "@/lib/pricing"
import {
  calculateUSPSPostage,
  formatPostageRate,
  PRESORT_LABELS,
  ENTRY_LABELS,
  type USPSInputs,
  type USPSEntry,
  type PresortLevel,
} from "@/lib/usps-rates"
import {
  Plus,
  Info,
  AlertTriangle,
  AlertCircle,
  Building2,
  Heart,
  TrendingDown,
  Zap,
  CreditCard,
  Mail,
  FileText,
  Package,
  Hash,
  Scale,
} from "lucide-react"

// Toggle button component for the shape/mode selectors
function ToggleBtn({
  active,
  onClick,
  icon,
  label,
  sub,
  className = "",
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  sub?: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 p-3 text-center transition-all ${
        active
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-card hover:border-muted-foreground/30"
      } ${className}`}
    >
      <span className="text-base">{icon}</span>
      <span className="text-xs font-semibold text-foreground">{label}</span>
      {sub && <span className="text-[10px] text-muted-foreground leading-tight">{sub}</span>}
    </button>
  )
}

export function USPSPostageCalculator() {
  const [inputs, setInputs] = useState<USPSInputs>({
    mode: "COMM",
    service: "MKT",
    shape: "LETTER",
    pack: "ENV",
    quantity: 5000,
    weight: 0.5,
    presort: 2,
    entry: "NONE",
    fullServiceIMb: false,
  })

  const result = useMemo(() => calculateUSPSPostage(inputs), [inputs])
  const quote = useQuote()

  const update = useCallback((partial: Partial<USPSInputs>) => {
    setInputs((prev) => ({ ...prev, ...partial }))
  }, [])

  const handleAddToQuote = useCallback(() => {
    if (!result.isValid) return
    const parts: string[] = []
    parts.push(result.className)
    parts.push(result.category)
    parts.push(`${formatPostageRate(result.pricePerPiece)}/pc`)
    if (inputs.entry !== "NONE") parts.push(ENTRY_LABELS[inputs.entry])
    if (inputs.fullServiceIMb) parts.push("Full-Service IMb")

    quote.addItem({
      category: "postage",
      label: `USPS Postage - ${inputs.quantity.toLocaleString()} pc`,
      description: parts.join(" | "),
      amount: result.total,
    })
  }, [result, inputs, quote])

  const showEntryPoint = !(inputs.service === "FCM" && inputs.shape !== "PARCEL")
  const showPackaging = inputs.shape !== "PARCEL"
  const showScale = inputs.shape === "FLAT" || inputs.shape === "PARCEL"

  return (
    <div className="mx-auto max-w-5xl flex flex-col gap-6">
      {/* Step 1: Mail Class */}
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-primary/10 text-primary text-xs font-bold">1</span>
            Mail Class
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground text-pretty">
            USPS postage rates from Notice 123 (2026). Select your service type and mail shape.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Mode: Commercial / Nonprofit */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
              Account Type
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <ToggleBtn
                active={inputs.mode === "COMM"}
                onClick={() => update({ mode: "COMM" })}
                icon={<Building2 className="h-4 w-4" />}
                label="Commercial"
                sub="Business / Standard"
              />
              <ToggleBtn
                active={inputs.mode === "NP"}
                onClick={() => update({ mode: "NP" })}
                icon={<Heart className="h-4 w-4" />}
                label="Nonprofit"
                sub="Auth # Required"
              />
            </div>
          </div>

          {/* Service: Marketing Mail / First-Class Presort */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
              Service
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <ToggleBtn
                active={inputs.service === "MKT"}
                onClick={() => update({ service: "MKT" })}
                icon={<TrendingDown className="h-4 w-4" />}
                label="Marketing Mail"
                sub="Slow / 200pc Min"
              />
              <ToggleBtn
                active={inputs.service === "FCM"}
                onClick={() => update({ service: "FCM" })}
                icon={<Zap className="h-4 w-4" />}
                label="First-Class Presort"
                sub="Fast / 500pc Min"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Physical Specs */}
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-primary/10 text-primary text-xs font-bold">2</span>
            Physical Specs
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Shape selection */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
              Mail Shape
            </Label>
            <div className="grid grid-cols-4 gap-2">
              <ToggleBtn
                active={inputs.shape === "POSTCARD"}
                onClick={() => update({ shape: "POSTCARD" })}
                icon={<CreditCard className="h-4 w-4" />}
                label="Card"
              />
              <ToggleBtn
                active={inputs.shape === "LETTER"}
                onClick={() => update({ shape: "LETTER" })}
                icon={<Mail className="h-4 w-4" />}
                label="Letter"
              />
              <ToggleBtn
                active={inputs.shape === "FLAT"}
                onClick={() => update({ shape: "FLAT" })}
                icon={<FileText className="h-4 w-4" />}
                label="Flat"
              />
              <ToggleBtn
                active={inputs.shape === "PARCEL"}
                onClick={() => update({ shape: "PARCEL" })}
                icon={<Package className="h-4 w-4" />}
                label="Parcel"
              />
            </div>
          </div>

          {/* Packaging -- not for Parcels */}
          {showPackaging && (
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                Format / Packaging
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <ToggleBtn
                  active={inputs.pack === "ENV"}
                  onClick={() => update({ pack: "ENV" })}
                  icon={<Mail className="h-3.5 w-3.5" />}
                  label="Standard"
                  sub="Envelope/Card"
                />
                <ToggleBtn
                  active={inputs.pack === "FOLD"}
                  onClick={() => update({ pack: "FOLD" })}
                  icon={<FileText className="h-3.5 w-3.5" />}
                  label="Folded"
                  sub="Self-Mailer"
                />
                <ToggleBtn
                  active={inputs.pack === "PLAS"}
                  onClick={() => update({ pack: "PLAS" })}
                  icon={<Package className="h-3.5 w-3.5" />}
                  label="Plastic"
                  sub="Poly Bag"
                />
              </div>
            </div>
          )}

          {/* Quantity & Scale */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="usps-qty" className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Hash className="h-4 w-4 text-primary" />
                Quantity
              </Label>
              <Input
                id="usps-qty"
                type="number"
                inputMode="numeric"
                min={1}
                autoComplete="off"
                placeholder="e.g. 5000..."
                className="h-11 font-mono"
                value={inputs.quantity || ""}
                onChange={(e) => update({ quantity: parseInt(e.target.value) || 0 })}
              />
            </div>
            {showScale && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="usps-weight" className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Scale className="h-4 w-4 text-primary" />
                  Scale (oz)
                </Label>
                <Input
                  id="usps-weight"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={0}
                  autoComplete="off"
                  placeholder="e.g. 0.5..."
                  className="h-11 font-mono"
                  value={inputs.weight || ""}
                  onChange={(e) => update({ weight: parseFloat(e.target.value) || 0 })}
                />
              </div>
            )}
            {!showScale && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="usps-weight-fixed" className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Scale className="h-4 w-4 text-primary" />
                  Scale (oz)
                </Label>
                <Input
                  id="usps-weight-fixed"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={0}
                  autoComplete="off"
                  placeholder="e.g. 0.5..."
                  className="h-11 font-mono"
                  value={inputs.weight || ""}
                  onChange={(e) => update({ weight: parseFloat(e.target.value) || 0 })}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Logistics */}
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-primary/10 text-primary text-xs font-bold">3</span>
            Logistics
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Presort Density */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 block">
              Presort Density
            </Label>
            <Slider
              value={[inputs.presort]}
              onValueChange={([v]) => update({ presort: v as PresortLevel })}
              min={1}
              max={4}
              step={1}
              className="mb-3"
            />
            <div className="grid grid-cols-4 gap-1">
              {([1, 2, 3, 4] as PresortLevel[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => update({ presort: level })}
                  className={`text-center py-1.5 px-1 rounded-md text-[10px] font-semibold leading-tight transition-colors ${
                    inputs.presort === level
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {PRESORT_LABELS[level]}
                </button>
              ))}
            </div>
          </div>

          {/* Entry Point & Full-Service */}
          {showEntryPoint && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="usps-entry" className="text-sm font-medium text-foreground">
                  Entry Point
                </Label>
                <Select
                  value={inputs.entry}
                  onValueChange={(v) => update({ entry: v as USPSEntry })}
                >
                  <SelectTrigger id="usps-entry" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Origin (Local PO)</SelectItem>
                    <SelectItem value="DSCF">DSCF (Regional)</SelectItem>
                    <SelectItem value="DDU">DDU (Local Delivery)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-2">
                <div className="flex items-center gap-2.5">
                  <Checkbox
                    id="fullServiceIMb"
                    checked={inputs.fullServiceIMb}
                    onCheckedChange={(checked) => update({ fullServiceIMb: checked === true })}
                  />
                  <Label htmlFor="fullServiceIMb" className="text-sm font-medium text-foreground cursor-pointer leading-snug">
                    Full-Service IMb
                    <span className="block text-[10px] text-muted-foreground font-normal">
                      {inputs.service === "FCM" ? "-$0.003/pc" : "-$0.005/pc"}
                    </span>
                  </Label>
                </div>
              </div>
            </div>
          )}

          {!showEntryPoint && (
            <div className="flex items-center gap-2.5">
              <Checkbox
                id="fullServiceIMb-solo"
                checked={inputs.fullServiceIMb}
                onCheckedChange={(checked) => update({ fullServiceIMb: checked === true })}
              />
              <Label htmlFor="fullServiceIMb-solo" className="text-sm font-medium text-foreground cursor-pointer leading-snug">
                Full-Service IMb
                <span className="block text-[10px] text-muted-foreground font-normal">
                  {inputs.service === "FCM" ? "-$0.003/pc" : "-$0.005/pc"}
                </span>
              </Label>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alerts */}
      {result.alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {result.alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2.5 rounded-lg border p-3 text-sm leading-relaxed ${
                alert.type === "error"
                  ? "bg-destructive/5 border-destructive/20 text-destructive"
                  : alert.type === "warning"
                    ? "bg-chart-4/5 border-chart-4/20 text-chart-4"
                    : "bg-primary/5 border-primary/20 text-primary"
              }`}
            >
              {alert.type === "error" ? (
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              ) : alert.type === "warning" ? (
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              ) : (
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
              )}
              <span>{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Results Bar */}
      <Card className="border-border bg-foreground text-background shadow-lg">
        <CardContent className="p-5">
          <div className="flex items-end justify-between gap-4 pb-4 border-b border-background/10">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-background/50 mb-1">
                Price Per Piece
              </p>
              <p className="text-4xl font-extrabold font-mono tabular-nums leading-none">
                {result.isValid ? formatPostageRate(result.pricePerPiece) : "---"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-medium uppercase tracking-widest text-background/50 mb-1">
                Estimated Total
              </p>
              <p className="text-2xl font-bold font-mono tabular-nums text-chart-2">
                {result.isValid ? formatCurrency(result.total) : "$0.00"}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-background/80">
                {result.className || "---"}
              </span>
              <Badge variant="outline" className="text-[10px] border-background/20 text-background/70">
                {result.category || "---"}
              </Badge>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="gap-1.5 text-xs h-8"
              onClick={handleAddToQuote}
              disabled={!result.isValid}
            >
              <Plus className="h-3 w-3" />
              Add to Quote
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
