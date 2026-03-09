"use client"

import { useState } from "react"
import useSWR, { mutate } from "swr"
import { Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronRight, Power, PowerOff, GripVertical, ArrowUp, ArrowDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface Paper {
  id: string
  name: string
  category: "text" | "cover" | "specialty"
  is_cardstock: boolean
  thickness: number
  weight_gsm: number | null
  active: boolean
  prices: Record<string, number>
  available_sizes: string[]
  // Printing context usage flags
  use_in_flat_printing: boolean
  use_in_book_cover: boolean
  use_in_book_inside: boolean
  use_in_coil_cover: boolean
  use_in_coil_inside: boolean
  use_in_spiral_cover: boolean
  use_in_spiral_inside: boolean
  use_in_pad: boolean
  notes: string | null
  sort_order: number
}

const PRINTING_USAGE_OPTIONS = [
  { key: "use_in_flat_printing", label: "Flat Printing", description: "Sheets, flats, self-mailers", group: "flat" },
  { key: "use_in_book_cover", label: "Book Cover", description: "Booklet, saddle stitch, perfect bind", group: "book" },
  { key: "use_in_book_inside", label: "Book Inside", description: "Booklet, saddle stitch, perfect bind", group: "book" },
  { key: "use_in_coil_cover", label: "Coil Cover", description: "Coil bound covers", group: "coil" },
  { key: "use_in_coil_inside", label: "Coil Inside", description: "Coil bound inside pages", group: "coil" },
  { key: "use_in_spiral_cover", label: "Spiral Cover", description: "Spiral bound covers", group: "spiral" },
  { key: "use_in_spiral_inside", label: "Spiral Inside", description: "Spiral bound inside pages", group: "spiral" },
  { key: "use_in_pad", label: "Pad", description: "Notepad / pad printing", group: "pad" },
] as const

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const ALL_SIZES = ["8.5x11", "11x17", "12x18", "12.5x19", "13x19", "13x26"]
const CATEGORIES = [
  { value: "text", label: "Text Weight" },
  { value: "cover", label: "Cover / Cardstock" },
  { value: "specialty", label: "Specialty" },
]

export function PapersSettings() {
  const { data: papers, isLoading } = useSWR<Paper[]>("/api/papers?active=false", fetcher)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<string | null>("text")

  const groupedPapers = papers?.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = []
    acc[p.category].push(p)
    return acc
  }, {} as Record<string, Paper[]>) || {}

  const handleToggleActive = async (paper: Paper) => {
    await fetch(`/api/papers/${paper.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !paper.active }),
    })
    mutate("/api/papers?active=false")
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this paper permanently?")) return
    await fetch(`/api/papers/${id}`, { method: "DELETE" })
    mutate("/api/papers?active=false")
  }

  const handleReorder = async (category: string, paperId: string, direction: "up" | "down") => {
    const catPapers = groupedPapers[category] || []
    const idx = catPapers.findIndex((p) => p.id === paperId)
    if (idx === -1) return
    if (direction === "up" && idx === 0) return
    if (direction === "down" && idx === catPapers.length - 1) return

    const swapIdx = direction === "up" ? idx - 1 : idx + 1
    const currentPaper = catPapers[idx]
    const swapPaper = catPapers[swapIdx]

    // Swap sort_order values
    await Promise.all([
      fetch(`/api/papers/${currentPaper.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: swapPaper.sort_order }),
      }),
      fetch(`/api/papers/${swapPaper.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: currentPaper.sort_order }),
      }),
    ])
    mutate("/api/papers?active=false")
  }

  if (isLoading) return <div className="text-sm text-muted-foreground py-8 text-center">Loading papers...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Paper Management</h3>
          <p className="text-xs text-muted-foreground">Add, edit, or deactivate papers for use across all calculators</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5 h-8 text-xs">
          <Plus className="h-3.5 w-3.5" /> Add Paper
        </Button>
      </div>

      {showAdd && (
        <PaperForm
          onClose={() => setShowAdd(false)}
          onSave={() => { setShowAdd(false); mutate("/api/papers?active=false") }}
        />
      )}

      {CATEGORIES.map((cat) => {
        const catPapers = groupedPapers[cat.value] || []
        const isExpanded = expandedCategory === cat.value
        const activeCount = catPapers.filter((p) => p.active).length

        return (
          <div key={cat.value} className="border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedCategory(isExpanded ? null : cat.value)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="text-sm font-semibold">{cat.label}</span>
                <span className="text-xs text-muted-foreground">
                  {activeCount}/{catPapers.length} active
                </span>
              </div>
            </button>

            {isExpanded && (
              <div className="divide-y divide-border">
                {catPapers.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">No papers in this category</p>
                ) : (
                  catPapers.map((paper) => (
                    <div key={paper.id}>
                      {editingId === paper.id ? (
                        <PaperForm
                          paper={paper}
                          onClose={() => setEditingId(null)}
                          onSave={() => { setEditingId(null); mutate("/api/papers?active=false") }}
                        />
                      ) : (
                        <div className={cn(
                          "flex items-center gap-2 px-3 py-2",
                          !paper.active && "opacity-50 bg-secondary/20"
                        )}>
                          {/* Sort buttons */}
                          <div className="flex flex-col border rounded bg-secondary/50">
                            <button
                              onClick={() => handleReorder(cat.value, paper.id, "up")}
                              className="p-1 rounded-t text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-20 disabled:pointer-events-none border-b"
                              disabled={catPapers.indexOf(paper) === 0}
                              title="Move up"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleReorder(cat.value, paper.id, "down")}
                              className="p-1 rounded-b text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-20 disabled:pointer-events-none"
                              disabled={catPapers.indexOf(paper) === catPapers.length - 1}
                              title="Move down"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <button
                            onClick={() => handleToggleActive(paper)}
                            className={cn(
                              "p-1.5 rounded transition-colors",
                              paper.active
                                ? "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                : "text-muted-foreground hover:bg-secondary"
                            )}
                            title={paper.active ? "Deactivate" : "Activate"}
                          >
                            {paper.active ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                          </button>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{paper.name}</span>
                              {paper.is_cardstock && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-semibold">
                                  CARDSTOCK
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                              <span>{paper.thickness}" thick</span>
                              <span className="text-muted-foreground/50">|</span>
                              <div className="flex gap-1 flex-wrap">
                                {paper.use_in_flat_printing && <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">Flat</span>}
                                {paper.use_in_book_cover && <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">Book Cvr</span>}
                                {paper.use_in_book_inside && <span className="px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Book In</span>}
                                {paper.use_in_coil_cover && <span className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">Coil Cvr</span>}
                                {paper.use_in_coil_inside && <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Coil In</span>}
                                {paper.use_in_spiral_cover && <span className="px-1.5 py-0.5 rounded bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400">Spiral Cvr</span>}
                                {paper.use_in_spiral_inside && <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400">Spiral In</span>}
                                {paper.use_in_pad && <span className="px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400">Pad</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditingId(paper.id)}
                              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(paper.id)}
                              className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function PaperForm({ paper, onClose, onSave }: { paper?: Paper; onClose: () => void; onSave: () => void }) {
  const [name, setName] = useState(paper?.name || "")
  const [category, setCategory] = useState(paper?.category || "text")
  const [isCardstock, setIsCardstock] = useState(paper?.is_cardstock || false)
  const [thickness, setThickness] = useState(paper?.thickness?.toString() || "0.003")
  const [sizes, setSizes] = useState<string[]>(paper?.available_sizes || ["8.5x11", "11x17"])
  const [prices, setPrices] = useState<Record<string, string>>(
    paper?.prices ? Object.fromEntries(Object.entries(paper.prices).map(([k, v]) => [k, v.toString()])) : {}
  )
  const [usage, setUsage] = useState({
    use_in_flat_printing: paper?.use_in_flat_printing ?? true,
    use_in_book_cover: paper?.use_in_book_cover ?? false,
    use_in_book_inside: paper?.use_in_book_inside ?? false,
    use_in_coil_cover: paper?.use_in_coil_cover ?? false,
    use_in_coil_inside: paper?.use_in_coil_inside ?? false,
    use_in_spiral_cover: paper?.use_in_spiral_cover ?? false,
    use_in_spiral_inside: paper?.use_in_spiral_inside ?? false,
    use_in_pad: paper?.use_in_pad ?? false,
  })
  const [saving, setSaving] = useState(false)

  const toggleUsage = (key: keyof typeof usage) => {
    setUsage((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    const payload = {
      name: name.trim(),
      category,
      is_cardstock: isCardstock,
      thickness: parseFloat(thickness) || 0.003,
      available_sizes: sizes,
      prices: Object.fromEntries(Object.entries(prices).filter(([k]) => sizes.includes(k)).map(([k, v]) => [k, parseFloat(v) || 0])),
      ...usage,
    }

    if (paper) {
      await fetch(`/api/papers/${paper.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    } else {
      await fetch("/api/papers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    }
    setSaving(false)
    onSave()
  }

  const toggleSize = (size: string) => {
    setSizes((prev) => prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size])
  }

  return (
    <div className="p-3 bg-card border-y border-border space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{paper ? "Edit Paper" : "Add New Paper"}</span>
        <button onClick={onClose} className="p-1 rounded hover:bg-secondary">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Paper Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 80lb Gloss Text" className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Category</Label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Paper["category"])}
            className="w-full h-8 text-sm rounded-md border border-input bg-background px-2"
          >
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Thickness (inches)</Label>
          <Input value={thickness} onChange={(e) => setThickness(e.target.value)} placeholder="0.003" className="h-8 text-sm" />
        </div>
        <div className="flex items-end gap-2 col-span-2">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={isCardstock} onChange={(e) => setIsCardstock(e.target.checked)} className="rounded" />
            Is Cardstock
          </label>
        </div>
      </div>

      <div>
        <Label className="text-xs">Available Sizes</Label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {ALL_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => toggleSize(size)}
              className={cn(
                "px-2 py-1 text-xs rounded-md border transition-colors",
                sizes.includes(size)
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:border-foreground"
              )}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs">Prices per Sheet</Label>
        <div className="grid grid-cols-3 gap-2 mt-1">
          {sizes.map((size) => (
            <div key={size} className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground w-14">{size}</span>
              <Input
                value={prices[size] || ""}
                onChange={(e) => setPrices({ ...prices, [size]: e.target.value })}
                placeholder="$0.00"
                className="h-7 text-xs flex-1"
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs mb-2 block">Show in Printing Calculators</Label>
        <div className="flex flex-col gap-2">
          {PRINTING_USAGE_OPTIONS.map((opt) => (
            <label key={opt.key} className="flex items-start gap-2 text-xs cursor-pointer p-2 rounded-lg border border-border hover:bg-secondary/50 transition-colors">
              <input
                type="checkbox"
                checked={usage[opt.key as keyof typeof usage]}
                onChange={() => toggleUsage(opt.key as keyof typeof usage)}
                className="rounded h-4 w-4 mt-0.5"
              />
              <div>
                <span className="font-medium">{opt.label}</span>
                <p className="text-[10px] text-muted-foreground">{opt.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">Cancel</Button>
        <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()} className="h-8 text-xs gap-1.5">
          <Check className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save Paper"}
        </Button>
      </div>
    </div>
  )
}
