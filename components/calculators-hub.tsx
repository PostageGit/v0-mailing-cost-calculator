"use client"

  import React, { useState } from "react"
  import {
  Calculator, FileText, BookOpen, Mail, Layers,
  Package, Scissors, Settings, Database, ChevronLeft,
  Truck, Stamp, StickyNote, Disc3, BookMarked,
  Printer, LayoutGrid, Check, AlertCircle,
  CheckCircle2, Info, ArrowRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Import standalone calculator wrappers (no quote dependencies)
import {
  StandalonePrintingCalculator,
  StandaloneBookletCalculator,
  StandalonePerfectCalculator,
  StandaloneSpiralCalculator,
  StandalonePadCalculator,
  StandaloneEnvelopeCalculator,
  StandaloneUSPSPostageCalculator,
} from "@/components/standalone-calculator-wrappers"

// Import all settings
import { PapersSettings } from "@/components/papers-settings"
import { PaperWeightsSettingsTab } from "@/components/paper-weights-settings"
import { BoxSizesSettings } from "@/components/box-sizes-settings"
import { SaddleStitchSettingsTab } from "@/components/saddle-stitch-settings"
import { PerfectBindingSettingsTab } from "@/components/perfect-binding-settings"
import { FoldScoreSettingsTab } from "@/components/fold-score-settings"
import { SuppliersSettings } from "@/components/suppliers-settings"
import { FinishingCalculatorsSettingsTab } from "@/components/finishing-calculators-settings"

// Calculator definitions
const CALCULATORS = [
  { 
    id: "flat-printing", 
    name: "Flat Printing", 
    description: "Flyers, postcards, letterheads, business cards",
    icon: FileText,
    color: "bg-blue-500",
  },
  { 
    id: "booklet", 
    name: "Saddle Stitch Booklet", 
    description: "Brochures, catalogs, magazines",
    icon: BookOpen,
    color: "bg-emerald-500",
  },
  { 
    id: "perfect", 
    name: "Perfect Binding", 
    description: "Books, thick catalogs, manuals",
    icon: BookMarked,
    color: "bg-purple-500",
  },
  { 
    id: "spiral", 
    name: "Spiral/Coil Binding", 
    description: "Notebooks, presentations, manuals",
    icon: Disc3,
    color: "bg-orange-500",
  },
  { 
    id: "pad", 
    name: "Notepads", 
    description: "Tear-off pads, memo pads",
    icon: StickyNote,
    color: "bg-yellow-500",
  },
  { 
    id: "envelope", 
    name: "Envelopes", 
    description: "Printed envelopes, all sizes",
    icon: Mail,
    color: "bg-pink-500",
  },
  { 
    id: "usps", 
    name: "USPS Postage", 
    description: "Postage rates by class and weight",
    icon: Stamp,
    color: "bg-indigo-500",
  },
]

// Tag tones used to tell the user, at a glance, whether a settings screen
// is the AUTHORITATIVE place to edit a given price ("price") or whether it
// is reference data that does NOT affect pricing ("reference"). A neutral
// "info" tone is used for screens that own their own specific rates.
type SettingTagTone = "price" | "reference" | "info"

// Settings definitions. Each entry carries an explicit `tag` so users know
// which screen is the right place to change a value — and which screens are
// NOT where prices are set — to avoid editing in the wrong place.
const SETTINGS_CATEGORIES: {
  id: string
  name: string
  description: string
  icon: typeof Layers
  component: React.ComponentType<{ readOnly?: boolean }>
  tag: string
  tagTone: SettingTagTone
  /** Short, plain-language assurance shown in a banner INSIDE the screen
   *  so the user knows at a glance whether they're in the right place. */
  assurance: string
  /** For "reference"/"info" screens that are NOT the price source: where
   *  the user SHOULD go to change prices. Renders a jump button. */
  redirectTo?: { id: string; name: string }
}[] = [
  {
    id: "papers",
    name: "Paper Stocks",
    description: "Edit paper types, sizes, and the per-sheet PRICE. This is the one place that controls paper pricing everywhere.",
    icon: Layers,
    component: PapersSettings,
    tag: "Paper prices set here",
    tagTone: "price",
    assurance: "You're in the right place. Paper prices you set here apply to every calculator across the whole app.",
  },
  {
    id: "paper-weights",
    name: "Paper Weights",
    description: "Weight reference tables only. Changing these does NOT change any prices — edit prices in Paper Stocks.",
    icon: Database,
    component: PaperWeightsSettingsTab,
    tag: "Reference only — not prices",
    tagTone: "reference",
    assurance: "This is NOT where prices are set. Editing weights here will NOT change any quote pricing. To change paper prices, go to Paper Stocks.",
    redirectTo: { id: "papers", name: "Paper Stocks" },
  },
  {
    id: "finishing",
    name: "Finishing Options",
    description: "Lamination & coating rates, labor and markup used by the calculators. This is where finishing prices are set.",
    icon: Scissors,
    component: FinishingCalculatorsSettingsTab,
    tag: "Finishing prices set here",
    tagTone: "price",
    assurance: "You're in the right place. Lamination, coating and other finishing prices are set here and used by the calculators.",
  },
  {
    id: "fold-score",
    name: "Fold & Score",
    description: "Folding & scoring labor rates only. For lamination or coating use Finishing Options instead.",
    icon: LayoutGrid,
    component: FoldScoreSettingsTab,
    tag: "Fold / score rates only",
    tagTone: "info",
    assurance: "This screen sets ONLY folding & scoring labor rates. Looking for lamination or coating? Those live in Finishing Options.",
    redirectTo: { id: "finishing", name: "Finishing Options" },
  },
  {
    id: "saddle-stitch",
    name: "Saddle Stitch",
    description: "Saddle stitch (booklet) binding rates. This is the right place for booklet binding pricing.",
    icon: BookOpen,
    component: SaddleStitchSettingsTab,
    tag: "Booklet binding rates",
    tagTone: "info",
    assurance: "You're in the right place for saddle stitch (booklet) binding rates. Perfect-bound books are priced under Perfect Binding.",
  },
  {
    id: "perfect-binding",
    name: "Perfect Binding",
    description: "Perfect binding rates. This is the right place for perfect-bound book pricing.",
    icon: BookMarked,
    component: PerfectBindingSettingsTab,
    tag: "Perfect binding rates",
    tagTone: "info",
    assurance: "You're in the right place for perfect-bound book binding rates. Saddle-stitched booklets are priced under Saddle Stitch.",
  },
  {
    id: "boxes",
    name: "Shipping Boxes",
    description: "Box sizes and inventory used for shipping. No print or paper pricing here.",
    icon: Package,
    component: BoxSizesSettings,
    tag: "Box sizes & inventory",
    tagTone: "info",
    assurance: "This screen manages shipping box sizes and inventory only. There is no print or paper pricing here.",
  },
  {
    id: "suppliers",
    name: "Suppliers & Supplies",
    description: "Vendor catalog and supply item prices. This is where supply / vendor pricing is set.",
    icon: Truck,
    component: SuppliersSettings,
    tag: "Supply prices set here",
    tagTone: "price",
    assurance: "You're in the right place for vendor and supply item prices. Paper prices live in Paper Stocks, finishing in Finishing Options.",
  },
]

// Small helper: visual styles for each tag tone.
const SETTING_TAG_STYLES: Record<SettingTagTone, string> = {
  // Green = authoritative place to edit this kind of price.
  price: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  // Amber = NOT where prices are set; reference only. Draws caution.
  reference: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  // Neutral = owns its own specific rates, no confusion risk.
  info: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
}

interface CalculatorsHubProps {
  /** If true, Settings are read-only and require password to edit */
  settingsLocked?: boolean
  /** Password to unlock settings editing (default: "1234") */
  settingsPassword?: string
}

export function CalculatorsHub({ 
  settingsLocked = false, 
  settingsPassword = "1234" 
}: CalculatorsHubProps) {
  const [activeCalculator, setActiveCalculator] = useState<string | null>(null)
  const [activeSetting, setActiveSetting] = useState<string | null>(null)
  const [settingsUnlocked, setSettingsUnlocked] = useState(!settingsLocked)
  const [passwordInput, setPasswordInput] = useState("")
  const [showPasswordError, setShowPasswordError] = useState(false)

  const handleUnlockSettings = () => {
    if (passwordInput === settingsPassword) {
      setSettingsUnlocked(true)
      setShowPasswordError(false)
    } else {
      setShowPasswordError(true)
    }
  }

  // Render active calculator (using standalone wrappers - no quote dependencies)
  const renderCalculator = () => {
    switch (activeCalculator) {
      case "flat-printing":
        return <StandalonePrintingCalculator />
      case "booklet":
        return <StandaloneBookletCalculator />
      case "perfect":
        return <StandalonePerfectCalculator />
      case "spiral":
        return <StandaloneSpiralCalculator />
      case "pad":
        return <StandalonePadCalculator />
      case "envelope":
        return <StandaloneEnvelopeCalculator />
      case "usps":
        return <StandaloneUSPSPostageCalculator />
      default:
        return null
    }
  }

  // Render active setting
  const renderSetting = () => {
    const setting = SETTINGS_CATEGORIES.find(s => s.id === activeSetting)
    if (!setting) return null
    const SettingComponent = setting.component
    // Pass readOnly prop when settings are locked
    return <SettingComponent readOnly={!settingsUnlocked} />
  }

  // If a calculator is active, show it full screen
  if (activeCalculator) {
    const calc = CALCULATORS.find(c => c.id === activeCalculator)
    return (
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b bg-muted/30">
          <button
            onClick={() => setActiveCalculator(null)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Calculators
          </button>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-3">
            {calc && (
              <>
                <div className={cn("p-2 rounded-lg", calc.color)}>
                  <calc.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold">{calc.name}</h1>
                  <p className="text-xs text-muted-foreground">{calc.description}</p>
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Calculator content */}
        <div className="flex-1 overflow-auto p-6">
          {renderCalculator()}
        </div>
      </div>
    )
  }

  // If a setting is active, show it full screen
  if (activeSetting) {
    const setting = SETTINGS_CATEGORIES.find(s => s.id === activeSetting)
    return (
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b bg-muted/30">
          <button
            onClick={() => setActiveSetting(null)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Settings
          </button>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-3">
            {setting && (
              <>
                <div className="p-2 rounded-lg bg-slate-500">
                  <setting.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold">{setting.name}</h1>
                  <p className="text-xs text-muted-foreground">{setting.description}</p>
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Read-only banner */}
        {!settingsUnlocked && (
          <div className="mx-6 mt-4 p-3 rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-700 dark:text-amber-300 text-center">
              View Only - Enter password on Settings page to make changes
            </p>
          </div>
        )}

        {/* "Right place vs wrong place" assurance banner.
            - price tone  → green  : confirms this IS the source of truth.
            - reference   → red    : warns this is NOT where prices live.
            - info tone   → blue   : clarifies exactly what this screen owns.
            Keeps the user from editing in the wrong place. */}
        {setting && (
          <div
            className={cn(
              "mx-6 mt-4 flex items-start gap-3 p-4 rounded-xl border-2",
              setting.tagTone === "price" &&
                "bg-emerald-50 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-800",
              setting.tagTone === "reference" &&
                "bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-800",
              setting.tagTone === "info" &&
                "bg-blue-50 border-blue-300 dark:bg-blue-950/30 dark:border-blue-800",
            )}
          >
            <div className="shrink-0 mt-0.5">
              {setting.tagTone === "price" && (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              )}
              {setting.tagTone === "reference" && (
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              )}
              {setting.tagTone === "info" && (
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  "text-sm font-bold leading-snug",
                  setting.tagTone === "price" &&
                    "text-emerald-800 dark:text-emerald-200",
                  setting.tagTone === "reference" &&
                    "text-red-800 dark:text-red-200",
                  setting.tagTone === "info" &&
                    "text-blue-800 dark:text-blue-200",
                )}
              >
                {setting.assurance}
              </p>
              {setting.redirectTo && (
                <button
                  onClick={() => setActiveSetting(setting.redirectTo!.id)}
                  className={cn(
                    "mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors",
                    setting.tagTone === "reference"
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-blue-600 text-white hover:bg-blue-700",
                  )}
                >
                  Go to {setting.redirectTo.name}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Setting content */}
        <div className={cn(
          "flex-1 overflow-auto p-6",
          !settingsUnlocked && "pointer-events-none select-none opacity-80"
        )}>
          {renderSetting()}
        </div>
      </div>
    )
  }

  // Main hub view
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-6 py-5 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Calculators</h1>
            <p className="text-sm text-muted-foreground">
              Standalone pricing calculators, settings, and inventory
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="calculators" className="flex-1 flex flex-col">
        <div className="px-6 border-b">
          <TabsList className="h-12 bg-transparent p-0 gap-6">
            <TabsTrigger 
              value="calculators" 
              className="h-12 px-0 pb-3 pt-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium"
            >
              <Printer className="h-4 w-4 mr-2" />
              Calculators
            </TabsTrigger>
            <TabsTrigger 
              value="settings" 
              className="h-12 px-0 pb-3 pt-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium"
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Calculators Tab */}
        <TabsContent value="calculators" className="flex-1 overflow-auto p-6 mt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CALCULATORS.map((calc) => (
              <button
                key={calc.id}
                onClick={() => setActiveCalculator(calc.id)}
                className="group flex items-start gap-4 p-5 rounded-xl border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all text-left"
              >
                <div className={cn("p-3 rounded-xl shrink-0", calc.color, "group-hover:scale-110 transition-transform")}>
                  <calc.icon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base group-hover:text-primary transition-colors">
                    {calc.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {calc.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="flex-1 overflow-auto p-6 mt-0">
          {/* View-only banner when locked */}
          {!settingsUnlocked && (
            <div className="mb-6 p-4 rounded-xl border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Settings className="h-5 w-5 text-blue-600" />
                  <div>
                    <h3 className="font-semibold text-blue-800 dark:text-blue-200">View Only Mode</h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      You can view settings but cannot make changes.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value)
                      setShowPasswordError(false)
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleUnlockSettings()}
                    placeholder="Password"
                    className="w-28 px-3 py-1.5 rounded-lg border bg-white dark:bg-slate-900 text-sm"
                  />
                  <button
                    onClick={handleUnlockSettings}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                  >
                    Unlock
                  </button>
                </div>
              </div>
              {showPasswordError && (
                <p className="text-sm text-red-600 mt-2">Incorrect password</p>
              )}
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SETTINGS_CATEGORIES.map((setting) => (
              <button
                key={setting.id}
                onClick={() => setActiveSetting(setting.id)}
                className="group flex items-start gap-4 p-5 rounded-xl border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all text-left cursor-pointer"
              >
                <div className="p-3 rounded-xl shrink-0 bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                  <setting.icon className="h-6 w-6 text-slate-600 dark:text-slate-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-base group-hover:text-primary transition-colors">
                      {setting.name}
                    </h3>
                    {/* Guidance badge: tells the user whether THIS is the
                        right place to set a price, or reference-only. */}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide leading-none",
                        SETTING_TAG_STYLES[setting.tagTone],
                      )}
                    >
                      {setting.tagTone === "price" && <Check className="h-2.5 w-2.5" />}
                      {setting.tagTone === "reference" && <AlertCircle className="h-2.5 w-2.5" />}
                      {setting.tag}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1.5 line-clamp-3">
                    {setting.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </TabsContent>

        </Tabs>
    </div>
  )
}
