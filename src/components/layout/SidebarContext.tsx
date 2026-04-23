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
  isMobile: boolean
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
  isMobile: false,
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

const COLLAPSED_STORAGE_KEY = 'halvex.sidebar.collapsed'

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true'
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 900px)').matches
  })
  const [isCompactDesktop, setIsCompactDesktop] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 1180px)').matches
  })
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [copilotPrefill, setCopilotPrefill] = useState<string | null>(null)
  const [copilotAutoSend, setCopilotAutoSend] = useState<string | null>(null)
  const [activeDeal, setActiveDeal] = useState<ActiveDeal | null>(null)

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 900px)')
    const compactDesktopQuery = window.matchMedia('(max-width: 1180px)')

    const update = () => {
      const mobile = mobileQuery.matches
      setIsMobile(mobile)
      setIsCompactDesktop(compactDesktopQuery.matches)
      if (!mobile) {
        setMobileOpen(false)
      }
    }
    const onMobileChange = () => update()
    const onCompactChange = () => update()
    update()
    mobileQuery.addEventListener('change', onMobileChange)
    compactDesktopQuery.addEventListener('change', onCompactChange)

    return () => {
      mobileQuery.removeEventListener('change', onMobileChange)
      compactDesktopQuery.removeEventListener('change', onCompactChange)
    }
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed(previous => {
      const next = !previous
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next))
      }
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

  const sidebarWidth = isMobile ? 0 : collapsed ? 84 : isCompactDesktop ? 208 : 232

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        isMobile,
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
