"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MailingCalculator } from "@/components/mailing-calculator"
import { PrintingCalculator } from "@/components/printing/printing-calculator"
import { BookletCalculator } from "@/components/booklet/booklet-calculator"
import { QuoteSidebar } from "@/components/quote-sidebar"
import { QuoteProvider } from "@/lib/quote-context"
import { Mail, Printer, BookOpen, Calculator } from "lucide-react"

export default function Page() {
  return (
    <QuoteProvider>
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
          </div>
        </header>

        {/* Main Content */}
        <div className="w-full max-w-[120rem] mx-auto px-4 lg:px-6 pt-5 pb-8 flex flex-1 gap-6">
          {/* Calculators area */}
          <div className="flex-1 min-w-0">
            <Tabs defaultValue="mailing" className="w-full flex flex-col">
              <TabsList className="mb-5 bg-muted/60 h-10 p-1 w-fit">
                <TabsTrigger value="mailing" aria-label="Mailing Calculator" className="gap-2 px-4 data-[state=active]:bg-card data-[state=active]:shadow-sm">
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Mailing</span>
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

              <TabsContent value="mailing">
                <MailingCalculator />
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
      </div>
    </QuoteProvider>
  )
}
