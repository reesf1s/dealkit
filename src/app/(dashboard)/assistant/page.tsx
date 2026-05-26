'use client'

import { Bot, MailPlus, Sparkles } from 'lucide-react'
import { ActionCard, ButtonV2, HeroPanel, PanelV2, SectionHeader } from '@/components/v2/V2DesignSystem'

export const dynamic = 'force-dynamic'

const prompts = [
  'What should I do today?',
  'Which deals are slipping?',
  'Which deals have no next step?',
  'Prep me for my next meeting.',
  'Draft a follow-up for BOE.',
  'What changed this week?',
]

export default function AssistantPage() {
  return (
    <div className="v2-page">
      <HeroPanel
        eyebrow="Assistant"
        title="Ask Halvex"
        actions={<ButtonV2 tone="dark" onClick={() => {
          window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query: 'What should I do today?' } }))
        }}><Bot size={16} /> Open assistant</ButtonV2>}
        aside={<div className="v2-glass-card"><strong>Not a separate chatbot</strong><span>The assistant works best when it is attached to deals, people, companies, and meetings.</span></div>}
      >
        Understand, draft, update, and reason over the CRM. Important changes require approval.
      </HeroPanel>

      <div className="v2-grid-2">
        <PanelV2>
          <SectionHeader title="Useful questions" icon={<Sparkles size={18} />}>
            Start with operational questions that move revenue.
          </SectionHeader>
          <div className="v2-stack">
            {prompts.map(prompt => (
              <ActionCard
                key={prompt}
                title={prompt}
                reason="Opens the assistant drawer with current workspace context."
                source="Ask Halvex"
                action={<Bot size={17} />}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query: prompt } }))
                }}
              />
            ))}
          </div>
        </PanelV2>
        <PanelV2>
          <SectionHeader title="What Halvex can do" icon={<MailPlus size={18} />}>
            Answers should include records, evidence, and proposed actions.
          </SectionHeader>
          <div className="v2-stack">
            <ActionCard title="Summarise" reason="Explain a deal, person, company, or weekly sales state with links to records." />
            <ActionCard title="Draft" reason="Write follow-ups from real context, ready for review." />
            <ActionCard title="Propose updates" reason="Turn notes into blockers, next actions, tasks, and summary updates for approval." />
            <ActionCard title="Prioritise" reason="Tell the team what needs attention today and why." />
          </div>
        </PanelV2>
      </div>
    </div>
  )
}
