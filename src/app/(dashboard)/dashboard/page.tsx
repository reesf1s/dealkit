'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * /dashboard now redirects to / where the new Today page lives.
 * This file exists only for backward compatibility with old bookmarks.
 */
export default function DashboardRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/')
  }, [router])
  return null
}
