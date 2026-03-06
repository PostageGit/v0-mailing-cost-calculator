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
  flat: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  booklet: "bg-green-500/15 text-green-700 dark:text-green-400",
  perfect: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  spiral: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  pad: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  envelope: "bg-pink-500/15 text-pink-700 dark:text-pink-400",
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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 px-3 sm:px-5 py-4">
      {/* Header + Search row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-lg font-bold text-foreground">Chat Quotes</h1>
        <div className="flex items-center gap-2 flex-1 max-w-md min-w-[200px]">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search name, project, CQ-#..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={loadQuotes}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Stats bar + tabs -- single compact row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-0.5 rounded-md bg-muted/50 p-0.5">
          <button
            onClick={() => setViewFilter("active")}
            className={cn(
              "flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors",
              viewFilter === "active"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Active
            <span className={cn(
              "text-[10px] font-bold rounded-full px-1.5 py-px min-w-[18px] text-center",
              viewFilter === "active" ? "bg-foreground text-background" : "bg-muted-foreground/20 text-muted-foreground"
            )}>
              {activeQuotes.length}
            </span>
          </button>
          <button
            onClick={() => setViewFilter("archived")}
            className={cn(
              "flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors",
              viewFilter === "archived"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Archive className="h-3 w-3" />
            Archived
            {archivedQuotes.length > 0 && (
              <span className={cn(
                "text-[10px] font-bold rounded-full px-1.5 py-px min-w-[18px] text-center",
                viewFilter === "archived" ? "bg-foreground text-background" : "bg-muted-foreground/20 text-muted-foreground"
              )}>
                {archivedQuotes.length}
              </span>
            )}
          </button>
        </div>

        <div className="h-4 w-px bg-border hidden sm:block" />

        {/* Inline stats */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">{visibleQuotes.length}</span> quotes
          </span>
          <span>
            {"$"}<span className="font-semibold text-foreground">
              {visibleQuotes.reduce((s, q) => s + Number(q.total || 0), 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span> total
          </span>
          <span className="hidden sm:inline">
            {"$"}<span className="font-semibold text-foreground">
              {visibleQuotes.length > 0
                ? (visibleQuotes.reduce((s, q) => s + Number(q.total || 0), 0) / visibleQuotes.length).toFixed(2)
                : "0.00"}
            </span> avg
          </span>
        </div>
      </div>

      {/* Quote list */}
      {filtered.length === 0 ? (
        <div className="text-center py-10">
          <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">
            {searchTerm ? "No quotes match your search." : "No chat quotes yet."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtered.map((q) => {
            const isExpanded = expandedId === q.id
            const specs = q.specs || {}
            const breakdown = q.cost_breakdown || {}
            const productColor = PRODUCT_COLORS[q.product_type] || "bg-muted text-muted-foreground"
            const hasTranscript = q.chat_transcript && q.chat_transcript.length > 0

            return (
              <div key={q.id} className={cn(
                "rounded-lg border overflow-hidden transition-colors",
                isExpanded ? "border-border" : "border-border/60 hover:border-border"
              )}>
                {/* Header row -- compact */}
                <button
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors",
                    isExpanded ? "bg-muted/30" : "hover:bg-muted/10"
                  )}
                  onClick={() => {
                    setExpandedId(isExpanded ? null : q.id)
                    if (isExpanded) setShowTranscript(null)
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex items-center justify-center h-7 min-w-[52px] rounded bg-foreground px-1.5 shrink-0">
                      <span className="text-[10px] font-bold text-background">{formatChatQuoteRef(q.ref_number)}</span>
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-foreground truncate max-w-[200px]">{q.project_name}</span>
                        <span className={cn("text-[9px] font-bold uppercase px-1.5 py-px rounded-full", productColor)}>
                          {q.product_type}
                        </span>
                        {hasTranscript && (
                          <MessageSquare className="h-3 w-3 text-blue-500 shrink-0" />
                        )}
                        {q.attachments?.length > 0 && (
                          <span className="flex items-center gap-0.5 text-muted-foreground">
                            <Paperclip className="h-2.5 w-2.5" />
                            <span className="text-[10px]">{q.attachments.length}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {q.customer_name || "No name"}
                        {q.customer_phone && <> &middot; {q.customer_phone}</>}
                        {" "}&middot; {new Date(q.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {" "}{new Date(q.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-foreground">{"$"}{Number(q.total).toFixed(2)}</span>
                    {isExpanded
                      ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                      : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    }
                  </div>
                </button>

                {/* Expanded details -- compact */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {/* Conversation button */}
                    <div className="px-3 pt-2.5 pb-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowTranscript(showTranscript === q.id ? null : q.id)
                        }}
                        className={cn(
                          "w-full flex items-center justify-between rounded-md px-3 py-2 text-left transition-colors text-xs",
                          hasTranscript
                            ? "bg-blue-50 hover:bg-blue-100 border border-blue-200 dark:bg-blue-950/30 dark:hover:bg-blue-950/50 dark:border-blue-800"
                            : "bg-muted/20 border border-dashed border-border/40 cursor-default"
                        )}
                        disabled={!hasTranscript}
                      >
                        <div className="flex items-center gap-2">
                          <MessageSquare className={cn("h-3.5 w-3.5", hasTranscript ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground/30")} />
                          <span className={cn("font-medium", hasTranscript ? "text-blue-800 dark:text-blue-300" : "text-muted-foreground/40")}>
                            {hasTranscript ? `Conversation (${q.chat_transcript!.length} msgs)` : "No conversation"}
                          </span>
                        </div>
                        {hasTranscript && (
                          showTranscript === q.id
                            ? <ChevronUp className="h-3 w-3 text-blue-500" />
                            : <ChevronDown className="h-3 w-3 text-blue-500" />
                        )}
                      </button>

                      {/* Transcript thread -- compact left-aligned list */}
                      {showTranscript === q.id && hasTranscript && (
                        <div className="mt-1.5 max-h-[320px] overflow-y-auto rounded-md border border-border bg-background">
                          <div className="divide-y divide-border/40">
                            {q.chat_transcript!.map((msg, idx) => {
                              const isCustomer = msg.role === "customer"
                              return (
                                <div key={idx} className="flex gap-2 px-2.5 py-1.5">
                                  <span className={cn(
                                    "text-[10px] font-bold uppercase shrink-0 w-[52px] pt-0.5",
                                    isCustomer ? "text-foreground/70" : "text-blue-600 dark:text-blue-400"
                                  )}>
                                    {isCustomer ? "CUST" : "BOT"}
                                  </span>
                                  <p className="text-xs leading-snug text-foreground/90 whitespace-pre-wrap break-words min-w-0">{msg.text}</p>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Specs + breakdown -- single scannable block */}
                    <div className="px-3 py-2.5 bg-muted/20 border-y border-border/40">
                      {/* All specs in one horizontal wrapped line */}
                      {Object.keys(specs).length > 0 && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          {Object.entries(specs).map(([key, value]) => (
                            <span key={key} className="text-[11px]">
                              <span className="font-semibold text-foreground">
                                {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
                              </span>
                              <span className="text-muted-foreground ml-1">{formatKey(key)}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Breakdown inline below specs */}
                      {Object.keys(breakdown).length > 0 && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 pt-2 border-t border-border/30">
                          {Object.entries(breakdown).map(([key, value]) => (
                            <span key={key} className="text-[11px]">
                              <span className="font-bold text-foreground">{String(value)}</span>
                              <span className="text-muted-foreground ml-1">{formatKey(key)}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Attachments -- inline compact */}
                    {q.attachments?.length > 0 && (
                      <div className="px-3 pb-2">
                        <h4 className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1.5">
                          Attachments ({q.attachments.length})
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {q.attachments.map((att, idx) => {
                            const isImage = att.type?.startsWith("image/")
                            return (
                              <a
                                key={idx}
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 hover:bg-muted/30 transition-colors group"
                              >
                                {isImage ? (
                                  <ImageIcon className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                                ) : (
                                  <FileText className="h-3 w-3 text-red-500" />
                                )}
                                <span className="text-[10px] font-medium text-foreground truncate max-w-[120px]">{att.filename}</span>
                                <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/40 group-hover:text-muted-foreground" />
                              </a>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Footer: contact + actions */}
                    <div className="px-3 py-2 border-t border-border bg-muted/10 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                        <span className="font-medium text-foreground">{q.customer_name || "N/A"}</span>
                        {q.customer_email && (
                          <a href={`mailto:${q.customer_email}`} className="hover:text-foreground underline underline-offset-2">{q.customer_email}</a>
                        )}
                        {q.customer_phone && (
                          <a href={`tel:${q.customer_phone}`} className="hover:text-foreground underline underline-offset-2">{q.customer_phone}</a>
                        )}
                        {q.per_unit > 0 && (
                          <span>{"$"}{Number(q.per_unit).toFixed(4)}/ea</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-7 gap-1.5 text-[10px] px-2.5",
                            q.archived
                              ? "border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400"
                              : "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400"
                          )}
                          disabled={archiving === q.id}
                          onClick={() => toggleArchive(q.id, !q.archived)}
                        >
                          {archiving === q.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : q.archived ? (
                            <ArchiveRestore className="h-3 w-3" />
                          ) : (
                            <Archive className="h-3 w-3" />
                          )}
                          {q.archived ? "Restore" : "Archive"}
                        </Button>
                        <span className="text-sm font-bold text-foreground">{"$"}{Number(q.total).toFixed(2)}</span>
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
