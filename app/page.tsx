"use client"

import { useState, useCallback, useMemo, useEffect, useRef, Component, type ReactNode } from "react"
import { PrintingCalculator } from "@/components/printing/printing-calculator"
import { BookletCalculator } from "@/components/booklet/booklet-calculator"
import { SpiralCalculator } from "@/components/spiral/spiral-calculator"
import { PerfectCalculator } from "@/components/perfect/perfect-calculator"
import { PadCalculator } from "@/components/pad/pad-calculator"
import { USPSPostageCalculator } from "@/components/usps-postage-calculator"
import { QuoteFormLayout } from "@/components/quote-form-layout"
import { ServiceBuilder } from "@/components/service-builder"
import { QuoteSidebar } from "@/components/quote-sidebar"
import { MailPiecePlanner } from "@/components/mail-piece-planner"
import { QuoteProvider, useQuote } from "@/lib/quote-context"
import { MailingProvider, useMailing, PIECE_TYPE_META } from "@/lib/mailing-context"
import { KanbanBoard } from "@/components/kanban-board"
import { MailClassSettingsPanel } from "@/components/mail-class-settings"
import { CustomerList } from "@/components/customer-list"

import { DeliveriesDashboard } from "@/components/deliveries-dashboard"
import { BillingDashboard } from "@/components/billing-dashboard"
import { OhpBidsDashboard } from "@/components/ohp-bids-dashboard"
import { VendorBidTab } from "@/components/vendor-bid-tab"
import { EnvelopeTab } from "@/components/envelope-tab"
import { InvoiceList } from "@/components/invoice-list"
import { ChatQuotesDashboard } from "@/components/chat-quotes-dashboard"
import { ExportToQB } from "@/components/export-to-qb"
import { NonprofitLookup } from "@/components/nonprofit-lookup"
import WorkflowPage from "@/app/workflow/page"
import { CalculatorsHub } from "@/components/calculators-hub"
import { PDFBatchTool } from "@/components/pdf-batch-tool"
import { PDFImposeTool } from "@/components/pdf-impose-tool"
import { SimplePrintingEntry } from "@/components/simple-printing-entry"
import { useAppConfig } from "@/lib/app-config-context"

// UberDeliveryCalculator hidden until API access is approved - see components/uber-delivery-calculator.tsx
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { usePricingConfig } from "@/lib/use-pricing-config"
import { StepCelebration, useCelebration } from "@/components/step-celebration"
import {
  Plus, Settings, Mail, Stamp, Wrench, Printer, BookOpen, Disc3,
  Send, Check, ChevronRight, FileText, Receipt, Briefcase, Package,
  PanelRightOpen, X, Layers, ArrowLeft, PenLine, LayoutDashboard,
  Users, Menu, ChevronLeft, Columns3, List, Download, LayoutPanelLeft, DollarSign,
  SkipForward, AlertCircle, CircleDashed, CheckCircle2, MessageSquare, Building2, GitBranch,
  FileStack, Layers3, FolderOpen,
} from "lucide-react"

// ---- Calculator Steps (after planner) ----
type StepId = "envelope" | "usps" | "labor" | "printing" | "booklet" | "spiral" | "perfect" | "pad" | "ohp"
const ALL_STEPS: { id: StepId; label: string; icon: React.ReactNode }[] = [
  { id: "envelope",  label: "Envelope",  icon: <Mail className="h-3.5 w-3.5" /> },
  { id: "usps",      label: "Postage",   icon: <Stamp className="h-3.5 w-3.5" /> },
  { id: "labor",     label: "Services",  icon: <Wrench className="h-3.5 w-3.5" /> },
  { id: "printing",  label: "Printing",  icon: <Printer className="h-3.5 w-3.5" /> },
  { id: "booklet",   label: "Fold & Staple",   icon: <BookOpen className="h-3.5 w-3.5" /> },
  { id: "spiral",    label: "Spiral",    icon: <Disc3 className="h-3.5 w-3.5" /> },
  { id: "perfect",   label: "Perfect",   icon: <BookOpen className="h-3.5 w-3.5" /> },
  { id: "pad",       label: "Pad",       icon: <Layers className="h-3.5 w-3.5" /> },
  { id: "ohp",       label: "OHP",       icon: <Send className="h-3.5 w-3.5" /> },
]
const STEP_CATS: Record<StepId, string[]> = {
  envelope: ["envelope"], usps: ["postage"], labor: ["listwork", "item"],
  printing: ["flat"], booklet: ["booklet"], spiral: ["spiral"], perfect: ["perfect"], pad: ["pad"], ohp: ["ohp"],
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
  | "customers" | "invoices" | "export-qb" | "chat-quotes"
  | "nonprofit-lookup" | "workflow" | "calculators" | "pdf-tools"
  | "job"

interface NavItem { id: Section; label: string; icon: ReactNode; group: "dashboards" | "data" | "tools"; simpleMode?: boolean }
const NAV_ITEMS: NavItem[] = [
  // simpleMode: true = show in simple mode, false/undefined = show only in full mode
  // In SIMPLE MODE: only Quotes and Production are visible
  { id: "quotes-board", label: "Quotes",     icon: <LayoutDashboard className="h-4 w-4" />, group: "dashboards", simpleMode: true },
  { id: "jobs-board",   label: "Production",  icon: <Briefcase className="h-4 w-4" />,       group: "dashboards", simpleMode: true },
  { id: "deliveries",   label: "Deliveries",   icon: <Package className="h-4 w-4" />,         group: "dashboards" },
  { id: "billing",      label: "Billing",      icon: <DollarSign className="h-4 w-4" />,      group: "dashboards" },
  { id: "ohp-bids",     label: "Shop Bids",     icon: <Send className="h-4 w-4" />,            group: "dashboards" },
  { id: "chat-quotes",  label: "Quote Cats", icon: <MessageSquare className="h-4 w-4" />,   group: "dashboards" },
  { id: "customers",    label: "Customers",   icon: <Users className="h-4 w-4" />,            group: "data" },
  { id: "invoices",     label: "Invoices",    icon: <Receipt className="h-4 w-4" />,          group: "data" },
  { id: "export-qb",    label: "Export to QB", icon: <Download className="h-4 w-4" />,         group: "data" },
  { id: "nonprofit-lookup", label: "Nonprofit Lookup", icon: <Building2 className="h-4 w-4" />, group: "tools", simpleMode: true },
  { id: "workflow", label: "Workflow Guide", icon: <GitBranch className="h-4 w-4" />, group: "tools" },
  { id: "calculators", label: "Calculators", icon: <Stamp className="h-4 w-4" />, group: "tools" },
  { id: "pdf-tools", label: "PDF Tools", icon: <FileStack className="h-4 w-4" />, group: "tools" },
]

type JobPhase = "planner" | "pricing"

// ---- PDF Tools Section with tabs ----
function PDFToolsSection() {
  const [activeTab, setActiveTab] = useState<"batch" | "impose">("batch")
  
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header with tabs */}
      <div className="shrink-0 border-b border-border bg-card/50">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">PDF Tools</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Batch organize and impose PDF files</p>
            </div>
          </div>
          {/* Tab buttons */}
          <div className="flex items-center gap-1 mt-4">
            <button
              onClick={() => setActiveTab("batch")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === "batch"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <FolderOpen className="h-4 w-4" />
              Batch Organizer
            </button>
            <button
              onClick={() => setActiveTab("impose")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === "impose"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <Layers3 className="h-4 w-4" />
              Impose
            </button>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "batch" && <PDFBatchTool />}
        {activeTab === "impose" && <PDFImposeTool />}
      </div>
    </div>
  )
}

