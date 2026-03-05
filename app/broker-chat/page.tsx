"use client"
// Broker Chat Page V3
import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { LogOut, Loader2, Send, ArrowLeft } from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

export default function BrokerChatPage() {
  const router = useRouter()
  const { user, isLoading: authLoading, logout } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
      return
    }
    if (!authLoading && user && !user.canAccessChat) {
      router.push("/")
    }
  }, [authLoading, user, router])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading || !user) return

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setIsLoading(true)

    try {
      const res = await fetch("/api/broker-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          brokerId: user.id,
          brokerName: user.displayName,
          brokerCompany: user.companyName,
        }),
      })

      if (!res.ok) throw new Error("Chat failed")

      const data = await res.json()
      const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: data.response }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      console.error("[v0] Broker chat error:", err)
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: "Sorry, something went wrong. Please try again." }])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, messages, user])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage()
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user || !user.canAccessChat) return null

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between h-12 px-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-sm font-bold text-foreground">Perfect Binding Quotes</h1>
            <p className="text-[10px] text-muted-foreground">{user.companyName} - Broker Pricing</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={logout} className="h-8 px-2 text-xs gap-1.5">
          <LogOut className="h-3.5 w-3.5" /> Sign Out
        </Button>
      </header>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground mb-2">Welcome, {user.displayName}!</p>
            <p className="text-xs text-muted-foreground">Ask me for a perfect binding quote. For example:</p>
            <p className="text-xs text-foreground mt-2 italic">&quot;I need 500 copies of an 8.5x11 perfect bound book, 100 pages, 80# gloss text inside, 12pt gloss cover&quot;</p>
          </div>
        )}

        <div className="flex flex-col gap-2 max-w-2xl mx-auto">
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
                msg.role === "user"
                  ? "bg-foreground text-background rounded-br-md"
                  : "bg-muted text-foreground rounded-bl-md"
              )}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted text-foreground rounded-2xl rounded-bl-md px-4 py-2.5">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-border bg-card p-3">
        <div className="flex gap-2 max-w-2xl mx-auto">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your perfect binding job..."
            className="flex-1 h-11"
            disabled={isLoading}
          />
          <Button type="submit" disabled={!input.trim() || isLoading} className="h-11 px-4">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  )
}
