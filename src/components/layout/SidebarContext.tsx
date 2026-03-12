'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

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
}

const Ctx = createContext<SidebarCtx>({
  collapsed: false,
  mobileOpen: false,
  toggleCollapsed: () => {},
  openMobile: () => {},
  closeMobile: () => {},
  sidebarWidth: 220,
  aiCollapsed: false,
  toggleAiCollapsed: () => {},
  aiSidebarWidth: 340,
})

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [aiCollapsed, setAiCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored === 'true') setCollapsed(true)

    const storedAi = localStorage.getItem('ai-sidebar-collapsed')
    if (storedAi === 'true') setAiCollapsed(true)

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
      localStorage.setItem('ai-sidebar-collapsed', String(!p))
      return !p
    })
  }

  const sidebarWidth = isMobile ? 0 : collapsed ? 64 : 220
  const aiSidebarWidth = isMobile ? 0 : aiCollapsed ? 48 : 340

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
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useSidebar = () => useContext(Ctx)
