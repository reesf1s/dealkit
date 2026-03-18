'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

export interface ActiveDeal {
  id: string
  name: string
  company: string
  stage: string
}

interface SidebarCtx {
  collapsed: boolean
  mobileOpen: boolean
  toggleCollapsed: () => void
  openMobile: () => void
  closeMobile: () => void
  sidebarWidth: number
  // Copilot panel
  copilotOpen: boolean
  toggleCopilot: () => void
  setCopilotOpen: (open: boolean) => void
  // Prefill copilot input and open panel
  prefillCopilot: (text: string) => void
  copilotPrefill: string | null
  clearCopilotPrefill: () => void
  // Auto-send a message through the copilot (bypasses prefill, submits immediately)
  sendToCopilot: (text: string) => void
  copilotAutoSend: string | null
  clearCopilotAutoSend: () => void
  // Active deal context — set by deal detail page so AI chat knows what you're looking at
  activeDeal: ActiveDeal | null
  setActiveDeal: (deal: ActiveDeal | null) => void
}

const Ctx = createContext<SidebarCtx>({
  collapsed: false,
  mobileOpen: false,
  toggleCollapsed: () => {},
  openMobile: () => {},
  closeMobile: () => {},
  sidebarWidth: 220,
  copilotOpen: false,
  toggleCopilot: () => {},
  setCopilotOpen: () => {},
  prefillCopilot: () => {},
  copilotPrefill: null,
  clearCopilotPrefill: () => {},
  sendToCopilot: () => {},
  copilotAutoSend: null,
  clearCopilotAutoSend: () => {},
  activeDeal: null,
  setActiveDeal: () => {},
})

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [copilotPrefill, setCopilotPrefill] = useState<string | null>(null)
  const [copilotAutoSend, setCopilotAutoSend] = useState<string | null>(null)
  const [activeDeal, setActiveDeal] = useState<ActiveDeal | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored === 'true') setCollapsed(true)

    const mq = window.matchMedia('(max-width: 768px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const toggleCollapsed = () => {
    setCollapsed(p => {
      localStorage.setItem('sidebar-collapsed', String(!p))
      return !p
    })
  }

  const toggleCopilot = useCallback(() => {
    setCopilotOpen(p => !p)
  }, [])

  const prefillCopilot = useCallback((text: string) => {
    setCopilotPrefill(text)
    setCopilotOpen(true)
  }, [])

  const clearCopilotPrefill = useCallback(() => {
    setCopilotPrefill(null)
  }, [])

  const sendToCopilot = useCallback((text: string) => {
    setCopilotAutoSend(text)
    setCopilotOpen(true)
  }, [])

  const clearCopilotAutoSend = useCallback(() => {
    setCopilotAutoSend(null)
  }, [])

  const sidebarWidth = isMobile ? 0 : collapsed ? 64 : 220

  return (
    <Ctx.Provider value={{
      collapsed,
      mobileOpen,
      toggleCollapsed,
      openMobile: () => setMobileOpen(true),
      closeMobile: () => setMobileOpen(false),
      sidebarWidth,
      copilotOpen,
      toggleCopilot,
      setCopilotOpen,
      prefillCopilot,
      copilotPrefill,
      clearCopilotPrefill,
      sendToCopilot,
      copilotAutoSend,
      clearCopilotAutoSend,
      activeDeal,
      setActiveDeal,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useSidebar = () => useContext(Ctx)
