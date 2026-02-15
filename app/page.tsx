"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { PrintingCalculator } from "@/components/printing/printing-calculator"
import { BookletCalculator } from "@/components/booklet/booklet-calculator"
import { USPSPostageCalculator } from "@/components/usps-postage-calculator"
import { LaborCalculator } from "@/components/labor-calculator"
import { QuoteSidebar } from "@/components/quote-sidebar"
import { MailPiecePlanner } from "@/components/mail-piece-planner"
import { QuoteProvider, useQuote } from "@/lib/quote-context"
import { MailingProvider, useMailing, PIECE_TYPE_META } from "@/lib/mailing-context"
import { KanbanBoard } from "@/components/kanban-board"
import { MailClassSettingsPanel } from "@/components/mail-class-settings"
import { CustomerList } from "@/components/customer-list"
import { VendorList } from "@/components/vendor-list"
import { VendorBidTab } from "@/components/vendor-bid-tab"
import { ItemsTab } from "@/components/items-tab"
import { EnvelopeTab } from "@/components/envelope-tab"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { usePricingConfig } from "@/lib/use-pricing-config"
import {
  Plus, Settings, Mail, Stamp, Wrench, Printer, BookOpen,
  Send, Package, Check, ChevronRight, FileText,
  PanelRightOpen, X, Layers, ArrowLeft, PenLine,
} from "lucide-react"

// ─── Calculator Steps (after planner) ─────────────────────
type StepId = "envelope" | "usps" | "labor" | "printing" | "booklet" | "ohp" | "items"
const ALL_STEPS: { id: StepId; label: string; icon: React.ReactNode }[] = [
  { id: "envelope",  label: "Envelope",  icon: <Mail className="h-3.5 w-3.5" /> },
  { id: "usps",      label: "Postage",   icon: <Stamp className="h-3.5 w-3.5" /> },
  { id: "labor",     label: "Labor",     icon: <Wrench className="h-3.5 w-3.5" /> },
  { id: "printing",  label: "Printing",  icon: <Printer className="h-3.5 w-3.5" /> },
  { id: "booklet",   label: "Booklet",   icon: <BookOpen className="h-3.5 w-3.5" /> },
  { id: "ohp",       label: "OHP",       icon: <Send className="h-3.5 w-3.5" /> },
  { id: "items",     label: "Items",     icon: <Package className="h-3.5 w-3.5" /> },
]
const STEP_CATS: Record<StepId, string[]> = {
  envelope: [], usps: ["postage"], labor: ["listwork"],
  printing: ["flat"], booklet: ["booklet"], ohp: ["ohp"], items: ["item"],
}

type View = "home" | "job" | "dashboard" | "customers" | "vendors"
type JobPhase = "planner" | "pricing"
// v2 - cleaned up calculators

