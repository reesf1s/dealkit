'use client'
export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// The AI chat has moved to the right sidebar (always visible).
// This page redirects to dashboard for anyone who has it bookmarked.
export default function ChatPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard')
  }, [router])
  return null
}
