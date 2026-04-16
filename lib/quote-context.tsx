"use client"

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react"
import { mutate as globalMutate } from "swr"
import type { QuoteLineItem, QuoteCategory } from "./quote-types"
import type { MailingSnapshot } from "./mailing-context"

export interface ActivityLogEntry {
  id: number
  quote_id: string
  event: string
  detail: string | null
  created_at: string
}

export interface QuoteRevision {
  revision_number: number
  project_name: string
  items: QuoteLineItem[]
  total: number
  notes?: string
  quantity?: number
  created_at: string
  is_current?: boolean
  name?: string
}

interface QuoteContextValue {
  items: QuoteLineItem[]
  projectName: string
  customerId: string | null
  contactName: string
  referenceNumber: string
  quantity: number
  savedId: string | null
  quoteNumber: number | null
  isSaving: boolean
  lastSavedAt: number | null
  activityLog: ActivityLogEntry[]
  /** TRUE if there are unsaved changes since last save */
  hasUnsavedChanges: boolean
  setProjectName: (name: string) => void
  setCustomerId: (id: string | null) => void
  setContactName: (name: string) => void
  setReferenceNumber: (ref: string) => void
  setQuantity: (qty: number) => void
  addItem: (item: Omit<QuoteLineItem, "id">) => void
  removeItem: (id: number) => void
  updateItem: (id: number, updates: Partial<Omit<QuoteLineItem, "id">>) => void
  clearCategory: (cat: QuoteCategory) => void
  clearAll: () => void
  getTotal: () => number
  getCategoryTotal: (cat: QuoteCategory) => number
  /** EXPLICIT SAVE - Creates a new revision. User must click to save. */
  saveQuote: () => Promise<string | null>
  /** Force an immediate save (creates if needed). Returns the saved ID. */
  ensureSaved: () => Promise<string>
  loadQuote: (quoteId: string) => Promise<MailingSnapshot | null>
  newQuote: () => void
  logActivity: (event: string, detail?: string) => Promise<void>
  refreshLog: () => Promise<void>
  /** Steps the user explicitly skipped -- persisted via job_meta */
  skippedSteps: string[]
  setSkippedSteps: (steps: string[]) => void
  /** Push latest mailing snapshot for auto-save */
  setMailingSnapshot: (snap: MailingSnapshot) => void
  /** The mailing snapshot from the last loadQuote (null until a load happens) */
  lastLoadedMailingState: MailingSnapshot | null
  /** Current revision number */
  currentRevision: number
  /** All revisions for this quote */
  revisions: QuoteRevision[]
  /** Fetch revisions from API */
  fetchRevisions: () => Promise<void>
  /** Load a specific revision */
  loadRevision: (revisionNumber: number) => void
}

const QuoteContext = createContext<QuoteContextValue | null>(null)

