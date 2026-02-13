"use client"

import { useQuote } from "@/lib/quote-context"
import {
  getCategoryLabel,
  getCategoryColor,
  type QuoteCategory,
} from "@/lib/quote-types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { X, FileText, ChevronDown, ChevronUp, ClipboardCopy, Check } from "lucide-react"
import { useState, useCallback } from "react"
import { formatCurrency } from "@/lib/pricing"

const CATEGORIES: QuoteCategory[] = ["flat", "booklet", "postage", "listwork"]

export function QuoteSidebar() {
  const {
    items,
    projectName,
    setProjectName,
    removeItem,
    clearAll,
    getTotal,
    getCategoryTotal,
  } = useQuote()

  const [collapsedCats, setCollapsedCats] = useState<Set<QuoteCategory>>(new Set())

  const toggleCategory = (cat: QuoteCategory) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const total = getTotal()
  const hasItems = items.length > 0

  const [copied, setCopied] = useState(false)
  const [showPlainText, setShowPlainText] = useState(false)

  // Group printing categories together for a cleaner email layout
  const PRINT_CATS: QuoteCategory[] = ["flat", "booklet"]
  const OTHER_CATS: QuoteCategory[] = ["postage", "listwork"]

  const buildPlainText = useCallback(() => {
    const lines: string[] = []
    const divider = "------------------------------"

    if (projectName) {
      lines.push(`Quote: ${projectName}`)
    } else {
      lines.push("Quote Summary")
    }
    lines.push(divider)
    lines.push("")

    // Helper to render a category section
    const renderCat = (cat: QuoteCategory, indent = "") => {
      const catItems = items.filter((i) => i.category === cat)
      if (catItems.length === 0) return false

      const catTotal = getCategoryTotal(cat)
      lines.push(`${indent}${getCategoryLabel(cat)}`)

      catItems.forEach((item, idx) => {
        const prefix = catItems.length > 1 ? `#${idx + 1} ` : ""
        lines.push(`${indent}  ${prefix}${item.label}`)
        if (item.description) {
          lines.push(`${indent}    ${item.description}`)
        }
        lines.push(`${indent}    ${formatCurrency(item.amount)}`)
        lines.push("")
      })

      lines.push(`${indent}  Subtotal: ${formatCurrency(catTotal)}`)
      lines.push("")
      return true
    }

    // Printing super-group (flat + booklet)
    const hasPrinting = PRINT_CATS.some(
      (cat) => items.filter((i) => i.category === cat).length > 0
    )
    if (hasPrinting) {
      const printTotal = PRINT_CATS.reduce((s, c) => s + getCategoryTotal(c), 0)
      lines.push("PRINTING")
      lines.push("")
      for (const cat of PRINT_CATS) {
        renderCat(cat, "  ")
      }
      lines.push(`  Printing Total: ${formatCurrency(printTotal)}`)
      lines.push("")
      lines.push(divider)
      lines.push("")
    }

    // Other categories
    for (const cat of OTHER_CATS) {
      const rendered = renderCat(cat)
      if (rendered) {
        lines.push(divider)
        lines.push("")
      }
    }

    lines.push(`TOTAL: ${formatCurrency(total)}`)
    lines.push("")

    return lines.join("\n")
  }, [items, projectName, total, getCategoryTotal])

  const handleCopy = useCallback(async () => {
    const text = buildPlainText()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const ta = document.createElement("textarea")
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [buildPlainText])

  return (
    <Card className="border-border bg-card shadow-sm h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Quote Builder
          </CardTitle>
          {hasItems && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-destructive"
              onClick={clearAll}
            >
              Clear All
            </Button>
          )}
        </div>
        <Input
          placeholder="Project / Client Name"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="h-8 text-sm mt-2"
        />
      </CardHeader>

      <CardContent className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pt-0">
        {!hasItems ? (
          <div className="flex flex-col items-center justify-center py-12 text-center flex-1">
            <div className="rounded-full bg-muted p-3 mb-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground max-w-[180px] leading-relaxed">
              Add items from any calculator to build your project quote.
            </p>
          </div>
        ) : (
          <>
            {CATEGORIES.map((cat) => {
              const catItems = items.filter((i) => i.category === cat)
              if (catItems.length === 0) return null

              const catTotal = getCategoryTotal(cat)
              const isCollapsed = collapsedCats.has(cat)

              return (
                <div key={cat}>
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="w-full flex items-center justify-between py-2 px-1 group"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] px-1.5 py-0 font-semibold ${getCategoryColor(cat)}`}
                      >
                        {getCategoryLabel(cat)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        ({catItems.length})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-foreground tabular-nums">
                        {formatCurrency(catTotal)}
                      </span>
                      {isCollapsed ? (
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <ChevronUp className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Category Items */}
                  {!isCollapsed && (
                    <div className="flex flex-col gap-1.5 ml-1">
                      {catItems.map((item, idx) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between gap-2 py-1.5 px-2 rounded-md bg-muted/40 group/item"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">
                              {catItems.length > 1 && (
                                <span className="text-muted-foreground font-mono mr-1">#{idx + 1}</span>
                              )}
                              {item.label}
                            </p>
                            {item.description && (
                              <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className="text-xs font-mono font-semibold text-foreground tabular-nums">
                              {formatCurrency(item.amount)}
                            </span>
                            <button
                              onClick={() => removeItem(item.id)}
                              className="opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10 hover:text-destructive"
                              aria-label="Remove item"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </CardContent>

      {/* Footer: Grand Total + Copy */}
      {hasItems && (
        <div className="flex-shrink-0 border-t border-border p-4 flex flex-col gap-2.5">
          {CATEGORIES.map((cat) => {
            const catTotal = getCategoryTotal(cat)
            if (catTotal === 0) return null
            return (
              <div key={cat} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{getCategoryLabel(cat)}</span>
                <span className="text-xs font-mono text-muted-foreground tabular-nums">
                  {formatCurrency(catTotal)}
                </span>
              </div>
            )
          })}
          {/* Show combined printing total when both flat and booklet exist */}
          {getCategoryTotal("flat") > 0 && getCategoryTotal("booklet") > 0 && (
            <div className="flex items-center justify-between pt-1 border-t border-dashed border-border">
              <span className="text-xs font-medium text-foreground">All Printing</span>
              <span className="text-xs font-mono font-medium text-foreground tabular-nums">
                {formatCurrency(getCategoryTotal("flat") + getCategoryTotal("booklet"))}
              </span>
            </div>
          )}
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Project Total</span>
            <span className="text-lg font-bold font-mono text-primary tabular-nums">
              {formatCurrency(total)}
            </span>
          </div>

          {/* Plain Text Toggle + Copy */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 text-xs h-8"
              onClick={() => setShowPlainText(!showPlainText)}
            >
              <FileText className="h-3.5 w-3.5" />
              {showPlainText ? "Hide Text" : "View as Text"}
            </Button>
            <Button
              variant={copied ? "default" : "outline"}
              size="sm"
              className="flex-1 gap-1.5 text-xs h-8"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <ClipboardCopy className="h-3.5 w-3.5" />
                  Copy for Email
                </>
              )}
            </Button>
          </div>

          {/* Plain text preview */}
          {showPlainText && (
            <pre className="bg-muted rounded-lg p-3 text-[11px] font-mono text-foreground leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto border border-border select-all">
              {buildPlainText()}
            </pre>
          )}
        </div>
      )}
    </Card>
  )
}
