'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bot } from 'lucide-react'
import { CrmPage, CrmPanel, CrmSectionHeader } from '@/components/crm/CrmShell'

export const dynamic = 'force-dynamic'

export default function AssistantPage() {
  const router = useRouter()

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query: 'What should I do today?' } }))
    router.replace('/home')
  }, [router])

  return (
    <CrmPage>
      <CrmPanel>
        <CrmSectionHeader title="Opening assistant" description="Halvex now lives as a floating assistant across the CRM." action={<Bot size={18} />} />
      </CrmPanel>
    </CrmPage>
  )
}
