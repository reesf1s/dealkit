/**
 * Meeting intelligence — auto-extract feature requests from meeting notes,
 * match them to Linear issues, and notify the rep via Slack.
 *
 * Called inside next/after() from the meeting-notes endpoint so it never
 * blocks the HTTP response.
 *
 * Flow:
 *   1. Use Claude Haiku to extract features + pain points from notes
 *   2. For each extracted feature, search Linear issues by similarity
 *   3. If similarity > 0.7 → auto-link to deal in deal_linear_links
 *   4. If no match → insert a stub in linear_issues_cache (pending PM review)
 *   5. Send a Slack DM to the rep summarising what was found
 */

import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { dealLogs, dealLinearLinks, linearIssuesCache, slackUserMappings } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { findMatchingIssues } from '@/lib/deal-linear-matcher'
import { getSlackBotToken, slackOpenDm, slackPostMessage } from '@/lib/slack-client'
import { markdownToBlocks } from '@/lib/slack-blocks'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ExtractedFeature {
  title: string
  description: string
  priority: 'blocker' | 'nice-to-have'
}

interface ExtractionResult {
  features: ExtractedFeature[]
  painPoints: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Haiku extraction
// ─────────────────────────────────────────────────────────────────────────────

async function extractFeaturesFromNotes(notes: string): Promise<ExtractionResult> {
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Extract product feature requests and pain points from these meeting notes. Return ONLY valid JSON:
{"features":[{"title":"string","description":"string","priority":"blocker"|"nice-to-have"}],"painPoints":["string"]}

Notes:
${notes.slice(0, 3000)}`,
      }],
    })

    const raw = (msg.content[0] as { type: string; text: string }).text.trim()
    const cleaned = raw.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
    const parsed = JSON.parse(cleaned) as ExtractionResult

    return {
      features: Array.isArray(parsed.features)
        ? parsed.features.slice(0, 5).map(f => ({
          title: String(f.title ?? '').slice(0, 120),
          description: String(f.description ?? '').slice(0, 300),
          priority: f.priority === 'blocker' ? 'blocker' : 'nice-to-have',
        }))
        : [],
      painPoints: Array.isArray(parsed.painPoints)
        ? parsed.painPoints.slice(0, 5).map(p => String(p).slice(0, 200))
        : [],
    }
  } catch {
    return { features: [], painPoints: [] }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract feature requests from meeting notes, match to Linear issues,
 * and notify the rep via Slack.
 *
 * Safe to call fire-and-forget — catches all errors internally.
 */
export async function extractAndLinkFeatures(
  dealId: string,
  notes: string,
  workspaceId: string,
  repClerkUserId?: string,
): Promise<void> {
  try {
    // 1. Load deal context
    const [deal] = await db
      .select({
        dealName: dealLogs.dealName,
        prospectCompany: dealLogs.prospectCompany,
        notes: dealLogs.notes,
        meetingNotes: dealLogs.meetingNotes,
        dealRisks: dealLogs.dealRisks,
        description: dealLogs.description,
      })
      .from(dealLogs)
      .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, workspaceId)))
      .limit(1)

    if (!deal) return

    // 2. Extract features via Haiku
    const extraction = await extractFeaturesFromNotes(notes)
    if (extraction.features.length === 0 && extraction.painPoints.length === 0) return

    let linkedCount = 0
    let stubCount = 0

    // 3. For each extracted feature, try to match existing Linear issues
    for (const feature of extraction.features) {
      // Build a synthetic deal data object weighted towards this specific feature
      const featureSignalText = `${feature.title} ${feature.description}`
      const dealData = {
        dealName: deal.dealName,
        prospectCompany: deal.prospectCompany,
        notes: featureSignalText,
        meetingNotes: deal.meetingNotes,
        dealRisks: deal.dealRisks,
        description: deal.description,
      }

      let matched = false
      try {
        const matches = await findMatchingIssues(dealId, workspaceId, dealData, {
          limit: 3,
          minSimilarity: 0.15,
        })

        // Auto-link issues with similarity > 0.7 (scaled: findMatchingIssues returns 0-1)
        for (const match of matches) {
          if (match.similarity < 0.7) continue

          // Upsert into deal_linear_links (ignore if already linked)
          const existing = await db
            .select({ id: dealLinearLinks.id, status: dealLinearLinks.status })
            .from(dealLinearLinks)
            .where(and(
              eq(dealLinearLinks.dealId, dealId),
              eq(dealLinearLinks.linearIssueId, match.issueId),
            ))
            .limit(1)

          if (!existing.length) {
            await db.insert(dealLinearLinks).values({
              workspaceId,
              dealId,
              linearIssueId: match.issueId,
              relevanceScore: Math.round(match.similarity * 100),
              linkType: 'feature_gap',
              status: 'suggested',
            }).onConflictDoNothing()
            linkedCount++
          }
          matched = true
          break  // only link the best match per feature
        }
      } catch (e) {
        console.warn('[meeting-intelligence] match failed for feature:', feature.title, e)
      }

      // 4. No match found → create a stub in linear_issues_cache for PM review
      if (!matched) {
        try {
          const stubId = `STUB-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
          await db.insert(linearIssuesCache).values({
            workspaceId,
            linearIssueId: stubId,
            title: feature.title,
            description: `${feature.description}\n\n[Auto-extracted from meeting notes — pending PM review]`,
            status: 'Backlog',
            priority: feature.priority === 'blocker' ? 1 : 3,
          }).onConflictDoNothing()
          stubCount++
        } catch {
          // non-fatal — stub creation is best-effort
        }
      }
    }

    // 5. Send Slack DM to the rep if connected
    if (linkedCount > 0 || stubCount > 0) {
      await notifyRepAboutExtraction(
        workspaceId,
        repClerkUserId,
        deal.dealName,
        deal.prospectCompany,
        linkedCount,
        stubCount,
      )
    }
  } catch (e) {
    // Never throw — this runs in after() and must not affect the response
    console.error('[meeting-intelligence] extractAndLinkFeatures failed:', e)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Slack notification
// ─────────────────────────────────────────────────────────────────────────────

async function notifyRepAboutExtraction(
  workspaceId: string,
  repClerkUserId: string | undefined,
  dealName: string,
  company: string,
  linkedCount: number,
  stubCount: number,
): Promise<void> {
  try {
    const botToken = await getSlackBotToken(workspaceId)
    if (!botToken) return

    // Find the rep's Slack user ID
    let slackUserId: string | null = null
    if (repClerkUserId) {
      const [mapping] = await db
        .select({ slackUserId: slackUserMappings.slackUserId })
        .from(slackUserMappings)
        .where(and(
          eq(slackUserMappings.workspaceId, workspaceId),
          eq(slackUserMappings.clerkUserId, repClerkUserId),
        ))
        .limit(1)
      slackUserId = mapping?.slackUserId ?? null
    }

    if (!slackUserId) return

    const parts: string[] = [
      `🔍 *Meeting notes analysed for ${company}*`,
      '',
    ]
    if (linkedCount > 0) {
      parts.push(`• Matched *${linkedCount}* existing Linear issue${linkedCount !== 1 ? 's' : ''} to this deal`)
    }
    if (stubCount > 0) {
      parts.push(`• Found *${stubCount}* new feature request${stubCount !== 1 ? 's' : ''} not yet in Linear`)
    }
    parts.push('', `Ask me _"latest on ${company}"_ to review them.`)

    const text = parts.join('\n')
    const dmChannel = await slackOpenDm(botToken, slackUserId)
    if (dmChannel) {
      await slackPostMessage(botToken, dmChannel, markdownToBlocks(text), text)
    }
  } catch (e) {
    console.warn('[meeting-intelligence] Slack notify failed:', e)
  }
}
