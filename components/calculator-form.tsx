"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Mail, Hash, Layers, Users, Copy, Printer } from "lucide-react"
import type { MailPiece, MailingClass, MailingInputs } from "@/lib/pricing"

interface CalculatorFormProps {
  inputs: MailingInputs
  onInputChange: (inputs: Partial<MailingInputs>) => void
}

export function CalculatorForm({ inputs, onInputChange }: CalculatorFormProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Mail Piece */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="mailPiece" className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Mail className="h-4 w-4 text-primary" />
            Mail Piece
          </Label>
          <Select
            value={inputs.mailPiece}
            onValueChange={(value: string) => onInputChange({ mailPiece: value as MailPiece })}
          >
            <SelectTrigger id="mailPiece" className="h-11 bg-card text-card-foreground border-border">
              <SelectValue placeholder="Select mail piece type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Postcard">Postcard</SelectItem>
              <SelectItem value="Letter">Letter / Envelope</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quantity */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="quantity" className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Hash className="h-4 w-4 text-primary" />
            Quantity
          </Label>
          <Input
            id="quantity"
            type="number"
            placeholder="Enter quantity"
            min={1}
            className="h-11 bg-card text-card-foreground border-border font-mono"
            value={inputs.quantity || ""}
            onChange={(e) => onInputChange({ quantity: parseInt(e.target.value) || 0 })}
          />
        </div>

        {/* Mailing Class */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="mailingClass" className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Layers className="h-4 w-4 text-primary" />
            Mailing Class
          </Label>
          <Select
            value={inputs.mailingClass}
            onValueChange={(value: string) => onInputChange({ mailingClass: value as MailingClass })}
          >
            <SelectTrigger id="mailingClass" className="h-11 bg-card text-card-foreground border-border">
              <SelectValue placeholder="Select mailing class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1st Class">1st Class</SelectItem>
              <SelectItem value="Standard">Standard</SelectItem>
              <SelectItem value="Non-Profit">Non-Profit</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Split Mailing */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="splitMailing" className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Copy className="h-4 w-4 text-primary" />
            Split Mailing Into
          </Label>
          <Input
            id="splitMailing"
            type="number"
            placeholder="Number of splits (optional)"
            min={0}
            className="h-11 bg-card text-card-foreground border-border font-mono"
            value={inputs.splitMailingInto || ""}
            onChange={(e) => onInputChange({ splitMailingInto: parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>

      {/* Checkboxes row */}
      <div className="flex flex-wrap items-center gap-6 pt-1">
        <div className="flex items-center gap-2.5">
          <Checkbox
            id="matchingNames"
            checked={inputs.matchingNames}
            onCheckedChange={(checked) => onInputChange({ matchingNames: checked === true })}
          />
          <Label
            htmlFor="matchingNames"
            className="flex items-center gap-1.5 text-sm font-medium text-foreground cursor-pointer"
          >
            <Users className="h-4 w-4 text-muted-foreground" />
            Matching Names
          </Label>
        </div>

        <div className="flex items-center gap-2.5">
          <Checkbox
            id="includePrinting"
            checked={inputs.includePrinting}
            onCheckedChange={(checked) => onInputChange({ includePrinting: checked === true })}
          />
          <Label
            htmlFor="includePrinting"
            className="flex items-center gap-1.5 text-sm font-medium text-foreground cursor-pointer"
          >
            <Printer className="h-4 w-4 text-muted-foreground" />
            Include Printing / Stamping
          </Label>
        </div>
      </div>
    </div>
  )
}
