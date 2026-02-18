"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Package, CalendarDays } from "lucide-react"
import type { CustomerProvidedState } from "@/hooks/use-customer-provided"

interface Props {
  cp: CustomerProvidedState
  /** What noun to display, e.g. "Envelopes", "Paper", "Booklets" */
  itemNoun: string
  vendors?: Array<{ id: string; company_name: string }> | null
}

export function CustomerProvidedSection({ cp, itemNoun, vendors }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Checkbox
          id={`cp-${itemNoun}`}
          checked={cp.enabled}
          onCheckedChange={(checked) => cp.setEnabled(checked === true)}
        />
        <label
          htmlFor={`cp-${itemNoun}`}
          className="text-sm font-medium text-foreground cursor-pointer"
        >
          Customer Provided
        </label>
      </div>

      {cp.enabled && (
        <div className="rounded-xl border-2 border-amber-400/60 bg-amber-50 dark:bg-amber-950/20 p-4 flex flex-col gap-4">
          {/* Big pill */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-400/20 border border-amber-400/40">
              <Package className="h-4 w-4 text-amber-700 dark:text-amber-400" />
              <span className="text-sm font-bold text-amber-800 dark:text-amber-300 tracking-tight">
                Customer Provides {itemNoun}
              </span>
            </div>
          </div>

          {/* Expected date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-amber-800 dark:text-amber-300">
              Expected Date
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  value={cp.date}
                  onChange={(e) => cp.setDate(e.target.value)}
                  className="pl-8 text-sm h-9"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-9 text-xs font-medium shrink-0"
                onClick={() =>
                  cp.setDate(new Date().toISOString().slice(0, 10))
                }
              >
                Today
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-9 text-xs font-medium shrink-0"
                onClick={() => {
                  const d = new Date()
                  d.setDate(d.getDate() + 1)
                  cp.setDate(d.toISOString().slice(0, 10))
                }}
              >
                Tomorrow
              </Button>
            </div>
          </div>

          {/* Vendor / Source */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-amber-800 dark:text-amber-300">
              Vendor / Source
            </label>
            <Select
              value={cp.vendor}
              onValueChange={(val) => {
                cp.setVendor(val)
                if (val !== "__custom__") cp.setCustomVendor("")
              }}
            >
              <SelectTrigger className="text-sm h-9">
                <SelectValue placeholder="Select vendor or enter custom" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__custom__">
                  Type custom name...
                </SelectItem>
                {vendors?.map((vnd) => (
                  <SelectItem key={vnd.id} value={vnd.id}>
                    {vnd.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cp.vendor === "__custom__" && (
              <Input
                type="text"
                placeholder="Enter vendor or source name"
                value={cp.customVendor}
                onChange={(e) => cp.setCustomVendor(e.target.value)}
                className="text-sm h-9 mt-1"
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
