"use client"

import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { ChatBubble } from "@/components/chat-bubble"

// Pages where the chat bubble should NOT appear
const HIDDEN_ROUTES = ["/login", "/broker-chat"]

export function ConditionalChatBubble() {
  const pathname = usePathname()
  const { user } = useAuth()

  // Hide on login, broker-chat (has its own inline chat), or for broker users
  if (HIDDEN_ROUTES.includes(pathname)) return null
  if (user && user.role === "broker") return null

  return <ChatBubble />
}
