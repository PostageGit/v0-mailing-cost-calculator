"use client"

import { CalculatorsHub } from "@/components/calculators-hub"

/**
 * Secret Calculator Tools Page
 * 
 * This page is completely separate from the main app.
 * Share this URL only with people who need access.
 * Not linked from anywhere in the main navigation.
 * 
 * URL: /tools/calc
 */
export default function CalculatorToolsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <CalculatorsHub />
    </div>
  )
}
