"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useChat, type UIMessage } from "@ai-sdk/react"
import { MessageCircle, X, Send, RotateCcw, Paperclip, FileText, ImageIcon, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useGlobalChat } from "@/lib/chat-context"

function getMessageText(msg: UIMessage): string {
  if (!msg.parts || !Array.isArray(msg.parts)) return ""
  return msg.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

interface UploadedFile {
  url: string
  filename: string
  size: number
  type: string
}

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"]

export function ChatBubble() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  // Track all files uploaded during this chat session (to save with quote)
  const [sessionFiles, setSessionFiles] = useState<UploadedFile[]>([])


  const { registerChat } = useGlobalChat()

  const [chatError, setChatError] = useState<string | null>(null)
  const [lastUserText, setLastUserText] = useState<string>("")
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { messages, sendMessage, status, setMessages } = useChat({
    api: "/api/chat",
    onError: (error) => {
      console.error("[v0] Chat error:", error)
      setChatError("stuck")
    },
  })

  const isLoading = status === "streaming" || status === "submitted"

  // Timeout detection: if loading for 20s with no streaming text, show recovery message
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    if (isLoading) {
      timeoutRef.current = setTimeout(() => {
        // Only trigger if still loading (no response came through)
        setChatError("stuck")
      }, 20000)
    }

    // If we got a response, clear any error
    if (status === "ready" || status === "streaming") {
      if (status === "streaming") {
        setChatError(null)
      }
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [isLoading, status])

  // Register send function globally so calculators can trigger chat
  const sendRef = useRef(sendMessage)
  sendRef.current = sendMessage
  useEffect(() => {
    registerChat(
      (msg: string) => sendRef.current({ text: msg }),
      () => setOpen(true)
    )
  }, [registerChat])

  // Auto-attach session files when a quote is saved (detect CQ- reference in AI messages)
  const attachedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (sessionFiles.length === 0) return
    const lastMsg = messages[messages.length - 1]
    if (!lastMsg || lastMsg.role !== "assistant") return
    const text = getMessageText(lastMsg)
    const cqMatch = text.match(/CQ-(\d+)/)
    if (cqMatch && !attachedRef.current.has(cqMatch[1])) {
      attachedRef.current.add(cqMatch[1])
      const refNum = parseInt(cqMatch[1], 10)
      fetch("/api/chat-quotes/attach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refNumber: refNum, attachments: sessionFiles }),
      }).catch(() => { /* silent fail -- quote is saved, files are bonus */ })
    }
  }, [messages, sessionFiles])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, status])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if ((!input.trim() && pendingFiles.length === 0) || isLoading) return

    // Build message text -- if files are attached, add their info
    let text = input.trim()
    if (pendingFiles.length > 0) {
      const fileList = pendingFiles
        .map((f) => `[Attached file: ${f.filename} (${f.type === "application/pdf" ? "PDF" : "Image"}, ${(f.size / 1024).toFixed(0)}KB) - ${f.url}]`)
        .join("\n")
      text = text ? `${text}\n\n${fileList}` : fileList
    }

    setChatError(null)
    setLastUserText(text)
    sendMessage({ text })
    setInput("")
    setPendingFiles([])
  }

  const handleRetry = useCallback(() => {
    if (!lastUserText) return
    setChatError(null)
    sendMessage({ text: lastUserText })
  }, [lastUserText, sendMessage])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`${file.name} is too large. Max 25MB.`)
        continue
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        alert(`${file.name} is not a supported file type. Only images and PDFs.`)
        continue
      }

      setUploading(true)
      try {
        const formData = new FormData()
        formData.append("file", file)
        const res = await fetch("/api/chat-upload", { method: "POST", body: formData })
        if (!res.ok) {
          const err = await res.json()
          alert(err.error || "Upload failed")
          continue
        }
        const data: UploadedFile = await res.json()
        setPendingFiles((prev) => [...prev, data])
        setSessionFiles((prev) => [...prev, data])
      } catch {
        alert("Upload failed. Please try again.")
      } finally {
        setUploading(false)
      }
    }
    // Reset the input so the same file can be re-selected
    e.target.value = ""
  }, [])

  const removePendingFile = useCallback((url: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.url !== url))
  }, [])

  const handleReset = () => {
    setMessages([])
    setPendingFiles([])
    setSessionFiles([])
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

              // Extract attachment URLs from user messages
              const attachmentRegex = /\[Attached file: (.+?) \((Image|PDF), .+?\) - (https?:\/\/[^\]]+)\]/g
              const attachments: { name: string; type: string; url: string }[] = []
              let match
              const cleanText = isUser ? text.replace(attachmentRegex, () => {
                // We already ran the regex above so re-run to collect
                return ""
              }).trim() : text

              // Re-run to actually collect attachments
              if (isUser) {
                let m
                const re = /\[Attached file: (.+?) \((Image|PDF), .+?\) - (https?:\/\/[^\]]+)\]/g
                while ((m = re.exec(text)) !== null) {
                  attachments.push({ name: m[1], type: m[2], url: m[3] })
                }
              }

              const displayText = isUser ? cleanText : text
              if (!displayText && attachments.length === 0) return null

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
                    {displayText && <ChatText text={displayText} />}
                    {attachments.length > 0 && (
                      <div className={`flex flex-col gap-1.5 ${displayText ? "mt-2" : ""}`}>
                        {attachments.map((att) => (
                          <a
                            key={att.url}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] transition-colors ${
                              isUser
                                ? "bg-background/15 text-background hover:bg-background/25"
                                : "bg-muted text-foreground hover:bg-muted/80"
                            }`}
                          >
                            {att.type === "PDF" ? (
                              <FileText className="h-3.5 w-3.5 shrink-0" />
                            ) : (
                              <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                            )}
                            <span className="truncate">{att.name}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {isLoading && messages.length > 0 && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-muted px-4 py-3">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:300ms]" />
                </div>
              </div>
            )}

            {chatError === "stuck" && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  <p className="font-medium mb-1">Looks like I got a little stuck!</p>
                  <p className="text-amber-800 dark:text-amber-300 mb-3">
                    No worries -- this can happen when crunching numbers. You can try again or rephrase your request.
                  </p>
                  <div className="flex gap-2">
                    {lastUserText && (
                      <button
                        onClick={handleRetry}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-50 dark:bg-amber-200 dark:text-amber-900 dark:hover:bg-amber-300"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Try again
                      </button>
                    )}
                    <button
                      onClick={() => setChatError(null)}
                      className="inline-flex items-center rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/40"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pending file previews */}
          {pendingFiles.length > 0 && (
            <div className="flex gap-2 overflow-x-auto border-t border-border px-3 pt-2 pb-0">
              {pendingFiles.map((f) => (
                <div key={f.url} className="relative group flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2 py-1.5 shrink-0 max-w-[180px]">
                  {f.type === "application/pdf" ? (
                    <FileText className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  ) : (
                    <ImageIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  )}
                  <span className="text-[11px] text-foreground truncate">{f.filename}</span>
                  <button
                    onClick={() => removePendingFile(f.url)}
                    className="ml-auto shrink-0 rounded-full p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Remove ${f.filename}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t border-border px-3 py-3"
          >
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || isLoading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              aria-label="Attach file"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
            </button>
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
              disabled={(!input.trim() && pendingFiles.length === 0) || isLoading}
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
