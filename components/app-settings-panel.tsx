"use client"

import { useAppConfig } from "@/lib/app-config-context"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building2, Printer, Mail, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export function AppSettingsPanel() {
  const { config, loading, error, updateConfig } = useAppConfig()

  const handleSimpleModeToggle = async (checked: boolean) => {
    try {
      await updateConfig({ simple_mode: checked })
    } catch (err) {
      // Error is handled in context
    }
  }

  const handleCompanyModeToggle = async (mode: "postage_plus" | "printout") => {
    try {
      await updateConfig({ company_mode: mode })
    } catch (err) {
      // Error is handled in context
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading settings...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Company Mode Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5" />
            Company Mode
          </CardTitle>
          <CardDescription>
            Select which company is using the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleCompanyModeToggle("postage_plus")}
              className={cn(
                "flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-all",
                config.company_mode === "postage_plus"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                  : "border-border hover:border-muted-foreground/50"
              )}
            >
              <Mail className={cn(
                "h-8 w-8",
                config.company_mode === "postage_plus" ? "text-blue-500" : "text-muted-foreground"
              )} />
              <div className="text-center">
                <div className="font-semibold">Postage Plus</div>
                <div className="text-xs text-muted-foreground">Mailing Services</div>
              </div>
              {config.company_mode === "postage_plus" && (
                <Badge variant="default" className="bg-blue-500">Active</Badge>
              )}
            </button>

            <button
              onClick={() => handleCompanyModeToggle("printout")}
              className={cn(
                "flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-all",
                config.company_mode === "printout"
                  ? "border-green-500 bg-green-50 dark:bg-green-950"
                  : "border-border hover:border-muted-foreground/50"
              )}
            >
              <Printer className={cn(
                "h-8 w-8",
                config.company_mode === "printout" ? "text-green-500" : "text-muted-foreground"
              )} />
              <div className="text-center">
                <div className="font-semibold">Printout</div>
                <div className="text-xs text-muted-foreground">Print Services</div>
              </div>
              {config.company_mode === "printout" && (
                <Badge variant="default" className="bg-green-500">Active</Badge>
              )}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Simple Mode Toggle */}
      <Card className={cn(
        "transition-all",
        config.simple_mode && "ring-2 ring-amber-500"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                Simple Printing Mode
                {config.simple_mode && (
                  <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                    ON
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                For Postage Plus users who just need to enter printing prices
              </CardDescription>
            </div>
            <Switch
              id="simple-mode"
              checked={config.simple_mode}
              onCheckedChange={handleSimpleModeToggle}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="p-3 bg-muted rounded-lg">
              <div className="font-medium mb-2">When Simple Mode is ON:</div>
              <ul className="space-y-1 text-muted-foreground">
                <li>• In-house printing becomes like OHP - just enter price/cost</li>
                <li>• Skip detailed paper, impressions, and finishing setup</li>
                <li>• Optional calculator button if you need to calculate a price</li>
                <li>• Perfect for Postage Plus quoting workflow</li>
              </ul>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="font-medium mb-2">When Simple Mode is OFF:</div>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Full detailed printing calculator workflow</li>
                <li>• Select paper, calculate impressions, add finishing</li>
                <li>• Perfect for Printout internal pricing</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
