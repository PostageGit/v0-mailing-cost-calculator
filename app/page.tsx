"use client"

import { useState, useCallback, useMemo, useEffect, Component, type ReactNode } from "react"
import { PrintingCalculator } from "@/components/printing/printing-calculator"
import { BookletCalculator } from "@/components/booklet/booklet-calculator"
import { SpiralCalculator } from "@/components/spiral/spiral-calculator"
import { PerfectCalculator } from "@/components/perfect/perfect-calculator"
import { USPSPostageCalculator } from "@/components/usps-postage-calculator"
import { ServiceBuilder } from "@/components/service-builder"
import { QuoteSidebar } from "@/components/quote-sidebar"
import { MailPiecePlanner } from "@/components/mail-piece-planner"
import { QuoteProvider, useQuote } from "@/lib/quote-context"
import { MailingProvider, useMailing, PIECE_TYPE_META } from "@/lib/mailing-context"
import { KanbanBoard } from "@/components/kanban-board"
import { MailClassSettingsPanel } from "@/components/mail-class-settings"
import { CustomerList } from "@/components/customer-list"
import { VendorList } from "@/components/vendor-list"
import { DeliveriesDashboard } from "@/components/deliveries-dashboard"
import { BillingDashboard } from "@/components/billing-dashboard"
import { OhpBidsDashboard } from "@/components/ohp-bids-dashboard"
import { VendorBidTab } from "@/components/vendor-bid-tab"
import { ItemsTab } from "@/components/items-tab"
import { EnvelopeTab } from "@/components/envelope-tab"
import { InvoiceList } from "@/components/invoice-list"
import { ExportToQB } from "@/components/export-to-qb"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { usePricingConfig } from "@/lib/use-pricing-config"
import {
  Plus, Settings, Mail, Stamp, Wrench, Printer, BookOpen, Disc3,
  Send, Package, Check, ChevronRight, FileText, Receipt, Briefcase,
  PanelRightOpen, X, Layers, ArrowLeft, PenLine, LayoutDashboard,
  Users, Truck, Menu, ChevronLeft, Columns3, List, Download, LayoutPanelLeft, DollarSign,
} from "lucide-react"

// ---- Calculator Steps (after planner) ----
type StepId = "envelope" | "usps" | "labor" | "printing" | "booklet" | "spiral" | "perfect" | "ohp" | "items"
const ALL_STEPS: { id: StepId; label: string; icon: React.ReactNode }[] = [
  { id: "envelope",  label: "Envelope",  icon: <Mail className="h-3.5 w-3.5" /> },
  { id: "usps",      label: "Postage",   icon: <Stamp className="h-3.5 w-3.5" /> },
  { id: "labor",     label: "Services",  icon: <Wrench className="h-3.5 w-3.5" /> },
  { id: "printing",  label: "Printing",  icon: <Printer className="h-3.5 w-3.5" /> },
  { id: "booklet",   label: "Booklet",   icon: <BookOpen className="h-3.5 w-3.5" /> },
  { id: "spiral",    label: "Spiral",    icon: <Disc3 className="h-3.5 w-3.5" /> },
  { id: "perfect",   label: "Perfect",   icon: <BookOpen className="h-3.5 w-3.5" /> },
  { id: "ohp",       label: "OHP",       icon: <Send className="h-3.5 w-3.5" /> },
  { id: "items",     label: "Items",     icon: <Package className="h-3.5 w-3.5" /> },
]
const STEP_CATS: Record<StepId, string[]> = {
  envelope: ["envelope"], usps: ["postage"], labor: ["listwork", "item"],
  printing: ["flat"], booklet: ["booklet"], spiral: ["spiral"], perfect: ["perfect"], ohp: ["ohp"], items: ["item"],
}

class StepErrorBoundary extends Component<{ children: ReactNode; stepId: string }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error) { console.error("[v0] Step crash:", this.props.stepId, error) }
  render() {
    if (this.state.error) return (
      <div className="p-8 rounded-2xl border border-destructive/30 bg-destructive/5">
        <h3 className="text-sm font-bold text-destructive mb-2">Error in: {this.props.stepId}</h3>
        <pre className="text-xs text-destructive/80 whitespace-pre-wrap">{this.state.error.message}{"\n"}{this.state.error.stack}</pre>
      </div>
    )
    return this.props.children
  }
}

// ---- Sidebar nav sections ----
type Section =
  | "quotes-board" | "jobs-board" | "deliveries" | "billing" | "ohp-bids"
  | "customers" | "invoices" | "export-qb" | "vendors"
  | "job"

