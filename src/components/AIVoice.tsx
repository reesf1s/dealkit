import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type AIVoiceProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode
  as?: 'span' | 'div' | 'p'
}

export function AIVoice({ as = 'span', children, className, ...props }: AIVoiceProps) {
  const Component = as

  return (
    <Component
      className={cn('font-serif italic', className)}
      {...props}
    >
      {children}
    </Component>
  )
}

export default AIVoice
