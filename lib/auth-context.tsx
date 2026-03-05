"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"

export interface BrokerUser {
  id: string
  username: string
  companyName: string
  displayName: string
  role: "admin" | "broker"
  canAccessCalculator: boolean
  canAccessChat: boolean
}

interface AuthContextType {
  user: BrokerUser | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  isAdmin: boolean
  isBroker: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<BrokerUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check for existing session on mount
  useEffect(() => {
    const stored = localStorage.getItem("broker_user")
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        localStorage.removeItem("broker_user")
      }
    }
    setIsLoading(false)
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Login failed" }
      }

      setUser(data.user)
      localStorage.setItem("broker_user", JSON.stringify(data.user))
      return { success: true }
    } catch (err) {
      console.error("[v0] Login error:", err)
      return { success: false, error: "Network error" }
    }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem("broker_user")
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      login,
      logout,
      isAdmin: user?.role === "admin",
      isBroker: user?.role === "broker",
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
