"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { CalculatorApp } from "@/components/calculator-app"
import { Loader2 } from "lucide-react"

export default function CalculatorPage() {
  const router = useRouter()
  const { user, isLoading, isAdmin } = useAuth()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login")
      return
    }
    // Only admins or users with canAccessCalculator can access
    if (!isLoading && user && !isAdmin && !user.canAccessCalculator) {
      router.push("/")
    }
  }, [isLoading, user, isAdmin, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user || (!isAdmin && !user.canAccessCalculator)) return null

  return <CalculatorApp />
}
