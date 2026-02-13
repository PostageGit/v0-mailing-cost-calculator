"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import { mutate as globalMutate } from "swr"
import type { QuoteLineItem, QuoteCategory } from "./quote-types"

interface QuoteContextValue {
  items: QuoteLineItem[]
  projectName: string
  savedId: string | null
  isSaving: boolean
  setProjectName: (name: string) => void
  addItem: (item: Omit<QuoteLineItem, "id">) => void
  removeItem: (id: number) => void
  updateItem: (id: number, updates: Partial<Omit<QuoteLineItem, "id">>) => void
  clearCategory: (cat: QuoteCategory) => void
  clearAll: () => void
  getTotal: () => number
  getCategoryTotal: (cat: QuoteCategory) => number
  saveQuote: () => Promise<void>
  loadQuote: (quoteId: string) => Promise<void>
  newQuote: () => void
}

const QuoteContext = createContext<QuoteContextValue | null>(null)

export function QuoteProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<QuoteLineItem[]>([])
  const [projectName, setProjectName] = useState("")
  const [savedId, setSavedId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const addItem = useCallback((item: Omit<QuoteLineItem, "id">) => {
    const newItem: QuoteLineItem = { ...item, id: Date.now() + Math.random() }
    setItems((prev) => [...prev, newItem])
  }, [])

  const removeItem = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const updateItem = useCallback((id: number, updates: Partial<Omit<QuoteLineItem, "id">>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    )
  }, [])

  const clearCategory = useCallback((cat: QuoteCategory) => {
    setItems((prev) => prev.filter((item) => item.category !== cat))
  }, [])

  const clearAll = useCallback(() => {
    setItems([])
  }, [])

  const getTotal = useCallback(() => {
    return items.reduce((sum, item) => sum + item.amount, 0)
  }, [items])

  const getCategoryTotal = useCallback(
    (cat: QuoteCategory) => {
      return items.filter((item) => item.category === cat).reduce((sum, item) => sum + item.amount, 0)
    },
    [items]
  )

  const saveQuote = useCallback(async () => {
    setIsSaving(true)
    try {
      const total = items.reduce((s, i) => s + i.amount, 0)
      const payload = {
        project_name: projectName || "Untitled Quote",
        items,
        total,
      }

      if (savedId) {
        // Update existing
        await fetch(`/api/quotes/${savedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        // Create new
        const res = await fetch("/api/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.id) setSavedId(data.id)
      }
      // Revalidate the dashboard
      globalMutate("/api/quotes")
    } finally {
      setIsSaving(false)
    }
  }, [items, projectName, savedId])

  const loadQuote = useCallback(async (quoteId: string) => {
    const res = await fetch(`/api/quotes/${quoteId}`)
    const data = await res.json()
    if (data.id) {
      setSavedId(data.id)
      setProjectName(data.project_name || "")
      setItems(data.items || [])
    }
  }, [])

  const newQuote = useCallback(() => {
    setSavedId(null)
    setProjectName("")
    setItems([])
  }, [])

  return (
    <QuoteContext.Provider
      value={{
        items,
        projectName,
        savedId,
        isSaving,
        setProjectName,
        addItem,
        removeItem,
        updateItem,
        clearCategory,
        clearAll,
        getTotal,
        getCategoryTotal,
        saveQuote,
        loadQuote,
        newQuote,
      }}
    >
      {children}
    </QuoteContext.Provider>
  )
}

export function useQuote() {
  const ctx = useContext(QuoteContext)
  if (!ctx) throw new Error("useQuote must be used within a QuoteProvider")
  return ctx
}