function AppContent() {
const { config: appConfig } = useAppConfig()
  const [section, setSection] = useState<Section>("quotes-board")
const [sidebarOpen, setSidebarOpen] = useState(true)
  const [quoteView, setQuoteView] = useState<"board" | "list" | "sidebar">("board")
  const [jobView, setJobView] = useState<"board" | "list" | "sidebar">("board")
  const [showSettings, setShowSettings] = useState(false)
  const [jobPhase, setJobPhase] = useState<JobPhase>("planner")
  const [currentStep, setCurrentStep] = useState<StepId>("usps")
  const [rightOpen, setRightOpen] = useState(true)
  const [stepGateFlash, setStepGateFlash] = useState(false)
  const [calcViewMode, setCalcViewMode] = useState<"detailed" | "quick">("detailed")
  // Optional QuickBooks-style quote form view - active across ALL pricing steps when on
  const [quoteFormView, setQuoteFormViewRaw] = useState(false)
  // Load persisted preference on mount
  useEffect(() => {
    try {
      const stored = typeof window !== "undefined" ? localStorage.getItem("quoteFormView") : null
      if (stored === "1") setQuoteFormViewRaw(true)
    } catch { /* ignore */ }
  }, [])
  const setQuoteFormView = useCallback((on: boolean) => {
    setQuoteFormViewRaw(on)
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("quoteFormView", on ? "1" : "0")
      }
    } catch { /* ignore */ }
  }, [])
  const { loadQuote, items, newQuote, skippedSteps: savedSkipped, setSkippedSteps: saveSkipped, setMailingSnapshot, savedId } = useQuote()
  const mailing = useMailing()
  usePricingConfig()
  const celebration = useCelebration()

  // Guard: suppress snapshot pushes right after a load to avoid overwriting
  // the DB snapshot with empty/stale mailing state before restoreState propagates
  const loadGuardRef = useRef(false)

  // Push mailing state into QuoteContext for auto-save whenever it changes
  useEffect(() => {
    if (loadGuardRef.current) {
      loadGuardRef.current = false
      return
    }
    setMailingSnapshot(mailing.getSnapshot())
  }, [mailing.quantity, mailing.shape, mailing.className, mailing.mailService, mailing.pieces, setMailingSnapshot, mailing.getSnapshot])

  const visibleSteps = useMemo(() => {
    // In SIMPLE MODE: consolidate all printing into one "Printing" step
    // Hide envelope, booklet, spiral, perfect, pad, ohp - all handled by SimplePrintingEntry
    if (appConfig.simple_mode) {
      const hasAnyPrinting = mailing.needsEnvelope || mailing.needsPrinting || mailing.needsBooklet || 
                            mailing.needsSpiral || mailing.needsPerfect || mailing.needsPad || mailing.needsOHP
      return ALL_STEPS.filter((step) => {
        // Only show: Postage, Services, and ONE "Printing" step
        if (step.id === "usps") return true
        if (step.id === "labor") return true
        if (step.id === "printing") return hasAnyPrinting // This becomes the unified printing step
        // Hide all other printing calculators in simple mode
        if (step.id === "envelope") return false
        if (step.id === "booklet") return false
        if (step.id === "spiral") return false
        if (step.id === "perfect") return false
        if (step.id === "pad") return false
        if (step.id === "ohp") return false
        return true
      })
    }
    
    // FULL MODE: show individual steps as before
    return ALL_STEPS.filter((step) => {
      if (step.id === "envelope" && !mailing.needsEnvelope) return false
      if (step.id === "printing" && !mailing.needsPrinting) return false
      if (step.id === "booklet" && !mailing.needsBooklet) return false
      if (step.id === "spiral" && !mailing.needsSpiral) return false
      if (step.id === "perfect" && !mailing.needsPerfect) return false
      if (step.id === "pad" && !mailing.needsPad) return false
      if (step.id === "ohp" && !mailing.needsOHP) return false
      return true
    })
  }, [appConfig.simple_mode, mailing.needsEnvelope, mailing.needsPrinting, mailing.needsBooklet, mailing.needsSpiral, mailing.needsPerfect, mailing.needsPad, mailing.needsOHP])

  useEffect(() => {
    if (jobPhase === "pricing" && !visibleSteps.find((s) => s.id === currentStep)) {
      setCurrentStep(visibleSteps[0]?.id || "usps")
    }
  }, [visibleSteps, currentStep, jobPhase])

  const handleLoadQuote = useCallback(
    async (quoteId: string, step?: string) => {
      const mailingSnap = await loadQuote(quoteId)
      // Restore mailing state (pieces, shape, service, qty) so planner + calculators are populated
      if (mailingSnap) {
        loadGuardRef.current = true // prevent the snapshot effect from overwriting the restored state
        mailing.restoreState(mailingSnap)
      }
      setJobPhase("pricing")
      if (step) setCurrentStep(step as StepId)
      setSection("job")
    },
    [loadQuote, mailing],
  )
  const handleNewJob = useCallback(() => {
    newQuote()
    // Reset mailing state for a fresh quote
    mailing.restoreState({ quantity: 0, shape: "LETTER", className: "Letter", mailService: "", pieces: [] })
    setJobPhase("planner")
    setSection("job")
  }, [newQuote, mailing])

  const handleContinueToPricing = useCallback(() => {
    const firstStep = visibleSteps[0]
    const nextLabel = firstStep?.label || "Postage"
    celebration.trigger("Job Setup Complete", nextLabel, true, () => {
      setJobPhase("pricing")
      setCurrentStep(firstStep?.id || "usps")
    })
  }, [visibleSteps, celebration])

  // ── Step workflow state ──
  const skippedSteps = useMemo(() => new Set(savedSkipped as StepId[]), [savedSkipped])

  const completedSteps = useMemo(() => {
    const done = new Set<StepId>()
    for (const s of visibleSteps) {
      if (STEP_CATS[s.id].length > 0 && items.some((i) => STEP_CATS[s.id].includes(i.category))) done.add(s.id)
    }
    return done
  }, [items, visibleSteps])

  // Auto-clear skipped status when step gets items (completed)
  useEffect(() => {
    const cleaned = savedSkipped.filter((id) => !completedSteps.has(id as StepId))
    if (cleaned.length !== savedSkipped.length) saveSkipped(cleaned)
  }, [completedSteps, savedSkipped, saveSkipped])

  type StepStatus = "done" | "skipped" | "pending"
  const getStepStatus = useCallback((id: StepId): StepStatus => {
    if (completedSteps.has(id)) return "done"
    if (skippedSteps.has(id)) return "skipped"
    return "pending"
  }, [completedSteps, skippedSteps])

  // The "progress frontier" -- the furthest step you can reach.
  // When editing an existing saved quote, ALL steps are freely navigable.
  // For new quotes, you can click any step up to (and including) the first pending step.
  const isEditingExisting = !!savedId
  const progressFrontier = useMemo(() => {
    if (isEditingExisting) return visibleSteps.length - 1
    for (let i = 0; i < visibleSteps.length; i++) {
      const s = visibleSteps[i].id
      if (!completedSteps.has(s) && !skippedSteps.has(s)) return i
    }
    return visibleSteps.length - 1 // all done/skipped
  }, [visibleSteps, completedSteps, skippedSteps, isEditingExisting])

  const canNavigateTo = useCallback((stepIdx: number) => {
    return stepIdx <= progressFrontier
  }, [progressFrontier])

  const handleSkipStep = useCallback(() => {
    saveSkipped([...savedSkipped, currentStep])
    const idx = visibleSteps.findIndex((s) => s.id === currentStep)
    if (idx < visibleSteps.length - 1) {
      const nextStep = visibleSteps[idx + 1]
      const currentLabel = visibleSteps[idx]?.label || currentStep
      celebration.trigger(`${currentLabel} Skipped`, nextStep.label, false, () => {
        setCurrentStep(nextStep.id)
      })
    }
  }, [currentStep, visibleSteps, savedSkipped, saveSkipped, celebration])

  const handleNextStep = useCallback(() => {
    const idx = visibleSteps.findIndex((s) => s.id === currentStep)
    const status = getStepStatus(currentStep)
    // When editing an existing quote, allow free navigation even if step is pending
    if (status === "pending" && !isEditingExisting) {
      // Can't advance -- flash the gate
      setStepGateFlash(true)
      setTimeout(() => setStepGateFlash(false), 1500)
      return
    }
    if (idx < visibleSteps.length - 1) {
      const nextStep = visibleSteps[idx + 1]
      const currentLabel = visibleSteps[idx]?.label || currentStep
      celebration.trigger(currentLabel, nextStep.label, false, () => {
        setCurrentStep(nextStep.id)
      })
    }
  }, [currentStep, visibleSteps, getStepStatus, isEditingExisting, celebration])

  const pendingSteps = useMemo(() =>
    visibleSteps.filter((s) => !completedSteps.has(s.id)),
  [visibleSteps, completedSteps])

