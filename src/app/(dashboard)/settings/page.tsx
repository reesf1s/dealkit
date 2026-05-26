'use client'

import useSWR from 'swr'
import { Building2, CalendarDays, CreditCard, Import, Settings, UsersRound } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { ActionCard, ButtonV2, HeroPanel, PanelV2, SectionHeader } from '@/components/v2/V2DesignSystem'

export const dynamic = 'force-dynamic'

export default function SettingsPage() {
  const { data } = useSWR('/api/integrations/google/status', fetcher, { revalidateOnFocus: false })
  const googleConnected = Boolean(data?.data?.connected)

  return (
    <div className="v2-page">
      <HeroPanel
        eyebrow="Settings"
        title="Quiet controls for the CRM."
        actions={googleConnected ? <ButtonV2 href="/calendar">Open Calendar</ButtonV2> : <ButtonV2 tone="dark" href="/api/integrations/google/auth"><CalendarDays size={16} /> Connect Google Calendar</ButtonV2>}
        aside={<div className="v2-glass-card"><strong>Keep settings out of the workflow</strong><span>Workspace, members, pipeline, imports, integrations, and billing live here.</span></div>}
      >
        Settings should support the product without becoming the product.
      </HeroPanel>

      <div className="v2-grid-2">
        <PanelV2>
          <SectionHeader title="Workspace" icon={<Settings size={18} />}>
            Team setup and operating defaults.
          </SectionHeader>
          <div className="v2-stack">
            <ActionCard title="Workspace" reason="Name, business type, and basic account settings." source="Core" />
            <ActionCard title="Members" reason="Invite teammates and manage owner, admin, and member roles." source="Team" action={<UsersRound size={17} />} />
            <ActionCard title="Pipelines" reason="Stages, probabilities, and stale deal thresholds." source="Deals" action={<Building2 size={17} />} />
          </div>
        </PanelV2>
        <PanelV2>
          <SectionHeader title="Data and billing" icon={<Import size={18} />}>
            Bring data in and connect systems when they are useful.
          </SectionHeader>
          <div className="v2-stack">
            <ActionCard title="Imports" reason="CSV import for companies, people, and deals. Migration tools stay behind admin controls." source="Data" />
            <ActionCard title="Google Calendar" reason={googleConnected ? 'Calendar is connected.' : 'Connect Calendar to power meeting prep and post-meeting updates.'} source={googleConnected ? 'Connected' : 'Not connected'} />
            <ActionCard title="Billing" reason="Plan and billing controls. Keep this quiet until product value is obvious." source="Billing" action={<CreditCard size={17} />} />
          </div>
        </PanelV2>
      </div>
    </div>
  )
}
