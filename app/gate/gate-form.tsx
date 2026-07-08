"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, AlertCircle } from "lucide-react"

export function GateForm({ next }: { next?: string }) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        // Hard navigation so middleware re-evaluates with the new cookie.
        const dest = next && next.startsWith("/") ? next : "/"
        window.location.assign(dest)
        return
      }
      const data = await res.json().catch(() => ({}))
      setError(data?.error || "Incorrect password")
      setLoading(false)
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="site-password" className="text-sm font-medium text-foreground">
          Password
        </label>
        <Input
          id="site-password"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            if (error) setError(null)
          }}
          placeholder="Enter site password"
          aria-invalid={error ? true : undefined}
          disabled={loading}
        />
        {error && (
          <p className="flex items-center gap-1.5 text-sm text-destructive mt-0.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}
      </div>

      <Button type="submit" disabled={loading || !password} className="w-full">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Unlocking…
          </>
        ) : (
          "Unlock"
        )}
      </Button>
    </form>
  )
}