interface NavItem { id: Section; label: string; icon: ReactNode; group: "dashboards" | "data" }
const NAV_ITEMS: NavItem[] = [
  { id: "quotes-board", label: "Quotes",     icon: <LayoutDashboard className="h-4 w-4" />, group: "dashboards" },
  { id: "jobs-board",   label: "Active Jobs",  icon: <Briefcase className="h-4 w-4" />,       group: "dashboards" },
  { id: "deliveries",   label: "Deliveries",   icon: <Package className="h-4 w-4" />,         group: "dashboards" },
  { id: "billing",      label: "Billing",      icon: <DollarSign className="h-4 w-4" />,      group: "dashboards" },
  { id: "ohp-bids",     label: "OHP Bids",     icon: <Send className="h-4 w-4" />,            group: "dashboards" },
  { id: "customers",    label: "Customers",   icon: <Users className="h-4 w-4" />,            group: "data" },
  { id: "invoices",     label: "Invoices",    icon: <Receipt className="h-4 w-4" />,          group: "data" },
  { id: "export-qb",    label: "Export to QB", icon: <Download className="h-4 w-4" />,         group: "data" },
  { id: "vendors",      label: "Vendors",     icon: <Truck className="h-4 w-4" />,            group: "data" },
]

type JobPhase = "planner" | "pricing"

