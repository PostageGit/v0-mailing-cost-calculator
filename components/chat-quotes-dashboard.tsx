"use client"

import { useState, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Search, RefreshCw, Loader2, MessageSquare, ChevronUp, ChevronDown,
  FileText, ImageIcon, ExternalLink, Paperclip, Archive, ArchiveRestore,
} from "lucide-react"

interface TranscriptMessage {
  role: "customer" | "assistant"
  text: string
  ts: string
}

interface ChatQuote {
  id: string; ref_number: number; customer_name: string;
  customer_email: string; customer_phone: string;
  project_name: string; product_type: string; total: number; per_unit: number;
  specs: Record<string, unknown>; cost_breakdown: Record<string, unknown>;
  attachments: Array<{ url: string; filename: string; size: number; type: string }>;
  notes: string; archived: boolean; chat_transcript: TranscriptMessage[] | null; created_at: string;
}

const PRODUCT_COLORS: Record<string, string> = {
  flat: "bg-blue-500/15 text-blue-700",
  booklet: "bg-green-500/15 text-green-700",
  perfect: "bg-purple-500/15 text-purple-700",
  spiral: "bg-orange-500/15 text-orange-700",
  pad: "bg-yellow-500/15 text-yellow-700",
  envelope: "bg-pink-500/15 text-pink-700",
}

const formatKey = (key: string) =>
  key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()).trim()

export function formatChatQuoteRef(refNumber: number) {
  return `CQ-${refNumber}`
}

