"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

// ── Data Model ──────────────────────────────────────────
interface Node {
  id: string
  label: string
  description: string
  group: string
  files: string[]
}

interface Edge {
  from: string
  to: string
  label?: string
}

const GROUPS: Record<string, { label: string; color: string; textColor: string; borderColor: string }> = {
  ui:       { label: "UI / Pages",         color: "bg-blue-50 dark:bg-blue-950/30",   textColor: "text-blue-700 dark:text-blue-300",   borderColor: "border-blue-200 dark:border-blue-800" },
  calc:     { label: "Calculators",        color: "bg-amber-50 dark:bg-amber-950/30", textColor: "text-amber-700 dark:text-amber-300", borderColor: "border-amber-200 dark:border-amber-800" },
  engine:   { label: "Pricing Engines",    color: "bg-emerald-50 dark:bg-emerald-950/30", textColor: "text-emerald-700 dark:text-emerald-300", borderColor: "border-emerald-200 dark:border-emerald-800" },
  context:  { label: "State & Context",    color: "bg-rose-50 dark:bg-rose-950/30",   textColor: "text-rose-700 dark:text-rose-300",   borderColor: "border-rose-200 dark:border-rose-800" },
  config:   { label: "Configuration",      color: "bg-violet-50 dark:bg-violet-950/30", textColor: "text-violet-700 dark:text-violet-300", borderColor: "border-violet-200 dark:border-violet-800" },
  api:      { label: "API Routes",         color: "bg-cyan-50 dark:bg-cyan-950/30",   textColor: "text-cyan-700 dark:text-cyan-300",   borderColor: "border-cyan-200 dark:border-cyan-800" },
  data:     { label: "Data Management",    color: "bg-orange-50 dark:bg-orange-950/30", textColor: "text-orange-700 dark:text-orange-300", borderColor: "border-orange-200 dark:border-orange-800" },
  output:   { label: "Output & Export",    color: "bg-stone-50 dark:bg-stone-950/30", textColor: "text-stone-700 dark:text-stone-300", borderColor: "border-stone-200 dark:border-stone-800" },
}

