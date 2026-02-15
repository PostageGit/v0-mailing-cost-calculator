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
  Loader2,
  ChevronRight,
  Factory,
} from "lucide-react"
import type { Vendor } from "@/lib/vendor-types"
import { VendorDetail } from "./vendor-detail"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function VendorList() {
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  const { data: vendors, isLoading } = useSWR<Vendor[]>(
    `/api/vendors${search ? `?search=${encodeURIComponent(search)}` : ""}`,
    fetcher
  )

  const handleCreated = useCallback((id: string) => {
    globalMutate((key: string) => typeof key === "string" && key.startsWith("/api/vendors"))
    setShowNew(false)
    setSelectedId(id)
  }, [])

  const handleClose = useCallback(() => {
    setSelectedId(null)
    setShowNew(false)
    globalMutate((key: string) => typeof key === "string" && key.startsWith("/api/vendors"))
  }, [])

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground text-balance">Vendors</h1>
          <p className="text-sm text-muted-foreground text-pretty mt-0.5">
            {vendors?.length ?? 0} vendor{(vendors?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => setShowNew(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add Vendor
        </Button>
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
      ) : !vendors?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Factory className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">No vendors yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search ? "Try a different search term" : "Add your first vendor to get started"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {vendors.map((v) => (
            <Card
              key={v.id}
              className="cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => setSelectedId(v.id)}
            >
              <CardContent className="flex items-center gap-4 py-3 px-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-amber-500/10 text-amber-600 flex-shrink-0">
                  <Factory className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {v.company_name}
                    </p>
                    {v.terms && (
                      <Badge variant="outline" className="text-[9px] font-semibold tracking-wide px-1.5 py-0 shrink-0">
                        {v.terms}
                      </Badge>
                    )}
                    {v.quoting_contacts.length > 0 && (
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0">
                        {v.quoting_contacts.length} quoting contact{v.quoting_contacts.length !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                    {v.contact_name && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" /> {v.contact_name}
                      </span>
                    )}
                    {v.email && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {v.email}
                      </span>
                    )}
                    {v.office_phone && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {v.office_phone}
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
        <VendorDetail
          vendorId={selectedId}
          isNew={showNew}
          onClose={handleClose}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
