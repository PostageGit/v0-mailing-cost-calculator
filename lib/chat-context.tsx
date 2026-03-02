"use client"

import { createContext, useContext, useCallback, useRef } from "react"

type ChatContextType = {
  sendToChat: (message: string) => void
  openChat: () => void
  registerChat: (send: (msg: string) => void, open: () => void) => void
}

const ChatContext = createContext<ChatContextType>({
  sendToChat: () => {},
  openChat: () => {},
  registerChat: () => {},
})

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const sendRef = useRef<(msg: string) => void>(() => {})
  const openRef = useRef<() => void>(() => {})

  const registerChat = useCallback((send: (msg: string) => void, open: () => void) => {
    sendRef.current = send
    openRef.current = open
  }, [])

  const sendToChat = useCallback((message: string) => {
    openRef.current()
    // Small delay so the chat panel renders before sending
    setTimeout(() => {
      sendRef.current(message)
    }, 300)
  }, [])

  const openChat = useCallback(() => {
    openRef.current()
  }, [])

  return (
    <ChatContext.Provider value={{ sendToChat, openChat, registerChat }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useGlobalChat() {
  return useContext(ChatContext)
}
