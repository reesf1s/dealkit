'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

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
  // AI sidebar
  aiCollapsed: boolean
  toggleAiCollapsed: () => void
  aiSidebarWidth: number
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
  aiCollapsed: true,
  toggleAiCollapsed: () => {},
  aiSidebarWidth: 0,
  activeDeal: null,
  setActiveDeal: () => {},
})

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [aiCollapsed, setAiCollapsed] = useState(true)
  const [activeDeal, setActiveDeal] = useState<ActiveDeal | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored === 'true') setCollapsed(true)

    const storedAi = localStorage.getItem('ai-bar-expanded')
    if (storedAi === 'true') setAiCollapsed(false)

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

  const toggleAiCollapsed = () => {
    setAiCollapsed(p => {
      localStorage.setItem('ai-bar-expanded', String(p)) // store whether it WAS expanded (now toggling to collapsed)
      return !p
    })
  }

  const sidebarWidth = isMobile ? 0 : collapsed ? 64 : 220
  const aiSidebarWidth = 0

  return (
    <Ctx.Provider value={{
      collapsed,
      mobileOpen,
      toggleCollapsed,
      openMobile: () => setMobileOpen(true),
      closeMobile: () => setMobileOpen(false),
      sidebarWidth,
      aiCollapsed,
      toggleAiCollapsed,
      aiSidebarWidth,
      activeDeal,
      setActiveDeal,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useSidebar = () => useContext(Ctx)
