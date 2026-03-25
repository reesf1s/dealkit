'use client'

import React, { useState } from 'react'

const TOOL_LABELS: Record<string, { pending: string; done: string }> = {
  // 5 consolidated tools
  get_deal: { pending: 'Loading deal...', done: 'Deal loaded' },
  update_deal: { pending: 'Updating deal...', done: 'Deal updated' },
  search_deals: { pending: 'Searching deals...', done: 'Found deals' },
  generate_content: { pending: 'Generating content...', done: 'Content generated' },
  answer_question: { pending: 'Analysing pipeline...', done: 'Analysis complete' },
}

interface ToolInvocation {
  toolName: string
  args: Record<string, unknown>
  state: 'partial-call' | 'call' | 'result'
  result?: unknown
}

interface ToolCallCardProps {
  invocation: ToolInvocation
}

export default function ToolCallCard({ invocation }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false)
  const { toolName, state, result } = invocation

  const labels = TOOL_LABELS[toolName] ?? {
    pending: `Running ${toolName.replace(/_/g, ' ')}...`,
    done: `${toolName.replace(/_/g, ' ')} complete`,
  }

  const isDone = state === 'result'
  // Detect if the result is a tool error (our graceful error wrapper)
  const resultStr = result != null
    ? (typeof result === 'string' ? result : JSON.stringify(result, null, 2))
    : null
  const isToolError = resultStr?.startsWith('[Tool "') ?? false
  const label = isDone
    ? (isToolError ? `${toolName.replace(/_/g, ' ')} — retrying...` : labels.done)
    : labels.pending

  // Don't expose internal error messages in the expandable result
  const resultText = isToolError ? null : resultStr

  return (
    <div style={{
      margin: '4px 0',
      borderRadius: '10px',
      background: 'var(--glass-tool-card, rgba(15, 12, 30, 0.6))',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: `1px solid ${isDone ? (isToolError ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)') : 'rgba(255,255,255,0.08)'}`,
      overflow: 'hidden',
      transition: 'border-color 0.2s',
      boxShadow: isDone && !isToolError
        ? '0 0 8px rgba(16,185,129,0.06)'
        : isToolError
          ? '0 0 8px rgba(245,158,11,0.06)'
          : undefined,
    }}>
      <button
        onClick={() => resultText && setExpanded(p => !p)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          padding: '6px 10px',
          background: 'none',
          border: 'none',
          cursor: resultText ? 'pointer' : 'default',
          color: isDone ? (isToolError ? '#FCD34D' : '#6EE7B7') : 'rgba(255,255,255,0.70)',
          fontSize: '11.5px',
          fontWeight: 500,
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        {/* Status icon */}
        {isDone ? (
          <span style={{
            width: '16px', height: '16px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%',
            background: 'rgba(16,185,129,0.15)',
          }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5.5L4 7.5L8 3" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        ) : (
          <span style={{
            width: '16px', height: '16px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              width: '12px', height: '12px',
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.14)',
              borderTopColor: 'rgba(255,255,255,0.80)',
              animation: 'spin 0.8s linear infinite',
            }} />
          </span>
        )}

        <span style={{ flex: 1 }}>{label}</span>

        {/* Expand chevron */}
        {resultText && (
          <svg
            width="12" height="12" viewBox="0 0 12 12" fill="none"
            style={{
              flexShrink: 0,
              transition: 'transform 0.15s',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Expanded result */}
      {expanded && resultText && (
        <div style={{
          padding: '6px 10px 8px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          fontSize: '11px',
          color: '#9CA3AF',
          lineHeight: '1.6',
          maxHeight: '160px',
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        }}>
          {resultText.length > 800 ? resultText.slice(0, 800) + '...' : resultText}
        </div>
      )}
    </div>
  )
}
