"use client"

/**
 * Standalone Calculator Wrappers
 * These wrappers provide the necessary context providers for calculators 
 * to work independently without being part of the quote builder flow.
 * The "Add to Quote" buttons are hidden via the standalone prop.
 */

import { QuoteProvider } from "@/lib/quote-context"
import { MailingProvider } from "@/lib/mailing-context"
import { PapersProvider } from "@/lib/papers-context"
import { ChatProvider } from "@/lib/chat-context"

// Import the actual calculator components
import { PrintingCalculator } from "@/components/printing/printing-calculator"
import { BookletCalculator } from "@/components/booklet/booklet-calculator"
import { PerfectCalculator } from "@/components/perfect/perfect-calculator"
import { SpiralCalculator } from "@/components/spiral/spiral-calculator"
import { PadCalculator } from "@/components/pad/pad-calculator"
import { EnvelopeTab } from "@/components/envelope-tab"
import { MailingCalculator } from "@/components/mailing-calculator"
import { USPSPostageCalculator } from "@/components/usps-postage-calculator"
import { LaborCalculator } from "@/components/labor-calculator"

// Wrapper that provides all required contexts for standalone operation
function StandaloneWrapper({ children }: { children: React.ReactNode }) {
  return (
    <QuoteProvider>
      <MailingProvider>
        <PapersProvider>
          <ChatProvider>
            {children}
          </ChatProvider>
        </PapersProvider>
      </MailingProvider>
    </QuoteProvider>
  )
}

// Export standalone versions of each calculator
export function StandalonePrintingCalculator() {
  return (
    <StandaloneWrapper>
      <PrintingCalculator viewMode="detailed" standalone />
    </StandaloneWrapper>
  )
}

export function StandaloneBookletCalculator() {
  return (
    <StandaloneWrapper>
      <BookletCalculator viewMode="detailed" standalone />
    </StandaloneWrapper>
  )
}

export function StandalonePerfectCalculator() {
  return (
    <StandaloneWrapper>
      <PerfectCalculator viewMode="detailed" standalone />
    </StandaloneWrapper>
  )
}

export function StandaloneSpiralCalculator() {
  return (
    <StandaloneWrapper>
      <SpiralCalculator viewMode="detailed" standalone />
    </StandaloneWrapper>
  )
}

export function StandalonePadCalculator() {
  return (
    <StandaloneWrapper>
      <PadCalculator viewMode="detailed" standalone />
    </StandaloneWrapper>
  )
}

export function StandaloneEnvelopeCalculator() {
  return (
    <StandaloneWrapper>
      <EnvelopeTab standalone />
    </StandaloneWrapper>
  )
}

export function StandaloneMailingCalculator() {
  return (
    <StandaloneWrapper>
      <MailingCalculator standalone />
    </StandaloneWrapper>
  )
}

export function StandaloneUSPSPostageCalculator() {
  return (
    <StandaloneWrapper>
      <USPSPostageCalculator standalone />
    </StandaloneWrapper>
  )
}

export function StandaloneLaborCalculator() {
  return (
    <StandaloneWrapper>
      <LaborCalculator standalone />
    </StandaloneWrapper>
  )
}
