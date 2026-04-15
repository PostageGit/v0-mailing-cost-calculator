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

      {/* Simple Mode Toggle - VERY CLEAR */}
      <Card className={cn(
        "transition-all border-2",
        config.simple_mode ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30" : "border-slate-300"
      )}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Simple Printing Mode</CardTitle>
            <Switch
              id="simple-mode"
              checked={config.simple_mode}
              onCheckedChange={handleSimpleModeToggle}
              className="scale-125"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* BIG STATUS INDICATOR */}
          <div className={cn(
            "p-4 rounded-xl text-center text-lg font-bold",
            config.simple_mode 
              ? "bg-amber-500 text-white" 
              : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          )}>
            {config.simple_mode ? "SIMPLE MODE IS ON" : "SIMPLE MODE IS OFF"}
          </div>

          {/* WHAT HAPPENS NOW - Crystal clear */}
          <div className={cn(
            "p-5 rounded-xl border-2",
            config.simple_mode 
              ? "border-amber-400 bg-white dark:bg-slate-900" 
              : "border-slate-300 bg-white dark:bg-slate-900"
          )}>
            <div className="text-base font-bold mb-3 text-center">
              {config.simple_mode ? "What happens now:" : "What happens now:"}
            </div>
            
            {config.simple_mode ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <span className="text-2xl">1.</span>
                  <div>
                    <div className="font-semibold">Printing = Just Type a Price</div>
                    <div className="text-sm text-muted-foreground">No calculators. Just enter what Printout quoted you.</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <span className="text-2xl">2.</span>
                  <div>
                    <div className="font-semibold">Works Like OHP</div>
                    <div className="text-sm text-muted-foreground">Enter description, quantity, cost, price. Done.</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <span className="text-2xl">3.</span>
                  <div>
                    <div className="font-semibold">Calculator Available If Needed</div>
                    <div className="text-sm text-muted-foreground">Button to open calculator if you need to figure out a price.</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <span className="text-2xl">1.</span>
                  <div>
                    <div className="font-semibold">Full Printing Calculators</div>
                    <div className="text-sm text-muted-foreground">Pick paper, enter impressions, add finishing options.</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <span className="text-2xl">2.</span>
                  <div>
                    <div className="font-semibold">Detailed Pricing</div>
                    <div className="text-sm text-muted-foreground">System calculates cost based on paper + clicks + finishing.</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <span className="text-2xl">3.</span>
                  <div>
                    <div className="font-semibold">For Printout Team</div>
                    <div className="text-sm text-muted-foreground">Full control over all print job details.</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* WHO SHOULD USE THIS */}
          <div className="text-center text-sm text-muted-foreground pt-2">
            {config.simple_mode 
              ? "Best for: Postage Plus team doing quotes" 
              : "Best for: Printout team pricing jobs"
            }
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
