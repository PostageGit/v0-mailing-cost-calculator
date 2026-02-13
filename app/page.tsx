"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MailingCalculator } from "@/components/mailing-calculator"
import { PrintingCalculator } from "@/components/printing/printing-calculator"
import { BookletCalculator } from "@/components/booklet/booklet-calculator"
import { Mail, Printer, BookOpen } from "lucide-react"

export default function Page() {
  return (
    <div className="min-h-screen bg-background">
      <div className="w-full max-w-[90rem] mx-auto p-4 lg:p-6">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">MailCost Pro</h1>
          <p className="text-sm text-muted-foreground">Professional mailing and printing cost calculator</p>
        </header>

        {/* Navigation Tabs */}
        <Tabs defaultValue="mailing" className="w-full">
          <TabsList className="mb-6 bg-muted/50">
            <TabsTrigger value="mailing" className="gap-2 data-[state=active]:bg-card">
              <Mail className="h-4 w-4" />
              Mailing Calculator
            </TabsTrigger>
            <TabsTrigger value="printing" className="gap-2 data-[state=active]:bg-card">
              <Printer className="h-4 w-4" />
              Flat Printing
            </TabsTrigger>
            <TabsTrigger value="booklet" className="gap-2 data-[state=active]:bg-card">
              <BookOpen className="h-4 w-4" />
              Fold & Staple
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
    </div>
  )
}
