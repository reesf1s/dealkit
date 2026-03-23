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
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
            background: 'rgba(20,20,20,0.85)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '24px',
            boxShadow: '0 16px 48px rgba(0, 0, 0, 0.8)',
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
                color: '#EBEBEB',
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
                  color: '#888888',
                  flexShrink: 0,
                  marginTop: '-2px',
                  transition: 'background-color 100ms ease, color 100ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)'
                  e.currentTarget.style.color = '#EBEBEB'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = '#888888'
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
              color: '#888888',
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
                  color: '#888888',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  cursor: 'pointer',
                  transition: 'background-color 100ms ease, color 100ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'
                  e.currentTarget.style.color = '#EBEBEB'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)'
                  e.currentTarget.style.color = '#888888'
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
                backgroundColor: destructive ? '#EF4444' : '#6366F1',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = destructive ? '#DC2626' : '#4F46E5'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = destructive ? '#EF4444' : '#6366F1'
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