// Builds just the helper tool for the current step (the right-side content
// that swaps with each step). Rendered inside QuoteFormLayout in QB mode.
const renderStepHelper = () => {
  const viewMode = calcViewMode === "quick" ? "compact" : "detailed"
  if (appConfig.simple_mode && currentStep === "printing") {
    return <SimplePrintingEntry qbMode />
  }
  switch (currentStep) {
    case "envelope": return <EnvelopeTab />
    case "usps":     return <USPSPostageCalculator />
    case "labor":    return <ServiceBuilder />
    case "printing": return <PrintingCalculator viewMode={viewMode} />
    case "booklet":  return <BookletCalculator viewMode={viewMode} />
    case "spiral":   return <SpiralCalculator viewMode={viewMode} />
    case "perfect":  return <PerfectCalculator viewMode={viewMode} />
    case "pad":      return <PadCalculator viewMode={viewMode} />
    case "ohp":      return <VendorBidTab />
    default:         return null
  }
}

// Classic (non-QB) mode: returns the raw calculator content with no wrapper.
const renderStep = () => {
  const viewMode = calcViewMode === "quick" ? "compact" : "detailed"
  if (appConfig.simple_mode && currentStep === "printing") {
    return <SimplePrintingEntry />
  }
  switch (currentStep) {
    case "envelope": return <EnvelopeTab />
    case "usps":     return <USPSPostageCalculator />
    case "labor":    return <ServiceBuilder />
    case "printing": return <PrintingCalculator viewMode={viewMode} />
    case "booklet":  return <BookletCalculator viewMode={viewMode} />
    case "spiral":   return <SpiralCalculator viewMode={viewMode} />
    case "perfect":  return <PerfectCalculator viewMode={viewMode} />
    case "pad":      return <PadCalculator viewMode={viewMode} />
    case "ohp":      return <VendorBidTab />
    default:         return null
  }
}

