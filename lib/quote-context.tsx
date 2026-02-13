"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import type { QuoteLineItem, QuoteCategory } from "./quote-types"

interface QuoteContextValue {
  items: QuoteLineItem[]
  projectName: string
  setProjectName: (name: string) => void
  addItem: (item: Omit<QuoteLineItem, "id">) => void
  removeItem: (id: number) => void
  updateItem: (id: number, updates: Partial<Omit<QuoteLineItem, "id">>) => void
  clearCategory: (cat: QuoteCategory) => void
  clearAll: () => void
  getTotal: () => number
  getCategoryTotal: (cat: QuoteCategory) => number
}

const QuoteContext = createContext<QuoteContextValue | null>(null)

export function QuoteProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<QuoteLineItem[]>([])
  const [projectName, setProjectName] = useState("")

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

  return (
    <QuoteContext.Provider
      value={{
        items,
        projectName,
        setProjectName,
        addItem,
        removeItem,
        updateItem,
        clearCategory,
        clearAll,
        getTotal,
        getCategoryTotal,
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