const NODES: Node[] = [
  // UI Layer
  { id: "app-shell",    label: "App Shell",          group: "ui",   description: "Main page with sidebar navigation, section routing (Quotes Board, Jobs Board, Deliveries, Billing, Customers, Vendors, Invoices, OHP Bids, Export to QB). Contains the job wizard flow.",                       files: ["app/page.tsx", "app/layout.tsx"] },
  { id: "mail-planner", label: "Mail Piece Planner",  group: "ui",   description: "Step 1 of job creation. User selects outer piece type (Envelope, Postcard, Booklet, Self-Mailer, etc.), adds inserts, sets USPS shape/class/service, enters quantity. Drives which calculator steps appear.",    files: ["components/mail-piece-planner.tsx", "components/mail-piece-diagram.tsx"] },
  { id: "quote-sidebar", label: "Quote Sidebar",      group: "ui",   description: "Right panel showing live quote line items, category totals, weight estimate, per-piece cost, and grand total. Includes copy-to-clipboard, PDF export, and finalize actions.",                                  files: ["components/quote-sidebar.tsx", "components/finalize-quote-modal.tsx"] },
  { id: "kanban",       label: "Kanban Board",        group: "ui",   description: "Drag-and-drop board for managing quotes and active jobs through pipeline stages. Supports board view, list view, and sidebar preview. Columns are customizable.",                                              files: ["components/kanban-board.tsx"] },
  { id: "settings",     label: "Settings Panel",      group: "ui",   description: "Tabbed settings for mail class rates, envelope pricing, addressing/tabbing brackets, finishing options, score-fold config, paper weights/thickness, and supplier management.",                                  files: ["components/mail-class-settings.tsx", "components/paper-weights-settings.tsx", "components/finishing-calculators-settings.tsx", "components/suppliers-settings.tsx", "components/pad/pad-settings.tsx"] },
  { id: "dashboards",   label: "Dashboards",          group: "ui",   description: "Billing Dashboard (revenue, payments, aging), Deliveries Dashboard (tracking, scheduling), OHP Bids Dashboard (out-of-house vendor bid management).",                                                          files: ["components/billing-dashboard.tsx", "components/deliveries-dashboard.tsx", "components/ohp-bids-dashboard.tsx"] },

  // Calculators
  { id: "printing-calc", label: "Printing Calculator", group: "calc", description: "Flat printing: paper selection, sheet size optimization, color mode (BW/1-1/1-2/2-2), bleed margins, imposition. Includes fold/score finishing with HTML calculator bridge. Lamination add-on.",             files: ["components/printing/printing-calculator.tsx", "components/printing/printing-form.tsx", "components/printing/fold-finish-section.tsx", "components/printing/sheet-options-table.tsx", "components/printing/sheet-layout-svg.tsx", "components/printing/order-summary.tsx", "components/printing/price-breakdown.tsx"] },
  { id: "booklet-calc",  label: "Fold & Staple Calculator",  group: "calc", description: "Saddle-stitch fold & staple: cover + inside pages with separate paper stocks, page count, trim sizes, cover scoring, quantity breaks.",                                                                            files: ["components/booklet/booklet-calculator.tsx", "components/booklet/booklet-form.tsx", "components/booklet/booklet-details.tsx", "components/booklet/booklet-layout-svg.tsx", "components/booklet/booklet-order-summary.tsx"] },
  { id: "spiral-calc",   label: "Spiral Calculator",   group: "calc", description: "Spiral/coil binding: cover + interior pages, multiple paper stocks, binding supply cost, tab inserts.",                                                                                                       files: ["components/spiral/spiral-calculator.tsx", "components/spiral/spiral-form.tsx", "components/spiral/spiral-details.tsx", "components/spiral/spiral-layout-svg.tsx"] },
  { id: "perfect-calc",  label: "Perfect Bind Calc",   group: "calc", description: "Perfect (glue) binding: cover + text block, spine width estimation from page count + paper caliper, case/soft cover options.",                                                                                files: ["components/perfect/perfect-calculator.tsx", "components/perfect/perfect-form.tsx", "components/perfect/perfect-details.tsx", "components/perfect/perfect-layout-svg.tsx"] },
  { id: "pad-calc",      label: "Pad Calculator",      group: "calc", description: "Notepad finishing: sheets per pad, chipboard backing, shrink wrap, padding compound pricing.",                                                                                                                files: ["components/pad/pad-calculator.tsx", "components/pad/pad-form.tsx", "components/pad/pad-details.tsx"] },
  { id: "envelope-calc", label: "Envelope Calculator",  group: "calc", description: "Envelope pricing: type (#10, 6x9, 9x12, A-series), window/non-window, quantity-based per-piece pricing from settings.",                                                                                     files: ["components/envelope-tab.tsx"] },
  { id: "postage-calc",  label: "USPS Postage Calc",   group: "calc", description: "Postage rate lookup by shape (Letter, Flat, Parcel), weight tier, mail class (Marketing, First Class, Non-Profit), service level.",                                                                           files: ["components/usps-postage-calculator.tsx"] },
  { id: "service-builder", label: "Service Builder",   group: "calc", description: "Auto-detects required mailing services (addressing, tabbing, ink-jetting, inserting, metering) from mail piece configuration. Users add/remove optional services. Tiered bracket pricing.",                    files: ["components/service-builder.tsx"] },
  { id: "vendor-bids",   label: "Vendor Bid Panel",    group: "calc", description: "OHP (out-of-house printing) bid collection: attach vendor quotes, compare prices, select winning bid. Links to vendor/facility database.",                                                                    files: ["components/vendor-bid-panel.tsx", "components/vendor-bid-tab.tsx"] },
  { id: "items-calc",    label: "Items / Misc",        group: "calc", description: "Manual line items: add-on charges, customer-supplied items, misc fees with custom descriptions and amounts.",                                                                                                 files: ["components/items-tab.tsx"] },

  // Pricing Engines
  { id: "printing-engine", label: "Printing Pricing",  group: "engine", description: "Paper options (13 stocks with available sizes), sheet-size-to-price mapping, click rates by color mode, imposition calculations, paper cost lookup. Configurable via settings.",                             files: ["lib/printing-pricing.ts", "lib/printing-types.ts"] },
  { id: "booklet-engine",  label: "Fold & Staple Pricing",   group: "engine", description: "Cover + inside pricing with separate paper stocks, quantity break tiers, binding charges, scoring add-on. Supports cardstock detection.",                                                                   files: ["lib/booklet-pricing.ts", "lib/booklet-types.ts"] },
  { id: "spiral-engine",   label: "Spiral Pricing",    group: "engine", description: "Coil binding pricing: cover + pages, binding supply cost per unit, tab insert charges.",                                                                                                                    files: ["lib/spiral-pricing.ts", "lib/spiral-types.ts"] },
  { id: "perfect-engine",  label: "Perfect Pricing",   group: "engine", description: "Perfect binding pricing: cover + text block, spine calculation from thickness data, case binding surcharge.",                                                                                                files: ["lib/perfect-pricing.ts", "lib/perfect-types.ts"] },
  { id: "pad-engine",      label: "Pad Pricing",       group: "engine", description: "Padding pricing: per-pad assembly, chipboard, shrink-wrap, compound.",                                                                                                                                     files: ["lib/pad-pricing.ts", "lib/pad-types.ts"] },
  { id: "envelope-engine", label: "Envelope Pricing",  group: "engine", description: "Envelope per-piece pricing lookup from configurable rate table by envelope type.",                                                                                                                          files: ["lib/envelope-pricing.ts"] },
  { id: "fold-engine",     label: "Fold / Score Engine", group: "engine", description: "Score-and-fold pricing by paper category (text, cover, cardstock), fold type, sheet size. Maps paper names to fold keys. Validates size constraints. HTML calculator bridge for complex lookups.",          files: ["lib/finishing-fold-engine.ts", "lib/finishing-fold-data.ts", "lib/calculators/fold-score-bridge.ts", "lib/finishing-calculator-types.ts"] },
  { id: "lamination-engine", label: "Lamination Pricing", group: "engine", description: "Lamination cost by film type, sheet size, and quantity.",                                                                                                                                                files: ["lib/lamination-pricing.ts"] },
  { id: "service-engine",  label: "Service Catalog",   group: "engine", description: "Mailing service definitions: addressing (letter/flat brackets), tabbing brackets, ink-jetting, inserting, metering, hand-work. Auto-detection rules based on mail piece context. Tiered bracket pricing.",   files: ["lib/service-catalog.ts"] },
  { id: "usps-engine",     label: "USPS Rate Tables",  group: "engine", description: "USPS rate data by shape, class, service, and weight tier. Supports Marketing Mail, First Class, Non-Profit.",                                                                                              files: ["lib/usps-rates.ts"] },
  { id: "paper-weights",   label: "Paper Weights",     group: "engine", description: "Per-piece weight estimation from configurable lbs-per-1000-sheets at a reference sheet size. Area-ratio math for any custom piece dimension. Envelope weights. Thickness data for shipping.",                files: ["lib/paper-weights.ts"] },

  // State / Context
  { id: "quote-ctx",    label: "Quote Context",       group: "context", description: "Global quote state: line items (with categories), project name, customer, quantity, auto-save to Supabase, activity logging, PDF/text export triggers, skipped steps tracking.",                             files: ["lib/quote-context.tsx", "lib/quote-types.ts"] },
  { id: "mailing-ctx",  label: "Mailing Context",     group: "context", description: "Mail piece state: pieces array (type, dimensions, paper, fold, production route), USPS shape/class/service, quantity. Derives which calculator steps are needed. Snapshot for save/restore.",                files: ["lib/mailing-context.tsx"] },
  { id: "pricing-cfg",  label: "Pricing Config",      group: "config",  description: "Runtime pricing configuration loaded from Supabase app_settings. Includes: paper prices, click rates, finishing options, score-fold config, envelope settings, addressing/tabbing brackets, paper weights/thickness, envelope weights/thickness.", files: ["lib/pricing-config.ts", "lib/use-pricing-config.ts"] },

  // API Layer
  { id: "api-quotes",   label: "Quotes API",          group: "api",  description: "CRUD for quotes: create, read, update, delete. Stores line items, mailing snapshot, job metadata. Activity log sub-route.",                                                                                   files: ["app/api/quotes/route.ts", "app/api/quotes/[id]/route.ts", "app/api/quotes/[id]/log/route.ts"] },
  { id: "api-customers", label: "Customers API",      group: "api",  description: "Customer management: create, list, search, update, delete. Contacts sub-resource. CSV import/export. Delivery history.",                                                                                      files: ["app/api/customers/route.ts", "app/api/customers/[id]/route.ts", "app/api/customers/[id]/contacts/route.ts", "app/api/customers/import/route.ts", "app/api/customers/export/route.ts"] },
  { id: "api-vendors",  label: "Vendors API",         group: "api",  description: "Vendor/supplier management: facilities, capabilities. Vendor bid CRUD with pricing breakdowns.",                                                                                                               files: ["app/api/vendors/route.ts", "app/api/vendors/[id]/route.ts", "app/api/vendor-bids/route.ts", "app/api/vendor-bids/[id]/route.ts"] },
  { id: "api-settings", label: "App Settings API",    group: "api",  description: "Global app settings store: mail class rates, paper prices, click rates, finishing config, addressing/tabbing brackets, paper weights, envelope weights. Single JSON row in Supabase.",                          files: ["app/api/app-settings/route.ts", "app/api/mail-class-settings/route.ts", "app/api/finishing-calculators/route.ts", "app/api/finishing-global-rates/route.ts"] },
  { id: "api-invoices", label: "Invoices API",        group: "api",  description: "Invoice generation from finalized quotes. PDF export, QuickBooks CSV export, payment tracking.",                                                                                                               files: ["app/api/invoices/route.ts", "app/api/invoices/[id]/route.ts", "app/api/invoices/export/route.ts"] },
  { id: "api-board",    label: "Board Columns API",   group: "api",  description: "Kanban board column configuration: create, reorder, rename, delete pipeline stages.",                                                                                                                         files: ["app/api/board-columns/route.ts", "app/api/board-columns/[id]/route.ts", "app/api/board-columns/reorder/route.ts"] },
  { id: "api-fold-calc", label: "Fold Calculator API", group: "api", description: "Server-side HTML fold/score calculator execution for complex finishing price lookups.",                                                                                                                        files: ["app/api/fold-calc/route.ts"] },

  // Data Management
  { id: "customers-ui", label: "Customer Manager",    group: "data", description: "Customer list, search, detail views, contact management, CSV import. Combobox search for quote assignment.",                                                                                                   files: ["components/customer-list.tsx", "components/customer-detail.tsx", "components/customer-search-combobox.tsx", "components/customer-import.tsx"] },
  { id: "vendors-ui",   label: "Vendor Manager",      group: "data", description: "Vendor directory with facilities, capabilities, contact info. Used by OHP bid system.",                                                                                                                       files: ["components/vendor-list.tsx", "components/vendor-detail.tsx"] },
  { id: "invoices-ui",  label: "Invoice Manager",     group: "data", description: "Invoice list, status tracking, payment recording. QuickBooks export.",                                                                                                                                        files: ["components/invoice-list.tsx"] },

  // Output
  { id: "quote-text",   label: "Quote Text Builder",  group: "output", description: "Generates formatted quote text for clipboard/email: customer info, line items by category, totals, per-piece breakdown.",                                                                                   files: ["lib/build-quote-text.ts"] },
  { id: "quote-pdf",    label: "Quote PDF Builder",   group: "output", description: "Generates PDF quote document with company branding, itemized line items, category subtotals, grand total.",                                                                                                  files: ["lib/build-quote-pdf.ts"] },
  { id: "qb-export",    label: "QuickBooks Export",   group: "output", description: "Exports finalized invoices as QuickBooks-compatible CSV for accounting import.",                                                                                                                             files: ["lib/qb-export.ts", "components/export-to-qb.tsx"] },

  // Database
  { id: "supabase",     label: "Supabase (DB)",       group: "api",  description: "PostgreSQL database via Supabase: quotes, customers, contacts, vendors, facilities, invoices, board_columns, app_settings, vendor_bids, bid_prices, items, deliveries, job_files, team members.",              files: ["lib/supabase/client.ts", "lib/supabase/server.ts", "lib/supabase/middleware.ts"] },
]

