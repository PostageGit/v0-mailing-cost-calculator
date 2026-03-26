"use client"

import { useState } from "react"
import { 
  FileText, Users, CheckCircle2, Truck, Mail, DollarSign, Archive,
  ArrowRight, ArrowDown, ChevronDown, ChevronUp, Circle, CheckCircle,
  AlertCircle, Clock, Briefcase, Send, Package, Printer, ClipboardList,
  Receipt, CreditCard, FolderArchive
} from "lucide-react"
import { cn } from "@/lib/utils"

// Stage data structure
interface Step {
  id: string
  label: string
  description: string
  field?: string // The database field this step checks/updates
  required?: boolean
}

interface Stage {
  id: string
  number: number
  title: string
  subtitle: string
  icon: React.ReactNode
  color: string // tailwind color
  bgColor: string
  borderColor: string
  board: string // Which board/view this appears in
  steps: Step[]
}

const STAGES: Stage[] = [
  {
    id: "quote",
    number: 1,
    title: "QUOTE",
    subtitle: "Create & Send Estimate",
    icon: <FileText className="h-6 w-6" />,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    board: "Quotes Board",
    steps: [
      { id: "customer", label: "Select Customer", description: "Choose from customer database or create new", field: "customer_id", required: true },
      { id: "contact", label: "Add Contact Name", description: "Person at company for this job", field: "contact_name", required: true },
      { id: "project", label: "Project Name", description: "Descriptive name for the job", field: "project_name", required: true },
      { id: "piece", label: "Piece Description", description: "e.g., '6x9 postcard', '8.5x11 letter'", field: "piece_description" },
      { id: "quantity", label: "Quantity", description: "Number of pieces to mail", field: "quantity", required: true },
      { id: "mail_class", label: "Mail Class", description: "First Class, Marketing, Non-Profit", field: "job_meta.mail_class" },
      { id: "estimate", label: "Add Line Items", description: "Printing, postage, handling costs", field: "quote_line_items" },
      { id: "send", label: "Send to Customer", description: "Email quote for approval", field: "status" },
    ]
  },
  {
    id: "approval",
    number: 2,
    title: "APPROVAL",
    subtitle: "Customer Confirms",
    icon: <CheckCircle2 className="h-6 w-6" />,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    board: "Quotes Board",
    steps: [
      { id: "review", label: "Customer Reviews", description: "Waiting for customer response", field: "status" },
      { id: "changes", label: "Handle Changes", description: "Revisions if needed (tracked in history)", field: "revisions" },
      { id: "approve", label: "Quote Approved", description: "Customer gives the go-ahead", field: "status", required: true },
      { id: "convert", label: "Convert to Job", description: "Quote becomes active job (J-number assigned)", field: "is_job", required: true },
    ]
  },
  {
    id: "setup",
    number: 3,
    title: "JOB SETUP",
    subtitle: "Production Preparation",
    icon: <ClipboardList className="h-6 w-6" />,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    board: "Production Dashboard",
    steps: [
      { id: "assignee", label: "Assign Sales Rep", description: "Who owns this job (Lazer, Shia, Dovy)", field: "job_meta.assignee", required: true },
      { id: "zendesk", label: "Add ZD Ticket #", description: "Link to Zendesk ticket for communications", field: "job_meta.zendesk_ticket", required: true },
      { id: "mail_date", label: "Set Mailing Date", description: "Target date for mail drop", field: "mailing_date", required: true },
      { id: "list", label: "Get Mailing List", description: "Customer provides addresses", field: "job_meta.list_received" },
    ]
  },
  {
    id: "printing",
    number: 4,
    title: "PRINTING",
    subtitle: "Vendor Production",
    icon: <Printer className="h-6 w-6" />,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    board: "Production Dashboard",
    steps: [
      { id: "po_create", label: "Create Purchase Order", description: "Order from print vendor (OHP, etc.)", field: "purchase_orders" },
      { id: "po_vendor", label: "Select Vendor", description: "Choose printing company", field: "purchase_orders.vendor_id" },
      { id: "po_submit", label: "Submit PO", description: "Send order to vendor", field: "purchase_orders.status" },
      { id: "po_track", label: "Track Production", description: "Monitor vendor progress", field: "purchase_orders.status" },
      { id: "prints_ship", label: "Prints Shipped", description: "Vendor ships to us", field: "purchase_orders.status" },
      { id: "prints_arrive", label: "Prints Arrived", description: "Received at facility", field: "job_meta.prints_arrived", required: true },
    ]
  },
  {
    id: "production",
    number: 5,
    title: "MAIL PREP",
    subtitle: "Processing & Assembly",
    icon: <Package className="h-6 w-6" />,
    color: "text-teal-600",
    bgColor: "bg-teal-50",
    borderColor: "border-teal-200",
    board: "Production Dashboard",
    steps: [
      { id: "bcc", label: "Run BCC / CASS", description: "Address verification & postal processing", field: "job_meta.bcc_done", required: true },
      { id: "paperwork", label: "Complete Paperwork", description: "PS Form 3602, manifests, etc.", field: "job_meta.paperwork_done", required: true },
      { id: "assemble", label: "Assemble Mailing", description: "Tray, bag, and prepare for drop", field: "job_meta.folder_archived" },
      { id: "archive", label: "Archive Job Folder", description: "Save all files to archive", field: "job_meta.folder_archived", required: true },
    ]
  },
  {
    id: "mailing",
    number: 6,
    title: "MAIL DROP",
    subtitle: "Delivery to USPS",
    icon: <Mail className="h-6 w-6" />,
    color: "text-pink-600",
    bgColor: "bg-pink-50",
    borderColor: "border-pink-200",
    board: "Production Dashboard",
    steps: [
      { id: "transport", label: "Transport to Post Office", description: "Load and deliver to USPS facility", field: "job_meta.drop_off_location" },
      { id: "drop", label: "Drop Off Mailing", description: "Hand off to postal service", field: "job_meta.job_mailed" },
      { id: "confirm", label: "Mark as Mailed", description: "Confirm successful drop", field: "job_meta.job_mailed", required: true },
      { id: "notify", label: "Notify Customer", description: "Send confirmation email", field: "job_meta.customer_notified" },
    ]
  },
  {
    id: "billing",
    number: 7,
    title: "BILLING",
    subtitle: "Invoice & Payment",
    icon: <DollarSign className="h-6 w-6" />,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    board: "Production Dashboard",
    steps: [
      { id: "invoice_update", label: "Update Invoice", description: "Final counts, actual postage", field: "job_meta.invoice_updated", required: true },
      { id: "invoice_send", label: "Email Invoice", description: "Send to customer for payment", field: "job_meta.invoice_emailed", required: true },
      { id: "postage_paid", label: "Postage Payment", description: "Customer pays postage portion", field: "job_meta.paid_postage", required: true },
      { id: "full_paid", label: "Paid in Full", description: "All payments received", field: "job_meta.paid_full", required: true },
    ]
  },
  {
    id: "complete",
    number: 8,
    title: "COMPLETE",
    subtitle: "Job Archived",
    icon: <Archive className="h-6 w-6" />,
    color: "text-gray-600",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
    board: "Done / History",
    steps: [
      { id: "mark_done", label: "Mark Job Done", description: "All checklist items complete", field: "job_meta.done", required: true },
      { id: "archive", label: "Move to Archive", description: "Job moves to completed history", field: "status" },
    ]
  },
]

