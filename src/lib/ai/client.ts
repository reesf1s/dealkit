import Anthropic from '@anthropic-ai/sdk'

/**
 * Shared Anthropic client.
 *
 * Prompt caching is enabled via the beta header — this allows callers to add
 * `cache_control: { type: 'ephemeral' }` to large, reused system/user blocks
 * (workspace brain context, static instruction sections) without any extra setup.
 *
 * Savings estimate: cached tokens cost ~10% of normal input token price.
 * The workspace brain context (~2000–4000 tokens) is identical for all requests
 * in the same workspace within a session — caching it saves ~90% of that cost.
 */
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: {
    'anthropic-beta': 'prompt-caching-2024-07-31',
  },
})
