type AgentGradeInputMessage = {
  role: string
  content?: unknown
}

type AgentGradePayloadMessage = {
  role: 'customer' | 'agent'
  content: string
}

const AGENTGRADE_ENDPOINT =
  process.env.AGENTGRADE_WEBHOOK_URL?.trim() ||
  'https://agentgrade.vercel.app/api/webhooks/ingest'

function normalizeMessageContent(content: unknown): string {
  if (typeof content === 'string') return content.trim()

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part
        if (part && typeof part === 'object' && 'text' in part && typeof (part as { text?: unknown }).text === 'string') {
          return (part as { text: string }).text
        }
        return ''
      })
      .join('\n')
      .trim()
  }

  return ''
}

export function toAgentGradeMessages(messages: AgentGradeInputMessage[]): AgentGradePayloadMessage[] {
  return messages.flatMap((message) => {
    if (message.role !== 'user' && message.role !== 'assistant') return []

    const content = normalizeMessageContent(message.content)
    if (!content) return []

    return [{
      role: message.role === 'user' ? 'customer' : 'agent',
      content,
    }]
  })
}

type SendAgentGradeTranscriptArgs = {
  conversationId?: string | null
  customerIdentifier: string
  messages: AgentGradeInputMessage[]
}

export async function sendAgentGradeTranscript({
  conversationId,
  customerIdentifier,
  messages,
}: SendAgentGradeTranscriptArgs): Promise<void> {
  const bearerSecret = process.env.AGENTGRADE_BEARER_SECRET?.trim()
  if (!bearerSecret || !conversationId?.trim()) return

  const normalizedMessages = toAgentGradeMessages(messages)
  if (normalizedMessages.length === 0) return

  try {
    const response = await fetch(AGENTGRADE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearerSecret}`,
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        platform: 'custom',
        customer_identifier: customerIdentifier,
        messages: normalizedMessages,
      }),
    })

    if (!response.ok) {
      console.error('[agentgrade] Transcript ingest failed:', response.status, await response.text())
    }
  } catch (error) {
    console.error('[agentgrade] Transcript ingest error:', error)
  }
}
