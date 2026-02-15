"use client"

import { cn } from "@/lib/utils"
import {
  Mail, Stamp, Wrench, Printer, BookOpen, Send, Package,
  Check, ChevronRight,
} from "lucide-react"

export type StepId = "envelope" | "usps" | "labor" | "printing" | "booklet" | "ohp" | "items"

export interface StepDef {
  id: StepId
  label: string
  shortLabel: string
  icon: React.ReactNode
  description: string
}

export const STEPS: StepDef[] = [
  { id: "envelope",  label: "Envelope",        shortLabel: "Env",    icon: <Mail className="h-4 w-4" />,     description: "Select envelope size and pricing" },
  { id: "usps",      label: "USPS Postage",    shortLabel: "USPS",   icon: <Stamp className="h-4 w-4" />,    description: "Calculate mailing postage rates" },
  { id: "labor",     label: "Labor",            shortLabel: "Labor",  icon: <Wrench className="h-4 w-4" />,   description: "Addressing, list work, and handling" },
  { id: "printing",  label: "Flat Printing",    shortLabel: "Print",  icon: <Printer className="h-4 w-4" />,  description: "Flat sheet printing and finishing" },
  { id: "booklet",   label: "Fold & Staple",    shortLabel: "Bind",   icon: <BookOpen className="h-4 w-4" />, description: "Saddle stitch booklets" },
  { id: "ohp",       label: "OHP",              shortLabel: "OHP",    icon: <Send className="h-4 w-4" />,     description: "Out of house production bids" },
  { id: "items",     label: "Items & Supplies", shortLabel: "Items",  icon: <Package className="h-4 w-4" />,  description: "Miscellaneous items and supplies" },
]

interface StepNavigatorProps {
  currentStep: StepId
  onStepChange: (step: StepId) => void
  /** Steps that have at least one quote item added */
  completedSteps: Set<StepId>
}

export function StepNavigator({ currentStep, onStepChange, completedSteps }: StepNavigatorProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep)

  return (
    <nav aria-label="Quote steps" className="w-full">
      {/* Desktop: horizontal step bar */}
      <div className="hidden md:flex items-center gap-1 bg-muted/50 rounded-xl p-1.5">
        {STEPS.map((step, i) => {
          const isCurrent = step.id === currentStep
          const isDone = completedSteps.has(step.id)

          return (
            <button
              key={step.id}
              onClick={() => onStepChange(step.id)}
              className={cn(
                "group relative flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all flex-1 min-w-0",
                isCurrent
                  ? "bg-card shadow-sm text-foreground ring-1 ring-border"
                  : isDone
                  ? "text-foreground/80 hover:bg-card/60"
                  : "text-muted-foreground hover:bg-card/40 hover:text-foreground/70"
              )}
              aria-current={isCurrent ? "step" : undefined}
            >
              {/* Step number or check */}
              <span
                className={cn(
                  "flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold shrink-0 transition-colors",
                  isCurrent
                    ? "bg-primary text-primary-foreground"
                    : isDone
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {isDone && !isCurrent ? <Check className="h-3 w-3" /> : i + 1}
              </span>

              {/* Label -- show full on xl, short on md */}
              <span className="hidden xl:inline truncate">{step.label}</span>
              <span className="xl:hidden truncate">{step.shortLabel}</span>

              {/* Active indicator */}
              {isCurrent && (
                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          )
        })}
      </div>

      {/* Mobile: compact current step with prev/next */}
      <div className="md:hidden flex items-center gap-2">
        <button
          onClick={() => {
            if (currentIndex > 0) onStepChange(STEPS[currentIndex - 1].id)
          }}
          disabled={currentIndex === 0}
          className="p-2 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"
          aria-label="Previous step"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
        </button>

        <div className="flex-1 flex items-center justify-center gap-1.5">
          {STEPS.map((step, i) => {
            const isCurrent = step.id === currentStep
            const isDone = completedSteps.has(step.id)
            return (
              <button
                key={step.id}
                onClick={() => onStepChange(step.id)}
                className={cn(
                  "h-2 rounded-full transition-all",
                  isCurrent
                    ? "w-8 bg-primary"
                    : isDone
                    ? "w-2 bg-accent"
                    : "w-2 bg-muted-foreground/20"
                )}
                aria-label={step.label}
                aria-current={isCurrent ? "step" : undefined}
              />
            )
          })}
        </div>

        <button
          onClick={() => {
            if (currentIndex < STEPS.length - 1) onStepChange(STEPS[currentIndex + 1].id)
          }}
          disabled={currentIndex === STEPS.length - 1}
          className="p-2 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"
          aria-label="Next step"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Step title + description -- always visible */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 text-primary">
            {STEPS[currentIndex].icon}
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground leading-tight">
              Step {currentIndex + 1}: {STEPS[currentIndex].label}
            </h2>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              {STEPS[currentIndex].description}
            </p>
          </div>
        </div>

        {/* Next step hint */}
        {currentIndex < STEPS.length - 1 && (
          <button
            onClick={() => onStepChange(STEPS[currentIndex + 1].id)}
            className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors px-3 py-1.5 rounded-lg hover:bg-primary/5"
          >
            Next: {STEPS[currentIndex + 1].label}
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </nav>
  )
}
