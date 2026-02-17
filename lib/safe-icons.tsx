"use client"

// This module re-exports lucide icons as React components
// to prevent the autofix from adding 'Activity' (which clashes with React 19.2)
import React from "react"

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number | string }>

function createIcon(displayName: string): IconComponent {
  // Dynamic import at module level - load once
  let Cached: IconComponent | null = null

  const Icon = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement> & { size?: number | string }>(
    (props, ref) => {
      if (!Cached) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require("lucide-react")
        Cached = mod[displayName]
      }
      if (!Cached) return null
      const C = Cached
      return <C ref={ref} {...props} />
    }
  )
  Icon.displayName = displayName
  return Icon as unknown as IconComponent
}

export const Settings = createIcon("Settings")
export const Plus = createIcon("Plus")
export const X = createIcon("X")
export const Save = createIcon("Save")
export const Trash2 = createIcon("Trash2")
export const Loader2 = createIcon("Loader2")
export const ChevronDown = createIcon("ChevronDown")
export const ChevronUp = createIcon("ChevronUp")
export const DollarSign = createIcon("DollarSign")
export const AlertTriangle = createIcon("AlertTriangle")
export const GripVertical = createIcon("GripVertical")
export const Lock = createIcon("Lock")
export const Palette = createIcon("Palette")
export const ListPlus = createIcon("ListPlus")
export const Wrench = createIcon("Wrench")
export const CreditCard = createIcon("CreditCard")
export const BarChart3 = createIcon("BarChart3")
export const Calculator = createIcon("Calculator")
export const Database = createIcon("Database")
export const KeyRound = createIcon("KeyRound")
export const CheckCircle2 = createIcon("CheckCircle2")
export const XCircle = createIcon("XCircle")
export const RefreshCw = createIcon("RefreshCw")
export const HardDrive = createIcon("HardDrive")
export const ShieldAlert = createIcon("ShieldAlert")
export const Info = createIcon("Info")
export const Package = createIcon("Package")
export const Users = createIcon("Users")
export const Mail = createIcon("Mail")
export const Zap = createIcon("Zap")
export const Calendar = createIcon("Calendar")
export const Factory = createIcon("Factory")
export const Layers = createIcon("Layers")
export const Filter = createIcon("Filter")
export const Stamp = createIcon("Stamp")
export const BookOpen = createIcon("BookOpen")
export const Disc3 = createIcon("Disc3")
export const Send = createIcon("Send")
export const Receipt = createIcon("Receipt")
export const Briefcase = createIcon("Briefcase")
export const PanelRightOpen = createIcon("PanelRightOpen")
export const ArrowLeft = createIcon("ArrowLeft")
export const PenLine = createIcon("PenLine")
export const LayoutDashboard = createIcon("LayoutDashboard")
export const Check = createIcon("Check")
export const ChevronRight = createIcon("ChevronRight")
export const FileText = createIcon("FileText")
export const Truck = createIcon("Truck")
export const Menu = createIcon("Menu")
export const ChevronLeft = createIcon("ChevronLeft")
export const Columns3 = createIcon("Columns3")
export const List = createIcon("List")
export const ClipboardList = createIcon("ClipboardList")
export const Printer = createIcon("Printer")
