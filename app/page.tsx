"use client"

import { useState, useCallback, useMemo } from "react"
import { PrintingCalculator } from "@/components/printing/printing-calculator"
import { BookletCalculator } from "@/components/booklet/booklet-calculator"
import { USPSPostageCalculator } from "@/components/usps-postage-calculator"
import { LaborCalculator } from "@/components/labor-calculator"
import { QuoteSidebar } from "@/components/quote-sidebar"
import { QuoteProvider, useQuote } from "@/lib/quote-context"
import { MailingProvider } from "@/lib/mailing-context"
import { KanbanBoard } from "@/components/kanban-board"
import { MailClassSettingsPanel } from "@/components/mail-class-settings"
import { CustomerList } from "@/components/customer-list"
import { VendorList } from "@/components/vendor-list"
import { VendorBidTab } from "@/components/vendor-bid-tab"
import { ItemsTab } from "@/components/items-tab"
import { JobSetupHeader } from "@/components/job-setup-header"
import { EnvelopeTab } from "@/components/envelope-tab"
import { StepNavigator, STEPS, type StepId } from "@/components/step-navigator"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Calculator, LayoutDashboard, Settings, Users, Factory, FileText, PanelRightOpen, PanelRightClose } from "lucide-react"
import { usePricingConfig } from "@/lib/use-pricing-config"

/** Map step ID to which quote categories count as "done" for that step */
const STEP_CATEGORIES: Record<StepId, string[]> = {
  envelope: [],
  usps: ["postage"],
  labor: ["listwork"],
  printing: ["flat"],
  booklet: ["booklet"],
  ohp: ["ohp"],
  items: ["item"],
}

function AppContent() {
  const [view, setView] = useState<"calculators" | "dashboard" | "customers" | "vendors">("calculators")
  const [showSettings, setShowSettings] = useState(false)
  const [currentStep, setCurrentStep] = useState<StepId>("envelope")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { loadQuote, items } = useQuote()
  usePricingConfig()

  const handleLoadQuote = useCallback(
    (quoteId: string) => {
      loadQuote(quoteId)
      setView("calculators")
    },
    [loadQuote],
  )

  // Figure out which steps have items added
  const completedSteps = useMemo(() => {
    const done = new Set<StepId>()
    for (const step of STEPS) {
      const cats = STEP_CATEGORIES[step.id]
      if (cats.length > 0 && items.some((item) => cats.includes(item.category))) {
        done.add(step.id)
      }
    }
    return done
  }, [items])

  // Render the current step's calculator
  const renderStep = () => {
    switch (currentStep) {
      case "envelope":
        return <EnvelopeTab />
      case "usps":
        return <USPSPostageCalculator />
      case "labor":
        return <LaborCalculator />
      case "printing":
        return <PrintingCalculator />
      case "booklet":
        return <BookletCalculator />
      case "ohp":
        return <VendorBidTab />
      case "items":
        return <ItemsTab />
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="w-full max-w-[120rem] mx-auto px-4 lg:px-6 flex items-center justify-between h-12">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary text-primary-foreground">
              <Calculator className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-bold tracking-tight text-foreground">MailCost Pro</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={view === "calculators" ? "secondary" : "ghost"}
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={() => setView("calculators")}
            >
              <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Quote</span>
            </Button>
            <Button
              variant={view === "dashboard" ? "secondary" : "ghost"}
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={() => setView("dashboard")}
            >
              <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>
            <Button
              variant={view === "customers" ? "secondary" : "ghost"}
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={() => setView("customers")}
            >
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Customers</span>
            </Button>
            <Button
              variant={view === "vendors" ? "secondary" : "ghost"}
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={() => setView("vendors")}
            >
              <Factory className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Vendors</span>
            </Button>
            <Separator orientation="vertical" className="h-5 mx-1" />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setShowSettings(true)}
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      {view === "calculators" ? (
        <div className="w-full max-w-[120rem] mx-auto px-4 lg:px-6 pt-4 pb-8 flex flex-1 gap-5">
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            {/* Job Setup -- always visible at top */}
            <JobSetupHeader />

            {/* Step Navigator */}
            <StepNavigator
              currentStep={currentStep}
              onStepChange={setCurrentStep}
              completedSteps={completedSteps}
            />

            {/* Current Step Content */}
            <div key={currentStep} className="min-h-[400px] step-enter">
              {renderStep()}
            </div>
          </div>

          {/* Sidebar - toggleable */}
          <aside
            className={`hidden lg:flex flex-col flex-shrink-0 sticky top-[3.75rem] h-[calc(100vh-4.75rem)] transition-all duration-200 ${
              sidebarOpen ? "w-80" : "w-10"
            }`}
          >
            {sidebarOpen ? (
              <div className="relative h-full">
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="absolute -left-3 top-3 z-10 h-6 w-6 rounded-full bg-card border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Collapse sidebar"
                >
                  <PanelRightClose className="h-3 w-3" />
                </button>
                <QuoteSidebar />
              </div>
            ) : (
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex flex-col items-center gap-2 pt-3"
                aria-label="Expand sidebar"
              >
                <div className="h-8 w-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <PanelRightOpen className="h-3.5 w-3.5" />
                </div>
                <span className="text-[9px] text-muted-foreground font-medium [writing-mode:vertical-lr] rotate-180">
                  Quote
                </span>
              </button>
            )}
          </aside>

          {/* Mobile floating quote button */}
          <MobileQuoteDrawer />
        </div>
      ) : view === "dashboard" ? (
        <div className="w-full max-w-[120rem] mx-auto px-4 lg:px-6 pt-5 pb-8">
          <div className="mb-5">
            <h1 className="text-xl font-bold text-foreground text-balance">Saved Quotes</h1>
            <p className="text-sm text-muted-foreground text-pretty mt-1">
              Track and manage your quotes through each stage.
            </p>
          </div>
          <KanbanBoard onLoadQuote={handleLoadQuote} />
        </div>
      ) : view === "customers" ? (
        <div className="w-full max-w-[120rem] mx-auto px-4 lg:px-6 pt-5 pb-8">
          <CustomerList />
        </div>
      ) : (
        <div className="w-full max-w-[120rem] mx-auto px-4 lg:px-6 pt-5 pb-8">
          <VendorList />
        </div>
      )}

      {showSettings && (
        <MailClassSettingsPanel onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}

/** Mobile: floating button that opens quote as a drawer */
function MobileQuoteDrawer() {
  const [open, setOpen] = useState(false)
  const { items, getTotal } = useQuote()
  const total = getTotal()
  const count = items.length

  return (
    <div className="lg:hidden fixed bottom-4 right-4 z-40">
      {open && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[80vh] bg-card border-t border-border rounded-t-2xl shadow-xl flex flex-col overflow-hidden z-50">
            <div className="flex items-center justify-between p-3 border-b border-border">
              <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Quote ({count} items)
              </span>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-1">
              <QuoteSidebar />
            </div>
          </div>
        </div>
      )}

      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-full shadow-lg hover:bg-primary/90 transition-colors"
        >
          <FileText className="h-4 w-4" />
          <span className="text-sm font-semibold">
            {count > 0 ? `$${total.toFixed(0)} (${count})` : "Quote"}
          </span>
        </button>
      )}
    </div>
  )
}

export default function Page() {
  return (
    <QuoteProvider>
      <MailingProvider>
        <AppContent />
      </MailingProvider>
    </QuoteProvider>
  )
}
