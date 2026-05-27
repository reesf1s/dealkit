import { afterEach, describe, expect, it, vi } from 'vitest'
import { answerAssistantWithAI } from '../ai'

vi.mock('server-only', () => ({}))

describe('answerAssistantWithAI', () => {
  const originalKey = process.env.OPENAI_API_KEY

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalKey
    vi.restoreAllMocks()
  })

  it('uses the Responses API shape required by GPT-5.4 mini', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: 'What happened: BOE has fresh context.' }],
          },
        ],
      }),
    } as Response)

    const answer = await answerAssistantWithAI({
      message: 'Summarise BOE',
      today: null,
      pipeline: null,
      activity: [],
      fallbackAnswer: 'fallback',
    })

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.openai.com/v1/responses')
    expect(body.model).toBe('gpt-5.4-mini')
    expect(body.max_output_tokens).toBe(900)
    expect(body.max_tokens).toBeUndefined()
    expect(answer).toBe('What happened: BOE has fresh context.')
  })
})
