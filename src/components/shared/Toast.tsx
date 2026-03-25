'use client'

import * as RadixToast from '@radix-ui/react-toast'
import { createContext, useCallback, useContext, useState, useRef } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const TOAST_CONFIG: Record<
  ToastType,
  { color: string; bg: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }> }
> = {
  success: {
    color: '#22C55E',
    bg: 'rgba(34, 197, 94, 0.12)',
    Icon: CheckCircle,
  },
  error: {
    color: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.12)',
    Icon: AlertCircle,
  },
  warning: {
    color: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.12)',
    Icon: AlertTriangle,
  },
  info: {
    color: '#6366F1',
    bg: 'rgba(99, 102, 241, 0.12)',
    Icon: Info,
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual Toast item
// ─────────────────────────────────────────────────────────────────────────────

function ToastItem({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  const config = TOAST_CONFIG[item.type]
  const { Icon } = config

  return (
    <RadixToast.Root
      duration={4000}
      onOpenChange={(open) => {
        if (!open) onRemove(item.id)
      }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '12px 14px',
        borderRadius: '8px',
        background: 'rgba(14, 10, 35, 0.82)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7)',
        minWidth: '280px',
        maxWidth: '380px',
        animation: 'slide-in-up 0.2s ease-out',
      }}
    >
      {/* Colored left strip */}
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '6px',
          backgroundColor: config.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={15} strokeWidth={2} color={config.color} />
      </div>

      {/* Message */}
      <RadixToast.Description
        style={{
          flex: 1,
          fontSize: '13px',
          color: '#EBEBEB',
          lineHeight: 1.5,
          paddingTop: '7px',
          margin: 0,
        }}
      >
        {item.message}
      </RadixToast.Description>

      {/* Close */}
      <RadixToast.Close asChild>
        <button
          style={{
            width: '20px',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#555555',
            flexShrink: 0,
            marginTop: '6px',
            transition: 'background-color 100ms ease, color 100ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)'
            e.currentTarget.style.color = '#EBEBEB'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = '#555555'
          }}
          aria-label="Dismiss"
        >
          <X size={12} strokeWidth={2} />
        </button>
      </RadixToast.Close>
    </RadixToast.Root>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Toaster (Provider + Viewport)
// ─────────────────────────────────────────────────────────────────────────────

export function Toaster({ children }: { children?: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counterRef = useRef(0)

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast-${++counterRef.current}`
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      <RadixToast.Provider swipeDirection="right">
        {children}

        {toasts.map((item) => (
          <ToastItem key={item.id} item={item} onRemove={removeToast} />
        ))}

        <RadixToast.Viewport
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 9999,
            outline: 'none',
            listStyle: 'none',
            margin: 0,
            padding: 0,
          }}
        />
      </RadixToast.Provider>
    </ToastContext.Provider>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

const noop = () => {}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Return a noop during SSR / outside provider — prevents build errors
    return { toast: noop }
  }
  return ctx
}