const EDGES: Edge[] = [
  // App shell routes to sections
  { from: "app-shell", to: "kanban",       label: "Quotes / Jobs Board" },
  { from: "app-shell", to: "dashboards",   label: "Billing, Deliveries, OHP" },
  { from: "app-shell", to: "customers-ui", label: "Customer mgmt" },
  { from: "app-shell", to: "vendors-ui",   label: "Vendor mgmt" },
  { from: "app-shell", to: "invoices-ui",  label: "Invoice mgmt" },
  { from: "app-shell", to: "settings",     label: "Settings" },

  // Job wizard flow
  { from: "kanban",        to: "mail-planner",    label: "New Job / Edit Quote" },
  { from: "mail-planner",  to: "envelope-calc",   label: "if envelope needed" },
  { from: "mail-planner",  to: "postage-calc",    label: "always" },
  { from: "mail-planner",  to: "service-builder", label: "always" },
  { from: "mail-planner",  to: "printing-calc",   label: "if flat pieces" },
  { from: "mail-planner",  to: "booklet-calc",    label: "if booklet pieces" },
  { from: "mail-planner",  to: "spiral-calc",     label: "if spiral pieces" },
  { from: "mail-planner",  to: "perfect-calc",    label: "if perfect bound" },
  { from: "mail-planner",  to: "pad-calc",        label: "if pad pieces" },
  { from: "mail-planner",  to: "vendor-bids",     label: "if OHP pieces" },
  { from: "mail-planner",  to: "items-calc",      label: "misc items" },

  // Calculators -> Engines
  { from: "printing-calc",  to: "printing-engine",   label: "prices" },
  { from: "printing-calc",  to: "fold-engine",       label: "fold/score" },
  { from: "printing-calc",  to: "lamination-engine", label: "lamination" },
  { from: "booklet-calc",   to: "booklet-engine",    label: "prices" },
  { from: "spiral-calc",    to: "spiral-engine",     label: "prices" },
  { from: "perfect-calc",   to: "perfect-engine",    label: "prices" },
  { from: "pad-calc",       to: "pad-engine",        label: "prices" },
  { from: "envelope-calc",  to: "envelope-engine",   label: "prices" },
  { from: "postage-calc",   to: "usps-engine",       label: "rates" },
  { from: "service-builder", to: "service-engine",   label: "auto-detect + pricing" },

  // Calculators -> Quote
  { from: "printing-calc",   to: "quote-ctx",  label: "add line items" },
  { from: "booklet-calc",    to: "quote-ctx",  label: "add line items" },
  { from: "spiral-calc",     to: "quote-ctx",  label: "add line items" },
  { from: "perfect-calc",    to: "quote-ctx",  label: "add line items" },
  { from: "pad-calc",        to: "quote-ctx",  label: "add line items" },
  { from: "envelope-calc",   to: "quote-ctx",  label: "add line items" },
  { from: "postage-calc",    to: "quote-ctx",  label: "add line items" },
  { from: "service-builder", to: "quote-ctx",  label: "add line items" },
  { from: "vendor-bids",     to: "quote-ctx",  label: "add line items" },
  { from: "items-calc",      to: "quote-ctx",  label: "add line items" },

  // Context feeds sidebar
  { from: "quote-ctx",   to: "quote-sidebar", label: "live totals" },
  { from: "mailing-ctx", to: "mail-planner",  label: "piece state" },
  { from: "mailing-ctx", to: "service-builder", label: "auto-detect context" },
  { from: "mailing-ctx", to: "quote-ctx",     label: "snapshot for save" },

  // Config feeds engines
  { from: "pricing-cfg", to: "printing-engine",  label: "paper prices, clicks" },
  { from: "pricing-cfg", to: "booklet-engine",   label: "prices" },
  { from: "pricing-cfg", to: "envelope-engine",  label: "envelope rates" },
  { from: "pricing-cfg", to: "service-engine",   label: "bracket rates" },
  { from: "pricing-cfg", to: "fold-engine",      label: "score-fold config" },
  { from: "pricing-cfg", to: "paper-weights",    label: "weight + thickness" },
  { from: "pricing-cfg", to: "usps-engine",      label: "rate overrides" },

  // Weight system
  { from: "paper-weights", to: "quote-sidebar", label: "weight estimate" },

  // Settings -> Config
  { from: "settings",   to: "api-settings", label: "save config" },
  { from: "api-settings", to: "pricing-cfg", label: "load config" },

  // API -> Supabase
  { from: "api-quotes",    to: "supabase", label: "quotes table" },
  { from: "api-customers", to: "supabase", label: "customers table" },
  { from: "api-vendors",   to: "supabase", label: "vendors table" },
  { from: "api-settings",  to: "supabase", label: "app_settings table" },
  { from: "api-invoices",  to: "supabase", label: "invoices table" },
  { from: "api-board",     to: "supabase", label: "board_columns table" },
  { from: "api-fold-calc", to: "fold-engine", label: "server calc" },

  // Quote -> API
  { from: "quote-ctx",  to: "api-quotes", label: "auto-save" },
  { from: "kanban",     to: "api-quotes", label: "CRUD" },
  { from: "kanban",     to: "api-board",  label: "columns" },

  // Output
  { from: "quote-sidebar", to: "quote-text", label: "copy text" },
  { from: "quote-sidebar", to: "quote-pdf",  label: "PDF export" },
  { from: "invoices-ui",   to: "qb-export",  label: "QB CSV" },
  { from: "invoices-ui",   to: "api-invoices", label: "CRUD" },
]

