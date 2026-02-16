"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ChevronDown, Search, User, Phone, Mail, MapPin, Users, X, Loader2 } from "lucide-react"
import type { Customer } from "@/lib/customer-types"

interface SearchableCustomer extends Customer {
  _matchedContact?: { name: string; email?: string; phone?: string } | null
  _matchReason?: string
}

interface Props {
  customers: Customer[] | undefined
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export function CustomerSearchCombobox({ customers, selectedId, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchableCustomer[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()

  const selectedCustomer = customers?.find((c) => c.id === selectedId)

  // Search API with debounce
  const doSearch = useCallback(async (term: string) => {
    if (!term.trim()) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(term.trim())}`)
      if (res.ok) {
        const data = await res.json()
        setResults(Array.isArray(data) ? data : [])
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(() => doSearch(query), 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, doSearch])

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery("")
      setResults([])
    }
  }, [open])

  const handleSelect = (customer: SearchableCustomer) => {
    onSelect(customer.id)
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(null)
  }

  // Show all customers (first 20) when no search query
  const displayList = query.trim() ? results : (customers || []).slice(0, 20)

  function getMatchBadge(c: SearchableCustomer) {
    if (!query.trim()) return null
    const reason = c._matchReason
    if (reason === "contact" && c._matchedContact) {
      return (
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Users className="h-2.5 w-2.5" />
          Contact: {c._matchedContact.name}
        </span>
      )
    }
    if (reason === "email") {
      return (
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Mail className="h-2.5 w-2.5" />
          {c.email}
        </span>
      )
    }
    if (reason === "phone") {
      return (
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Phone className="h-2.5 w-2.5" />
          {c.office_phone}
        </span>
      )
    }
    if (reason === "city") {
      return (
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <MapPin className="h-2.5 w-2.5" />
          {c.city}, {c.state}
        </span>
      )
    }
    if (reason === "name" && c.contact_name && c.contact_name !== c.company_name) {
      return (
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <User className="h-2.5 w-2.5" />
          {c.contact_name}
        </span>
      )
    }
    return null
  }

  function highlightMatch(text: string) {
    if (!query.trim() || !text) return text
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <span className="font-bold text-foreground bg-foreground/10 rounded px-0.5">{text.slice(idx, idx + query.length)}</span>
        {text.slice(idx + query.length)}
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className="flex items-center justify-between w-full h-9 px-3 text-sm border border-border bg-background rounded-xl hover:bg-secondary/50 transition-colors text-left"
        >
          {selectedCustomer ? (
            <span className="truncate font-medium">{selectedCustomer.company_name}</span>
          ) : (
            <span className="text-muted-foreground">Search customers...</span>
          )}
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {selectedId && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClear(e as unknown as React.MouseEvent) }}
                className="h-4 w-4 rounded-full bg-secondary flex items-center justify-center hover:bg-destructive/20 transition-colors cursor-pointer"
              >
                <X className="h-2.5 w-2.5" />
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl" align="start" sideOffset={4}>
        {/* Search input */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin shrink-0" />
          ) : (
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, phone, contact..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[280px] overflow-y-auto p-1">
          {displayList.length === 0 && !loading && (
            <div className="py-6 text-center text-xs text-muted-foreground">
              {query.trim() ? "No customers found" : "Start typing to search..."}
            </div>
          )}
          {displayList.map((c) => {
            const isSelected = c.id === selectedId
            const badge = getMatchBadge(c as SearchableCustomer)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c as SearchableCustomer)}
                className={`w-full flex flex-col items-start text-left px-3 py-2 rounded-lg transition-colors ${
                  isSelected
                    ? "bg-foreground/5 text-foreground"
                    : "hover:bg-secondary text-foreground"
                }`}
              >
                <span className="text-sm font-medium truncate w-full">
                  {highlightMatch(c.company_name)}
                </span>
                {badge && <div className="mt-0.5">{badge}</div>}
                {!badge && c.city && !query.trim() && (
                  <span className="text-[10px] text-muted-foreground">
                    {c.city}{c.state ? `, ${c.state}` : ""}
                  </span>
                )}
              </button>
            )
          })}
          {!query.trim() && (customers || []).length > 20 && (
            <div className="py-2 text-center text-[10px] text-muted-foreground">
              Type to search all {(customers || []).length} customers
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
