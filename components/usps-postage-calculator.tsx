"use client"

import { useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  SORT_LABELS,
  ENTRY_LABELS,
  SERVICE_LABELS,
  SPECS,
  type USPSInputs,
  type USPSServiceType,
  type USPSEntry,
  type SortLevel,
  type USPSShape,
} from "@/lib/usps-rates"
import {
  Plus,
  Info,
  AlertTriangle,
  AlertCircle,
  Zap,
  Mail,
  FileText,
  CreditCard,
  Hash,
  Scale,
} from "lucide-react"

// --- Toggle button ---
function ToggleBtn({
  active,
  disabled,
  onClick,
  icon,
  label,
  sub,
  className = "",
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  sub?: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 p-3 text-center transition-all ${
        disabled
          ? "opacity-40 cursor-not-allowed border-border bg-muted grayscale"
          : active
            ? "border-primary bg-primary/5 shadow-sm"
            : "border-border bg-card hover:border-muted-foreground/30 cursor-pointer"
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
    service: "FCM_COMM",
    shape: "LETTER",
    pack: "ENV",
    quantity: 5000,
    saturationQty: 0,
    weight: 1,
    sortLevel: 1,
    entry: "ORIGIN",
  })

  const result = useMemo(() => calculateUSPSPostage(inputs), [inputs])
  const quote = useQuote()

  const update = useCallback((partial: Partial<USPSInputs>) => {
    setInputs((prev) => {
      const next = { ...prev, ...partial }
      // Rule: If switching to Marketing and shape is Postcard, force Letter
      if ((next.service === "MKT_COMM" || next.service === "MKT_NP") && next.shape === "POSTCARD") {
        next.shape = "LETTER"
      }
      // Rule: Retail has no saturation
      if (next.service === "FCM_RETAIL") {
        next.saturationQty = 0
      }
      return next
    })
  }, [])

  const handleAddToQuote = useCallback(() => {
    if (!result.isValid) return
    const parts: string[] = []
    parts.push(result.className)
    if (result.description) parts.push(result.description)

    quote.addItem({
      category: "postage",
      label: `USPS Postage - ${inputs.quantity.toLocaleString()} pc`,
      description: parts.join(" | "),
      amount: result.total,
    })
  }, [result, inputs, quote])

  const isMkt = inputs.service === "MKT_COMM" || inputs.service === "MKT_NP"
  const isRetail = inputs.service === "FCM_RETAIL"
  const postcardDisabled = isMkt
  const showSaturation = isMkt
  const showEntryPoint = isMkt
  const showSortSlider = !isRetail
  const remainingQty = inputs.quantity - Math.min(inputs.saturationQty, inputs.quantity)
  const spec = SPECS[inputs.shape]

  return (
    <div className="mx-auto max-w-5xl flex flex-col gap-6">
      {/* Step 1: Mail Service */}
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-primary/10 text-primary text-xs font-bold">1</span>
            Mail Service
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground text-pretty">
            Exact USPS rates from Notice 123 (Jan 2026). No parcels.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <ToggleBtn
              active={inputs.service === "FCM_COMM"}
              onClick={() => update({ service: "FCM_COMM" })}
              icon={<Zap className="h-4 w-4" />}
              label="First-Class Presort"
              sub="500+ Pc / Fast"
            />
            <ToggleBtn
              active={inputs.service === "FCM_RETAIL"}
              onClick={() => update({ service: "FCM_RETAIL" })}
              icon={<Mail className="h-4 w-4" />}
              label="First-Class Retail"
              sub="Single Piece / Stamps"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ToggleBtn
              active={inputs.service === "MKT_COMM"}
              onClick={() => update({ service: "MKT_COMM" })}
              icon={<FileText className="h-4 w-4" />}
              label="Marketing"
              sub="Commercial"
            />
            <ToggleBtn
              active={inputs.service === "MKT_NP"}
              onClick={() => update({ service: "MKT_NP" })}
              icon={<CreditCard className="h-4 w-4" />}
              label="Nonprofit"
              sub="Auth Req."
            />
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Physical Specs */}
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <span className="flex items-center justify-center h-6 w-6 rounded-md bg-primary/10 text-primary text-xs font-bold">2</span>
              Physical Specs
            </CardTitle>
            <SpecsTooltip shape={inputs.shape} />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Shape: Card / Letter / Flat (no Parcel) */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
              Mail Shape
            </Label>
            <div className="grid grid-cols-3 gap-3">
              <ToggleBtn
                active={inputs.shape === "POSTCARD"}
                disabled={postcardDisabled}
                onClick={() => update({ shape: "POSTCARD" })}
                icon={<CreditCard className="h-4 w-4" />}
                label="Postcard"
                sub={postcardDisabled ? "First-Class only" : undefined}
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
                sub="USPS Flat shape"
              />
            </div>
          </div>

          {/* Packaging: Envelope / Folded / Plastic */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
              Format / Packaging
            </Label>
            <div className="grid grid-cols-3 gap-3">
              <ToggleBtn
                active={inputs.pack === "ENV"}
                onClick={() => update({ pack: "ENV" })}
                icon={<Mail className="h-3.5 w-3.5" />}
                label="Envelope"
                sub="Standard"
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
                icon={<CreditCard className="h-3.5 w-3.5" />}
                label="Plastic"
                sub="Poly Bag"
              />
            </div>
          </div>

          {/* Quantity + Weight */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="usps-qty" className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Hash className="h-4 w-4 text-primary" />
                Total Quantity
              </Label>
              <Input
                id="usps-qty"
                type="number"
                inputMode="numeric"
                min={1}
                autoComplete="off"
                spellCheck={false}
                placeholder="e.g. 5000..."
                className="h-11 font-mono"
                value={inputs.quantity || ""}
                onChange={(e) => update({ quantity: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="usps-weight" className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Scale className="h-4 w-4 text-primary" />
                Weight (oz)
              </Label>
              <Input
                id="usps-weight"
                type="number"
                inputMode="decimal"
                step="0.1"
                min={0}
                autoComplete="off"
                spellCheck={false}
                placeholder="e.g. 1..."
                className="h-11 font-mono"
                value={inputs.weight || ""}
                onChange={(e) => update({ weight: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          {/* Saturation Quantity (Marketing only) */}
          {showSaturation && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="usps-sat-qty" className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  Saturation Quantity
                </Label>
                <span className="text-xs font-bold bg-background px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-700 tabular-nums font-mono text-emerald-700 dark:text-emerald-400">
                  Rate: {result.satRate > 0 ? formatPostageRate(result.satRate) : "N/A"}
                </span>
              </div>
              <Input
                id="usps-sat-qty"
                type="number"
                inputMode="numeric"
                min={0}
                max={inputs.quantity}
                autoComplete="off"
                spellCheck={false}
                placeholder="0"
                className="h-11 font-mono border-emerald-200 dark:border-emerald-700"
                value={inputs.saturationQty || ""}
                onChange={(e) => update({ saturationQty: parseInt(e.target.value) || 0 })}
              />
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-2 font-medium leading-relaxed">
                Pieces qualifying for max discount (90% residential density).
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 3: Sort & Entry */}
      {showSortSlider && (
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <span className="flex items-center justify-center h-6 w-6 rounded-md bg-primary/10 text-primary text-xs font-bold">3</span>
              Sort Level{showSaturation && " & Entry"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {/* Sort level slider */}
            <div className="bg-muted/40 border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium text-foreground">
                  Remaining Qty: <span className="text-primary font-bold font-mono tabular-nums">{remainingQty.toLocaleString()}</span>
                </Label>
                <span className="text-[11px] text-muted-foreground font-medium">Sort level for non-saturation pieces</span>
              </div>
              <Slider
                value={[inputs.sortLevel]}
                onValueChange={([v]) => update({ sortLevel: v as SortLevel })}
                min={1}
                max={3}
                step={1}
                className="mb-4"
              />
              {/* Rate labels under slider */}
              <div className="grid grid-cols-3 gap-2 text-center">
                {([1, 2, 3] as SortLevel[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => update({ sortLevel: level })}
                    className="flex flex-col items-center gap-1"
                  >
                    <span className={`text-[11px] font-bold ${inputs.sortLevel === level ? "text-primary" : "text-muted-foreground"}`}>
                      {SORT_LABELS[level].split(" (")[0]}
                    </span>
                    <span className={`text-xs font-extrabold font-mono tabular-nums px-2 py-0.5 rounded-md min-w-[60px] ${
                      inputs.sortLevel === level
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {result.rateAtLevel[level] > 0 ? formatPostageRate(result.rateAtLevel[level]) : "---"}
                    </span>
                  </button>
                ))}
              </div>
              {/* Min/Max row */}
              <div className="flex justify-between mt-3 text-[11px] text-muted-foreground">
                <span>Min: <strong className="text-foreground font-mono tabular-nums">{result.rateAtLevel[3] > 0 ? formatPostageRate(result.rateAtLevel[3]) : "---"}</strong></span>
                <span>Max: <strong className="text-foreground font-mono tabular-nums">{result.rateAtLevel[1] > 0 ? formatPostageRate(result.rateAtLevel[1]) : "---"}</strong></span>
              </div>
            </div>

            {/* Entry Point (Marketing only) */}
            {showEntryPoint && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="usps-entry" className="text-sm font-medium text-foreground">
                  Entry Point (Drop Ship)
                </Label>
                <Select
                  value={inputs.entry}
                  onValueChange={(v) => update({ entry: v as USPSEntry })}
                >
                  <SelectTrigger id="usps-entry" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ORIGIN">{ENTRY_LABELS.ORIGIN}</SelectItem>
                    <SelectItem value="DSCF">{ENTRY_LABELS.DSCF}</SelectItem>
                    <SelectItem value="DDU">{ENTRY_LABELS.DDU}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      {result.alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {result.alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2.5 rounded-lg border p-3 text-sm font-medium leading-relaxed ${
                alert.type === "error"
                  ? "bg-destructive/5 border-destructive/20 text-destructive"
                  : alert.type === "warning"
                    ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300"
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

      {/* Sticky Results Bar */}
      <Card className="border-border bg-foreground text-background shadow-lg sticky bottom-5 z-20">
        <CardContent className="p-5">
          <div className="flex items-end justify-between gap-4 pb-4 border-b border-background/10">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-background/50 mb-1">
                Per Piece (Avg)
              </p>
              <p className="text-4xl font-extrabold font-mono tabular-nums leading-none">
                {result.isValid ? formatPostageRate(result.avgPerPiece) : "---"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-background/50 mb-1">
                Total Postage
              </p>
              <p className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
                {result.isValid ? formatCurrency(result.total) : "$0.00"}
              </p>
              <p className="text-xs text-background/70 font-medium mt-1 max-w-[260px] truncate text-right">
                {result.description || "Rate Description"}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-background/80">
                {result.className || "---"}
              </span>
              {result.isValid && (
                <Badge variant="outline" className="text-[10px] border-background/20 text-background/70">
                  {SERVICE_LABELS[inputs.service]}
                </Badge>
              )}
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

      {/* Size specs reference */}
      <div className="rounded-lg bg-muted/40 border border-border p-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 mb-2">
          <Info className="h-3.5 w-3.5" />
          <span className="font-semibold text-foreground">{SHAPE_LABELS[inputs.shape]} Specs</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <span className="font-bold text-muted-foreground">Min Size</span>
            <p className="font-mono mt-0.5">{spec.min}</p>
          </div>
          <div>
            <span className="font-bold text-muted-foreground">Max Size</span>
            <p className="font-mono mt-0.5">{spec.max}</p>
          </div>
          <div>
            <span className="font-bold text-muted-foreground">Max Weight</span>
            <p className="font-mono mt-0.5">{spec.weight}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Specs tooltip button ---
function SpecsTooltip({ shape }: { shape: USPSShape }) {
  const [open, setOpen] = useState(false)
  const spec = SPECS[shape]
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-[10px] gap-1 font-bold"
        onClick={() => setOpen(true)}
      >
        <Info className="h-3 w-3" />
        Specs & Limits
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <Card className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Specs & Limitations</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex justify-between border-b border-border pb-2 text-sm">
                <span className="text-muted-foreground font-bold">Shape</span>
                <span className="font-extrabold">{SHAPE_LABELS[shape]}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2 text-sm">
                <span className="text-muted-foreground font-bold">Min Size</span>
                <span className="font-extrabold font-mono text-xs">{spec.min}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2 text-sm">
                <span className="text-muted-foreground font-bold">Max Size</span>
                <span className="font-extrabold font-mono text-xs">{spec.max}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground font-bold">Max Weight</span>
                <span className="font-extrabold font-mono text-xs">{spec.weight}</span>
              </div>
              <Button className="mt-3 w-full" onClick={() => setOpen(false)}>Close</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