function AppContent() {
  const [view, setView] = useState<View>("home")
  const [showSettings, setShowSettings] = useState(false)
  const [jobPhase, setJobPhase] = useState<JobPhase>("planner")
  const [currentStep, setCurrentStep] = useState<StepId>("usps")
  const [rightOpen, setRightOpen] = useState(true)
  const { loadQuote, items, newQuote } = useQuote()
  const mailing = useMailing()
  usePricingConfig()

  // Dynamic steps based on mail piece configuration
  const visibleSteps = useMemo(() => {
    return ALL_STEPS.filter((step) => {
      if (step.id === "envelope" && !mailing.needsEnvelope) return false
      if (step.id === "printing" && !mailing.needsPrinting) return false
      if (step.id === "booklet" && !mailing.needsBooklet) return false
      if (step.id === "ohp" && !mailing.needsOHP) return false
      return true
    })
  }, [mailing.needsEnvelope, mailing.needsPrinting, mailing.needsBooklet, mailing.needsOHP])

  // If current step becomes hidden, jump to first visible
  useEffect(() => {
    if (jobPhase === "pricing" && !visibleSteps.find((s) => s.id === currentStep)) {
      setCurrentStep(visibleSteps[0]?.id || "usps")
    }
  }, [visibleSteps, currentStep, jobPhase])

  const handleLoadQuote = useCallback(
    (quoteId: string) => { loadQuote(quoteId); setJobPhase("pricing"); setView("job") },
    [loadQuote],
  )
  const handleNewJob = useCallback(() => {
    newQuote(); setJobPhase("planner"); setView("job")
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
      case "labor":    return <LaborCalculator />
      case "printing": return <PrintingCalculator />
      case "booklet":  return <BookletCalculator />
      case "ohp":      return <VendorBidTab />
      case "items":    return <ItemsTab />
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ─── Top Nav ─── */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/60">
        <div className="max-w-[100rem] mx-auto px-4 flex items-center justify-between h-11">
          <span className="text-sm font-semibold tracking-tight text-foreground select-none">MailCost Pro</span>
          <nav className="flex items-center gap-0.5">
            {([
              { v: "home" as View, label: "Home" },
              { v: "dashboard" as View, label: "Dashboard" },
              { v: "customers" as View, label: "Customers" },
              { v: "vendors" as View, label: "Vendors" },
            ]).map((n) => (
              <button key={n.v} onClick={() => setView(n.v)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-lg transition-colors",
                  view === n.v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                )}>
                {n.label}
              </button>
            ))}
            <div className="w-px h-4 bg-border mx-1" />
            <button onClick={() => setShowSettings(true)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors" aria-label="Settings">
              <Settings className="h-4 w-4" />
            </button>
          </nav>
        </div>
      </header>

      {/* ─── HOME ─── */}
      {view === "home" && (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <h1 className="text-4xl font-bold tracking-tight text-foreground text-balance">Ready to quote.</h1>
            <p className="mt-3 text-base text-muted-foreground text-pretty leading-relaxed">
              Start a new job to build your mailing and printing estimate.
            </p>
            <Button onClick={handleNewJob}
              className="mt-8 h-12 px-8 text-base font-semibold rounded-full bg-foreground text-background hover:bg-foreground/90 gap-2 shadow-lg">
              <Plus className="h-5 w-5" /> New Job
            </Button>
            <button onClick={() => setView("dashboard")}
              className="mt-5 block mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors">
              or open an existing quote
            </button>
          </div>
        </div>
      )}

      {/* ─── JOB VIEW ──�� */}
      {view === "job" && jobPhase === "planner" && (
        <div className="flex-1 px-6 pt-8 pb-12">
          <MailPiecePlanner onContinue={handleContinueToPricing} />
        </div>
      )}

      {view === "job" && jobPhase === "pricing" && (
        <div className="flex-1 flex flex-col">
          {/* Step Pills Bar + Back to Planner */}
          <div className="sticky top-11 z-30 bg-background/80 backdrop-blur-xl border-b border-border/40">
            <div className="max-w-[100rem] mx-auto px-4">
              <div className="flex items-center gap-1 py-1.5 overflow-x-auto no-scrollbar">
                {/* Back to planner */}
                <button onClick={() => setJobPhase("planner")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-all whitespace-nowrap shrink-0 mr-1">
                  <Layers className="h-3.5 w-3.5" /> Planner
                </button>
                <div className="w-px h-4 bg-border shrink-0" />

                {/* Calculator steps */}
                {visibleSteps.map((step) => {
                  const active = step.id === currentStep
                  const done = completedSteps.has(step.id)
                  return (
                    <button key={step.id} onClick={() => setCurrentStep(step.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap shrink-0",
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

          {/* ─── Job Summary Bar (compact, shows what was defined in planner) ─── */}
          <div className="bg-secondary/30 border-b border-border/40">
            <div className="max-w-[100rem] mx-auto px-4 py-2 flex items-center gap-4 text-xs overflow-x-auto no-scrollbar">
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

          {/* ─── Content + Quote Sidebar ─── */}
          <div className="max-w-[100rem] mx-auto w-full px-4 pt-4 pb-8 flex gap-4 flex-1 min-h-0">
            <main key={currentStep} className="flex-1 min-w-0 step-enter">
              {renderStep()}
            </main>
            {rightOpen ? (
              <aside className="hidden lg:block w-72 shrink-0 sticky top-[7.5rem] h-[calc(100vh-8.5rem)]">
                <QuoteSidebar />
              </aside>
            ) : (
              <aside className="hidden lg:flex flex-col items-center pt-1 shrink-0 sticky top-[7.5rem] h-[calc(100vh-8.5rem)]">
                <button onClick={() => setRightOpen(true)}
                  className="h-8 w-8 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:shadow-sm transition-all">
                  <PanelRightOpen className="h-3.5 w-3.5" />
                </button>
              </aside>
            )}
          </div>

          <MobileBar />
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
      {view === "customers" && <div className="max-w-[90rem] mx-auto w-full px-6 pt-6 pb-10"><CustomerList /></div>}
      {view === "vendors" && <div className="max-w-[90rem] mx-auto w-full px-6 pt-6 pb-10"><VendorList /></div>}
      {showSettings && <MailClassSettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  )
}

function MobileBar() {
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
            <div className="flex-1 overflow-y-auto"><QuoteSidebar /></div>
          </div>
        </div>
      )}
      {!open && count > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 lg:hidden">
          <button onClick={() => setOpen(true)}
            className="w-full flex items-center justify-between bg-foreground text-background px-5 py-3 rounded-2xl shadow-xl">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 opacity-60" />
              <span className="text-sm font-semibold">{count} item{count !== 1 ? "s" : ""}</span>
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
