"use client"

import { useState, useCallback, useMemo } from "react"

/**
 * Apple-style per-field validation for calculator forms.
 *
 * Usage:
 *   const v = useFormValidation({ qty: 0, paper: "" }, (f) => !f.qty || !f.paper)
 *   <Input className={v.cls("qty", !inputs.qty)} />
 *   <button onClick={v.guard(onCalculate)}>Calculate</button>
 *
 * After the first attempt, empty required fields get a red ring.
 * Subsequent changes clear the ring on filled fields instantly.
 */
export function useFormValidation() {
  const [attempted, setAttempted] = useState(false)

  /** Mark form as attempted (user clicked Calculate) */
  const markAttempted = useCallback(() => setAttempted(true), [])

  /** Reset (e.g. on form reset) */
  const reset = useCallback(() => setAttempted(false), [])

  /** Returns CSS classes for a field. Shows error ring only after first attempt + field is empty. */
  const cls = useCallback(
    (isEmpty: boolean) => {
      if (!attempted || !isEmpty) return ""
      return "ring-2 ring-destructive/50 border-destructive/40"
    },
    [attempted],
  )

  /** Tiny "Required" label shown next to field label when empty after attempt */
  const req = useCallback(
    (isEmpty: boolean) => {
      if (!attempted || !isEmpty) return null
      return " *"
    },
    [attempted],
  )

  return { attempted, markAttempted, reset, cls, req }
}
