"use client"

import { CalculatorsHub } from "@/components/calculators-hub"
import { PapersProvider } from "@/lib/papers-context"

/**
 * STANDALONE CALCULATOR TOOLS PAGE
 * 
 * Completely isolated from the main PostFlow app.
 * - No header
 * - No sidebar  
 * - No navigation
 * - Just the calculators
 * 
 * Share this link with people who only need calculator access:
 * /tools/calc
 */
export default function CalculatorToolsPage() {
  return (
    <PapersProvider>
      <CalculatorsHub />
    </PapersProvider>
  )
}