function StageCard({ stage, isExpanded, onToggle }: { stage: Stage; isExpanded: boolean; onToggle: () => void }) {
  return (
    <div className={cn("rounded-xl border-2 overflow-hidden transition-all", stage.borderColor, stage.bgColor)}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-4 hover:bg-white/50 transition-colors"
      >
        {/* Stage Number */}
        <div className={cn("flex items-center justify-center w-12 h-12 rounded-xl bg-white shadow-sm border", stage.borderColor)}>
          <span className={cn("text-xl font-bold", stage.color)}>{stage.number}</span>
        </div>
        
        {/* Icon & Title */}
        <div className={cn("p-3 rounded-lg bg-white/80", stage.color)}>
          {stage.icon}
        </div>
        
        <div className="flex-1 text-left">
          <h3 className={cn("text-lg font-bold", stage.color)}>{stage.title}</h3>
          <p className="text-sm text-muted-foreground">{stage.subtitle}</p>
        </div>
        
        {/* Board Badge */}
        <span className="px-3 py-1 rounded-full bg-white/80 text-xs font-medium text-muted-foreground border">
          {stage.board}
        </span>
        
        {/* Expand Icon */}
        <div className={cn("p-2 rounded-lg", stage.color)}>
          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </button>
      
      {/* Steps */}
      {isExpanded && (
        <div className="border-t border-white/50 bg-white/30 p-4">
          <div className="space-y-3">
            {stage.steps.map((step, idx) => (
              <div key={step.id} className="flex items-start gap-3">
                {/* Step connector */}
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                    step.required ? "bg-white shadow-sm border-2 " + stage.borderColor + " " + stage.color : "bg-white/60 text-muted-foreground"
                  )}>
                    {idx + 1}
                  </div>
                  {idx < stage.steps.length - 1 && (
                    <div className={cn("w-0.5 h-8 mt-1", step.required ? stage.bgColor.replace("50", "200") : "bg-gray-200")} />
                  )}
                </div>
                
                {/* Step content */}
                <div className="flex-1 pb-2">
                  <div className="flex items-center gap-2">
                    <span className={cn("font-semibold text-sm", step.required ? "text-foreground" : "text-muted-foreground")}>
                      {step.label}
                    </span>
                    {step.required && (
                      <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", stage.bgColor.replace("50", "100"), stage.color)}>
                        REQUIRED
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                  {step.field && (
                    <code className="text-[10px] text-muted-foreground/60 font-mono mt-1 block">
                      {step.field}
                    </code>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function WorkflowPage() {
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set(["quote", "setup", "production", "billing"]))
  
  const toggleStage = (id: string) => {
    setExpandedStages(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }
  
  const expandAll = () => setExpandedStages(new Set(STAGES.map(s => s.id)))
  const collapseAll = () => setExpandedStages(new Set())
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">PostagePlus Workflow</h1>
              <p className="text-muted-foreground mt-1">Complete job lifecycle from quote to completion</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={expandAll}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border hover:bg-gray-50 transition-colors"
              >
                Expand All
              </button>
              <button 
                onClick={collapseAll}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border hover:bg-gray-50 transition-colors"
              >
                Collapse All
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Flow Overview */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Mini flow diagram */}
        <div className="flex items-center justify-between mb-8 px-4 py-6 bg-white rounded-2xl border shadow-sm overflow-x-auto">
          {STAGES.map((stage, idx) => (
            <div key={stage.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", stage.bgColor, stage.color)}>
                  {stage.icon}
                </div>
                <span className="text-[10px] font-medium text-muted-foreground mt-1 whitespace-nowrap">
                  {stage.title}
                </span>
              </div>
              {idx < STAGES.length - 1 && (
                <ArrowRight className="h-4 w-4 text-gray-300 mx-2 shrink-0" />
              )}
            </div>
          ))}
        </div>
        
        {/* Smart Next Step Legend */}
        <div className="mb-8 p-4 bg-white rounded-xl border shadow-sm">
          <h3 className="font-semibold text-sm mb-3">Smart Next Step - Priority Colors</h3>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-red-100 border border-red-200" />
              <span className="text-xs">Missing Customer</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-orange-100 border border-orange-200" />
              <span className="text-xs">No Rep Assigned</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-amber-100 border border-amber-200" />
              <span className="text-xs">No ZD Ticket</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-blue-100 border border-blue-200" />
              <span className="text-xs">No Quantity</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-purple-100 border border-purple-200" />
              <span className="text-xs">No Mail Date</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-gray-100 border border-gray-200" />
              <span className="text-xs">Checklist Item</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-green-100 border border-green-200" />
              <span className="text-xs">All Done!</span>
            </div>
          </div>
        </div>
        
        {/* Stages */}
        <div className="space-y-4">
          {STAGES.map((stage, idx) => (
            <div key={stage.id}>
              <StageCard 
                stage={stage} 
                isExpanded={expandedStages.has(stage.id)}
                onToggle={() => toggleStage(stage.id)}
              />
              
              {/* Arrow between stages */}
              {idx < STAGES.length - 1 && (
                <div className="flex justify-center py-2">
                  <ArrowDown className="h-6 w-6 text-gray-300" />
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Checklist Summary */}
        <div className="mt-12 p-6 bg-white rounded-2xl border shadow-sm">
          <h2 className="text-lg font-bold mb-4">Production Checklist Fields</h2>
          <div className="grid grid-cols-2 gap-6">
            {/* Workflow */}
            <div>
              <h3 className="font-semibold text-sm text-blue-600 mb-2 flex items-center gap-2">
                <Package className="h-4 w-4" /> Workflow
              </h3>
              <div className="space-y-2">
                {[
                  { field: "prints_arrived", label: "Prints Arrived" },
                  { field: "bcc_done", label: "BCC Done" },
                  { field: "paperwork_done", label: "Paperwork Done" },
                  { field: "folder_archived", label: "Folder Archived" },
                  { field: "job_mailed", label: "Job Mailed" },
                ].map(item => (
                  <div key={item.field} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-gray-300" />
                    <span>{item.label}</span>
                    <code className="text-[10px] text-muted-foreground/50 ml-auto">{item.field}</code>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Billing */}
            <div>
              <h3 className="font-semibold text-sm text-emerald-600 mb-2 flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Billing
              </h3>
              <div className="space-y-2">
                {[
                  { field: "invoice_updated", label: "Invoice Updated" },
                  { field: "invoice_emailed", label: "Invoice Emailed" },
                  { field: "paid_postage", label: "Postage Paid" },
                  { field: "paid_full", label: "Paid in Full" },
                ].map(item => (
                  <div key={item.field} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-gray-300" />
                    <span>{item.label}</span>
                    <code className="text-[10px] text-muted-foreground/50 ml-auto">{item.field}</code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
