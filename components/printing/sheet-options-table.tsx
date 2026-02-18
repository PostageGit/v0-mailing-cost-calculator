"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency, SPECIALTY_SHEET_SIZES } from "@/lib/printing-pricing"
import type { SheetOptionRow } from "@/lib/printing-types"

interface SheetOptionsTableProps {
  options: SheetOptionRow[]
  onSelectSheet: (option: SheetOptionRow) => void
  selectedSize?: string
}

export function SheetOptionsTable({ options, onSelectSheet, selectedSize }: SheetOptionsTableProps) {
  if (options.length === 0) return null

  return (
    <div className="mt-6 pt-6 border-t border-border">
      <h2 className="text-lg font-bold text-foreground mb-4">Available Sheet Options</h2>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold text-xs uppercase tracking-wider">Size</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wider">Ups</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wider">Sheets</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wider">Total Cuts</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wider">Price (No Tax)</TableHead>
              <TableHead className="w-24">
                <span className="sr-only">Select</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {options.map((option) => {
              const isSelected = option.size === selectedSize
              return (
                <TableRow
                  key={option.size}
                  className={isSelected ? "bg-primary/5 border-primary/20" : "hover:bg-muted/30"}
                >
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      {option.size}
                      {SPECIALTY_SHEET_SIZES.has(option.size) && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-normal text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700">
                          Large Format
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>{option.ups}</TableCell>
                  <TableCell>{option.sheets.toLocaleString()}</TableCell>
                  <TableCell>{option.totalCuts}</TableCell>
                  <TableCell className="font-mono font-semibold">{formatCurrency(option.price)}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => onSelectSheet(option)}
                      className="text-xs"
                    >
                      {isSelected ? "Selected" : "Select"}
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
