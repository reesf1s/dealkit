'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

interface ConfirmModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  onConfirm: () => void
  confirmLabel?: string
  destructive?: boolean
}

export function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmLabel = 'Confirm',
  destructive = false,
}: ConfirmModalProps) {
  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'var(--border-default)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 500,
            animation: 'fade-in 0.15s ease-out',
          }}
        />

        {/* Content */}
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 501,
            width: '100%',
            maxWidth: '400px',
            background: 'var(--surface-1)',
            border: '1px solid var(--border-default)',
            borderRadius: '10px',
            padding: '24px',
            boxShadow: '0 8px 32px #dddddd',
            animation: 'scale-in 0.15s ease-out',
            outline: 'none',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
            <Dialog.Title
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
                margin: 0,
              }}
            >
              {title}
            </Dialog.Title>

            <Dialog.Close asChild>
              <button
                style={{
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-tertiary)',
                  flexShrink: 0,
                  marginTop: '-2px',
                  transition: 'background-color 100ms ease, color 100ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--surface-2)'
                  e.currentTarget.style.color = '#1a1a1a'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = '#9b9a97'
                }}
                aria-label="Close"
              >
                <X size={14} strokeWidth={2} />
              </button>
            </Dialog.Close>
          </div>

          {/* Description */}
          <Dialog.Description
            style={{
              fontSize: '13px',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              margin: '0 0 24px',
            }}
          >
            {description}
          </Dialog.Description>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Dialog.Close asChild>
              <button
                style={{
                  height: '32px',
                  padding: '0 14px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--border-default)',
                  cursor: 'pointer',
                  transition: 'background-color 100ms ease, color 100ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#eeeeee'
                  e.currentTarget.style.color = '#1a1a1a'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--surface-2)'
                  e.currentTarget.style.color = '#787774'
                }}
              >
                Cancel
              </button>
            </Dialog.Close>

            <button
              onClick={handleConfirm}
              style={{
                height: '32px',
                padding: '0 14px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#fff',
                backgroundColor: destructive ? '#e03e3e' : '#1a1a1a',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = destructive ? '#c73232' : '#2d2b28'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = destructive ? '#e03e3e' : '#1a1a1a'
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
