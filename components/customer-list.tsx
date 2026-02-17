"use client"

import { useState, useCallback } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Plus,
  Building2,
  Phone,
  Mail,
  User,
  Download,
  Upload,
  Loader2,
  ChevronRight,
  CheckCircle2,
} from "lucide-react"
import type { Customer, DepartmentColors } from "@/lib/customer-types"
import { CustomerDetail } from "./customer-detail"
import { CustomerImportModal } from "./customer-import"
import { CustomerExportDialog } from "./customer-export-dialog"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function CustomerList() {
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showExport, setShowExport] = useState(false)

  const { data: customers, isLoading } = useSWR<Customer[]>(
    `/api/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`,
    fetcher
  )
  const { data: settings } = useSWR<Record<string, unknown>>("/api/app-settings", fetcher)
  const deptColors = (settings?.department_colors ?? {}) as DepartmentColors

  const handleCreated = useCallback((id: string) => {
    globalMutate((key: string) => typeof key === "string" && key.startsWith("/api/customers"))
    setShowNew(false)
    setSelectedId(id)
  }, [])

  const handleClose = useCallback(() => {
    setSelectedId(null)
    setShowNew(false)
    globalMutate((key: string) => typeof key === "string" && key.startsWith("/api/customers"))
  }, [])

  const handleExport = () => setShowExport(true)

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground text-balance">Customers</h1>
          <p className="text-sm text-muted-foreground text-pretty mt-0.5">
            {customers?.length ?? 0} customer{(customers?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => setShowImport(true)}>
            <Upload className="h-3.5 w-3.5" />
            Import CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" />
            Export QB
          </Button>
          <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => setShowNew(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by company, contact, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !customers?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">No customers yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search ? "Try a different search term" : "Add your first customer to get started"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {customers.map((c) => (
            <Card
              key={c.id}
              className="cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => setSelectedId(c.id)}
            >
              <CardContent className="flex items-center gap-4 py-3 px-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {c.company_name}
                    </p>
                    {c.qbo_synced && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" title={`Synced to QBO${c.qbo_synced_at ? ` on ${new Date(c.qbo_synced_at).toLocaleDateString()}` : ""}`} />
                    )}
                    {c.terms && (
                      <Badge variant="outline" className="text-[9px] font-semibold tracking-wide px-1.5 py-0 shrink-0">
                        {c.terms}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                    {c.contact_name && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {c.contact_name}
                      </span>
                    )}
                    {c.email && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {c.email}
                      </span>
                    )}
                    {c.office_phone && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {c.office_phone}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail / Edit Modal */}
      {(selectedId || showNew) && (
        <CustomerDetail
          customerId={selectedId}
          isNew={showNew}
          deptColors={deptColors}
          onClose={handleClose}
          onCreated={handleCreated}
        />
      )}

      {/* Import Modal */}
      {showImport && (
        <CustomerImportModal
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false)
            globalMutate((key: string) => typeof key === "string" && key.startsWith("/api/customers"))
          }}
        />
      )}

      {/* Export Dialog */}
      <CustomerExportDialog
        open={showExport}
        onClose={() => {
          setShowExport(false)
          globalMutate((key: string) => typeof key === "string" && key.startsWith("/api/customers"))
        }}
      />
    </div>
  )
}
