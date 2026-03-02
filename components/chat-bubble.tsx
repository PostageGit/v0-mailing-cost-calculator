"use client"

import { useState, useRef, useEffect } from "react"
import { useChat, type UIMessage } from "@ai-sdk/react"
import { MessageCircle, X, Send, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

function getMessageText(msg: UIMessage): string {
  if (!msg.parts || !Array.isArray(msg.parts)) return ""
  return msg.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

export function ChatBubble() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)


  const { messages, sendMessage, status, setMessages } = useChat({
    api: "/api/chat",
  })

  const isLoading = status === "streaming" || status === "submitted"

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, status])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ text: input.trim() })
    setInput("")
  }

  const handleReset = () => {
    setMessages([])
  }

  return (
    <>
      {/* Floating bubble button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-transform hover:scale-105 active:scale-95"
          aria-label="Open quote assistant"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[min(580px,calc(100vh-40px))] w-[min(400px,calc(100vw-40px))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-foreground px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background/15">
                <MessageCircle className="h-4 w-4 text-background" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight text-background">
                  Quote Assistant
                </p>
                <p className="text-[11px] text-background/60">
                  Postage Plus
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleReset}
                className="h-7 w-7 rounded-full text-background/60 hover:bg-background/10 hover:text-background"
                aria-label="Reset chat"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                className="h-7 w-7 rounded-full text-background/60 hover:bg-background/10 hover:text-background"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
          >
            {messages.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <MessageCircle className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Need a quote?
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-[260px]">
                    What are you looking for?
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                  {[
                    { label: "Flat printing", text: "I need flat printing" },
                    { label: "Envelopes", text: "I need envelopes" },
                    { label: "Books / Booklets", text: "I need a book or booklet" },
                    { label: "Notepads", text: "I need notepads" },
                  ].map((suggestion) => (
                    <button
                      key={suggestion.label}
                      onClick={() => {
                        sendMessage({ text: suggestion.text })
                      }}
                      className="rounded-full border border-border px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => {
              const text = getMessageText(msg)
              if (!text) return null
              const isUser = msg.role === "user"
              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      isUser
                        ? "rounded-br-md bg-foreground text-background"
                        : "rounded-bl-md bg-muted text-foreground"
                    }`}
                  >
                    <ChatText text={text} />
                  </div>
                </div>
              )
            })}

            {isLoading && messages.length > 0 && !getMessageText(messages[messages.length - 1]) && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-muted px-4 py-3">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:300ms]" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t border-border px-3 py-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe what you need..."
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="h-9 w-9 shrink-0 rounded-lg bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  )
}

/** Renders text with basic markdown-like formatting: **bold** and line breaks */
function ChatText({ text }: { text: string }) {
  // Split into paragraphs
  const paragraphs = text.split("\n\n")
  return (
    <>
      {paragraphs.map((para, i) => {
        const lines = para.split("\n")
        return (
          <p key={i} className={i > 0 ? "mt-2" : ""}>
            {lines.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                <FormatLine line={line} />
              </span>
            ))}
          </p>
        )
      })}
    </>
  )
}

function FormatLine({ line }: { line: string }) {
  // Bold **text** and format $amounts
  const parts = line.split(/(\*\*[^*]+\*\*|\$[\d,.]+)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          )
        }
        if (/^\$[\d,.]+$/.test(part)) {
          return (
            <span key={i} className="font-semibold tabular-nums">
              {part}
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}
