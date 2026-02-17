"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { COMPANY } from "@/lib/company"
import { Mail, Send, Check, AlertCircle, Loader2, ExternalLink, Info } from "lucide-react"
import { toast } from "sonner"

export function EmailSettingsTab() {
  const [testEmail, setTestEmail] = useState("")
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null)
  const [errorMsg, setErrorMsg] = useState("")

  const handleSendTest = async () => {
    if (!testEmail.trim() || !testEmail.includes("@")) {
      toast.error("Enter a valid email address")
      return
    }
    setTesting(true)
    setTestResult(null)
    setErrorMsg("")
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "invoice",
          to: testEmail.trim(),
          data: {
            invoiceNumber: 999,
            customerName: "Test Customer",
            contactName: "Test",
            total: 1250.00,
            terms: "Net 30",
            items: [
              { label: "Printing -- 500 pcs Full Color", description: "4/4 80# Gloss, 12x18", amount: 450.00 },
              { label: "Postage -- First Class Letter", description: "500 pieces", amount: 350.00 },
              { label: "Labor -- Tabbing & Sorting", description: "Hand assembly", amount: 200.00 },
              { label: "Envelopes -- #10 Window", description: "500 pcs", amount: 250.00 },
            ],
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setTestResult("error")
        setErrorMsg(data.error || "Failed to send")
        toast.error(data.error || "Test email failed")
      } else {
        setTestResult("success")
        toast.success(`Test email sent to ${testEmail}`)
      }
    } catch {
      setTestResult("error")
      setErrorMsg("Network error")
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 py-2">
      {/* Overview */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Email Configuration</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Send invoices and quotes directly to customers from within the app.
          Emails are sent via Resend with your company branding.
        </p>
      </div>

      {/* Status card */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Provider</span>
          <Badge variant="outline" className="text-[10px] font-semibold gap-1">
            <Mail className="h-3 w-3" /> Resend
          </Badge>
        </div>
        <div className="flex flex-col gap-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">From Name</span>
            <span className="font-medium text-foreground">{COMPANY.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Reply-To</span>
            <span className="font-medium text-foreground">{COMPANY.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">From Address</span>
            <span className="font-medium text-muted-foreground">
              Set via RESEND_FROM_DOMAIN env var
            </span>
          </div>
        </div>
      </div>

      {/* Setup guide */}
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-4">
        <div className="flex items-start gap-2.5">
          <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex flex-col gap-2 text-xs">
            <p className="font-semibold text-foreground">Setup Required</p>
            <p className="text-muted-foreground leading-relaxed">
              To send emails, you need a <strong>RESEND_API_KEY</strong> environment variable.
              Optionally set <strong>RESEND_FROM_DOMAIN</strong> for a custom sender domain.
            </p>
            <ol className="list-decimal ml-4 text-muted-foreground leading-relaxed space-y-1">
              <li>Create a free account at <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5">resend.com <ExternalLink className="h-2.5 w-2.5" /></a></li>
              <li>Get your API key from the dashboard</li>
              <li>Add <code className="bg-secondary px-1 py-0.5 rounded text-foreground">RESEND_API_KEY</code> in the Vars section of the sidebar</li>
              <li>Optional: Add and verify your domain for custom sender address</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Test email */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="text-xs font-semibold text-foreground mb-2">Send Test Email</h4>
        <p className="text-[11px] text-muted-foreground mb-3">
          Sends a sample invoice email to verify your configuration is working correctly.
        </p>
        <div className="flex items-center gap-2">
          <Input
            type="email"
            placeholder="your@email.com"
            value={testEmail}
            onChange={(e) => { setTestEmail(e.target.value); setTestResult(null) }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSendTest() }}
            className="h-9 text-sm rounded-lg flex-1"
          />
          <Button
            size="sm"
            onClick={handleSendTest}
            disabled={testing || !testEmail.trim()}
            className="h-9 text-sm gap-1.5 rounded-lg bg-foreground text-background hover:bg-foreground/90 font-semibold shrink-0 px-4"
          >
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send Test
          </Button>
        </div>
        {testResult === "success" && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 mt-2">
            <Check className="h-3.5 w-3.5" /> Test email sent successfully! Check your inbox.
          </div>
        )}
        {testResult === "error" && (
          <div className="flex items-center gap-1.5 text-xs text-destructive mt-2">
            <AlertCircle className="h-3.5 w-3.5" /> {errorMsg || "Failed to send test email."}
          </div>
        )}
      </div>

      {/* Email templates info */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="text-xs font-semibold text-foreground mb-2">Email Templates</h4>
        <div className="flex flex-col gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30">
            <Badge variant="outline" className="text-[10px] shrink-0">Invoice</Badge>
            <span>Professional branded invoice with line items, totals, and payment terms</span>
          </div>
          <div className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30">
            <Badge variant="outline" className="text-[10px] shrink-0">Quote</Badge>
            <span>Quote/estimate presentation with project details and pricing breakdown</span>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Templates use {COMPANY.name} branding with company address and contact information.
        </p>
      </div>
    </div>
  )
}
