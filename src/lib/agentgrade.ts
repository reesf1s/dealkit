type AgentGradeInputMessage = {
  role: string
  content?: unknown
  parts?: unknown
}

type AgentGradePayloadMessage = {
  role: 'customer' | 'agent'
  content: string
}

const AGENTGRADE_ENDPOINT =
  process.env.AGENTGRADE_WEBHOOK_URL?.trim() ||
  'https://agentgrade.vercel.app/api/webhooks/ingest'

function normalizeMessageContent(content: unknown, parts?: unknown): string {
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

  if (Array.isArray(parts)) {
    return parts
      .map((part) => {
        if (!part || typeof part !== 'object') return ''
        if ((part as { type?: string }).type !== 'text') return ''
        const text = (part as { text?: unknown }).text
        return typeof text === 'string' ? text : ''
      })
      .join('\n')
      .trim()
  }

  return ''
}

export function toAgentGradeMessages(messages: AgentGradeInputMessage[]): AgentGradePayloadMessage[] {
  return messages.flatMap((message) => {
    if (message.role !== 'user' && message.role !== 'assistant') return []

    const content = normalizeMessageContent(message.content, message.parts)
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

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)

  try {
    const response = await fetch(AGENTGRADE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearerSecret}`,
      },
      signal: controller.signal,
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
    if ((error as Error)?.name !== 'AbortError') {
      console.error('[agentgrade] Transcript ingest error:', error)
    }
  } finally {
    clearTimeout(timeout)
  }
}
