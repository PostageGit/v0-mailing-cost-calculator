"use client"

import { useState } from "react"
import useSWR from "swr"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, ExternalLink, Building2, MapPin, FileText, DollarSign, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Organization {
  ein: number
  strein: string
  name: string
  sub_name: string
  city: string
  state: string
  ntee_code: string
  subseccd: number
}

interface SearchResponse {
  total_results: number
  num_pages: number
  cur_page: number
  organizations: Organization[]
}

interface OrganizationDetail {
  organization: Organization & {
    address: string
    zipcode: string
  }
  filings_with_data: Filing[]
  filings_without_data: Filing[]
}

interface Filing {
  ein: number
  tax_prd: number
  tax_prd_yr: number
  formtype: number
  pdf_url: string | null
  totrevenue?: number
  totfuncexpns?: number
  totassetsend?: number
  totliabend?: number
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch")
  return res.json()
}

const formatCurrency = (amount: number | undefined) => {
  if (amount === undefined || amount === null) return "N/A"
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount)
}

const formatEin = (ein: number | string | undefined, strein?: string): string => {
  if (strein) return strein
  if (!ein) return "N/A"
  const einStr = ein.toString().padStart(9, "0")
  return `${einStr.slice(0, 2)}-${einStr.slice(2)}`
}

const NTEE_CATEGORIES: Record<string, string> = {
  A: "Arts, Culture & Humanities",
  B: "Education",
  C: "Environment",
  D: "Animal-Related",
  E: "Health Care",
  F: "Mental Health & Crisis",
  G: "Disease/Disorder",
  H: "Medical Research",
  I: "Crime & Legal",
  J: "Employment",
  K: "Food, Agriculture",
  L: "Housing & Shelter",
  M: "Public Safety",
  N: "Recreation & Sports",
  O: "Youth Development",
  P: "Human Services",
  Q: "International",
  R: "Civil Rights",
  S: "Community Improvement",
  T: "Philanthropy",
  U: "Science & Technology",
  V: "Social Science",
  W: "Public Policy",
  X: "Religion-Related",
  Y: "Mutual/Membership",
  Z: "Unknown",
}

