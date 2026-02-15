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
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { usePricingConfig } from "@/lib/use-pricing-config"
import {
  Plus, LayoutDashboard, Settings, Users, Factory,
  Mail, Stamp, Wrench, Printer, BookOpen, Send, Package,
  Check, ChevronRight, FileText, PanelRightOpen, X,
} from "lucide-react"

// ─── Step definitions ────────────────────────────────────
type StepId = "envelope" | "usps" | "labor" | "printing" | "booklet" | "ohp" | "items"

const STEPS: { id: StepId; label: string; icon: React.ReactNode }[] = [
  { id: "envelope",  label: "Envelope",      icon: <Mail className="h-4 w-4" /> },
  { id: "usps",      label: "Postage",       icon: <Stamp className="h-4 w-4" /> },
  { id: "labor",     label: "Labor",         icon: <Wrench className="h-4 w-4" /> },
  { id: "printing",  label: "Printing",      icon: <Printer className="h-4 w-4" /> },
  { id: "booklet",   label: "Booklet",       icon: <BookOpen className="h-4 w-4" /> },
  { id: "ohp",       label: "OHP",           icon: <Send className="h-4 w-4" /> },
  { id: "items",     label: "Items",         icon: <Package className="h-4 w-4" /> },
]

const STEP_CATS: Record<StepId, string[]> = {
  envelope: [], usps: ["postage"], labor: ["listwork"],
  printing: ["flat"], booklet: ["booklet"], ohp: ["ohp"], items: ["item"],
}

// ─── Views ───────────────────────────────────────────────
type View = "home" | "job" | "dashboard" | "customers" | "vendors"

