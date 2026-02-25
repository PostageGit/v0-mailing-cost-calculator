"use client"

import { useEffect, useState, useCallback } from "react"
import { Check, ArrowRight, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface StepCelebrationProps {
  /** The step that was just completed */
  completedLabel: string
  /** The next step we're heading to */
  nextLabel: string
  /** Whether this is the planner → pricing transition (bigger moment) */
  isMajor?: boolean
  /** Called when animation is done and we should swap content */
  onComplete: () => void
}

export function StepCelebration({ completedLabel, nextLabel, isMajor, onComplete }: StepCelebrationProps) {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter")

  useEffect(() => {
    // enter -> hold (checkmark scales in)
    const t1 = setTimeout(() => setPhase("hold"), 100)
    // hold -> exit (start fading out)
    const t2 = setTimeout(() => setPhase("exit"), isMajor ? 1400 : 1000)
    // complete (unmount)
    const t3 = setTimeout(() => onComplete(), isMajor ? 1900 : 1450)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onComplete, isMajor])

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center pointer-events-none",
        "transition-all duration-500 ease-out",
        phase === "enter" && "opacity-0",
        phase === "hold" && "opacity-100",
        phase === "exit" && "opacity-0 scale-[1.02]",
      )}
    >
      {/* Subtle backdrop */}
      <div className={cn(
        "absolute inset-0 transition-all duration-500",
        phase === "hold" ? "bg-background/80 backdrop-blur-sm" : "bg-transparent",
      )} />

      {/* Content */}
      <div className={cn(
        "relative flex flex-col items-center gap-5 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
        phase === "enter" && "scale-90 opacity-0 translate-y-4",
        phase === "hold" && "scale-100 opacity-100 translate-y-0",
        phase === "exit" && "scale-95 opacity-0 -translate-y-4",
      )}>
        {/* Success ring + checkmark */}
        <div className="relative">
          {/* Outer glow ring */}
          <div className={cn(
            "absolute inset-0 rounded-full transition-all duration-1000 ease-out",
            isMajor ? "scale-[2.5]" : "scale-[2]",
            phase === "hold"
              ? "bg-emerald-500/5 dark:bg-emerald-400/5"
              : "bg-transparent scale-100",
          )} />
          {/* Inner ring */}
          <div className={cn(
            "absolute inset-0 rounded-full transition-all duration-700 ease-out delay-100",
            phase === "hold"
              ? "scale-[1.6] bg-emerald-500/10 dark:bg-emerald-400/10"
              : "bg-transparent scale-100",
          )} />
          {/* Circle */}
          <div className={cn(
            "relative flex items-center justify-center rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            isMajor ? "h-20 w-20" : "h-16 w-16",
            phase === "enter" && "scale-0 rotate-[-90deg]",
            phase === "hold" && "scale-100 rotate-0",
            phase === "exit" && "scale-75 opacity-50",
            "bg-emerald-500 dark:bg-emerald-400 shadow-lg shadow-emerald-500/25",
          )}>
            <Check className={cn(
              "text-white dark:text-emerald-950 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] delay-150",
              isMajor ? "h-10 w-10" : "h-8 w-8",
              phase === "enter" && "scale-0 opacity-0",
              phase === "hold" && "scale-100 opacity-100",
              phase === "exit" && "scale-75 opacity-50",
            )} strokeWidth={3} />
          </div>
        </div>

        {/* Text */}
        <div className={cn(
          "flex flex-col items-center gap-1.5 transition-all duration-500 ease-out delay-200",
          phase === "enter" && "opacity-0 translate-y-3",
          phase === "hold" && "opacity-100 translate-y-0",
          phase === "exit" && "opacity-0 -translate-y-2",
        )}>
          <p className={cn(
            "font-bold text-foreground tracking-tight",
            isMajor ? "text-xl" : "text-lg",
          )}>
            {completedLabel}
          </p>
          <p className="text-sm text-muted-foreground font-medium">
            Done
          </p>
        </div>

        {/* Next step hint */}
        <div className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/80 transition-all duration-500 ease-out delay-[400ms]",
          phase === "enter" && "opacity-0 translate-y-2 scale-95",
          phase === "hold" && "opacity-100 translate-y-0 scale-100",
          phase === "exit" && "opacity-0 translate-y-1",
        )}>
          <span className="text-xs text-muted-foreground font-medium">Next up</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">{nextLabel}</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Hook to manage celebration state.
 * Returns [showCelebration, triggerCelebration, celebrationProps]
 */
export function useCelebration() {
  const [state, setState] = useState<{
    showing: boolean
    completedLabel: string
    nextLabel: string
    isMajor: boolean
    onDone: () => void
  }>({ showing: false, completedLabel: "", nextLabel: "", isMajor: false, onDone: () => {} })

  const trigger = useCallback((
    completedLabel: string,
    nextLabel: string,
    isMajor: boolean,
    onDone: () => void,
  ) => {
    setState({ showing: true, completedLabel, nextLabel, isMajor, onDone })
  }, [])

  const handleComplete = useCallback(() => {
    setState((prev) => {
      prev.onDone()
      return { ...prev, showing: false }
    })
  }, [])

  return {
    showing: state.showing,
    trigger,
    props: {
      completedLabel: state.completedLabel,
      nextLabel: state.nextLabel,
      isMajor: state.isMajor,
      onComplete: handleComplete,
    },
  }
}