function AppContent() {
  const [section, setSection] = useState<Section>("quotes-board")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [quoteView, setQuoteView] = useState<"board" | "list" | "sidebar">("board")
  const [jobView, setJobView] = useState<"board" | "list" | "sidebar">("board")
  const [showSettings, setShowSettings] = useState(false)
  const [jobPhase, setJobPhase] = useState<JobPhase>("planner")
  const [currentStep, setCurrentStep] = useState<StepId>("usps")
  const [rightOpen, setRightOpen] = useState(true)
  const { loadQuote, items, newQuote } = useQuote()
  const mailing = useMailing()
  usePricingConfig()

  const visibleSteps = useMemo(() => {
    return ALL_STEPS.filter((step) => {
      if (step.id === "envelope" && !mailing.needsEnvelope) return false
      if (step.id === "printing" && !mailing.needsPrinting) return false
      if (step.id === "booklet" && !mailing.needsBooklet) return false
      if (step.id === "spiral" && !mailing.needsSpiral) return false
      if (step.id === "perfect" && !mailing.needsPerfect) return false
      if (step.id === "ohp" && !mailing.needsOHP) return false
      return true
    })
  }, [mailing.needsEnvelope, mailing.needsPrinting, mailing.needsBooklet, mailing.needsSpiral, mailing.needsPerfect, mailing.needsOHP])

  useEffect(() => {
    if (jobPhase === "pricing" && !visibleSteps.find((s) => s.id === currentStep)) {
      setCurrentStep(visibleSteps[0]?.id || "usps")
    }
  }, [visibleSteps, currentStep, jobPhase])

  const handleLoadQuote = useCallback(
    async (quoteId: string, step?: string) => { await loadQuote(quoteId); setJobPhase("pricing"); if (step) setCurrentStep(step as StepId); setSection("job") },
    [loadQuote],
  )
  const handleNewJob = useCallback(() => {
    newQuote(); setJobPhase("planner"); setSection("job")
  }, [newQuote])

  const handleContinueToPricing = useCallback(() => {
    setJobPhase("pricing")
    setCurrentStep(visibleSteps[0]?.id || "usps")
  }, [visibleSteps])

  const completedSteps = useMemo(() => {
    const done = new Set<StepId>()
    for (const s of visibleSteps) {
      if (STEP_CATS[s.id].length > 0 && items.some((i) => STEP_CATS[s.id].includes(i.category))) done.add(s.id)
    }
    return done
  }, [items, visibleSteps])

  const renderStep = () => {
    switch (currentStep) {
      case "envelope": return <EnvelopeTab />
      case "usps":     return <USPSPostageCalculator />
      case "labor":    return <ServiceBuilder />
      case "printing": return <PrintingCalculator />
      case "booklet":  return <BookletCalculator />
      case "spiral":   return <SpiralCalculator />
      case "perfect":  return <PerfectCalculator />
      case "ohp":      return <VendorBidTab />
      case "items":    return <ItemsTab /> /* DB items fallback */
    }
  }

  const isJobView = section === "job"

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* ---- Mobile Top Bar ---- */}
      <header className="flex lg:hidden items-center justify-between h-12 px-3 border-b border-border bg-background shrink-0 z-40">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-secondary min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Toggle menu">
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold text-foreground">Postage Plus</span>
        <button onClick={() => setShowSettings(true)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Settings">
          <Settings className="h-4 w-4" />
        </button>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* ---- LEFT SIDEBAR ---- */}
        {/* Desktop: always visible; Mobile: overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}
        <aside className={cn(
          "flex flex-col bg-card border-r border-border shrink-0 z-50 transition-all duration-200",
          // Desktop
          "hidden lg:flex",
          sidebarOpen ? "w-52" : "w-14",
          // Mobile overlay
        )}>
          {/* Logo + collapse */}
          <div className="flex items-center justify-between h-12 px-3 border-b border-border shrink-0">
            {sidebarOpen && <span className="text-sm font-bold text-foreground truncate">Postage Plus</span>}
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}>
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>

          {/* New Job button */}
          <div className="px-2 pt-3 pb-1">
            <Button onClick={handleNewJob}
              className={cn(
                "w-full gap-2 rounded-lg bg-foreground text-background hover:bg-foreground/90 font-semibold",
                sidebarOpen ? "h-9 text-xs px-3 justify-start" : "h-9 w-9 p-0 justify-center mx-auto"
              )}>
              <Plus className="h-4 w-4 shrink-0" />
              {sidebarOpen && "New Quote"}
            </Button>
          </div>

          {/* Nav groups */}
          <nav className="flex-1 overflow-y-auto px-2 pt-2 pb-4 flex flex-col gap-4">
            {(["dashboards", "data"] as const).map((group) => (
              <div key={group}>
                {sidebarOpen && (
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 px-2 mb-1">
                    {group === "dashboards" ? "Boards" : "Manage"}
                  </p>
                )}
                <div className="flex flex-col gap-0.5">
                  {NAV_ITEMS.filter((n) => n.group === group).map((nav) => {
                    const active = section === nav.id
                    return (
                      <button key={nav.id} onClick={() => { setSection(nav.id); setSidebarOpen(true) }}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg transition-all min-h-[40px]",
                          sidebarOpen ? "px-2.5 py-2 text-sm" : "px-0 py-2 justify-center",
                          active
                            ? "bg-foreground text-background font-semibold"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                        )}
                        title={!sidebarOpen ? nav.label : undefined}>
                        {nav.icon}
                        {sidebarOpen && <span className="truncate">{nav.label}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Settings footer */}
          <div className="px-2 pb-3 border-t border-border pt-2">
            <button onClick={() => setShowSettings(true)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all min-h-[40px]",
                sidebarOpen ? "px-2.5 py-2 text-sm w-full" : "px-0 py-2 justify-center w-full"
              )}>
              <Settings className="h-4 w-4 shrink-0" />
              {sidebarOpen && <span>Settings</span>}
            </button>
          </div>
        </aside>

        {/* Mobile sidebar overlay panel */}
        {sidebarOpen && (
          <aside className="fixed left-0 top-12 bottom-0 w-56 bg-card border-r border-border z-50 flex flex-col lg:hidden animate-in slide-in-from-left-2 duration-200">
            <div className="px-2 pt-3 pb-1">
              <Button onClick={() => { handleNewJob(); setSidebarOpen(false) }}
                className="w-full gap-2 rounded-lg bg-foreground text-background hover:bg-foreground/90 font-semibold h-10 text-xs px-3 justify-start">
                <Plus className="h-4 w-4 shrink-0" /> New Quote
              </Button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 pt-2 pb-4 flex flex-col gap-4">
              {(["dashboards", "data"] as const).map((group) => (
                <div key={group}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 px-2 mb-1">
                    {group === "dashboards" ? "Boards" : "Manage"}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {NAV_ITEMS.filter((n) => n.group === group).map((nav) => {
                      const active = section === nav.id
                      return (
                        <button key={nav.id} onClick={() => { setSection(nav.id); setSidebarOpen(false) }}
                          className={cn(
                            "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all min-h-[44px]",
                            active ? "bg-foreground text-background font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                          )}>
                          {nav.icon}
                          <span>{nav.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>
            <div className="px-2 pb-3 border-t border-border pt-2">
              <button onClick={() => { setShowSettings(true); setSidebarOpen(false) }}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary w-full min-h-[44px]">
                <Settings className="h-4 w-4 shrink-0" /> Settings
              </button>
            </div>
          </aside>
        )}

        {/* ---- MAIN CONTENT AREA ---- */}
        <main className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">

          {/* == QUOTES BOARD == */}
          {section === "quotes-board" && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="px-4 sm:px-6 pt-3 pb-2 flex items-center justify-between shrink-0">
                <h1 className="text-lg font-bold tracking-tight text-foreground">Quotes</h1>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-secondary rounded-lg p-0.5">
<button onClick={() => setQuoteView("board")} className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all", quoteView === "board" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}><Columns3 className="h-3 w-3" /> Board</button>
<button onClick={() => setQuoteView("list")} className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all", quoteView === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}><List className="h-3 w-3" /> List</button>
<button onClick={() => setQuoteView("sidebar")} className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all", quoteView === "sidebar" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}><LayoutPanelLeft className="h-3 w-3" /> Sidebar</button>
                  </div>
                  <Button onClick={handleNewJob} size="sm" className="gap-1.5 rounded-lg bg-foreground text-background hover:bg-foreground/90 h-8 text-xs font-semibold">
                    <Plus className="h-3.5 w-3.5" /> New Quote
                  </Button>
                </div>
              </div>
              <div className="flex-1 px-4 sm:px-6 pb-2 min-h-0 overflow-hidden flex flex-col">
                <KanbanBoard boardType="quote" viewMode={quoteView} onLoadQuote={handleLoadQuote} />
              </div>
            </div>
          )}

          {/* == JOBS BOARD == */}
          {section === "jobs-board" && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="px-4 sm:px-6 pt-3 pb-2 flex items-center justify-between shrink-0">
                <h1 className="text-lg font-bold tracking-tight text-foreground">Jobs</h1>
                <div className="flex items-center bg-secondary rounded-lg p-0.5">
<button onClick={() => setJobView("board")} className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all", jobView === "board" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}><Columns3 className="h-3 w-3" /> Board</button>
<button onClick={() => setJobView("list")} className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all", jobView === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}><List className="h-3 w-3" /> List</button>
<button onClick={() => setJobView("sidebar")} className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all", jobView === "sidebar" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}><LayoutPanelLeft className="h-3 w-3" /> Sidebar</button>
                </div>
              </div>
              <div className="flex-1 px-4 sm:px-6 pb-2 min-h-0 overflow-hidden flex flex-col">
                <KanbanBoard boardType="job" viewMode={jobView} onLoadQuote={handleLoadQuote} />
              </div>
            </div>
          )}

          {/* == CUSTOMERS == */}
          {section === "customers" && (
            <div className="flex-1 overflow-auto px-4 sm:px-6 pt-5 pb-6">
              <CustomerList />
            </div>
          )}

          {/* == INVOICES == */}
          {section === "invoices" && (
            <div className="flex-1 overflow-auto px-4 sm:px-6 pt-5 pb-6">
              <InvoiceList />
            </div>
          )}

          {/* == EXPORT TO QB == */}
          {section === "export-qb" && (
            <div className="flex-1 overflow-auto px-4 sm:px-6 pt-5 pb-6">
              <ExportToQB onOpenQuote={handleLoadQuote} />
            </div>
          )}

          {/* == VENDORS == */}
          {section === "vendors" && (
            <div className="flex-1 overflow-auto px-4 sm:px-6 pt-5 pb-6">
              <VendorList />
            </div>
          )}

          {/* == DELIVERIES == */}
          {section === "deliveries" && (
            <div className="flex-1 min-h-0">
              <DeliveriesDashboard />
            </div>
          )}

          {/* == BILLING == */}
          {section === "billing" && (
            <div className="flex-1 min-h-0">
              <BillingDashboard />
            </div>
          )}

          {/* == OHP BIDS == */}
          {section === "ohp-bids" && (
            <div className="flex-1 min-h-0">
              <OhpBidsDashboard onOpenQuote={handleLoadQuote} />
            </div>
          )}

          {/* == JOB VIEW (Planner) == */}
          {isJobView && jobPhase === "planner" && (
            <div className="flex-1 overflow-auto px-4 sm:px-6 pt-5 pb-8">
              <MailPiecePlanner onContinue={handleContinueToPricing} />
            </div>
          )}

          {/* == JOB VIEW (Pricing / Calculator) == */}
          {isJobView && jobPhase === "pricing" && (
            <StepErrorBoundary stepId="pricing-layout">
              <div className="flex-1 flex flex-col min-h-0">
                {/* Step Pills */}
                <div className="shrink-0 bg-background border-b border-border/40">
                  <div className="px-4 sm:px-6">
                    <div className="flex items-center gap-1 py-1.5 overflow-x-auto no-scrollbar">
                      <button onClick={() => setJobPhase("planner")}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-all whitespace-nowrap shrink-0 mr-1 min-h-[44px]">
                        <Layers className="h-3.5 w-3.5" /> Planner
                      </button>
                      <div className="w-px h-4 bg-border shrink-0" />
                      {visibleSteps.map((step) => {
                        const active = step.id === currentStep
                        const done = completedSteps.has(step.id)
                        return (
                          <button key={step.id} onClick={() => setCurrentStep(step.id)}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap shrink-0 min-h-[44px]",
                              active ? "bg-foreground text-background shadow-sm"
                                : done ? "bg-secondary text-foreground hover:bg-secondary/80"
                                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                            )}>
                            {done && !active ? <Check className="h-3 w-3" /> : step.icon}
                            {step.label}
                          </button>
                        )
                      })}
                      {(() => {
                        const idx = visibleSteps.findIndex((s) => s.id === currentStep)
                        if (idx < visibleSteps.length - 1) {
                          return (
                            <button onClick={() => setCurrentStep(visibleSteps[idx + 1].id)}
                              className="ml-auto flex items-center gap-1 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0">
                              Next <ChevronRight className="h-3 w-3" />
                            </button>
                          )
                        }
                        return null
                      })()}
                    </div>
                  </div>
                </div>

                {/* Job Summary Bar */}
                <div className="shrink-0 bg-secondary/30 border-b border-border/40">
                  <div className="px-4 sm:px-6 py-2 flex items-center gap-4 text-xs overflow-x-auto no-scrollbar">
                    <button onClick={() => setJobPhase("planner")} className="flex items-center gap-1 text-primary hover:text-primary/80 font-semibold shrink-0 transition-colors">
                      <PenLine className="h-3 w-3" /> Edit
                    </button>
                    {mailing.quantity > 0 && <span className="text-muted-foreground shrink-0"><strong className="text-foreground">{mailing.quantity.toLocaleString()}</strong> pcs</span>}
                    <div className="w-px h-3 bg-border shrink-0" />
                    {mailing.pieces.map((p) => {
                      const meta = PIECE_TYPE_META[p.type]
                      return (
                        <span key={p.id} className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${meta.color}`}>{meta.short}</span>
                          <span className="text-foreground font-medium">{p.label}</span>
                          {p.width && p.height && <span className="font-mono text-muted-foreground">{p.width}x{p.height}</span>}
                          <span className={`text-[8px] font-bold ${p.production === "inhouse" ? "text-emerald-600" : p.production === "ohp" ? "text-amber-600" : "text-primary"}`}>
                            {p.production === "inhouse" ? "IH" : p.production === "ohp" ? "OHP" : "BOTH"}
                          </span>
                        </span>
                      )
                    })}
                  </div>
                </div>

                {/* Content + Quote Sidebar */}
                <div className="flex-1 flex min-h-0 overflow-hidden">
                  <div className="flex-1 min-w-0 overflow-auto px-4 sm:px-6 pt-4 pb-8">
                    <div key={currentStep} className="step-enter">
                      <StepErrorBoundary stepId={currentStep}>
                        {renderStep()}
                      </StepErrorBoundary>
                    </div>
                  </div>
                  {rightOpen ? (
                    <aside className="hidden lg:block w-[22rem] shrink-0 border-l border-border overflow-y-auto">
                      <QuoteSidebar onGoToExport={() => setSection("export-qb")} />
                    </aside>
                  ) : (
                    <aside className="hidden lg:flex flex-col items-center pt-2 px-1 shrink-0 border-l border-border">
                      <button onClick={() => setRightOpen(true)}
                        className="h-8 w-8 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:shadow-sm transition-all">
                        <PanelRightOpen className="h-3.5 w-3.5" />
                      </button>
                    </aside>
                  )}
                </div>

                <MobileBar onGoToExport={() => setSection("export-qb")} />
              </div>
            </StepErrorBoundary>
          )}
        </main>
      </div>

      {showSettings && <MailClassSettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  )
}

function MobileBar({ onGoToExport }: { onGoToExport?: () => void }) {
  const [open, setOpen] = useState(false)
  const { items, getTotal } = useQuote()
  const total = getTotal()
  const count = items.length
  if (count === 0 && !open) return null
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] bg-card rounded-t-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold text-foreground">Quote ({count})</span>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-secondary"><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <div className="flex-1 overflow-y-auto"><QuoteSidebar onGoToExport={onGoToExport} /></div>
          </div>
        </div>
      )}
      {!open && count > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 lg:hidden">
          <button onClick={() => setOpen(true)}
            className="w-full flex items-center justify-between bg-foreground text-background px-5 py-4 rounded-2xl shadow-xl min-h-[56px]">
            <div className="flex items-center gap-2.5">
              <FileText className="h-5 w-5 opacity-60" />
              <span className="text-base font-semibold">{count} item{count !== 1 ? "s" : ""}</span>
            </div>
            <span className="text-base font-bold font-mono">${total.toFixed(2)}</span>
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
