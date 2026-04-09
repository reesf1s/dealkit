'use client'

import React from 'react'
import Link from 'next/link'

interface MarkdownRendererProps {
  content: string
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|~~[^~]+~~)/)
  return parts.map((part, i) => {
    if (!part) return null
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} style={{ color: '#1a1a1a', fontWeight: 600 }}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**'))
      return <em key={i} style={{ color: '#1a1a1a', fontStyle: 'italic' }}>{part.slice(1, -1)}</em>
    if (part.startsWith('`') && part.endsWith('`'))
      return (
        <code key={i} style={{
          background: 'var(--surface-2)',
          padding: '1px 6px',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#1a1a1a',
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        }}>{part.slice(1, -1)}</code>
      )
    if (part.startsWith('~~') && part.endsWith('~~'))
      return <span key={i} style={{ textDecoration: 'line-through', color: '#9b9a97' }}>{part.slice(2, -2)}</span>
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (linkMatch)
      return <Link key={i} href={linkMatch[2]} style={{ color: '#1DB86A', textDecoration: 'underline' }}>{linkMatch[1]}</Link>
    return part
  })
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.trimStart().startsWith('```')) {
      const lang = line.trimStart().slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      elements.push(
        <pre key={elements.length} style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border-default)',
          borderRadius: '6px',
          padding: '10px 14px',
          margin: '6px 0',
          overflowX: 'auto',
          fontSize: '12px',
          lineHeight: '1.6',
          color: '#1a1a1a',
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        }}>
          {lang && (
            <div style={{ fontSize: '10px', color: '#9b9a97', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {lang}
            </div>
          )}
          <code>{codeLines.join('\n')}</code>
        </pre>
      )
      continue
    }

    // Headers
    if (line.startsWith('### ')) {
      elements.push(
        <div key={elements.length} style={{
          fontSize: '12px', fontWeight: 700, color: '#1a1a1a',
          marginTop: elements.length > 0 ? '12px' : 0, marginBottom: '4px', letterSpacing: '0.01em',
        }}>
          {renderInline(line.slice(4))}
        </div>
      )
      i++
      continue
    }
    if (line.startsWith('## ')) {
      elements.push(
        <div key={elements.length} style={{
          fontSize: '13px', fontWeight: 700, color: '#1a1a1a',
          marginTop: elements.length > 0 ? '14px' : 0, marginBottom: '5px',
        }}>
          {renderInline(line.slice(3))}
        </div>
      )
      i++
      continue
    }
    if (line.startsWith('# ')) {
      elements.push(
        <div key={elements.length} style={{
          fontSize: '14px', fontWeight: 700, color: '#1a1a1a',
          marginTop: elements.length > 0 ? '16px' : 0, marginBottom: '6px',
        }}>
          {renderInline(line.slice(2))}
        </div>
      )
      i++
      continue
    }

    // Bullet lists
    if (line.startsWith('- ') || line.startsWith('• ')) {
      elements.push(
        <div key={elements.length} style={{ display: 'flex', gap: '8px', marginBottom: '3px' }}>
          <span style={{ color: '#9b9a97', flexShrink: 0, marginTop: '3px', fontSize: '10px' }}>&#9658;</span>
          <span>{renderInline(line.slice(2))}</span>
        </div>
      )
      i++
      continue
    }

    // Numbered lists
    if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\.\s/)?.[1]
      const text = line.replace(/^\d+\.\s/, '')
      elements.push(
        <div key={elements.length} style={{ display: 'flex', gap: '8px', marginBottom: '3px' }}>
          <span style={{ color: '#9b9a97', flexShrink: 0, fontSize: '11px', fontWeight: 700, marginTop: '2px', minWidth: '14px' }}>
            {num}.
          </span>
          <span>{renderInline(text)}</span>
        </div>
      )
      i++
      continue
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={elements.length} style={{ height: '7px' }} />)
      i++
      continue
    }

    // Regular paragraph
    elements.push(
      <div key={elements.length} style={{ marginBottom: '2px' }}>
        {renderInline(line)}
      </div>
    )
    i++
  }

  return (
    <div style={{
      fontSize: '13.5px',
      color: '#1a1a1a',
      lineHeight: '1.7',
      wordBreak: 'break-word',
    }}>
      {elements}
    </div>
  )
}
