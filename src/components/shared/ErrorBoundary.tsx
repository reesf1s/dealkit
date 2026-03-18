'use client'

import React from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught:', error.message, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '200px',
          padding: '32px',
          gap: '16px',
          color: 'var(--text-secondary)',
        }}>
          <div style={{ fontSize: '24px' }}>Something went wrong</div>
          <p style={{ maxWidth: '400px', textAlign: 'center', lineHeight: 1.5 }}>
            An unexpected error occurred. Try refreshing the page.
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--card-bg)',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