export function ChatQuotesDashboard() {
  const [quotes, setQuotes] = useState<ChatQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showTranscript, setShowTranscript] = useState<string | null>(null)
  const [viewFilter, setViewFilter] = useState<"active" | "archived">("active")
  const [archiving, setArchiving] = useState<string | null>(null)

  const loadQuotes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/chat-quotes")
      if (res.ok) {
        const data = await res.json()
        setQuotes(data)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useState(() => { loadQuotes() })

  const toggleArchive = useCallback(async (id: string, archived: boolean) => {
    setArchiving(id)
    try {
      const res = await fetch("/api/chat-quotes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, archived }),
      })
      if (res.ok) {
        setQuotes((prev) => prev.map((q) => q.id === id ? { ...q, archived } : q))
        setExpandedId(null)
      }
    } catch { /* ignore */ }
    setArchiving(null)
  }, [])

  const activeQuotes = quotes.filter((q) => !q.archived)
  const archivedQuotes = quotes.filter((q) => q.archived)
  const visibleQuotes = viewFilter === "active" ? activeQuotes : archivedQuotes

  const filtered = visibleQuotes.filter((q) => {
    const term = searchTerm.toLowerCase()
    if (!term) return true
    return (
      q.customer_name?.toLowerCase().includes(term) ||
      q.customer_email?.toLowerCase().includes(term) ||
      q.customer_phone?.includes(term) ||
      q.project_name?.toLowerCase().includes(term) ||
      q.product_type?.toLowerCase().includes(term) ||
      String(q.ref_number).includes(term) ||
      formatChatQuoteRef(q.ref_number).toLowerCase().includes(term)
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 px-4 sm:px-6 py-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Chat Quotes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Quotes saved by customers from the AI chat assistant
        </p>
      </div>

      {/* Search & refresh */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, project, CQ-number, or product type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-11 pl-10 text-sm"
          />
        </div>
        <Button variant="outline" size="sm" className="h-11 px-4 min-w-[44px]" onClick={loadQuotes}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Active / Archived tabs */}
      <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1 w-fit">
        <button
          onClick={() => setViewFilter("active")}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            viewFilter === "active"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Active
          {activeQuotes.length > 0 && (
            <span className={cn(
              "text-xs font-bold rounded-full px-2 py-0.5 min-w-[24px] text-center",
              viewFilter === "active" ? "bg-foreground text-background" : "bg-muted-foreground/20 text-muted-foreground"
            )}>
              {activeQuotes.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setViewFilter("archived")}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            viewFilter === "archived"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Archive className="h-3.5 w-3.5" />
          Archived
          {archivedQuotes.length > 0 && (
            <span className={cn(
              "text-xs font-bold rounded-full px-2 py-0.5 min-w-[24px] text-center",
              viewFilter === "archived" ? "bg-foreground text-background" : "bg-muted-foreground/20 text-muted-foreground"
            )}>
              {archivedQuotes.length}
            </span>
          )}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">{viewFilter === "archived" ? "Archived" : "Active"} Quotes</p>
          <p className="text-2xl font-bold text-foreground mt-1">{visibleQuotes.length}</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Total Value</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {"$"}{visibleQuotes.reduce((sum, q) => sum + Number(q.total || 0), 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">This Month</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {visibleQuotes.filter((q) => {
              const d = new Date(q.created_at)
              const now = new Date()
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
            }).length}
          </p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Avg Quote</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {"$"}{visibleQuotes.length > 0
              ? (visibleQuotes.reduce((sum, q) => sum + Number(q.total || 0), 0) / visibleQuotes.length).toFixed(2)
              : "0.00"}
          </p>
        </div>
      </div>

      {/* Quote list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {searchTerm ? "No quotes match your search." : "No chat quotes saved yet. Quotes will appear here when customers save them from the chat."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((q) => {
            const isExpanded = expandedId === q.id
            const specs = q.specs || {}
            const breakdown = q.cost_breakdown || {}
            const productColor = PRODUCT_COLORS[q.product_type] || "bg-muted text-muted-foreground"
            return (
              <div key={q.id} className="rounded-xl border border-border overflow-hidden">
                {/* Header row */}
                <button
                  className={cn(
                    "w-full flex items-center justify-between px-4 sm:px-5 py-4 text-left transition-colors min-h-[64px]",
                    isExpanded ? "bg-muted/40" : "hover:bg-muted/20"
                  )}
                  onClick={() => setExpandedId(isExpanded ? null : q.id)}
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="flex items-center justify-center h-11 min-w-[60px] rounded-lg bg-foreground shrink-0 px-2">
                      <span className="text-xs font-bold text-background">{formatChatQuoteRef(q.ref_number)}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="text-sm font-semibold text-foreground truncate">{q.project_name}</p>
                        <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0", productColor)}>
                          {q.product_type}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {q.customer_name || "No name"}
                        {q.customer_phone && <> &middot; {q.customer_phone}</>}
                        {" "}&middot; {new Date(q.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {" "}{new Date(q.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {q.chat_transcript && q.chat_transcript.length > 0 && (
                      <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400" title="Has conversation">
                        <MessageSquare className="h-3 w-3" />
                      </span>
                    )}
                    {(q.attachments?.length > 0) && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Paperclip className="h-3 w-3" />
                        {q.attachments.length}
                      </span>
                    )}
                    <span className="text-base font-bold text-foreground">${Number(q.total).toFixed(2)}</span>
                    {isExpanded
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    }
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/5">
                    {/* Chat Transcript -- TOP of expanded view */}
                    <div className="px-4 sm:px-5 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowTranscript(showTranscript === q.id ? null : q.id)
                        }}
                        className={cn(
                          "w-full flex items-center justify-between rounded-lg px-4 py-3.5 text-left transition-colors",
                          q.chat_transcript && q.chat_transcript.length > 0
                            ? "bg-blue-50 hover:bg-blue-100 border border-blue-200 dark:bg-blue-950/30 dark:hover:bg-blue-950/50 dark:border-blue-800"
                            : "bg-muted/30 border border-dashed border-border/50 cursor-default"
                        )}
                        disabled={!q.chat_transcript || q.chat_transcript.length === 0}
                      >
                        <div className="flex items-center gap-2.5">
                          <MessageSquare className={cn(
                            "h-5 w-5",
                            q.chat_transcript && q.chat_transcript.length > 0
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-muted-foreground/40"
                          )} />
                          <span className={cn(
                            "text-sm font-semibold",
                            q.chat_transcript && q.chat_transcript.length > 0
                              ? "text-blue-900 dark:text-blue-300"
                              : "text-muted-foreground/50"
                          )}>
                            {q.chat_transcript && q.chat_transcript.length > 0
                              ? `View Conversation (${q.chat_transcript.length} messages)`
                              : "No conversation recorded"}
                          </span>
                        </div>
                        {q.chat_transcript && q.chat_transcript.length > 0 && (
                          showTranscript === q.id
                            ? <ChevronUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            : <ChevronDown className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        )}
                      </button>

                      {showTranscript === q.id && q.chat_transcript && q.chat_transcript.length > 0 && (
                        <div className="mt-3 max-h-[500px] overflow-y-auto rounded-xl border border-border bg-background shadow-inner">
                          <div className="flex flex-col gap-1 p-4">
                            {q.chat_transcript.map((msg, idx) => {
                              const isCustomer = msg.role === "customer"
                              return (
                                <div key={idx} className={cn("flex", isCustomer ? "justify-end" : "justify-start")}>
                                  <div className="flex flex-col max-w-[80%]">
                                    {(idx === 0 || q.chat_transcript![idx - 1].role !== msg.role) && (
                                      <span className={cn(
                                        "text-[10px] font-medium uppercase tracking-wider mb-1 px-1",
                                        isCustomer ? "text-right text-muted-foreground/50" : "text-left text-blue-500/60"
                                      )}>
                                        {isCustomer ? q.customer_name || "Customer" : "Assistant"}
                                      </span>
                                    )}
                                    <div className={cn(
                                      "rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                                      isCustomer
                                        ? "bg-foreground text-background rounded-br-md"
                                        : "bg-muted text-foreground rounded-bl-md"
                                    )}>
                                      <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Specs section */}
                    <div className="px-4 sm:px-5 py-4">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Job Specifications</h4>
                      {Object.keys(specs).length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
                          {Object.entries(specs).map(([key, value]) => (
                            <div key={key}>
                              <p className="text-[11px] text-muted-foreground">{formatKey(key)}</p>
                              <p className="text-sm font-medium text-foreground">
                                {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No specs recorded.</p>
                      )}
                    </div>

                    {/* Cost breakdown section */}
                    {Object.keys(breakdown).length > 0 && (
                      <div className="px-4 sm:px-5 py-4 border-t border-border">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Cost Breakdown</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
                          {Object.entries(breakdown).map(([key, value]) => (
                            <div key={key}>
                              <p className="text-[11px] text-muted-foreground">{formatKey(key)}</p>
                              <p className="text-sm font-bold text-foreground">{String(value)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Attachments section */}
                    {q.attachments?.length > 0 && (
                      <div className="px-4 sm:px-5 py-4 border-t border-border">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">
                          Attachments ({q.attachments.length})
                        </h4>
                        <div className="flex flex-col gap-2">
                          {q.attachments.map((att, idx) => {
                            const isPdf = att.type === "application/pdf"
                            const isImage = att.type?.startsWith("image/")
                            return (
                              <div key={idx} className="flex items-center gap-3 rounded-lg border border-border p-3">
                                {/* Thumbnail for images */}
                                {isImage ? (
                                  <div className="h-12 w-12 shrink-0 rounded-md overflow-hidden bg-muted">
                                    <img
                                      src={att.url}
                                      alt={att.filename}
                                      className="h-full w-full object-cover"
                                      crossOrigin="anonymous"
                                    />
                                  </div>
                                ) : (
                                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-red-500/10">
                                    <FileText className="h-5 w-5 text-red-600" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-foreground truncate">{att.filename}</p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {isPdf ? "PDF" : "Image"} &middot; {att.size ? `${(att.size / 1024).toFixed(0)}KB` : ""}
                                  </p>
                                </div>
                                <a
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                  aria-label={`Open ${att.filename}`}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Customer contact info */}
                    <div className="px-4 sm:px-5 py-4 border-t border-border">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Customer Info</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                        <div>
                          <p className="text-[11px] text-muted-foreground">Name</p>
                          <p className="text-sm font-semibold text-foreground">{q.customer_name || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">Email</p>
                          <p className="text-sm font-semibold text-foreground">
                            {q.customer_email ? (
                              <a href={`mailto:${q.customer_email}`} className="underline underline-offset-2">{q.customer_email}</a>
                            ) : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">Phone</p>
                          <p className="text-sm font-semibold text-foreground">
                            {q.customer_phone ? (
                              <a href={`tel:${q.customer_phone}`} className="underline underline-offset-2">{q.customer_phone}</a>
                            ) : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">Date & Time</p>
                          <p className="text-sm font-semibold text-foreground">
                            {new Date(q.created_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                            {" "}at {new Date(q.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Summary footer */}
                    <div className="px-4 sm:px-5 py-4 border-t border-border bg-muted/20 flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
                        {q.per_unit > 0 && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Per Unit</p>
                            <p className="text-sm font-semibold text-foreground">{"$"}{Number(q.per_unit).toFixed(4)}</p>
                          </div>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-9 gap-2 text-xs",
                            q.archived
                              ? "border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950/30"
                              : "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30"
                          )}
                          disabled={archiving === q.id}
                          onClick={() => toggleArchive(q.id, !q.archived)}
                        >
                          {archiving === q.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : q.archived ? (
                            <ArchiveRestore className="h-3.5 w-3.5" />
                          ) : (
                            <Archive className="h-3.5 w-3.5" />
                          )}
                          {q.archived ? "Restore" : "Archive"}
                        </Button>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
                        <p className="text-xl font-bold text-foreground">{"$"}{Number(q.total).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