// Metadata used by QuoteFormLayout's top strip (shows the active step
// label on the helper side). Doesn't affect the quote document at all.
const qbStepMeta = ALL_STEPS.find(s => s.id === currentStep)
const qbStepDescriptions: Record<string, string> = {
  envelope: "Add envelope line items",
  usps: "Calculate postage rates",
  labor: "Add services & supplies",
  printing: "Price flat printing",
  booklet: "Price saddle-stitch booklets",
  spiral: "Price spiral-bound booklets",
  perfect: "Price perfect-bound booklets",
  pad: "Price padded items",
  ohp: "Vendor bids for outside help",
}

  const isJobView = section === "job"

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Step transition celebration overlay */}
      {celebration.showing && <StepCelebration {...celebration.props} />}

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
          "hidden lg:flex flex-col bg-card border-r border-border shrink-0 z-50 transition-all duration-200 overflow-hidden",
          sidebarOpen ? "w-52" : "w-14"
        )}>
          {/* Logo + collapse */}
          <div className={cn(
            "flex items-center h-12 border-b border-border shrink-0",
            sidebarOpen ? "justify-between px-3" : "justify-center"
          )}>
            {sidebarOpen && <span className="text-sm font-bold text-foreground truncate">Postage Plus</span>}
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}>
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>

          {/* New Job button */}
          <div className={cn("pt-3 pb-1", sidebarOpen ? "px-3" : "px-[7px]")}>
            <Button onClick={handleNewJob}
              className={cn(
                "gap-2.5 rounded-lg bg-foreground text-background hover:bg-foreground/90 font-semibold",
                sidebarOpen ? "w-full h-9 text-xs px-3 justify-start" : "h-9 w-full p-0 justify-center"
              )}>
              <Plus className="h-4 w-4 shrink-0" />
              {sidebarOpen && "New Quote"}
            </Button>
          </div>

          {/* Nav groups */}
          <nav className={cn(
            "flex-1 pt-2 pb-4 flex flex-col gap-4 overflow-y-auto overflow-x-hidden",
            sidebarOpen ? "px-3" : "px-[7px]"
          )} style={{ scrollbarWidth: "none", scrollbarGutter: "stable" }}>
            {(["dashboards", "data", "tools"] as const).map((group) => {
              const groupItems = NAV_ITEMS.filter((n) => n.group === group && (!appConfig.simple_mode || n.simpleMode))
              if (groupItems.length === 0) return null // Hide empty groups in simple mode
              return (
              <div key={group}>
                {sidebarOpen && (
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1 px-3">
                    {group === "dashboards" ? "Boards" : group === "data" ? "Manage" : "Tools"}
                  </p>
                )}
                <div className="flex flex-col gap-0.5">
{groupItems.map((nav) => {
  const active = section === nav.id
  return (
  <button key={nav.id} onClick={() => { setSection(nav.id); setSidebarOpen(true) }}
                        className={cn(
                          "flex items-center rounded-lg transition-all w-full",
                          sidebarOpen ? "gap-2.5 px-3 py-2 text-sm min-h-[40px]" : "h-10 justify-center",
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
            )})}
          </nav>

          {/* Settings footer */}
          <div className={cn("pb-3 border-t border-border pt-2", sidebarOpen ? "px-3" : "px-[7px]")}>
            <button onClick={() => setShowSettings(true)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all w-full",
                sidebarOpen ? "min-h-[40px] px-3 py-2 text-sm" : "h-10 justify-center"
              )}>
              <Settings className="h-4 w-4 shrink-0" />
              {sidebarOpen && <span>Settings</span>}
            </button>
          </div>
        </aside>

        {/* Mobile sidebar overlay panel */}
        {sidebarOpen && (
          <aside className="fixed left-0 top-12 bottom-0 w-56 bg-card border-r border-border z-50 flex flex-col lg:hidden animate-in slide-in-from-left-2 duration-200">
            <div className="px-3 pt-3 pb-1">
              <Button onClick={() => { handleNewJob(); setSidebarOpen(false) }}
                className="w-full gap-2 rounded-lg bg-foreground text-background hover:bg-foreground/90 font-semibold h-10 text-xs px-3 justify-start">
                <Plus className="h-4 w-4 shrink-0" /> New Quote
              </Button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 pt-2 pb-4 flex flex-col gap-4">
              {(["dashboards", "data", "tools"] as const).map((group) => {
                const groupItems = NAV_ITEMS.filter((n) => n.group === group && (!appConfig.simple_mode || n.simpleMode))
                if (groupItems.length === 0) return null
                return (
                <div key={group}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">
                    {group === "dashboards" ? "Boards" : group === "data" ? "Manage" : "Tools"}
                  </p>
                  <div className="flex flex-col gap-0.5">
{groupItems.map((nav) => {
  const active = section === nav.id
  return (
  <button key={nav.id} onClick={() => { setSection(nav.id); setSidebarOpen(false) }}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all min-h-[44px] w-full",
                            active ? "bg-foreground text-background font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                          )}>
                          {nav.icon}
                          <span>{nav.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )})}
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
                  {/* View toggle only in Full mode */}
                  {!appConfig.simple_mode && (
                    <div className="flex items-center bg-secondary rounded-lg p-0.5">
                      <button onClick={() => setQuoteView("board")} className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all", quoteView === "board" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}><Columns3 className="h-3 w-3" /> Board</button>
                      <button onClick={() => setQuoteView("list")} className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all", quoteView === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}><List className="h-3 w-3" /> List</button>
                      <button onClick={() => setQuoteView("sidebar")} className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all", quoteView === "sidebar" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}><LayoutPanelLeft className="h-3 w-3" /> Sidebar</button>
                    </div>
                  )}
                  <Button onClick={handleNewJob} size="sm" className="gap-1.5 rounded-lg bg-foreground text-background hover:bg-foreground/90 h-8 text-xs font-semibold">
                    <Plus className="h-3.5 w-3.5" /> New Quote
                  </Button>
                </div>
              </div>
              <div className="flex-1 px-4 sm:px-6 pb-2 min-h-0 overflow-hidden flex flex-col">
                <KanbanBoard boardType="quote" viewMode={quoteView} onLoadQuote={handleLoadQuote} appSimpleMode={appConfig.simple_mode} />
              </div>
            </div>
          )}

          {/* == PRODUCTION DASHBOARD == */}
          {section === "jobs-board" && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="px-4 sm:px-6 pt-3 pb-2 flex items-center justify-between shrink-0">
                <h1 className="text-lg font-bold tracking-tight text-foreground">Jobs</h1>
                {/* View toggle only in Full mode */}
                {!appConfig.simple_mode && (
                  <div className="flex items-center bg-secondary rounded-lg p-0.5">
                    <button onClick={() => setJobView("board")} className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all", jobView === "board" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}><Columns3 className="h-3 w-3" /> Board</button>
                    <button onClick={() => setJobView("list")} className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all", jobView === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}><List className="h-3 w-3" /> List</button>
                    <button onClick={() => setJobView("sidebar")} className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all", jobView === "sidebar" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}><LayoutPanelLeft className="h-3 w-3" /> Sidebar</button>
                  </div>
                )}
              </div>
              <div className="flex-1 px-4 sm:px-6 pb-2 min-h-0 overflow-hidden flex flex-col">
                <KanbanBoard boardType="job" viewMode={jobView} onLoadQuote={handleLoadQuote} appSimpleMode={appConfig.simple_mode} />
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

          {section === "chat-quotes" && (
            <div className="flex-1 overflow-auto">
              <ChatQuotesDashboard />
            </div>
          )}

          {/* == NONPROFIT LOOKUP == */}
          {section === "nonprofit-lookup" && (
            <div className="flex-1 overflow-auto px-4 sm:px-6 pt-5 pb-6">
              <NonprofitLookup />
            </div>
          )}

          {/* == WORKFLOW GUIDE == */}
          {section === "workflow" && (
            <div className="flex-1 overflow-auto">
              <WorkflowPage />
            </div>
          )}

          {/* == CALCULATORS HUB == */}
          {section === "calculators" && (
            <div className="flex-1 overflow-auto">
              <CalculatorsHub />
            </div>
          )}

          {/* == PDF TOOLS == */}
          {section === "pdf-tools" && (
            <PDFToolsSection />
          )}

          {/* == JOB VIEW (Planner) == */}
          {isJobView && jobPhase === "planner" && (
            quoteFormView ? (
              /* In QB Quote Form mode, the planner also becomes a helper beside
                 the live quote document - so the quote is visible beginning-to-end. */
              <div className="flex-1 min-h-0 overflow-hidden">
                <QuoteFormLayout
                  stepTitle="Planner"
                  stepDescription="Set up customer, job info & mail pieces"
                  stepIcon={<Layers className="h-3.5 w-3.5" />}
                  stepId="planner"
                  onClose={() => setSection("quotes-board")}
                >
                  <MailPiecePlanner onContinue={handleContinueToPricing} qbMode />
                </QuoteFormLayout>
              </div>
            ) : (
              <div className="flex-1 overflow-auto px-4 sm:px-6 pt-5 pb-8">
                <MailPiecePlanner onContinue={handleContinueToPricing} />
              </div>
            )
          )}

          {/* == JOB VIEW (Pricing / Calculator) == */}
          {isJobView && jobPhase === "pricing" && (
            <StepErrorBoundary stepId="pricing-layout">
              <div className="flex-1 flex flex-col min-h-0">
                {/* Step Pills - hidden entirely in QB Quote Form mode
                    (the bold bottom action bar handles navigation instead). */}
                {!quoteFormView && (
                <div className="shrink-0 bg-background border-b border-border/40">
                  <div className="px-4 sm:px-6 py-1.5">
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                      <button onClick={() => setJobPhase("planner")}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-all whitespace-nowrap shrink-0 mr-1 min-h-[44px]">
                        <Layers className="h-3.5 w-3.5" /> Planner
                      </button>
                      <div className="w-px h-4 bg-border shrink-0" />
                      {visibleSteps.map((step, stepIdx) => {
                        const active = step.id === currentStep
                        const status = getStepStatus(step.id)
                        const reachable = canNavigateTo(stepIdx)

                        // CLASSIC MODE: Original colorful pill style
                        return (
                          <div key={step.id} className="relative shrink-0 group/pill">
                            <button
                              onClick={() => reachable && setCurrentStep(step.id)}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap min-h-[44px]",
                                !reachable && !active && "opacity-30 cursor-not-allowed",
                                active
                                  ? "bg-foreground text-background shadow-sm pr-8"
                                  : status === "done"
                                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50"
                                    : status === "skipped"
                                      ? "border border-dashed border-amber-400 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                      : reachable
                                        ? "text-muted-foreground hover:bg-secondary hover:text-foreground"
                                        : "text-muted-foreground"
                              )}>
                              {active
                                ? step.icon
                                : status === "done"
                                  ? <Check className="h-3 w-3" />
                                  : status === "skipped"
                                    ? <SkipForward className="h-3 w-3" />
                                    : <CircleDashed className="h-3 w-3 opacity-40" />}
                              {step.label}
                            </button>
                            {/* Skip icon -- appears on active pill when step is not done */}
                            {active && status !== "done" && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleSkipStep() }}
                                title="Skip this step"
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-background/50 hover:text-background hover:bg-background/20 transition-colors"
                              >
                                <SkipForward className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )
                      })}
                      {/* Next arrow */}
                      {(() => {
                        const idx = visibleSteps.findIndex((s) => s.id === currentStep)
                        if (idx < visibleSteps.length - 1) {
                          const canGo = isEditingExisting || getStepStatus(currentStep) !== "pending"
                          return (
                            <button onClick={handleNextStep}
                              className={cn(
                                "flex items-center gap-0.5 px-2 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0",
                                canGo
                                  ? "text-muted-foreground hover:text-foreground hover:bg-secondary"
                                  : "text-muted-foreground/30 cursor-not-allowed"
                              )}>
                              Next <ChevronRight className="h-3 w-3" />
                            </button>
                          )
                        }
                        return null
                      })()}
                      {stepGateFlash && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium animate-in fade-in slide-in-from-right-2 duration-200 whitespace-nowrap shrink-0">
                          Complete or skip first
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                )}

                {/* Job Summary Bar - becomes the sole top chrome in QB Quote Form mode */}
                <div className={cn(
                  "shrink-0 border-b border-border/40",
                  quoteFormView ? "bg-white dark:bg-neutral-950" : "bg-secondary/30"
                )}>
                  <div className="px-4 sm:px-6 py-2 flex items-center gap-4 text-xs overflow-x-auto no-scrollbar">
                    <button onClick={() => setJobPhase("planner")} className="flex items-center gap-1 text-primary hover:text-primary/80 font-semibold shrink-0 transition-colors">
                      <PenLine className="h-3 w-3" /> Edit
                    </button>
                    {mailing.quantity > 0 && <span className="text-muted-foreground shrink-0"><strong className="text-foreground">{mailing.quantity.toLocaleString()}</strong> pcs</span>}
                    <div className="w-px h-3 bg-border shrink-0" />
                    {/* Global Quote Form View toggle - QuickBooks-style experience across ALL pricing steps */}
                    {jobPhase === "pricing" && (
                      <>
                        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-background/80 border border-border shrink-0">
                          <button
                            type="button"
                            onClick={() => setQuoteFormView(false)}
                            className={cn(
                              "px-2.5 py-1 text-[11px] font-medium rounded-md transition-all",
                              !quoteFormView
                                ? "bg-foreground text-background shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                            title="Classic calculator view"
                          >
                            Classic
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuoteFormView(true)}
                            className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-all",
                              quoteFormView
                                ? "bg-foreground text-background shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                            title="QuickBooks-style quote form view"
                          >
                            <FileText className="h-3 w-3" />
                            Quote Form
                          </button>
                        </div>
                        <div className="w-px h-3 bg-border shrink-0" />
                      </>
                    )}
                    {/* View toggle for calculators */}
                    {["printing", "booklet", "spiral", "perfect", "pad"].includes(currentStep) && (
                      <>
                        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-background/80 border border-border shrink-0">
                          <button
                            type="button"
                            onClick={() => setCalcViewMode("detailed")}
                            className={cn(
                              "px-2.5 py-1 text-[11px] font-medium rounded-md transition-all",
                              calcViewMode === "detailed"
                                ? "bg-foreground text-background shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            Full
                          </button>
                          <button
                            type="button"
                            onClick={() => setCalcViewMode("quick")}
                            className={cn(
                              "px-2.5 py-1 text-[11px] font-medium rounded-md transition-all",
                              calcViewMode === "quick"
                                ? "bg-foreground text-background shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            Compact
                          </button>
                        </div>
                        <div className="w-px h-3 bg-border shrink-0" />
                      </>
                    )}
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
                  <div className={cn(
                    "flex-1 min-w-0 overflow-auto",
                    // Full-width layouts: simple printing mode, and the QuickBooks quote form view
                    (appConfig.simple_mode && currentStep === "printing") || quoteFormView
                      ? "px-0 pt-0 pb-0"
                      : "max-w-4xl mx-auto px-4 sm:px-6 pt-4 pb-8"
                  )}>
                    {quoteFormView ? (
                      // QB MODE: QuoteFormLayout is mounted ONCE and persists
                      // across every step. Only the helper child remounts on
                      // step change - the quote document stays rock-solid.
                      (() => {
                        const qbIdx = visibleSteps.findIndex(s => s.id === currentStep)
                        return (
                          <QuoteFormLayout
                            stepTitle={qbStepMeta?.label || "Step"}
                            stepDescription={qbStepDescriptions[currentStep] || ""}
                            stepIcon={qbStepMeta?.icon}
                            stepId={currentStep}
                            stepNumber={qbIdx >= 0 ? qbIdx + 1 : undefined}
                            totalSteps={visibleSteps.length}
                            onExit={() => setQuoteFormView(false)}
                            onClose={() => setSection("quotes-board")}
                            onGoToPlanner={() => setJobPhase("planner")}
                          >
                            <div key={currentStep} className="h-full">
                              <StepErrorBoundary stepId={currentStep}>
                                {renderStepHelper()}
                              </StepErrorBoundary>
                            </div>
                          </QuoteFormLayout>
                        )
                      })()
                    ) : (
                      <div key={currentStep} className="step-enter h-full">
                        <StepErrorBoundary stepId={currentStep}>
                          {renderStep()}
                        </StepErrorBoundary>
                      </div>
                    )}
                  </div>
                  {/* In QuickBooks Quote Form View, hide the right sidebar - the quote is already center-stage in the form layout */}
                  {quoteFormView ? null : rightOpen ? (
                    <aside className="hidden lg:block w-80 xl:w-96 shrink-0 border-l border-border overflow-y-auto bg-card/50">
                      <QuoteSidebar
                        onGoToExport={() => setSection("export-qb")}
                        pendingSteps={pendingSteps.map((s) => ({
                          id: s.id,
                          label: s.label,
                          status: skippedSteps.has(s.id) ? "skipped" as const : "pending" as const,
                        }))}
                        onGoToStep={(id) => setCurrentStep(id as StepId)}
                      />
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

                {/* QB MODE: Substantial, clear bottom action bar.
                    A progress bar + step counter + prev/next makes the user
                    always feel exactly where they are in the workflow. */}
                {quoteFormView && jobPhase === "pricing" && (() => {
                  const idx = visibleSteps.findIndex(s => s.id === currentStep)
                  const prev = idx > 0 ? visibleSteps[idx - 1] : null
                  const next = idx < visibleSteps.length - 1 ? visibleSteps[idx + 1] : null
                  const canGoNext = isEditingExisting || getStepStatus(currentStep) !== "pending"
                  const progressPct = visibleSteps.length > 0 ? ((idx + 1) / visibleSteps.length) * 100 : 0
                  return (
                    <div className="shrink-0 border-t-2 border-border bg-white dark:bg-neutral-950 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
                      {/* Full-width progress bar on top edge */}
                      <div className="h-1 w-full bg-border/40 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-foreground to-foreground/80 transition-all duration-500 ease-out"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>

                      <div className="flex items-stretch justify-between gap-4 px-4 sm:px-8">
                        {/* LEFT: Previous */}
                        {prev ? (
                          <button
                            onClick={() => setCurrentStep(prev.id)}
                            className="group flex items-center gap-3 py-4 pr-6 -ml-2 pl-3 hover:bg-secondary/50 transition-colors border-r border-border"
                          >
                            <div className="h-9 w-9 rounded-lg border-2 border-border group-hover:border-foreground bg-card flex items-center justify-center transition-colors shrink-0">
                              <ChevronLeft className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                            </div>
                            <div className="text-left hidden sm:block">
                              <div className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground font-bold leading-none">Previous</div>
                              <div className="text-sm font-bold text-foreground leading-tight mt-1 truncate">{prev.label}</div>
                            </div>
                          </button>
                        ) : (
                          <button
                            onClick={() => setJobPhase("planner")}
                            className="group flex items-center gap-3 py-4 pr-6 -ml-2 pl-3 hover:bg-secondary/50 transition-colors border-r border-border"
                          >
                            <div className="h-9 w-9 rounded-lg border-2 border-border group-hover:border-foreground bg-card flex items-center justify-center transition-colors shrink-0">
                              <ChevronLeft className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                            </div>
                            <div className="text-left hidden sm:block">
                              <div className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground font-bold leading-none">Back to</div>
                              <div className="text-sm font-bold text-foreground leading-tight mt-1">Planner</div>
                            </div>
                          </button>
                        )}

                        {/* CENTER: Substantial step indicator - big number + label + dots */}
                        <div className="flex-1 min-w-0 flex items-center justify-center py-3 gap-4">
                          {/* Big "Step 3 of 7" display */}
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="h-10 w-10 rounded-xl bg-foreground text-background flex items-center justify-center font-bold text-base tabular-nums shadow-sm">
                              {idx + 1}
                            </div>
                            <div className="hidden md:block">
                              <div className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground font-bold leading-none">
                                Step {idx + 1} of {visibleSteps.length}
                              </div>
                              <div className="text-sm font-bold text-foreground leading-tight mt-1 truncate max-w-[160px]">
                                {qbStepMeta?.label || currentStep}
                              </div>
                            </div>
                          </div>

                          {/* Step dots - clickable navigation */}
                          <div className="hidden lg:flex items-center gap-1.5 pl-4 border-l border-border">
                            {visibleSteps.map((s, i) => {
                              const st = getStepStatus(s.id)
                              const isActive = s.id === currentStep
                              const reachable = canNavigateTo(i)
                              return (
                                <button
                                  key={s.id}
                                  onClick={() => reachable && setCurrentStep(s.id)}
                                  disabled={!reachable}
                                  title={`${i + 1}. ${s.label}`}
                                  className={cn(
                                    "transition-all rounded-full shrink-0",
                                    isActive
                                      ? "w-10 h-2.5 bg-foreground"
                                      : st === "done"
                                        ? "w-2.5 h-2.5 bg-emerald-500 hover:w-5"
                                        : st === "skipped"
                                          ? "w-2.5 h-2.5 bg-amber-400 hover:w-5"
                                          : reachable
                                            ? "w-2.5 h-2.5 bg-muted-foreground/25 hover:bg-muted-foreground/60"
                                            : "w-2.5 h-2.5 bg-muted-foreground/15 cursor-not-allowed"
                                  )}
                                />
                              )
                            })}
                          </div>
                        </div>

                        {/* RIGHT-SIDE ACTIONS: Close + Next/Finish */}
                        <div className="flex items-stretch">
                          {/* Close - exits the quote workflow back to Quotes board */}
                          <button
                            onClick={() => setSection("quotes-board")}
                            className="group flex items-center gap-2 py-4 px-3 hover:bg-secondary/50 transition-colors border-l border-border"
                            title="Close and return to Quotes"
                          >
                            <div className="h-9 w-9 rounded-lg border-2 border-border group-hover:border-red-500 bg-card flex items-center justify-center transition-colors shrink-0">
                              <X className="h-4 w-4 text-muted-foreground group-hover:text-red-600" />
                            </div>
                            <div className="text-left hidden md:block">
                              <div className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground font-bold leading-none">Exit</div>
                              <div className="text-sm font-bold text-foreground leading-tight mt-1">Close</div>
                            </div>
                          </button>

                          {/* Next - large, bold, clear primary action */}
                          {next ? (
                            <button
                              onClick={handleNextStep}
                              disabled={!canGoNext}
                              className={cn(
                                "group flex items-center gap-3 py-4 pl-6 -mr-2 pr-3 transition-all border-l border-border",
                                canGoNext
                                  ? "bg-foreground text-background hover:bg-foreground/95"
                                  : "bg-muted/30 text-muted-foreground cursor-not-allowed"
                              )}
                              title={!canGoNext ? "Complete or skip this step first" : undefined}
                            >
                              <div className="text-right hidden sm:block">
                                <div className="text-[9px] uppercase tracking-[0.15em] font-bold leading-none opacity-70">
                                  {canGoNext ? "Continue to" : "Complete first"}
                                </div>
                                <div className="text-sm font-bold leading-tight mt-1 truncate">{next.label}</div>
                              </div>
                              <div className={cn(
                                "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                canGoNext ? "bg-background/15 group-hover:bg-background/25" : "bg-muted"
                              )}>
                                <ChevronRight className="h-4 w-4" />
                              </div>
                            </button>
                          ) : (
                            <button
                              onClick={() => setSection("export-qb")}
                              className="group flex items-center gap-3 py-4 pl-6 -mr-2 pr-3 bg-emerald-600 text-white hover:bg-emerald-700 transition-all border-l border-border"
                            >
                              <div className="text-right hidden sm:block">
                                <div className="text-[9px] uppercase tracking-[0.15em] font-bold leading-none opacity-80">All Done</div>
                                <div className="text-sm font-bold leading-tight mt-1">Finish Quote</div>
                              </div>
                              <div className="h-9 w-9 rounded-lg bg-white/15 group-hover:bg-white/25 flex items-center justify-center shrink-0 transition-colors">
                                <Check className="h-4 w-4" />
                              </div>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })()}

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

