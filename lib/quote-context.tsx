"use client"

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react"
import { mutate as globalMutate } from "swr"
import type { QuoteLineItem, QuoteCategory } from "./quote-types"

interface QuoteContextValue {
  items: QuoteLineItem[]
  projectName: string
  customerId: string | null
  contactName: string
  referenceNumber: string
  savedId: string | null
  isSaving: boolean
  lastSavedAt: number | null
  setProjectName: (name: string) => void
  setCustomerId: (id: string | null) => void
  setContactName: (name: string) => void
  setReferenceNumber: (ref: string) => void
  addItem: (item: Omit<QuoteLineItem, "id">) => void
  removeItem: (id: number) => void
  updateItem: (id: number, updates: Partial<Omit<QuoteLineItem, "id">>) => void
  clearCategory: (cat: QuoteCategory) => void
  clearAll: () => void
  getTotal: () => number
  getCategoryTotal: (cat: QuoteCategory) => number
  /** Force an immediate save (creates if needed). Returns the saved ID. */
  ensureSaved: () => Promise<string>
  loadQuote: (quoteId: string) => Promise<void>
  newQuote: () => void
}

const QuoteContext = createContext<QuoteContextValue | null>(null)

const AUTO_SAVE_DELAY = 1500

export function QuoteProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<QuoteLineItem[]>([])
  const [projectName, setProjectNameRaw] = useState("")
  const [customerId, setCustomerIdRaw] = useState<string | null>(null)
  const [contactName, setContactNameRaw] = useState("")
  const [referenceNumber, setReferenceNumberRaw] = useState("")
  const [savedId, setSavedId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)

  // Track whether there are unsaved changes
  const dirtyRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingRef = useRef(false)
  const savedIdRef = useRef<string | null>(null)

  // Keep savedIdRef in sync
  useEffect(() => { savedIdRef.current = savedId }, [savedId])

  // --- Core persistence ---
  const persistNow = useCallback(async () => {
    if (savingRef.current) return savedIdRef.current
    savingRef.current = true
    setIsSaving(true)

    try {
      // Use refs to get latest state at call time
      const currentItems = itemsRef.current
      const total = currentItems.reduce((s, i) => s + i.amount, 0)
      const payload = {
        project_name: projectNameRef.current || "Untitled Quote",
        items: currentItems,
        total,
        customer_id: customerIdRef.current || null,
        contact_name: contactNameRef.current || "",
        reference_number: referenceNumberRef.current || "",
      }

      let id = savedIdRef.current

      if (id) {
        await fetch(`/api/quotes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        const res = await fetch("/api/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.id) {
          id = data.id
          setSavedId(id)
        }
      }

      dirtyRef.current = false
      setLastSavedAt(Date.now())
      globalMutate("/api/quotes")
      return id
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }, [])

  // Refs for latest values (needed inside the debounced save)
  const itemsRef = useRef(items)
  const projectNameRef = useRef(projectName)
  const customerIdRef = useRef(customerId)
  const contactNameRef = useRef(contactName)
  const referenceNumberRef = useRef(referenceNumber)

  useEffect(() => { itemsRef.current = items }, [items])
  useEffect(() => { projectNameRef.current = projectName }, [projectName])
  useEffect(() => { customerIdRef.current = customerId }, [customerId])
  useEffect(() => { contactNameRef.current = contactName }, [contactName])
  useEffect(() => { referenceNumberRef.current = referenceNumber }, [referenceNumber])

  // Schedule auto-save
  const scheduleSave = useCallback(() => {
    dirtyRef.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      persistNow()
    }, AUTO_SAVE_DELAY)
  }, [persistNow])

  // Wrapped setters that trigger auto-save
  const setProjectName = useCallback((name: string) => {
    setProjectNameRaw(name)
    scheduleSave()
  }, [scheduleSave])

  const setCustomerId = useCallback((id: string | null) => {
    setCustomerIdRaw(id)
    scheduleSave()
  }, [scheduleSave])

  const setContactName = useCallback((name: string) => {
    setContactNameRaw(name)
    scheduleSave()
  }, [scheduleSave])

  const setReferenceNumber = useCallback((ref: string) => {
    setReferenceNumberRaw(ref)
    scheduleSave()
  }, [scheduleSave])

  const addItem = useCallback((item: Omit<QuoteLineItem, "id">) => {
    const newItem: QuoteLineItem = { ...item, id: Date.now() + Math.random() }
    setItems((prev) => [...prev, newItem])
    scheduleSave()
  }, [scheduleSave])

  const removeItem = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
    scheduleSave()
  }, [scheduleSave])

  const updateItem = useCallback((id: number, updates: Partial<Omit<QuoteLineItem, "id">>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    )
    scheduleSave()
  }, [scheduleSave])

  const clearCategory = useCallback((cat: QuoteCategory) => {
    setItems((prev) => prev.filter((item) => item.category !== cat))
    scheduleSave()
  }, [scheduleSave])

  const clearAll = useCallback(() => {
    setItems([])
    scheduleSave()
  }, [scheduleSave])

  const getTotal = useCallback(() => {
    return items.reduce((sum, item) => sum + item.amount, 0)
  }, [items])

  const getCategoryTotal = useCallback(
    (cat: QuoteCategory) => {
      return items.filter((item) => item.category === cat).reduce((sum, item) => sum + item.amount, 0)
    },
    [items]
  )

  /** Force immediate save, returns the quote ID */
  const ensureSaved = useCallback(async (): Promise<string> => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const id = await persistNow()
    return id || ""
  }, [persistNow])

  const loadQuote = useCallback(async (quoteId: string) => {
    const res = await fetch(`/api/quotes/${quoteId}`)
    const data = await res.json()
    if (data.id) {
      setSavedId(data.id)
      setProjectNameRaw(data.project_name || "")
      setCustomerIdRaw(data.customer_id || null)
      setContactNameRaw(data.contact_name || "")
      setReferenceNumberRaw(data.reference_number || "")
      setItems(data.items || [])
      dirtyRef.current = false
      setLastSavedAt(Date.now())
    }
  }, [])

  const newQuote = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setSavedId(null)
    setProjectNameRaw("")
    setCustomerIdRaw(null)
    setContactNameRaw("")
    setReferenceNumberRaw("")
    setItems([])
    dirtyRef.current = false
    setLastSavedAt(null)
  }, [])

  return (
    <QuoteContext.Provider
      value={{
        items,
        projectName,
        customerId,
        contactName,
        referenceNumber,
        savedId,
        isSaving,
        lastSavedAt,
        setProjectName,
        setCustomerId,
        setContactName,
        setReferenceNumber,
        addItem,
        removeItem,
        updateItem,
        clearCategory,
        clearAll,
        getTotal,
        getCategoryTotal,
        ensureSaved,
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
