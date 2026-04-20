'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export interface ActiveDeal {
  id: string
  name: string
  company: string
  stage: string
}

interface SidebarContextValue {
  collapsed: boolean
  mobileOpen: boolean
  sidebarWidth: number
  toggleCollapsed: () => void
  openMobile: () => void
  closeMobile: () => void
  copilotOpen: boolean
  toggleCopilot: () => void
  setCopilotOpen: (open: boolean) => void
  prefillCopilot: (text: string) => void
  copilotPrefill: string | null
  clearCopilotPrefill: () => void
  sendToCopilot: (text: string) => void
  copilotAutoSend: string | null
  clearCopilotAutoSend: () => void
  activeDeal: ActiveDeal | null
  setActiveDeal: (deal: ActiveDeal | null) => void
}

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  mobileOpen: false,
  sidebarWidth: 232,
  toggleCollapsed: () => {},
  openMobile: () => {},
  closeMobile: () => {},
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
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('halvex-sidebar-collapsed') === 'true'
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 900px)').matches
  })
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [copilotPrefill, setCopilotPrefill] = useState<string | null>(null)
  const [copilotAutoSend, setCopilotAutoSend] = useState<string | null>(null)
  const [activeDeal, setActiveDeal] = useState<ActiveDeal | null>(null)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 900px)')
    const update = (matches: boolean) => setIsMobile(matches)
    const onChange = (event: MediaQueryListEvent) => update(event.matches)
    mediaQuery.addEventListener('change', onChange)

    return () => mediaQuery.removeEventListener('change', onChange)
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed(previous => {
      const next = !previous
      window.localStorage.setItem('halvex-sidebar-collapsed', String(next))
      return next
    })
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

  const sidebarWidth = isMobile ? 0 : collapsed ? 76 : 232

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        mobileOpen,
        sidebarWidth,
        toggleCollapsed,
        openMobile: () => setMobileOpen(true),
        closeMobile: () => setMobileOpen(false),
        copilotOpen,
        toggleCopilot: () => setCopilotOpen(previous => !previous),
        setCopilotOpen,
        prefillCopilot,
        copilotPrefill,
        clearCopilotPrefill,
        sendToCopilot,
        copilotAutoSend,
        clearCopilotAutoSend,
        activeDeal,
        setActiveDeal,
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  return useContext(SidebarContext)
}
