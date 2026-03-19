"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, MapPin, Navigation, DollarSign, Clock, Car, Bike } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

interface UberQuote {
  id: string
  fee: number
  currency: string
  currency_type: string
  dropoff_eta: string
  duration: number
  pickup_duration?: number
  expires_at?: string
  kind?: string
}

export function UberDeliveryCalculator() {
  const [pickup, setPickup] = useState("")
  const [dropoff, setDropoff] = useState("")
  const [vehicleType, setVehicleType] = useState<"car" | "bike">("car")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quote, setQuote] = useState<UberQuote | null>(null)

  const handleGetQuote = async () => {
    if (!pickup.trim() || !dropoff.trim()) {
      setError("Please enter both pickup and dropoff addresses")
      return
    }

    setLoading(true)
    setError(null)
    setQuote(null)

    try {
      const response = await fetch("/api/uber/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickup: pickup.trim(), dropoff: dropoff.trim(), vehicleType }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get quote")
      }

      setQuote(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get delivery quote")
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number, currency: string = "USD") => {
    // Uber returns fee in cents
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount / 100)
  }

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  const formatEta = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Uber Delivery Calculator</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Get real-time delivery quotes from Uber Direct
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            {vehicleType === "car" ? <Car className="h-4 w-4" /> : <Bike className="h-4 w-4" />}
            Get Delivery Quote
          </CardTitle>
          <CardDescription>
            Enter pickup and dropoff addresses to get a delivery price estimate. Choose car for larger packages or bike for smaller items.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Vehicle Type</Label>
            <ToggleGroup
              type="single"
              value={vehicleType}
              onValueChange={(value) => value && setVehicleType(value as "car" | "bike")}
              className="justify-start"
            >
              <ToggleGroupItem value="car" aria-label="Car delivery" className="gap-1.5 px-3">
                <Car className="h-4 w-4" />
                Car
              </ToggleGroupItem>
              <ToggleGroupItem value="bike" aria-label="Bike delivery" className="gap-1.5 px-3">
                <Bike className="h-4 w-4" />
                Bike
              </ToggleGroupItem>
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">
              {vehicleType === "car" 
                ? "Best for larger packages and heavier items" 
                : "Best for small packages and documents - often faster & cheaper"}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pickup" className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-green-600" />
              Pickup Address
            </Label>
            <Input
              id="pickup"
              placeholder="e.g., 123 Main St, Brooklyn, NY 11201"
              value={pickup}
              onChange={(e) => setPickup(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dropoff" className="flex items-center gap-1.5">
              <Navigation className="h-3.5 w-3.5 text-red-600" />
              Dropoff Address
            </Label>
            <Input
              id="dropoff"
              placeholder="e.g., 456 Oak Ave, Manhattan, NY 10001"
              value={dropoff}
              onChange={(e) => setDropoff(e.target.value)}
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </div>
          )}

          <Button
            onClick={handleGetQuote}
            disabled={loading || !pickup.trim() || !dropoff.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Getting Quote...
              </>
            ) : (
              "Get Delivery Quote"
            )}
          </Button>
        </CardContent>
      </Card>

      {quote && (
        <Card className="mt-4 border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-green-700 dark:text-green-400">
              Delivery Quote
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-background rounded-lg p-3 border">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  Delivery Fee
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(quote.fee, quote.currency)}
                </div>
              </div>

              <div className="bg-background rounded-lg p-3 border">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <Clock className="h-3.5 w-3.5" />
                  Est. Duration
                </div>
                <div className="text-2xl font-bold">
                  {formatDuration(quote.duration)}
                </div>
              </div>

              {quote.dropoff_eta && (
                <div className="bg-background rounded-lg p-3 border">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Navigation className="h-3.5 w-3.5" />
                    Dropoff ETA
                  </div>
                  <div className="text-2xl font-bold">
                    {formatEta(quote.dropoff_eta)}
                  </div>
                </div>
              )}
            </div>

            {quote.id && (
              <p className="text-xs text-muted-foreground mt-3">
                Quote ID: {quote.id}
                {quote.expires_at && (
                  <> • Expires: {new Date(quote.expires_at).toLocaleTimeString()}</>
                )}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mt-6 text-xs text-muted-foreground">
        <p>
          Powered by Uber Direct API. Quotes are estimates and may vary based on
          demand, traffic, and other factors.
        </p>
      </div>
    </div>
  )
}