// ── Component ───────────────────────────────────────────

export default function ArchitecturePage() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [filterGroup, setFilterGroup] = useState<string | null>(null)

  const node = selectedNode ? NODES.find(n => n.id === selectedNode) : null
  const connectedEdges = selectedNode
    ? EDGES.filter(e => e.from === selectedNode || e.to === selectedNode)
    : []
  const connectedNodeIds = new Set(
    connectedEdges.flatMap(e => [e.from, e.to])
  )

  const filteredNodes = filterGroup
    ? NODES.filter(n => n.group === filterGroup)
    : NODES

  const groupOrder = ["ui", "calc", "engine", "context", "config", "api", "data", "output"]
  const groupedNodes = groupOrder
    .filter(g => !filterGroup || g === filterGroup)
    .map(g => ({
      ...GROUPS[g],
      groupKey: g,
      nodes: filteredNodes.filter(n => n.group === g),
    }))
    .filter(g => g.nodes.length > 0)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-foreground">PostFlow Architecture</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {NODES.length} modules, {EDGES.length} connections
            </p>
          </div>
          <a
            href="/"
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border hover:bg-secondary"
          >
            Back to App
          </a>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Group filter chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => { setFilterGroup(null); setSelectedNode(null) }}
            className={cn(
              "text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all",
              !filterGroup
                ? "bg-foreground text-background border-foreground"
                : "bg-card text-foreground border-border hover:bg-secondary"
            )}
          >
            All Modules
          </button>
          {groupOrder.map(g => {
            const grp = GROUPS[g]
            return (
              <button
                key={g}
                onClick={() => { setFilterGroup(filterGroup === g ? null : g); setSelectedNode(null) }}
                className={cn(
                  "text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all",
                  filterGroup === g
                    ? `${grp.color} ${grp.textColor} ${grp.borderColor}`
                    : "bg-card text-foreground border-border hover:bg-secondary"
                )}
              >
                {grp.label}
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          {/* Left: Node Grid */}
          <div className="space-y-6">
            {groupedNodes.map(group => (
              <div key={group.groupKey}>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className={cn("h-2.5 w-2.5 rounded-full", group.color, group.borderColor, "border")} />
                  <h2 className={cn("text-xs font-bold uppercase tracking-wider", group.textColor)}>
                    {group.label}
                  </h2>
                  <span className="text-[10px] text-muted-foreground">({group.nodes.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {group.nodes.map(n => {
                    const isSelected = selectedNode === n.id
                    const isConnected = selectedNode && connectedNodeIds.has(n.id)
                    const isDimmed = selectedNode && !isSelected && !isConnected

                    return (
                      <button
                        key={n.id}
                        onClick={() => setSelectedNode(isSelected ? null : n.id)}
                        className={cn(
                          "text-left p-3 rounded-xl border transition-all",
                          group.color,
                          isSelected
                            ? `${group.borderColor} ring-2 ring-offset-1 ring-current shadow-lg`
                            : isConnected
                              ? `${group.borderColor} shadow-sm`
                              : `${group.borderColor} border-opacity-50`,
                          isDimmed && "opacity-30",
                          "hover:shadow-md"
                        )}
                      >
                        <div className={cn("text-xs font-bold leading-tight", group.textColor)}>
                          {n.label}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                          {n.description.slice(0, 80)}{n.description.length > 80 ? "..." : ""}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Right: Detail Panel */}
          <div className="lg:sticky lg:top-20 lg:self-start space-y-4">
            {node ? (
              <>
                {/* Node detail */}
                <div className={cn("rounded-2xl border p-5", GROUPS[node.group].color, GROUPS[node.group].borderColor)}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md",
                      GROUPS[node.group].color, GROUPS[node.group].textColor, GROUPS[node.group].borderColor, "border"
                    )}>
                      {GROUPS[node.group].label}
                    </span>
                  </div>
                  <h3 className={cn("text-base font-bold mb-2", GROUPS[node.group].textColor)}>
                    {node.label}
                  </h3>
                  <p className="text-xs text-foreground/70 leading-relaxed mb-4">
                    {node.description}
                  </p>
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Files</span>
                    <div className="mt-1 flex flex-col gap-0.5">
                      {node.files.map(f => (
                        <span key={f} className="text-[11px] font-mono text-muted-foreground">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Connections */}
                {connectedEdges.length > 0 && (
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <h4 className="text-xs font-bold text-foreground mb-3">
                      Connections ({connectedEdges.length})
                    </h4>
                    <div className="space-y-1.5">
                      {connectedEdges.map((e, i) => {
                        const isOutgoing = e.from === selectedNode
                        const otherId = isOutgoing ? e.to : e.from
                        const other = NODES.find(n => n.id === otherId)
                        if (!other) return null
                        const otherGroup = GROUPS[other.group]

                        return (
                          <button
                            key={i}
                            onClick={() => setSelectedNode(otherId)}
                            className="w-full flex items-center gap-2 text-left px-2.5 py-1.5 rounded-lg hover:bg-secondary/50 transition-colors"
                          >
                            <span className={cn(
                              "text-[10px] font-mono shrink-0 w-4 text-center",
                              isOutgoing ? "text-emerald-500" : "text-blue-500"
                            )}>
                              {isOutgoing ? "\u2192" : "\u2190"}
                            </span>
                            <span className={cn("text-xs font-semibold shrink-0", otherGroup.textColor)}>
                              {other.label}
                            </span>
                            {e.label && (
                              <span className="text-[10px] text-muted-foreground truncate">
                                {e.label}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-8 text-center">
                <p className="text-sm font-semibold text-foreground/60 mb-1">
                  Select a module
                </p>
                <p className="text-xs text-muted-foreground">
                  Click any module to see its description, source files, and connections to other parts of the system.
                </p>
              </div>
            )}

            {/* Legend */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5">
                System Flow
              </h4>
              <div className="space-y-2 text-[11px] text-muted-foreground leading-relaxed">
                <p><span className="font-bold text-foreground">1.</span> User creates a job via <span className="font-semibold text-foreground">Mail Piece Planner</span></p>
                <p><span className="font-bold text-foreground">2.</span> Planner determines which <span className="font-semibold text-foreground">Calculators</span> are needed</p>
                <p><span className="font-bold text-foreground">3.</span> Each calculator uses a <span className="font-semibold text-foreground">Pricing Engine</span> and pushes line items to <span className="font-semibold text-foreground">Quote Context</span></p>
                <p><span className="font-bold text-foreground">4.</span> <span className="font-semibold text-foreground">Quote Sidebar</span> shows live totals + weight estimate</p>
                <p><span className="font-bold text-foreground">5.</span> All config is editable in <span className="font-semibold text-foreground">Settings</span> and persisted to <span className="font-semibold text-foreground">Supabase</span></p>
                <p><span className="font-bold text-foreground">6.</span> Finalized quotes become invoices, exportable to <span className="font-semibold text-foreground">QuickBooks</span></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
