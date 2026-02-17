"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { createClient, supabaseClientReady } from "@/lib/supabase/client"
import { useSWRConfig } from "swr"

export type RealtimeStatus = "connecting" | "connected" | "disconnected" | "error"

/**
 * Subscribe to Supabase Realtime changes on key tables.
 * On any change, revalidate matching SWR keys instantly.
 * Returns connection status for the health dashboard.
 */
export function useRealtimeSync() {
  const { mutate } = useSWRConfig()
  const [status, setStatus] = useState<RealtimeStatus>("connecting")
  const [lastEvent, setLastEvent] = useState<string>("")
  const [eventCount, setEventCount] = useState(0)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null)

  const revalidateTable = useCallback((table: string) => {
    // Revalidate all SWR keys that contain this table's API path
    const keyMap: Record<string, string[]> = {
      quotes: ["/api/quotes"],
      customers: ["/api/customers"],
      quote_activity_log: ["/api/activity-log", "/api/system-stats"],
      board_columns: ["/api/board-columns"],
      purchase_orders: ["/api/purchase-orders"],
    }
    const keys = keyMap[table] || []
    for (const key of keys) {
      mutate((k: string) => typeof k === "string" && k.startsWith(key))
    }
  }, [mutate])

  useEffect(() => {
    if (!supabaseClientReady()) {
      setStatus("disconnected")
      return
    }

    const supabase = createClient()
    const channel = supabase
      .channel("app-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "quotes" }, (payload) => {
        setLastEvent(`quotes:${payload.eventType}`)
        setEventCount((c) => c + 1)
        revalidateTable("quotes")
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, (payload) => {
        setLastEvent(`customers:${payload.eventType}`)
        setEventCount((c) => c + 1)
        revalidateTable("customers")
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "quote_activity_log" }, (payload) => {
        setLastEvent(`activity:${payload.eventType}`)
        setEventCount((c) => c + 1)
        revalidateTable("quote_activity_log")
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "board_columns" }, (payload) => {
        setLastEvent(`columns:${payload.eventType}`)
        setEventCount((c) => c + 1)
        revalidateTable("board_columns")
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "purchase_orders" }, (payload) => {
        setLastEvent(`purchase_orders:${payload.eventType}`)
        setEventCount((c) => c + 1)
        revalidateTable("purchase_orders")
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setStatus("connected")
        else if (status === "CHANNEL_ERROR") setStatus("error")
        else if (status === "TIMED_OUT") setStatus("disconnected")
        else setStatus("connecting")
      })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [revalidateTable])

  return { status, lastEvent, eventCount }
}
