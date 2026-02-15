"use client"

import { useState, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Printer, BookOpen, Calculator, LayoutDashboard, Settings, Stamp, Wrench, Users, Factory } from "lucide-react"

function AppContent() {
  const [view, setView] = useState<"calculators" | "dashboard" | "customers" | "vendors">("calculators")
  const [showSettings, setShowSettings] = useState(false)
  const { loadQuote } = useQuote()

  const handleLoadQuote = useCallback(
    (quoteId: string) => {
      loadQuote(quoteId)
      setView("calculators")
    },
    [loadQuote]
  )

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="w-full max-w-[120rem] mx-auto px-4 lg:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary text-primary-foreground">
              <Calculator className="h-4 w-4" />
            </div>
            <span className="text-base font-bold tracking-tight text-foreground text-balance">MailCost Pro</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={view === "calculators" ? "secondary" : "ghost"}
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={() => setView("calculators")}
            >
              <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Calculators</span>
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
              aria-label="Mail class labor settings"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      {view === "calculators" ? (
        /* Calculator View */
        <div className="w-full max-w-[120rem] mx-auto px-4 lg:px-6 pt-5 pb-8 flex flex-1 gap-6">
          <div className="flex-1 min-w-0">
            <Tabs defaultValue="usps" className="w-full flex flex-col">
              <TabsList className="mb-5 bg-muted/60 h-10 p-1 w-fit flex-wrap">
                <TabsTrigger value="usps" aria-label="USPS Postage Calculator" className="gap-2 px-4 data-[state=active]:bg-card data-[state=active]:shadow-sm">
                  <Stamp className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">USPS Postage</span>
                </TabsTrigger>
                <TabsTrigger value="labor" aria-label="Labor & List Work Calculator" className="gap-2 px-4 data-[state=active]:bg-card data-[state=active]:shadow-sm">
                  <Wrench className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Labor</span>
                </TabsTrigger>
                <TabsTrigger value="printing" aria-label="Flat Printing Calculator" className="gap-2 px-4 data-[state=active]:bg-card data-[state=active]:shadow-sm">
                  <Printer className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Flat Printing</span>
                </TabsTrigger>
                <TabsTrigger value="booklet" aria-label="Fold and Staple Calculator" className="gap-2 px-4 data-[state=active]:bg-card data-[state=active]:shadow-sm">
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Fold & Staple</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="usps">
                <USPSPostageCalculator />
              </TabsContent>

              <TabsContent value="labor">
                <LaborCalculator />
              </TabsContent>

              <TabsContent value="printing">
                <PrintingCalculator />
              </TabsContent>

              <TabsContent value="booklet">
                <BookletCalculator />
              </TabsContent>
            </Tabs>
          </div>

          {/* Persistent Quote Sidebar */}
          <aside className="hidden xl:block w-80 flex-shrink-0 sticky top-[4.5rem] h-[calc(100vh-5.5rem)]">
            <QuoteSidebar />
          </aside>
        </div>
      ) : view === "dashboard" ? (
        /* Dashboard / Kanban View */
        <div className="w-full max-w-[120rem] mx-auto px-4 lg:px-6 pt-5 pb-8">
          <div className="mb-5">
            <h1 className="text-xl font-bold text-foreground text-balance">Saved Quotes</h1>
            <p className="text-sm text-muted-foreground text-pretty mt-1">
              Track and manage your quotes through each stage of the process.
            </p>
          </div>
          <KanbanBoard onLoadQuote={handleLoadQuote} />
        </div>
      ) : view === "customers" ? (
        /* Customers View */
        <div className="w-full max-w-[120rem] mx-auto px-4 lg:px-6 pt-5 pb-8">
          <CustomerList />
        </div>
      ) : (
        /* Vendors View */
        <div className="w-full max-w-[120rem] mx-auto px-4 lg:px-6 pt-5 pb-8">
          <VendorList />
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <MailClassSettingsPanel onClose={() => setShowSettings(false)} />
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
