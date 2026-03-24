"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import useSWR from "swr"
import { format, isToday, isTomorrow, isPast, parseISO, addDays } from "date-fns"
import { 
  Search, LayoutGrid, List, Plus, ChevronDown, X, Check, 
  Calendar, User, Hash, FileText, Truck, Mail, DollarSign,
  ExternalLink, Phone, Package, Edit2, AlertCircle, Clock
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// ── CONSTANTS ──────────────────────────────────────
const REPS = ["Lazer", "Shia", "Dovy", "Unas."]
const PRINT_OPTIONS = ["Print Out BP", "Print Out NJ", "Publimax", "Tri-Star", "4 Over", "Client Provides"]
const FOLDER_OPTIONS = ["Local", "Cloud", "NAS", "Shared"]
const MAILER_TYPES = ["Letter", "Flat", "Postcard", "Self-Mailer", "Booklet", "Snap-Pack"]
const MAIL_CLASSES = ["First Class", "Marketing Mail", "Non-Profit", "Periodical", "Priority"]
const DROP_OFFS = ["Hicksville", "Bethpage", "DVD", "Mid-Island", "Morgan"]

// ── CHECKLIST CONFIGURATION ──────────────────────────
const GROUP_CFG = {
  prod:  { label: "Production", color: "#0071E3", bg: "#EAF2FF", border: "#93C5FD", checked: "#0071E3", textOn: "#003D8F", textOff: "#94A3B8" },
  files: { label: "Files",      color: "#7B61FF", bg: "#F0EEFF", border: "#C4B5FD", checked: "#7B61FF", textOn: "#4A2E9E", textOff: "#94A3B8" },
  comms: { label: "Comms",      color: "#FF6B00", bg: "#FFF0E6", border: "#FBD5A0", checked: "#FF6B00", textOn: "#B45309", textOff: "#94A3B8" },
  bill:  { label: "Billing",    color: "#28A745", bg: "#EDFAF1", border: "#86EFB0", checked: "#28A745", textOn: "#1A6634", textOff: "#94A3B8" },
} as const

type GroupId = keyof typeof GROUP_CFG

interface ChecklistItem {
  key: string
  label: string
  short: string
  type: "bool" | "select"
  opts?: string[]
}

interface ChecklistGroup {
  id: GroupId
  label: string
  items: ChecklistItem[]
}

// NOTE: These keys match the existing job_meta fields used in kanban-board.tsx
const CL_GROUPS: ChecklistGroup[] = [
  { id: "prod", label: "Production", items: [
    { key: "prints_arrived",  label: "Prints",      short: "Prt",  type: "bool" },
    { key: "printed_by",      label: "Print Vendor", short: "Vndr", type: "select", opts: PRINT_OPTIONS },
    { key: "bcc_done",        label: "BCC Done",    short: "BCC",  type: "bool" },
  ]},
  { id: "files", label: "Files", items: [
    { key: "paperwork_done",   label: "Paperwork",   short: "Papr", type: "bool" },
    { key: "folder_archived",  label: "Folder",      short: "Fldr", type: "bool" },
  ]},
  { id: "comms", label: "Comms", items: [
    { key: "invoice_emailed", label: "Inv Emailed", short: "Email", type: "bool" },
    { key: "invoice_updated", label: "Inv Updated", short: "Upd",   type: "bool" },
    { key: "job_mailed",      label: "Job Mailed",  short: "Mail",  type: "bool" },
  ]},
  { id: "bill", label: "Billing", items: [
    { key: "paid_postage", label: "Paid Postage", short: "Post", type: "bool" },
    { key: "paid_full",    label: "Paid Full",    short: "Full", type: "bool" },
    { key: "done",         label: "DONE",         short: "Done", type: "bool" },
  ]},
]

const ALL_ITEMS = CL_GROUPS.flatMap(g => g.items)

// ── TYPES ──────────────────────────────────────────
interface Job {
  id: string
  quote_number: number
  job_number: number | null
  project_name: string
  customer_id: string | null
  customer?: { company_name: string } | null
  mailing_date: string | null
  quantity: number | null
  mailing_class: string | null
  notes: string | null
  job_meta: Record<string, unknown> | null
  invoice_id: string | null
  invoice?: { invoice_number: number } | null
  created_at: string
  updated_at: string
}

interface Customer {
  id: string
  company_name: string
}

// ── HELPER FUNCTIONS ──────────────────────────────
function getChecklistValue(job: Job, key: string): boolean | string | null {
  if (!job) return null
  const meta = (job.job_meta || {}) as Record<string, unknown>
  // Read directly from job_meta.{key}, NOT job_meta.checklist.{key}
  const val = meta[key]
  if (typeof val === "boolean" || typeof val === "string") return val
  return null
}

function isChecked(job: Job, key: string): boolean {
  const val = getChecklistValue(job, key)
  return !!val
}

function getProgress(job: Job): number {
  const completed = ALL_ITEMS.filter(item => isChecked(job, item.key)).length
  return Math.round((completed / ALL_ITEMS.length) * 100)
}

function getNextStep(job: Job): { msg: string; color: string; bg: string } {
  const meta = (job.job_meta || {}) as Record<string, unknown>
  const customerName = job.customer?.company_name || ""
  const assignee = (meta.assignee as string) || ""
  const dueDate = (meta.due_date as string) || job.mailing_date || ""
  
  // Check required fields in order of priority
  if (!customerName) return { msg: "Add customer name", color: "#EF4444", bg: "#FEF2F2" }
  if (!assignee || assignee === "Unas.") return { msg: "Assign person", color: "#F97316", bg: "#FFF7ED" }
  if (!job.quantity || job.quantity === 0) return { msg: "Add piece quantity", color: "#3B82F6", bg: "#EFF6FF" }
  if (!dueDate) return { msg: "Set mail date", color: "#8B5CF6", bg: "#F5F3FF" }
  
  const pct = getProgress(job)
  if (pct === 100) return { msg: "Ready to mark done!", color: "#22C55E", bg: "#F0FDF4" }
  
  // Find next unchecked item
  const nextItem = ALL_ITEMS.find(item => !isChecked(job, item.key))
  return { msg: `Next: ${nextItem?.label || "checklist"}`, color: "#64748B", bg: "#F8FAFC" }
}

function getUrgency(dateStr: string | null): { label: string; color: string; stripe: string; cls: string } | null {
  if (!dateStr) return null
  try {
    const date = parseISO(dateStr)
    if (isPast(date) && !isToday(date)) return { label: "Overdue", color: "#EF4444", stripe: "#EF4444", cls: "urgent-overdue" }
    if (isToday(date)) return { label: "Today", color: "#EF4444", stripe: "#EF4444", cls: "urgent-today" }
    if (isTomorrow(date)) return { label: "Tomorrow", color: "#F97316", stripe: "#F97316", cls: "urgent-tomorrow" }
    return { label: format(date, "MMM d"), color: "#3B82F6", stripe: "#3B82F6", cls: "urgent-upcoming" }
  } catch {
    return null
  }
}

function getProgressColor(pct: number): string {
  if (pct === 100) return "#22C55E"
  if (pct >= 70) return "#3B82F6"
  if (pct >= 40) return "#F97316"
  return "#EF4444"
}

// ── FETCHER ─────────────────────────────────������────
const fetcher = (url: string) => fetch(url).then(res => res.json())

// ── CHECKLIST DOT COMPONENT ─────────────────────────
function CheckDot({ 
  item, 
  checked, 
  groupId, 
  onToggle 
}: { 
  item: ChecklistItem
  checked: boolean
  groupId: GroupId
  onToggle: () => void
}) {
  const cfg = GROUP_CFG[groupId]
  return (
    <div className="flex flex-col items-center gap-0.5 cursor-pointer select-none" onClick={onToggle}>
      <div 
        className={cn(
          "w-6 h-6 rounded-md border-[1.5px] flex items-center justify-center transition-all",
          "hover:brightness-90"
        )}
        style={{ 
          borderColor: checked ? cfg.checked : cfg.border, 
          background: checked ? cfg.checked : cfg.bg 
        }}
      >
        {checked && <Check className="h-3.5 w-3.5 text-white" />}
      </div>
      <span 
        className="text-[8px] font-bold uppercase tracking-tight"
        style={{ color: checked ? cfg.textOn : cfg.textOff }}
      >
        {item.short}
      </span>
    </div>
  )
}

// ── SELECT DOT COMPONENT ────────────────────────────
function SelectDot({ 
  item, 
  value, 
  groupId, 
  onChange 
}: { 
  item: ChecklistItem
  value: string | null
  groupId: GroupId
  onChange: (val: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const cfg = GROUP_CFG[groupId]
  const isSet = !!value
  
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  return (
    <div className="relative flex flex-col items-center gap-0.5" ref={ref}>
      <div 
        className={cn(
          "w-6 h-6 rounded-md border-[1.5px] flex items-center justify-center transition-all cursor-pointer",
          "hover:brightness-90"
        )}
        style={{ 
          borderColor: isSet ? cfg.checked : cfg.border, 
          background: isSet ? cfg.checked : cfg.bg 
        }}
        onClick={() => setOpen(!open)}
      >
        {isSet && <Check className="h-3.5 w-3.5 text-white" />}
      </div>
      <span 
        className="text-[8px] font-bold uppercase tracking-tight text-center max-w-[32px] truncate"
        style={{ color: isSet ? cfg.textOn : cfg.textOff }}
      >
        {isSet ? value.split(" ")[0] : item.short}
      </span>
      
      {open && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 bg-background border rounded-xl shadow-lg min-w-[180px] overflow-hidden">
          <div className="px-3 py-2 bg-muted/50 border-b flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{item.label}</span>
          </div>
          <div 
            className={cn("px-3 py-2 text-sm cursor-pointer hover:bg-muted flex items-center gap-2", !value && "text-green-600 bg-green-50")}
            onClick={() => { onChange(null); setOpen(false) }}
          >
            <span className="w-4 text-xs">{!value ? "✓" : ""}</span>
            — Clear
          </div>
          {item.opts?.map(opt => (
            <div 
              key={opt}
              className={cn(
                "px-3 py-2 text-sm cursor-pointer hover:bg-muted flex items-center gap-2 border-t",
                value === opt && "text-green-600 bg-green-50 font-semibold"
              )}
              onClick={() => { onChange(opt); setOpen(false) }}
            >
              <span className="w-4 text-xs">{value === opt ? "✓" : ""}</span>
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── COMPACT CHECKLIST ───────────────────────────────
function CompactChecklist({ job, onToggle }: { job: Job; onToggle: (key: string, value: unknown) => void }) {
  const pct = getProgress(job)
  const progressColor = getProgressColor(pct)
  
  return (
    <div className="flex items-end gap-0 shrink-0">
      {CL_GROUPS.map((group, gi) => {
        const cfg = GROUP_CFG[group.id]
        return (
          <div key={group.id} className="flex items-end">
            {gi > 0 && <div className="w-px h-7 bg-border mx-1.5 self-end mb-1" />}
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] font-extrabold uppercase tracking-wide" style={{ color: cfg.color }}>
                {cfg.label}
              </span>
              <div className="flex gap-0.5">
                {group.items.map(item => {
                  const val = getChecklistValue(job, item.key)
                  if (item.type === "select") {
                    return (
                      <SelectDot 
                        key={item.key} 
                        item={item} 
                        value={typeof val === "string" ? val : null} 
                        groupId={group.id}
                        onChange={v => onToggle(item.key, v)}
                      />
                    )
                  }
                  return (
                    <CheckDot 
                      key={item.key} 
                      item={item} 
                      checked={!!val} 
                      groupId={group.id}
                      onToggle={() => onToggle(item.key, !val)}
                    />
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
      <div className="w-2" />
      <span className="text-xs font-extrabold font-mono w-8 text-center pb-0.5" style={{ color: progressColor }}>
        {pct}%
      </span>
    </div>
  )
}

// ── REP PICKER ──────────────────────────────────────
function RepPicker({ rep, onChange }: { rep: string | null; onChange: (rep: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  const repColors: Record<string, string> = {
    "Lazer": "#3B82F6",
    "Shia": "#8B5CF6",
    "Dovy": "#22C55E",
    "Unas.": "#94A3B8"
  }
  const color = repColors[rep || ""] || "#94A3B8"

  return (
    <div className="relative" ref={ref}>
      <button 
        className="flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-semibold hover:bg-muted transition-colors"
        style={{ borderColor: color + "40", color }}
        onClick={() => setOpen(!open)}
      >
        <User className="h-3 w-3" />
        {rep || "Unas."}
        <ChevronDown className="h-3 w-3" />
      </button>
      
      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-background border rounded-lg shadow-lg min-w-[120px] overflow-hidden">
          {REPS.map(r => (
            <div 
              key={r}
              className={cn(
                "px-3 py-2 text-sm cursor-pointer hover:bg-muted flex items-center gap-2",
                rep === r && "bg-muted font-semibold"
              )}
              onClick={() => { onChange(r); setOpen(false) }}
            >
              <div className="w-2 h-2 rounded-full" style={{ background: repColors[r] }} />
              {r}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── COMPACT ROW ─────────────────────────────────────
function CompactRow({ 
  job, 
  onToggle, 
  onDone, 
  onEdit, 
  onRepChange 
}: { 
  job: Job
  onToggle: (key: string, value: unknown) => void
  onDone: () => void
  onEdit: () => void
  onRepChange: (rep: string) => void
}) {
  const urgency = getUrgency(job.mailing_date)
  const nextStep = getNextStep(job)
  const isDone = isChecked(job, "done")
  const customerName = job.customer?.company_name || "No customer"
  const meta = (job.job_meta || {}) as Record<string, unknown>
  // Use existing field names from kanban-board.tsx
  const assignee = (meta.assignee as string) || null
  const zdTicket = (meta.zendesk_ticket as string) || null
  const invoiceNum = job.invoice?.invoice_number || null
  const dropOff = (meta.drop_off as string) || null
  const mailingClass = (meta.mailing_class as string) || job.mailing_class || null

  return (
    <div className={cn(
      "flex items-center border-b bg-background hover:bg-muted/30 transition-colors",
      isDone && "opacity-60"
    )}>
      <div 
        className="w-1 self-stretch shrink-0" 
        style={{ background: urgency?.stripe || "#E5E7EB" }} 
      />
      <div className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0">
        {/* Customer & Project */}
        <div className="w-[180px] shrink-0 min-w-0">
          <div className="font-semibold text-sm truncate" title={customerName}>{customerName}</div>
          {job.project_name && <div className="text-xs text-muted-foreground truncate">{job.project_name}</div>}
        </div>
        
        {/* Assignee */}
        <div className="w-[90px] shrink-0">
          <RepPicker rep={assignee} onChange={onRepChange} />
        </div>
        
        {/* Date */}
        <div className="w-[80px] shrink-0">
          {urgency ? (
            <Badge variant="outline" className={cn("text-[10px] px-2", urgency.cls)} style={{ borderColor: urgency.color + "40", color: urgency.color }}>
              {urgency.label}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">No date</span>
          )}
        </div>
        
        {/* Mail Class & Drop-off */}
        <div className="w-[120px] shrink-0 flex flex-col gap-1">
          {mailingClass && <Badge variant="secondary" className="text-[10px] w-fit">{mailingClass}</Badge>}
          {dropOff && <span className="text-[10px] text-muted-foreground">{dropOff}</span>}
          {!mailingClass && !dropOff && <span className="text-xs text-muted-foreground">—</span>}
        </div>
        
        {/* IDs */}
        <div className="w-[160px] shrink-0 flex flex-col gap-0.5">
          {job.job_number && <span className="text-[10px] font-bold text-teal-600">J-{job.job_number}</span>}
          {zdTicket && <span className="text-[10px] font-medium text-orange-600">ZD# {zdTicket}</span>}
          {invoiceNum && <span className="text-[10px] font-medium text-muted-foreground">INV {invoiceNum}</span>}
          {!job.job_number && !zdTicket && !invoiceNum && <span className="text-xs text-muted-foreground">—</span>}
        </div>
        
        {/* Next Step */}
        <div className="w-[160px] shrink-0">
          <div 
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border"
            style={{ background: nextStep.bg, borderColor: nextStep.color + "30", color: nextStep.color }}
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: nextStep.color }} />
            <span className="truncate">{nextStep.msg}</span>
          </div>
        </div>
        
        {/* Checklist */}
        <CompactChecklist job={job} onToggle={onToggle} />
        
        {/* Actions */}
        <div className="flex gap-2 shrink-0 ml-auto">
          <Button 
            size="sm" 
            variant={isDone ? "default" : "outline"}
            className={cn("text-xs h-8", isDone && "bg-green-600 hover:bg-green-700")}
            onClick={onDone}
          >
            {isDone ? "✓ Done" : "Mark Done"}
          </Button>
          <Button size="sm" variant="outline" className="text-xs h-8" onClick={onEdit}>
            Edit
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── JOB CARD ────────────────────────────────────────
function JobCard({ 
  job, 
  onToggle, 
  onDone, 
  onEdit, 
  onRepChange 
}: { 
  job: Job
  onToggle: (key: string, value: unknown) => void
  onDone: () => void
  onEdit: () => void
  onRepChange: (rep: string) => void
}) {
  const pct = getProgress(job)
  const urgency = getUrgency(job.mailing_date)
  const nextStep = getNextStep(job)
  const isDone = isChecked(job, "done")
  const progressColor = getProgressColor(pct)
  const customerName = job.customer?.company_name || "No customer"
  const meta = (job.job_meta || {}) as Record<string, unknown>
  // Use existing field names from kanban-board.tsx
  const assignee = (meta.assignee as string) || null
  const zdTicket = (meta.zendesk_ticket as string) || null
  const invoiceNum = job.invoice?.invoice_number || null
  const dropOff = (meta.drop_off as string) || null
  const mailingClass = (meta.mailing_class as string) || job.mailing_class || null
  const dueDate = (meta.due_date as string) || job.mailing_date || null

  return (
    <Card className={cn("relative overflow-hidden", isDone && "opacity-60")}>
      <div 
        className="absolute left-0 top-0 bottom-0 w-1" 
        style={{ background: urgency?.stripe || "#E5E7EB" }} 
      />
      <CardContent className="p-4 pl-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <div className="font-bold text-base">{customerName}</div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <RepPicker rep={assignee} onChange={onRepChange} />
              {mailingClass && <Badge variant="secondary" className="text-[10px]">{mailingClass}</Badge>}
              {dropOff && <Badge variant="outline" className="text-[10px]">{dropOff}</Badge>}
              {job.quantity && <Badge variant="outline" className="text-[10px]">{job.quantity.toLocaleString()} pcs</Badge>}
            </div>
          </div>
          {urgency && (
            <Badge variant="outline" style={{ borderColor: urgency.color + "40", color: urgency.color }}>
              {urgency.label}
            </Badge>
          )}
        </div>
        
        {/* IDs */}
        <div className="flex flex-wrap gap-2 text-xs mb-3">
          {zdTicket && <span className="font-medium"><strong>ZD</strong> #{zdTicket}</span>}
          {invoiceNum && <span className="font-medium"><strong>INV</strong> #{invoiceNum}</span>}
          {jobInfo && <span className="font-medium"><strong>JOB</strong> {jobInfo}</span>}
        </div>
        
        {/* Details */}
        {(job.project_name || job.mailing_date) && (
          <>
            <div className="border-t my-3" />
            <div className="grid grid-cols-2 gap-3 text-sm">
              {job.project_name && (
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase">Project</div>
                  <div className="font-medium">{job.project_name}</div>
                </div>
              )}
              {job.mailing_date && (
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase">Mail Date</div>
                  <div className="font-medium font-mono">{format(parseISO(job.mailing_date), "MMM d, yyyy")}</div>
                </div>
              )}
            </div>
          </>
        )}
        
        {/* Notes */}
        {job.notes && (
          <div className="mt-3 p-2 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-800">
            {job.notes}
          </div>
        )}
        
        {/* Next Step */}
        <div 
          className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm"
          style={{ background: nextStep.bg, borderColor: nextStep.color + "30" }}
        >
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: nextStep.color }} />
          <span className="text-xs font-medium text-muted-foreground">Next</span>
          <span className="font-semibold" style={{ color: nextStep.color }}>{nextStep.msg}</span>
        </div>
        
        {/* Checklist */}
        <div className="mt-4 space-y-3">
          {CL_GROUPS.map(group => (
            <div key={group.id}>
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">{group.label}</div>
              <div className="flex flex-wrap gap-2">
                {group.items.map(item => {
                  const val = getChecklistValue(job, item.key)
                  const checked = !!val
                  const cfg = GROUP_CFG[group.id]
                  
                  if (item.type === "select") {
                    return (
                      <div 
                        key={item.key} 
                        className={cn("flex flex-col gap-1 p-2 rounded-lg border", checked && "bg-muted/50")}
                      >
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded border flex items-center justify-center"
                            style={{ borderColor: checked ? cfg.checked : cfg.border, background: checked ? cfg.checked : "transparent" }}
                          >
                            {checked && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                          <span className="text-xs font-medium">{item.label}</span>
                        </div>
                        <Select 
                          value={typeof val === "string" && val ? val : "__none__"} 
                          onValueChange={v => onToggle(item.key, v === "__none__" ? null : v)}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Not set" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Not set</SelectItem>
                            {item.opts?.map(opt => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )
                  }
                  
                  return (
                    <div 
                      key={item.key}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors",
                        checked && "bg-muted/50"
                      )}
                      onClick={() => onToggle(item.key, !val)}
                    >
                      <div 
                        className="w-4 h-4 rounded border flex items-center justify-center"
                        style={{ borderColor: checked ? cfg.checked : cfg.border, background: checked ? cfg.checked : "transparent" }}
                      >
                        {checked && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                      <span className="text-xs font-medium">{item.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        
        {/* Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">Overall Progress</span>
            <span className="text-sm font-bold" style={{ color: progressColor }}>{pct}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full transition-all" style={{ width: `${pct}%`, background: progressColor }} />
          </div>
        </div>
        
        {/* Footer */}
        <div className="mt-4 flex gap-2">
          <Button 
            variant={isDone ? "default" : "outline"}
            className={cn("flex-1", isDone && "bg-green-600 hover:bg-green-700")}
            onClick={onDone}
          >
            {isDone ? "✓ In Billing — Undo" : "Mark as Done"}
          </Button>
          <Button variant="outline" onClick={onEdit}>
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── PIPELINE ────────────────────────────────────────
function Pipeline({ jobs }: { jobs: Job[] }) {
  const today = new Date()
  const tomorrow = addDays(today, 1)
  
  // Defensive check - ensure jobs is an array
  const safeJobs = Array.isArray(jobs) ? jobs : []
  
  const groups = useMemo(() => {
    return [
      { id: "overdue", label: "Overdue", color: "#EF4444", jobs: safeJobs.filter(j => j.mailing_date && isPast(parseISO(j.mailing_date)) && !isToday(parseISO(j.mailing_date))) },
      { id: "today", label: "Today", color: "#EF4444", jobs: safeJobs.filter(j => j.mailing_date && isToday(parseISO(j.mailing_date))) },
      { id: "tomorrow", label: "Tomorrow", color: "#F97316", jobs: safeJobs.filter(j => j.mailing_date && isTomorrow(parseISO(j.mailing_date))) },
      { id: "upcoming", label: "Upcoming", color: "#3B82F6", jobs: safeJobs.filter(j => j.mailing_date && parseISO(j.mailing_date) > tomorrow) },
      { id: "nodate", label: "No Date", color: "#94A3B8", jobs: safeJobs.filter(j => !j.mailing_date) },
    ].filter(g => g.jobs.length > 0)
  }, [safeJobs])
  
  const avgProgress = safeJobs.length ? Math.round(safeJobs.reduce((sum, j) => sum + getProgress(j), 0) / safeJobs.length) : 0

  return (
    <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl border mb-4 overflow-x-auto">
      {groups.map((group, i) => (
        <div key={group.id} className="flex items-center gap-3">
          {i > 0 && <div className="w-px h-8 bg-border" />}
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs font-bold" style={{ color: group.color }}>{group.label}</span>
            <div className="flex gap-1">
              {group.jobs.slice(0, 6).map(j => (
                <div 
                  key={j.id}
                  className="px-2 py-1 rounded-md text-[10px] font-semibold border"
                  style={{ background: group.color + "15", color: group.color, borderColor: group.color + "30" }}
                  title={j.customer?.company_name || ""}
                >
                  {(j.customer?.company_name || "?").split(" ")[0].substring(0, 8)}
                </div>
              ))}
              {group.jobs.length > 6 && (
                <div className="px-2 py-1 rounded-md text-[10px] font-semibold bg-muted">
                  +{group.jobs.length - 6}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
      <div className="w-px h-8 bg-border" />
      <div className="flex flex-col items-center gap-1 min-w-[100px]">
        <div className="flex items-center justify-between w-full">
          <span className="text-xs text-muted-foreground">Avg. completion</span>
          <span className="text-xs font-bold font-mono">{avgProgress}%</span>
        </div>
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 transition-all" style={{ width: `${avgProgress}%` }} />
        </div>
      </div>
    </div>
  )
}

// ── JOB EDIT MODAL ──────────────────────────────────
function JobEditModal({ 
  job, 
  customers,
  onClose, 
  onSave 
}: { 
  job: Job | null
  customers: Customer[]
  onClose: () => void
  onSave: (data: Partial<Job>) => void
}) {
  const isNew = !job
  const [form, setForm] = useState({
    customer_id: job?.customer_id || "",
    project_name: job?.project_name || "",
    mailing_date: job?.mailing_date || "",
    quantity: job?.quantity?.toString() || "",
    mailing_class: job?.mailing_class || "",
    notes: job?.notes || "",
    salesRep: (job?.job_meta?.salesRep as string) || "",
    zdTicket: (job?.job_meta?.zdTicket as string) || "",
    invoiceNum: (job?.job_meta?.invoiceNum as string) || "",
    jobInfo: (job?.job_meta?.jobInfo as string) || "",
    dropOff: (job?.job_meta?.dropOff as string) || "",
    mailer: (job?.job_meta?.mailer as string) || "",
  })

  const handleSubmit = () => {
    onSave({
      customer_id: form.customer_id || null,
      project_name: form.project_name,
      mailing_date: form.mailing_date || null,
      quantity: form.quantity ? parseInt(form.quantity) : null,
      mailing_class: form.mailing_class || null,
      notes: form.notes || null,
      job_meta: {
        ...(job?.job_meta || {}),
        salesRep: form.salesRep || null,
        zdTicket: form.zdTicket || null,
        invoiceNum: form.invoiceNum || null,
        jobInfo: form.jobInfo || null,
        dropOff: form.dropOff || null,
        mailer: form.mailer || null,
      }
    })
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "New Job" : `Edit: ${job?.customer?.company_name || "Job"}`}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold mb-3">Core Info</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Customer *</Label>
                <Select value={form.customer_id} onValueChange={v => setForm(f => ({ ...f, customer_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sales Rep</Label>
                <Select value={form.salesRep} onValueChange={v => setForm(f => ({ ...f, salesRep: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    {REPS.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mailing Date</Label>
                <Input type="date" value={form.mailing_date} onChange={e => setForm(f => ({ ...f, mailing_date: e.target.value }))} />
              </div>
              <div>
                <Label>ZD Ticket #</Label>
                <Input placeholder="e.g. 11134" value={form.zdTicket} onChange={e => setForm(f => ({ ...f, zdTicket: e.target.value }))} />
              </div>
              <div>
                <Label>Quantity (pcs)</Label>
                <Input type="number" placeholder="# of pieces" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-semibold mb-3">Job Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Mailer Type</Label>
                <Select value={form.mailer} onValueChange={v => setForm(f => ({ ...f, mailer: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {MAILER_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mail Class</Label>
                <Select value={form.mailing_class} onValueChange={v => setForm(f => ({ ...f, mailing_class: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {MAIL_CLASSES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Drop Off</Label>
                <Select value={form.dropOff} onValueChange={v => setForm(f => ({ ...f, dropOff: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {DROP_OFFS.map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Project Name</Label>
                <Input placeholder="Project description" value={form.project_name} onChange={e => setForm(f => ({ ...f, project_name: e.target.value }))} />
              </div>
              <div>
                <Label>Job Info #</Label>
                <Input placeholder="e.g. 17W0194" value={form.jobInfo} onChange={e => setForm(f => ({ ...f, jobInfo: e.target.value }))} />
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-semibold mb-3">Notes</h4>
            <Textarea 
              placeholder="Notes or special instructions..." 
              value={form.notes} 
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>{isNew ? "Add Job" : "Save Changes"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── MAIN DASHBOARD ──────────────────────────────────
export function ProductionDashboard() {
  const [view, setView] = useState<"cards" | "compact">("compact")
  const [search, setSearch] = useState("")
  const [editingJob, setEditingJob] = useState<Job | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [tab, setTab] = useState<"jobs" | "billing">("jobs")

  // Fetch jobs (is_job = true, not archived)
  const { data: jobs = [], mutate: mutateJobs } = useSWR<Job[]>(
    "/api/production-jobs",
    fetcher,
    { refreshInterval: 30000 }
  )
  
  // Fetch customers for the edit modal
  const { data: customers = [] } = useSWR<Customer[]>("/api/customers", fetcher)

  // Ensure jobs is always an array
  const safeJobs = Array.isArray(jobs) ? jobs : []

  // Filter jobs
  const activeJobs = useMemo(() => {
    return safeJobs
      .filter(j => !isChecked(j, "done"))
      .filter(j => {
        if (!search) return true
        const q = search.toLowerCase()
        return (
          j.customer?.company_name?.toLowerCase().includes(q) ||
          j.project_name?.toLowerCase().includes(q) ||
          j.job_meta?.zdTicket?.toString().includes(q) ||
          j.quote_number?.toString().includes(q)
        )
      })
  }, [safeJobs, search])

  const billingJobs = useMemo(() => safeJobs.filter(j => isChecked(j, "done")), [safeJobs])

  // Toggle checklist item - writes directly to job_meta.{key}, NOT job_meta.checklist.{key}
  const handleToggle = useCallback(async (jobId: string, key: string, value: unknown) => {
    const job = safeJobs.find(j => j.id === jobId)
    if (!job) return
    
    const existingMeta = job.job_meta || {}
    
    // Write directly to job_meta.{key} to match existing kanban-board data structure
    const newMeta = { ...existingMeta, [key]: value }
    
    // Optimistic update
    mutateJobs(
      safeJobs.map(j => j.id === jobId ? { ...j, job_meta: newMeta } : j),
      false
    )
    
    // API call
    await fetch(`/api/production-jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_meta: newMeta })
    })
    
    mutateJobs()
  }, [safeJobs, mutateJobs])

  // Toggle done
  const handleDone = useCallback((jobId: string) => {
    const job = safeJobs.find(j => j.id === jobId)
    if (!job) return
    const currentDone = isChecked(job, "done")
    handleToggle(jobId, "done", !currentDone)
  }, [safeJobs, handleToggle])

  // Change assignee (matches kanban-board field name)
  const handleRepChange = useCallback(async (jobId: string, rep: string) => {
    const job = safeJobs.find(j => j.id === jobId)
    if (!job) return
    
    const existingMeta = job.job_meta || {}
    const newMeta = { ...existingMeta, assignee: rep }
    
    mutateJobs(
      safeJobs.map(j => j.id === jobId ? { ...j, job_meta: newMeta } : j),
      false
    )
    
    await fetch(`/api/production-jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_meta: newMeta })
    })
    
    mutateJobs()
  }, [safeJobs, mutateJobs])

  // Save job edit
  const handleSaveJob = useCallback(async (data: Partial<Job>) => {
    if (editingJob) {
      await fetch(`/api/production-jobs/${editingJob.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })
    }
    setShowEditModal(false)
    setEditingJob(null)
    mutateJobs()
  }, [editingJob, mutateJobs])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b bg-background">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h1 className="text-xl font-bold">Production Dashboard</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search jobs..." 
                className="pl-9 w-[240px]"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex border rounded-lg overflow-hidden">
              <Button 
                variant={view === "cards" ? "default" : "ghost"} 
                size="sm" 
                className="rounded-none"
                onClick={() => setView("cards")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button 
                variant={view === "compact" ? "default" : "ghost"} 
                size="sm" 
                className="rounded-none"
                onClick={() => setView("compact")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        
        <Tabs value={tab} onValueChange={v => setTab(v as "jobs" | "billing")}>
          <TabsList>
            <TabsTrigger value="jobs">
              Active Jobs
              <Badge variant="secondary" className="ml-2">{activeJobs.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="billing">
              Billing
              <Badge variant="secondary" className="ml-2">{billingJobs.length}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {tab === "jobs" && (
          <>
            <Pipeline jobs={activeJobs} />
            
            {view === "compact" ? (
              <div className="border rounded-xl overflow-hidden bg-background">
                {activeJobs.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="font-semibold">No active jobs</p>
                    <p className="text-sm">Jobs will appear here when quotes are converted</p>
                  </div>
                ) : (
                  activeJobs.map(job => (
                    <CompactRow 
                      key={job.id}
                      job={job}
                      onToggle={(key, val) => handleToggle(job.id, key, val)}
                      onDone={() => handleDone(job.id)}
                      onEdit={() => { setEditingJob(job); setShowEditModal(true) }}
                      onRepChange={rep => handleRepChange(job.id, rep)}
                    />
                  ))
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {activeJobs.map(job => (
                  <JobCard 
                    key={job.id}
                    job={job}
                    onToggle={(key, val) => handleToggle(job.id, key, val)}
                    onDone={() => handleDone(job.id)}
                    onEdit={() => { setEditingJob(job); setShowEditModal(true) }}
                    onRepChange={rep => handleRepChange(job.id, rep)}
                  />
                ))}
              </div>
            )}
          </>
        )}
        
        {tab === "billing" && (
          <div className="border rounded-xl overflow-hidden bg-background">
            {billingJobs.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No jobs in billing</p>
                <p className="text-sm">Jobs marked as done will appear here</p>
              </div>
            ) : (
              billingJobs.map(job => (
                <CompactRow 
                  key={job.id}
                  job={job}
                  onToggle={(key, val) => handleToggle(job.id, key, val)}
                  onDone={() => handleDone(job.id)}
                  onEdit={() => { setEditingJob(job); setShowEditModal(true) }}
                  onRepChange={rep => handleRepChange(job.id, rep)}
                />
              ))
            )}
          </div>
        )}
      </div>
      
      {/* Edit Modal */}
      {showEditModal && (
        <JobEditModal 
          job={editingJob}
          customers={customers}
          onClose={() => { setShowEditModal(false); setEditingJob(null) }}
          onSave={handleSaveJob}
        />
      )}
    </div>
  )
}