export function NonprofitLookup() {
  const [searchQuery, setSearchQuery] = useState("")
  const [submittedQuery, setSubmittedQuery] = useState("")
  const [selectedEin, setSelectedEin] = useState<number | null>(null)
  const [stateFilter, setStateFilter] = useState("")

  const searchUrl = submittedQuery
    ? `/api/nonprofit/search?q=${encodeURIComponent(submittedQuery)}${stateFilter ? `&state=${stateFilter}` : ""}`
    : null

  const { data: searchData, isLoading: searchLoading, error: searchError } = useSWR<SearchResponse>(
    searchUrl,
    fetcher,
    { revalidateOnFocus: false }
  )

  const { data: orgDetail, isLoading: detailLoading } = useSWR<OrganizationDetail>(
    selectedEin ? `/api/nonprofit/${selectedEin}` : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSelectedEin(null)
    setSubmittedQuery(searchQuery.trim())
  }

  const latestFiling = orgDetail?.filings_with_data?.[0]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Nonprofit Status Lookup</h2>
        <p className="text-sm text-muted-foreground">
          Search the IRS database of 1.8+ million tax-exempt organizations via ProPublica Nonprofit Explorer.
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or EIN (e.g., Red Cross, 53-0196605)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Input
          placeholder="State (e.g., NY)"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value.toUpperCase().slice(0, 2))}
          className="w-full sm:w-20"
        />
        <Button type="submit" disabled={!searchQuery.trim() || searchLoading}>
          {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </form>

      {searchError && (
        <div className="text-sm text-destructive">Error searching. Please try again.</div>
      )}

      {/* Results */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Search Results List */}
        {searchData && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Found {searchData.total_results.toLocaleString()} organizations
              {searchData.num_pages > 1 && ` (showing page ${searchData.cur_page + 1} of ${searchData.num_pages})`}
            </div>
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
              {searchData.organizations.map((org) => (
                <button
                  key={org.ein}
                  onClick={() => setSelectedEin(org.ein)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg border transition-colors",
                    selectedEin === org.ein
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card hover:bg-secondary/50 border-border"
                  )}
                >
                  <div className="font-medium text-sm">{org.name}</div>
                  {org.sub_name && <div className="text-xs opacity-70">{org.sub_name}</div>}
                  <div className="flex items-center gap-2 mt-1 text-xs opacity-70">
                    <span className="font-mono">EIN: {formatEin(org.ein, org.strein)}</span>
                    {org.city && org.state && <span>• {org.city}, {org.state}</span>}
                    {org.ntee_code && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {org.ntee_code}
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Organization Detail */}
        {selectedEin && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Organization Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              {detailLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : orgDetail ? (
                <div className="space-y-4">
                  {/* Basic Info */}
                  <div>
                    <h3 className="font-semibold">{orgDetail.organization.name}</h3>
                    {orgDetail.organization.sub_name && (
                      <div className="text-sm text-muted-foreground">{orgDetail.organization.sub_name}</div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">EIN</div>
                      <div className="font-mono">{formatEin(orgDetail.organization.ein, orgDetail.organization.strein)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Tax Status</div>
                      <Badge variant="secondary">501(c)({orgDetail.organization.subseccd})</Badge>
                    </div>
                  </div>

                  {orgDetail.organization.address && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        {orgDetail.organization.address}<br />
                        {orgDetail.organization.city}, {orgDetail.organization.state} {orgDetail.organization.zipcode}
                      </div>
                    </div>
                  )}

                  {orgDetail.organization.ntee_code && (
                    <div>
                      <div className="text-xs text-muted-foreground">Category</div>
                      <div className="text-sm">
                        {NTEE_CATEGORIES[orgDetail.organization.ntee_code[0]] || "Unknown"} ({orgDetail.organization.ntee_code})
                      </div>
                    </div>
                  )}

                  {/* Latest Filing Financials */}
                  {latestFiling && (
                    <div className="pt-3 border-t">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Latest Filing ({latestFiling.tax_prd_yr})</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="p-2 rounded bg-secondary/50">
                          <div className="text-xs text-muted-foreground">Revenue</div>
                          <div className="font-medium">{formatCurrency(latestFiling.totrevenue)}</div>
                        </div>
                        <div className="p-2 rounded bg-secondary/50">
                          <div className="text-xs text-muted-foreground">Expenses</div>
                          <div className="font-medium">{formatCurrency(latestFiling.totfuncexpns)}</div>
                        </div>
                        <div className="p-2 rounded bg-secondary/50">
                          <div className="text-xs text-muted-foreground">Assets</div>
                          <div className="font-medium">{formatCurrency(latestFiling.totassetsend)}</div>
                        </div>
                        <div className="p-2 rounded bg-secondary/50">
                          <div className="text-xs text-muted-foreground">Liabilities</div>
                          <div className="font-medium">{formatCurrency(latestFiling.totliabend)}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Links */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <a
                      href={`https://projects.propublica.org/nonprofits/organizations/${orgDetail.organization.ein}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View on ProPublica
                    </a>
                    {latestFiling?.pdf_url && (
                      <a
                        href={latestFiling.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <FileText className="h-3 w-3" />
                        Download 990 PDF
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Select an organization to view details</div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Attribution */}
      <div className="text-[10px] text-muted-foreground">
        Data provided by <a href="https://projects.propublica.org/nonprofits/" target="_blank" rel="noopener noreferrer" className="underline">ProPublica Nonprofit Explorer</a>. 
        Sources: IRS Exempt Organizations Business Master File, IRS Annual Extract of Tax-Exempt Organization Financial Data.
      </div>
    </div>
  )
}
