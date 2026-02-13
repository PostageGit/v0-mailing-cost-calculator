"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MailingCalculator } from "@/components/mailing-calculator"
import { PrintingCalculator } from "@/components/printing/printing-calculator"
import { BookletCalculator } from "@/components/booklet/booklet-calculator"
import { Mail, Printer, BookOpen, Calculator } from "lucide-react"

export default function Page() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="w-full max-w-[90rem] mx-auto px-4 lg:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary text-primary-foreground">
              <Calculator className="h-4 w-4" />
            </div>
            <span className="text-base font-bold tracking-tight text-foreground">MailCost Pro</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="w-full max-w-[90rem] mx-auto px-4 lg:px-6 pt-5 pb-8 flex flex-col flex-1">
        <Tabs defaultValue="mailing" className="w-full flex flex-col flex-1">
          <TabsList className="mb-5 bg-muted/60 h-10 p-1 w-fit">
            <TabsTrigger value="mailing" className="gap-2 px-4 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Mailing</span>
            </TabsTrigger>
            <TabsTrigger value="printing" className="gap-2 px-4 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Flat Printing</span>
            </TabsTrigger>
            <TabsTrigger value="booklet" className="gap-2 px-4 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Fold & Staple</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mailing" className="flex-1">
            <MailingCalculator />
          </TabsContent>

          <TabsContent value="printing" className="flex-1">
            <PrintingCalculator />
          </TabsContent>

          <TabsContent value="booklet" className="flex-1">
            <BookletCalculator />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