function AppContent() {
  const [view, setView] = useState<View>("home")
  const [showSettings, setShowSettings] = useState(false)
  const [currentStep, setCurrentStep] = useState<StepId>("envelope")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { loadQuote, items, newQuote } = useQuote()
  usePricingConfig()

  const handleLoadQuote = useCallback(
    (quoteId: string) => { loadQuote(quoteId); setView("job") },
    [loadQuote],
  )

  const handleNewJob = useCallback(() => {
    newQuote()
    setCurrentStep("envelope")
    setView("job")
  }, [newQuote])

  const completedSteps = useMemo(() => {
    const done = new Set<StepId>()
    for (const s of STEPS) {
      if (STEP_CATS[s.id].length > 0 && items.some((i) => STEP_CATS[s.id].includes(i.category))) done.add(s.id)
    }
    return done
  }, [items])

  const renderStep = () => {
    switch (currentStep) {
      case "envelope": return <EnvelopeTab />
      case "usps": return <USPSPostageCalculator />
      case "labor": return <LaborCalculator />
      case "printing": return <PrintingCalculator />
      case "booklet": return <BookletCalculator />
      case "ohp": return <VendorBidTab />
      case "items": return <ItemsTab />
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ─── Top Nav ─── */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/60">
        <div className="max-w-[90rem] mx-auto px-6 flex items-center justify-between h-12">
          <span className="text-sm font-semibold tracking-tight text-foreground select-none">MailCost Pro</span>
          <nav className="flex items-center gap-0.5">
            {([
              { v: "home" as View, label: "Home" },
              { v: "dashboard" as View, label: "Dashboard", icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
              { v: "customers" as View, label: "Customers", icon: <Users className="h-3.5 w-3.5" /> },
              { v: "vendors" as View, label: "Vendors", icon: <Factory className="h-3.5 w-3.5" /> },
            ]).map((n) => (
              <button
                key={n.v}
                onClick={() => setView(n.v)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                  view === n.v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {n.label}
              </button>
            ))}
            <div className="w-px h-4 bg-border mx-1" />
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </nav>
        </div>
      </header>

      {/* ─── HOME: New Job CTA ─── */}
      {view === "home" && (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <h1 className="text-4xl font-bold tracking-tight text-foreground text-balance">
              Ready to quote.
            </h1>
            <p className="mt-3 text-base text-muted-foreground text-pretty leading-relaxed">
              Start a new job to build your mailing and printing estimate step by step.
            </p>
            <Button
              onClick={handleNewJob}
              className="mt-8 h-12 px-8 text-base font-semibold rounded-full bg-foreground text-background hover:bg-foreground/90 gap-2 shadow-lg"
            >
              <Plus className="h-5 w-5" />
              New Job
            </Button>

            {/* Recent jobs hint */}
            <button
              onClick={() => setView("dashboard")}
              className="mt-6 block mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              or open an existing quote
            </button>
          </div>
        </div>
      )}

      {/* ─── JOB VIEW: stepper + calculators ─── */}
      {view === "job" && (
        <div className="flex-1 flex flex-col">
          {/* Job Setup */}
          <div className="max-w-[90rem] mx-auto w-full px-6 pt-5">
            <JobSetupHeader />
          </div>

          {/* Step Pills */}
          <div className="sticky top-12 z-30 bg-background/80 backdrop-blur-xl border-b border-border/40">
            <div className="max-w-[90rem] mx-auto px-6">
              <div className="flex items-center gap-1 py-2.5 overflow-x-auto no-scrollbar">
                {STEPS.map((step) => {
                  const active = step.id === currentStep
                  const done = completedSteps.has(step.id)
                  return (
                    <button
                      key={step.id}
                      onClick={() => setCurrentStep(step.id)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap shrink-0",
                        active
                          ? "bg-foreground text-background shadow-sm"
                          : done
                          ? "bg-secondary text-foreground hover:bg-secondary/80"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                    >
                      {done && !active ? <Check className="h-3 w-3" /> : step.icon}
                      {step.label}
                    </button>
                  )
                })}

                {/* Next hint */}
                {(() => {
                  const idx = STEPS.findIndex((s) => s.id === currentStep)
                  if (idx < STEPS.length - 1) {
                    return (
                      <button
                        onClick={() => setCurrentStep(STEPS[idx + 1].id)}
                        className="ml-auto flex items-center gap-1 px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      >
                        Next <ChevronRight className="h-3 w-3" />
                      </button>
                    )
                  }
                  return null
                })()}
              </div>
            </div>
          </div>

          {/* Content + Sidebar */}
          <div className="max-w-[90rem] mx-auto w-full px-6 pt-5 pb-10 flex gap-6 flex-1">
            {/* Calculator */}
            <main key={currentStep} className="flex-1 min-w-0 step-enter">
              {renderStep()}
            </main>

            {/* Sidebar Desktop */}
            {sidebarOpen ? (
              <aside className="hidden lg:block w-80 shrink-0 sticky top-[7.5rem] h-[calc(100vh-8.5rem)]">
                <QuoteSidebar />
              </aside>
            ) : (
              <aside className="hidden lg:flex flex-col items-center pt-2 shrink-0 sticky top-[7.5rem] h-[calc(100vh-8.5rem)]">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="h-9 w-9 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:shadow-sm transition-all"
                  aria-label="Open quote panel"
                >
                  <PanelRightOpen className="h-4 w-4" />
                </button>
              </aside>
            )}
          </div>

          {/* Mobile bottom bar */}
          <MobileQuoteBar />
        </div>
      )}

      {/* ─── Other views ─── */}
      {view === "dashboard" && (
        <div className="max-w-[90rem] mx-auto w-full px-6 pt-6 pb-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Saved Quotes</h1>
              <p className="text-sm text-muted-foreground mt-1">Track and manage your quotes.</p>
            </div>
            <Button onClick={handleNewJob} className="gap-2 rounded-full bg-foreground text-background hover:bg-foreground/90">
              <Plus className="h-4 w-4" /> New Job
            </Button>
          </div>
          <KanbanBoard onLoadQuote={handleLoadQuote} />
        </div>
      )}
      {view === "customers" && (
        <div className="max-w-[90rem] mx-auto w-full px-6 pt-6 pb-10"><CustomerList /></div>
      )}
      {view === "vendors" && (
        <div className="max-w-[90rem] mx-auto w-full px-6 pt-6 pb-10"><VendorList /></div>
      )}

      {showSettings && <MailClassSettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  )
}

// ─── Mobile Quote Bar ─────────────────────────────────────
function MobileQuoteBar() {
  const [open, setOpen] = useState(false)
  const { items, getTotal } = useQuote()
  const total = getTotal()
  const count = items.length

  if (count === 0 && !open) return null

  return (
    <>
      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] bg-card rounded-t-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <span className="text-sm font-semibold text-foreground">
                Quote ({count} {count === 1 ? "item" : "items"})
              </span>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-secondary transition-colors">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto"><QuoteSidebar /></div>
          </div>
        </div>
      )}

      {/* Floating bar */}
      {!open && count > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="w-full flex items-center justify-between bg-foreground text-background px-5 py-3.5 rounded-2xl shadow-xl"
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 opacity-60" />
              <span className="text-sm font-semibold">{count} {count === 1 ? "item" : "items"}</span>
            </div>
            <span className="text-sm font-bold font-mono">${total.toFixed(2)}</span>
          </button>
        </div>
      )}
    </>
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
