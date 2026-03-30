import { generateText, streamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { MINI } from './models'

function getOpenAIProvider() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }
  return createOpenAI({ apiKey })
}

/** Vercel AI SDK model — use for streamText / generateText calls */
export const gptMini = getOpenAIProvider()(MINI)

type MessageParam = { role: 'user' | 'assistant'; content: string }

interface CreateParams {
  model: string
  max_tokens: number
  system?: string
  messages: MessageParam[]
  stream?: boolean
  [key: string]: unknown
}

/**
 * Drop-in shim matching the Anthropic SDK subset used throughout the codebase:
 *   anthropic.messages.create({ model, max_tokens, system?, messages })
 *   anthropic.messages.stream({ model, max_tokens, system?, messages })
 *
 * Both route through OpenAI via the Vercel AI SDK.
 * The stream() method yields Anthropic-compatible events so existing
 * SSE streaming code in chat/route.ts works unchanged.
 */
export const anthropic = {
  messages: {
    async create(params: CreateParams) {
      const openaiProvider = getOpenAIProvider()
      const { text } = await generateText({
        model: openaiProvider(MINI),
        maxTokens: params.max_tokens,
        system: params.system,
        messages: params.messages as any,
      })
      return {
        content: [{ type: 'text' as const, text }],
      }
    },

    stream(params: CreateParams) {
      const openaiProvider = getOpenAIProvider()
      // Returns an async iterable that yields Anthropic-compatible SSE events
      // so existing `for await (const event of stream)` loops work unchanged.
      return (async function* () {
        const result = streamText({
          model: openaiProvider(MINI),
          maxTokens: params.max_tokens,
          system: params.system,
          messages: params.messages as any,
        })

        for await (const delta of (await result).textStream) {
          yield {
            type: 'content_block_delta' as const,
            delta: { type: 'text_delta' as const, text: delta },
          }
        }
      })()
    },
  },
}