export function QuoteProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<QuoteLineItem[]>([])
  const [projectName, setProjectNameRaw] = useState("")
  const [customerId, setCustomerIdRaw] = useState<string | null>(null)
  const [contactName, setContactNameRaw] = useState("")
  const [referenceNumber, setReferenceNumberRaw] = useState("")
  const [quantity, setQuantityRaw] = useState(0)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [quoteNumber, setQuoteNumber] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([])
  const [skippedSteps, setSkippedStepsRaw] = useState<string[]>([])
  const [lastLoadedMailingState, setLastLoadedMailingState] = useState<MailingSnapshot | null>(null)
  const mailingSnapshotRef = useRef<MailingSnapshot | null>(null)
  const [currentRevision, setCurrentRevision] = useState(1)
  const [revisions, setRevisions] = useState<QuoteRevision[]>([])
  // NEW: Track unsaved changes - user must explicitly save to create revision
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const setMailingSnapshot = useCallback((snap: MailingSnapshot) => {
    mailingSnapshotRef.current = snap
  }, [])

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
      // Build job_meta with skipped steps + mailing state snapshot
      const currentSkipped = skippedStepsRef.current
      const jobMetaPatch: Record<string, unknown> = { skipped_steps: currentSkipped.length > 0 ? currentSkipped : [] }
      if (mailingSnapshotRef.current) {
        jobMetaPatch.mailing_state = mailingSnapshotRef.current
      }

      const payload = {
        project_name: projectNameRef.current || "Untitled Quote",
        items: currentItems,
        total,
        customer_id: customerIdRef.current || null,
        contact_name: contactNameRef.current || "",
        reference_number: referenceNumberRef.current || "",
        quantity: quantityRef.current || 0,
        job_meta: jobMetaPatch,
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
          if (data.quote_number) setQuoteNumber(data.quote_number)
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
  const quantityRef = useRef(quantity)
  const skippedStepsRef = useRef(skippedSteps)

  useEffect(() => { itemsRef.current = items }, [items])
  useEffect(() => { projectNameRef.current = projectName }, [projectName])
  useEffect(() => { customerIdRef.current = customerId }, [customerId])
  useEffect(() => { contactNameRef.current = contactName }, [contactName])
  useEffect(() => { referenceNumberRef.current = referenceNumber }, [referenceNumber])
  useEffect(() => { quantityRef.current = quantity }, [quantity])
  useEffect(() => { skippedStepsRef.current = skippedSteps }, [skippedSteps])

  // Mark as having unsaved changes (NO auto-save - user must explicitly save)
  const markDirty = useCallback(() => {
    dirtyRef.current = true
    setHasUnsavedChanges(true)
  }, [])

  // Wrapped setters that mark dirty (no auto-save)
  const setProjectName = useCallback((name: string) => {
    setProjectNameRaw(name)
    markDirty()
  }, [markDirty])

  const setCustomerId = useCallback((id: string | null) => {
    setCustomerIdRaw(id)
    markDirty()
  }, [markDirty])

  const setContactName = useCallback((name: string) => {
    setContactNameRaw(name)
    markDirty()
  }, [markDirty])

  const setReferenceNumber = useCallback((ref: string) => {
    setReferenceNumberRaw(ref)
    markDirty()
  }, [markDirty])

  const setQuantity = useCallback((qty: number) => {
    setQuantityRaw(qty)
    markDirty()
  }, [markDirty])

  const setSkippedSteps = useCallback((steps: string[]) => {
    setSkippedStepsRaw(steps)
    markDirty()
  }, [markDirty])

  const addItem = useCallback((item: Omit<QuoteLineItem, "id">) => {
    const newItem: QuoteLineItem = { ...item, id: Date.now() + Math.random() }
    setItems((prev) => [...prev, newItem])
    markDirty()
  }, [markDirty])

  const removeItem = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
    markDirty()
  }, [markDirty])

  const updateItem = useCallback((id: number, updates: Partial<Omit<QuoteLineItem, "id">>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    )
    markDirty()
  }, [markDirty])

  const clearCategory = useCallback((cat: QuoteCategory) => {
    setItems((prev) => prev.filter((item) => item.category !== cat))
    markDirty()
  }, [markDirty])

  const clearAll = useCallback(() => {
    setItems([])
    markDirty()
  }, [markDirty])

  const getTotal = useCallback(() => {
    return items.reduce((sum, item) => sum + item.amount, 0)
  }, [items])

  const getCategoryTotal = useCallback(
    (cat: QuoteCategory) => {
      return items.filter((item) => item.category === cat).reduce((sum, item) => sum + item.amount, 0)
    },
    [items]
  )

  /** EXPLICIT SAVE - User clicked Save, creates a revision */
  const saveQuote = useCallback(async (): Promise<string | null> => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const id = await persistNow()
    if (id) {
      setHasUnsavedChanges(false)
      // Refresh revisions to get the new one
      try {
        const res = await fetch(`/api/quotes/${id}/revisions`)
        const data = await res.json()
        if (data.revisions) {
          setRevisions(data.revisions)
          setCurrentRevision(data.current_revision || data.revisions.length)
        }
      } catch { /* ignore */ }
    }
    return id
  }, [persistNow])

  /** Force immediate save, returns the quote ID (legacy, prefer saveQuote) */
  const ensureSaved = useCallback(async (): Promise<string> => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const id = await persistNow()
    if (id) setHasUnsavedChanges(false)
    return id || ""
  }, [persistNow])

  const loadQuote = useCallback(async (quoteId: string): Promise<MailingSnapshot | null> => {
    const res = await fetch(`/api/quotes/${quoteId}`)
    const data = await res.json()
    if (data.id) {
      setSavedId(data.id)
      setQuoteNumber(data.quote_number || null)
      setProjectNameRaw(data.project_name || "")
      setCustomerIdRaw(data.customer_id || null)
      setContactNameRaw(data.contact_name || "")
      setReferenceNumberRaw(data.reference_number || "")
      setQuantityRaw(data.quantity || 0)
      setItems(data.items || [])
      setSkippedStepsRaw(data.job_meta?.skipped_steps || [])
      // Capture mailing state for the caller to restore
      let mailingState: MailingSnapshot | null = data.job_meta?.mailing_state || null
      // Fallback for quotes saved before mailing_state was persisted:
      // Synthesize a minimal snapshot from the saved quantity so at least qty is restored
      if (!mailingState && (data.quantity || 0) > 0) {
        mailingState = {
          quantity: data.quantity || 0,
          shape: "LETTER",
          className: "Letter",
          mailService: "",
          pieces: [],
        }
      }
      setLastLoadedMailingState(mailingState)
      if (mailingState) {
        mailingSnapshotRef.current = mailingState
      }
      dirtyRef.current = false
      setHasUnsavedChanges(false)
      setLastSavedAt(Date.now())
      // Set current revision from job_meta
      const revNum = data.job_meta?.current_revision || 1
      setCurrentRevision(revNum)
      // Load activity log
      try {
        const logRes = await fetch(`/api/quotes/${data.id}/log`)
        const logData = await logRes.json()
        if (Array.isArray(logData)) setActivityLog(logData)
      } catch { /* ignore */ }
      // Fetch revision history
      try {
        const revRes = await fetch(`/api/quotes/${data.id}/revisions`)
        const revData = await revRes.json()
        if (revData.revisions) {
          const allRevisions: QuoteRevision[] = [revData.current, ...revData.revisions]
          setRevisions(allRevisions)
        }
      } catch { /* ignore */ }
      return mailingState
    }
    return null
  }, [])

  const refreshLog = useCallback(async () => {
    const id = savedIdRef.current
    if (!id) return
    try {
      const res = await fetch(`/api/quotes/${id}/log`)
      const data = await res.json()
      if (Array.isArray(data)) setActivityLog(data)
    } catch { /* ignore */ }
  }, [])

  const logActivity = useCallback(async (event: string, detail?: string) => {
    const id = savedIdRef.current
    if (!id) return
    try {
      await fetch(`/api/quotes/${id}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, detail }),
      })
      refreshLog()
    } catch { /* ignore */ }
  }, [refreshLog])

  const newQuote = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setSavedId(null)
    setQuoteNumber(null)
    setProjectNameRaw("")
    setCustomerIdRaw(null)
    setContactNameRaw("")
    setReferenceNumberRaw("")
    setQuantityRaw(0)
    setItems([])
    setSkippedStepsRaw([])
    setLastLoadedMailingState(null)
    mailingSnapshotRef.current = null
    dirtyRef.current = false
    setLastSavedAt(null)
    setCurrentRevision(1)
    setRevisions([])
  }, [])
  
  const fetchRevisions = useCallback(async () => {
    const id = savedIdRef.current
    if (!id) return
    try {
      const res = await fetch(`/api/quotes/${id}/revisions`)
      const data = await res.json()
      if (data.revisions) {
        const allRevisions: QuoteRevision[] = [data.current, ...data.revisions]
        setRevisions(allRevisions)
        setCurrentRevision(data.current?.revision_number || 1)
      }
    } catch { /* ignore */ }
  }, [])
  
  const loadRevision = useCallback((revisionNumber: number) => {
    const rev = revisions.find(r => r.revision_number === revisionNumber)
    if (!rev) return
    // Load the old revision data into current state as a CLEAN view.
    // We intentionally do NOT mark this as dirty — the user has only
    // navigated, not edited.  The wrapped setters (setProjectName, addItem,
    // removeItem, etc.) will flip hasUnsavedChanges=true as soon as they
    // actually modify anything, at which point a save will correctly
    // create a new revision via the existing persistNow() path.
    setItems(rev.items || [])
    setProjectNameRaw(rev.project_name || "")
    if (rev.quantity !== undefined) setQuantityRaw(rev.quantity)
    setCurrentRevision(revisionNumber)
    // Explicitly clear any stale dirty flag so moving between revisions
    // without editing never triggers the "unsaved changes" guard.
    dirtyRef.current = false
    setHasUnsavedChanges(false)
  }, [revisions])

  return (
    <QuoteContext.Provider
      value={{
        items,
        projectName,
        customerId,
        contactName,
        referenceNumber,
        quantity,
        savedId,
        quoteNumber,
        isSaving,
        lastSavedAt,
        activityLog,
        hasUnsavedChanges,
        setProjectName,
        setCustomerId,
        setContactName,
        setReferenceNumber,
        setQuantity,
        addItem,
        removeItem,
        updateItem,
        clearCategory,
        clearAll,
        getTotal,
        getCategoryTotal,
        saveQuote,
        ensureSaved,
        loadQuote,
        newQuote,
        logActivity,
        refreshLog,
        skippedSteps,
        setSkippedSteps,
        setMailingSnapshot,
        lastLoadedMailingState,
        currentRevision,
        revisions,
        fetchRevisions,
        loadRevision,
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
