// Compares two QuoteRevision snapshots and returns a human-readable diff.
// Used by the "What changed?" popover in the quote form header so customer
// service can see exactly what was modified between revisions without
// cluttering the main UI.

import type { QuoteRevision } from "./quote-context"
import type { QuoteLineItem } from "./quote-types"

/** A single field-level change (project name, qty, total). */
export type FieldChange = {
  field: "projectName" | "quantity" | "total"
  label: string
  before: string | number
  after: string | number
}

/** A line-item level change. "modified" includes the pre/post snapshots so
 *  the UI can show amount deltas. */
export type LineChange =
  | { kind: "added"; item: QuoteLineItem }
  | { kind: "removed"; item: QuoteLineItem }
  | { kind: "modified"; before: QuoteLineItem; after: QuoteLineItem }

export type RevisionDiff = {
  /** Total dollar delta (after - before). May be 0 even if line items changed. */
  totalDelta: number
  fieldChanges: FieldChange[]
  lineChanges: LineChange[]
  /** Convenience flag: any change of any kind. */
  hasAnyChange: boolean
}

/** Key used to match line items across revisions. Falls back through a
 *  cascade: stable id → category+label+amount → category+label. This is
 *  intentionally forgiving because saved snapshots sometimes re-number ids. */
function itemKey(item: QuoteLineItem): string {
  if (item.id != null) return `id:${item.id}`
  return `ck:${item.category}|${item.label}|${item.amount}`
}

/** Detects whether two items with the same key have meaningful differences. */
function itemsDiffer(a: QuoteLineItem, b: QuoteLineItem): boolean {
  if (a.amount !== b.amount) return true
  if (a.label !== b.label) return true
  if ((a.description || "") !== (b.description || "")) return true
  if ((a.quantity || 0) !== (b.quantity || 0)) return true
  if ((a.unitPrice || 0) !== (b.unitPrice || 0)) return true
  return false
}

/** Compute a structured diff between two revisions. `before` is the older
 *  snapshot, `after` is the newer (or current-in-memory) one. */
export function diffRevisions(
  before: QuoteRevision | null | undefined,
  after: QuoteRevision | null | undefined,
): RevisionDiff {
  const fieldChanges: FieldChange[] = []
  const lineChanges: LineChange[] = []

  if (!before || !after) {
    return { totalDelta: 0, fieldChanges, lineChanges, hasAnyChange: false }
  }

  // ── Field-level changes ──────────────────────────────────────────────
  if ((before.project_name || "") !== (after.project_name || "")) {
    fieldChanges.push({
      field: "projectName",
      label: "Project name",
      before: before.project_name || "—",
      after: after.project_name || "—",
    })
  }
  const beforeQty = before.quantity || 0
  const afterQty = after.quantity || 0
  if (beforeQty !== afterQty) {
    fieldChanges.push({
      field: "quantity",
      label: "Quantity",
      before: beforeQty,
      after: afterQty,
    })
  }

  // ── Line-level changes ───────────────────────────────────────────────
  const beforeItems = before.items || []
  const afterItems = after.items || []

  // Bucket before-items by key so we can match + detect removals.
  const beforeByKey = new Map<string, QuoteLineItem>()
  for (const it of beforeItems) beforeByKey.set(itemKey(it), it)

  // Walk after-items: new keys = added, existing keys with diffs = modified.
  const seenBeforeKeys = new Set<string>()
  for (const it of afterItems) {
    const key = itemKey(it)
    const prior = beforeByKey.get(key)
    if (!prior) {
      lineChanges.push({ kind: "added", item: it })
    } else {
      seenBeforeKeys.add(key)
      if (itemsDiffer(prior, it)) {
        lineChanges.push({ kind: "modified", before: prior, after: it })
      }
    }
  }
  // Anything in before that wasn't matched = removed.
  for (const [key, it] of beforeByKey) {
    if (!seenBeforeKeys.has(key)) {
      lineChanges.push({ kind: "removed", item: it })
    }
  }

  const totalDelta = (after.total || 0) - (before.total || 0)
  const hasAnyChange =
    fieldChanges.length > 0 ||
    lineChanges.length > 0 ||
    Math.abs(totalDelta) > 0.005

  return { totalDelta, fieldChanges, lineChanges, hasAnyChange }
}

/** One-line summary (e.g. "3 changes: +1 added, 2 modified · +$120.00"). */
export function summarizeDiff(diff: RevisionDiff): string {
  if (!diff.hasAnyChange) return "No changes"
  const parts: string[] = []
  const added = diff.lineChanges.filter((c) => c.kind === "added").length
  const removed = diff.lineChanges.filter((c) => c.kind === "removed").length
  const modified = diff.lineChanges.filter((c) => c.kind === "modified").length
  if (added) parts.push(`${added} added`)
  if (removed) parts.push(`${removed} removed`)
  if (modified) parts.push(`${modified} modified`)
  if (diff.fieldChanges.length) parts.push(`${diff.fieldChanges.length} field`)
  return parts.join(", ")
}
