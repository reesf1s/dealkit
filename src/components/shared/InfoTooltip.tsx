'use client'
import React, { useState } from 'react'
import { Info } from 'lucide-react'

interface InfoTooltipProps {
  text: string
  size?: number
}

export function InfoTooltip({ text, size = 14 }: InfoTooltipProps) {
  const [show, setShow] = useState(false)
  return (
    <span
      className="relative inline-flex items-center"
      style={{ verticalAlign: 'middle', marginLeft: '4px' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <Info size={size} style={{ color: '#52525B', cursor: 'help' }} />
      {show && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '8px',
          zIndex: 9999,
          width: '240px',
          background: '#18181B',
          border: '1px solid #3F3F46',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '12px',
          color: '#D4D4D8',
          lineHeight: 1.5,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          pointerEvents: 'none'
        }}>
          {text}
        </div>
      )}
    </span>
  )
}
