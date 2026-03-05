"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { CalculatorApp } from "@/components/calculator-app"
import { ChatQuotesDashboard } from "@/components/chat-quotes-dashboard"
import { Button } from "@/components/ui/button"
import { Calculator, MessageSquare, LogOut, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

// Landing page for brokers -- shows two options: Postage Quotes (calculator) or Chat Quotes
function BrokerLanding() {
  const router = useRouter()
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between h-14 px-4 border-b border-border bg-card shrink-0">
        <div>
          <h1 className="text-sm font-bold text-foreground">Mailing Quote</h1>
          <p className="text-[11px] text-muted-foreground">{user?.companyName}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{user?.displayName}</span>
          <Button variant="ghost" size="sm" onClick={logout} className="h-8 px-2 text-xs gap-1.5">
            <LogOut className="h-3.5 w-3.5" /> Sign Out
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          {user?.canAccessCalculator && (
            <button
              onClick={() => router.push("/calculator")}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-border bg-card p-8 transition-all",
                "hover:border-foreground hover:shadow-lg min-h-[160px]"
              )}
            >
              <Calculator className="h-10 w-10 text-foreground" />
              <span className="text-base font-semibold text-foreground">Postage Quotes</span>
              <span className="text-xs text-muted-foreground text-center">Full calculator for mailing jobs</span>
            </button>
          )}

          {user?.canAccessChat && (
            <button
              onClick={() => router.push("/broker-chat")}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-border bg-card p-8 transition-all",
                "hover:border-foreground hover:shadow-lg min-h-[160px]"
              )}
            >
              <MessageSquare className="h-10 w-10 text-foreground" />
              <span className="text-base font-semibold text-foreground">Chat Quotes</span>
              <span className="text-xs text-muted-foreground text-center">Quick quotes via chat assistant</span>
            </button>
          )}
        </div>
      </main>
    </div>
  )
}

export default function Page() {
  const router = useRouter()
  const { user, isLoading, isAdmin } = useAuth()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login")
    }
  }, [isLoading, user, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) return null

  // Admins go straight to the full calculator app
  if (isAdmin) {
    return <CalculatorApp />
  }

  // Brokers see the landing page with their permitted options
  return <BrokerLanding />
}
