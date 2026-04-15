"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"

interface AppConfig {
  simple_mode: boolean
  company_mode: "postage_plus" | "printout"
}

interface AppConfigContextType {
  config: AppConfig
  loading: boolean
  error: string | null
  updateConfig: (updates: Partial<AppConfig>) => Promise<void>
  refetch: () => Promise<void>
}

const defaultConfig: AppConfig = {
  simple_mode: false,
  company_mode: "postage_plus",
}

const AppConfigContext = createContext<AppConfigContextType | null>(null)

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(defaultConfig)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch("/api/app-config")
      if (!res.ok) throw new Error("Failed to fetch config")
      const data = await res.json()
      
      setConfig({
        simple_mode: data.simple_mode === true || data.simple_mode === "true",
        company_mode: data.company_mode || "postage_plus",
      })
    } catch (err) {
      console.error("Error loading app config:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
      // Use defaults on error
      setConfig(defaultConfig)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const updateConfig = useCallback(async (updates: Partial<AppConfig>) => {
    try {
      setError(null)
      const res = await fetch("/api/app-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error("Failed to update config")
      
      // Update local state immediately
      setConfig(prev => ({ ...prev, ...updates }))
    } catch (err) {
      console.error("Error updating app config:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
      throw err
    }
  }, [])

  return (
    <AppConfigContext.Provider value={{ config, loading, error, updateConfig, refetch: fetchConfig }}>
      {children}
    </AppConfigContext.Provider>
  )
}

export function useAppConfig() {
  const context = useContext(AppConfigContext)
  if (!context) {
    throw new Error("useAppConfig must be used within AppConfigProvider")
  }
  return context
}

// Hook specifically for simple_mode - can be used without throwing
export function useSimpleMode() {
  const context = useContext(AppConfigContext)
  return context?.config.simple_mode ?? false
}
