'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Bot, Send } from 'lucide-react'
import { OperatorHeader, OperatorPage, OperatorPanel } from '@/components/shared/OperatorUI'

export const dynamic = 'force-dynamic'

type Reply = { answer: string; links: Array<{ label: string; href: string }> }

export default function AssistantPage() {
  const [message, setMessage] = useState('What should I do today?')
  const [replies, setReplies] = useState<Reply[]>([])
  const [loading, setLoading] = useState(false)

  async function ask(event: React.FormEvent) {
    event.preventDefault()
    if (!message.trim()) return
    setLoading(true)
    const res = await fetch('/api/crm/assistant', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message }),
    })
    const json = await res.json()
    setReplies(prev => [...prev, json.data])
    setLoading(false)
  }

  return (
    <OperatorPage>
      <OperatorHeader eyebrow="Assistant" title="Ask Halvex" description="Workspace-scoped CRM answers with links back to records." />
      <OperatorPanel icon={Bot}>
        <div className="crm-assistant">
          <div className="crm-assistant-messages">
            {replies.map((reply, index) => (
              <article key={index}>
                <p>{reply.answer}</p>
                {reply.links.length > 0 && (
                  <div>
                    {reply.links.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}
                  </div>
                )}
              </article>
            ))}
            {replies.length === 0 && <div className="empty-state">Try “What should I do today?”, “Which deals are at risk?”, or “Which deals are likely to close?”</div>}
          </div>
          <form onSubmit={ask} className="crm-assistant-input">
            <input value={message} onChange={event => setMessage(event.target.value)} />
            <button className="operator-button operator-button-primary" disabled={loading}><Send size={14} /> Ask</button>
          </form>
        </div>
      </OperatorPanel>
    </OperatorPage>
  )
}
