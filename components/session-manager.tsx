"use client"

/**
 * SessionManager — three responsibilities, all client-side:
 *
 * 1. Idle auto-logout: after 5 minutes with no user activity, revoke this
 *    session (DELETE /api/gate) and bounce to the /gate unlock screen. This
 *    mirrors the server's 5-minute idle window so the browser visibly logs
 *    out instead of silently going stale.
 *
 * 2. "Active Logins" button + dialog: lists every current login (IP,
 *    device, when it started / was last seen) and lets you revoke any one.
 *
 * 3. "Lock now" button: immediately revokes THIS session and returns to the
 *    unlock screen.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Users, LogOut, Loader2, ShieldX, Monitor, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

// Keep in sync with IDLE_TIMEOUT_MS in lib/site-gate.ts (5 minutes).
const IDLE_MS = 5 * 60 * 1000

type GateSession = {
  id: string
  ip: string | null
  user_agent: string | null
  label: string | null
  created_at: string
  last_seen_at: string
  revoked: boolean
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/** Turn a raw UA string into something readable. */
function deviceLabel(ua: string | null): string {
  if (!ua) return "Unknown device"
  const os =
    /Windows/.test(ua) ? "Windows" :
    /iPhone|iPad|iOS/.test(ua) ? "iOS" :
    /Mac OS X|Macintosh/.test(ua) ? "macOS" :
    /Android/.test(ua) ? "Android" :
    /Linux/.test(ua) ? "Linux" : "Device"
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Safari\//.test(ua) ? "Safari" : "Browser"
  return `${browser} on ${os}`
}

export function SessionManager({
  sidebarOpen,
  horizontal = false,
}: {
  sidebarOpen: boolean
  /** When true, render the two triggers as compact inline buttons suitable
   *  for a top header/toolbar (used on pages without the app sidebar, e.g.
   *  /tools/calc). Defaults to the vertical sidebar layout. */
  horizontal?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [sessions, setSessions] = useState<GateSession[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [locking, setLocking] = useState(false)

  // --- Idle auto-logout -------------------------------------------------
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const logout = useCallback(async () => {
    try {
      await fetch("/api/gate", { method: "DELETE" })
    } catch {
      /* ignore — redirect regardless */
    }
    window.location.href = "/gate"
  }, [])

  useEffect(() => {
    const reset = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
      idleTimer.current = setTimeout(logout, IDLE_MS)
    }
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"]
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [logout])

  // --- Session list -----------------------------------------------------
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/gate/sessions", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setSessions(Array.isArray(data?.sessions) ? data.sessions : [])
        setCurrentId(data?.currentSessionId ?? null)
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const revoke = useCallback(
    async (id: string) => {
      setRevoking(id)
      try {
        const res = await fetch("/api/gate/sessions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        })
        if (res.ok) {
          // If you revoked your own session, you're out too.
          if (id === currentId) {
            window.location.href = "/gate"
            return
          }
          await load()
        }
      } finally {
        setRevoking(null)
      }
    },
    [currentId, load],
  )

  const lockNow = useCallback(async () => {
    setLocking(true)
    await logout()
  }, [logout])

  return (
    <>
      <div
        className={cn(
          horizontal ? "flex flex-row items-center gap-2" : "flex flex-col gap-1",
          !horizontal && !sidebarOpen && "items-center",
        )}
      >
        <button
          onClick={() => setOpen(true)}
          className={cn(
            "flex items-center gap-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all",
            horizontal
              ? "h-9 px-3 text-sm border border-border"
              : cn("gap-2.5 w-full", sidebarOpen ? "min-h-[40px] px-3 py-2 text-sm" : "h-10 justify-center"),
          )}
          aria-label="Active logins"
        >
          <Users className="h-4 w-4 shrink-0" />
          {(sidebarOpen || horizontal) && <span>Active Logins</span>}
        </button>
        <button
          onClick={lockNow}
          disabled={locking}
          className={cn(
            "flex items-center gap-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all disabled:opacity-50",
            horizontal
              ? "h-9 px-3 text-sm border border-border"
              : cn("gap-2.5 w-full", sidebarOpen ? "min-h-[40px] px-3 py-2 text-sm" : "h-10 justify-center"),
          )}
          aria-label="Lock now"
        >
          {locking ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <LogOut className="h-4 w-4 shrink-0" />}
          {(sidebarOpen || horizontal) && <span>Lock Now</span>}
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Active Logins
            </DialogTitle>
            <DialogDescription>
              Everyone currently signed in with the site password. Sessions log out automatically after 5 minutes of
              inactivity. Revoke any login to force it out.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">No active logins.</div>
          ) : (
            <ScrollArea className="max-h-[50vh]">
              <ul className="flex flex-col gap-2 pr-2">
                {sessions.map((s) => {
                  const isCurrent = s.id === currentId
                  return (
                    <li
                      key={s.id}
                      className={cn(
                        "flex items-start justify-between gap-3 rounded-lg border p-3",
                        isCurrent ? "border-foreground/40 bg-muted/40" : "border-border",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Monitor className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm font-semibold truncate">{deviceLabel(s.user_agent)}</span>
                          {isCurrent && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              This device
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground font-mono">
                          IP: {s.ip || "unknown"}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Active {timeAgo(s.last_seen_at)}
                          <span className="opacity-40">·</span>
                          in since {timeAgo(s.created_at)}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={isCurrent ? "outline" : "destructive"}
                        onClick={() => revoke(s.id)}
                        disabled={revoking === s.id}
                        className="shrink-0"
                      >
                        {revoking === s.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <ShieldX className="h-3.5 w-3.5 mr-1" />
                            {isCurrent ? "Log out" : "Revoke"}
                          </>
                        )}
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
