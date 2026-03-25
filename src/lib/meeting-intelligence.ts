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
import { dealLogs, dealLinearLinks, linearIssuesCache, linearIntegrations, slackUserMappings } from '@/lib/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { findMatchingIssues } from '@/lib/deal-linear-matcher'
import { createIssue } from '@/lib/linear-client'
import { decrypt, getEncryptionKey } from '@/lib/encrypt'
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

    const totalFeatures = extraction.features.length
    let linkedCount = 0
    let createdCount = 0

    // Load Linear integration for issue creation
    const [integration] = await db
      .select({ id: linearIntegrations.id, apiKeyEnc: linearIntegrations.apiKeyEnc, teamId: linearIntegrations.teamId })
      .from(linearIntegrations)
      .where(eq(linearIntegrations.workspaceId, workspaceId))
      .limit(1)

    let linearApiKey: string | null = null
    if (integration) {
      try { linearApiKey = decrypt(integration.apiKeyEnc, getEncryptionKey()) } catch { /* non-fatal */ }
    }

    // 3. For each extracted feature, try to match existing Linear issues
    for (const feature of extraction.features) {
      let matched = false

      try {
        // Strategy 1: Direct title substring search against cached issues (instant, no API)
        const titleSearch = feature.title.toLowerCase()
        const directMatches = await db
          .select({ linearIssueId: linearIssuesCache.linearIssueId, title: linearIssuesCache.title, linearIssueUrl: linearIssuesCache.linearIssueUrl })
          .from(linearIssuesCache)
          .where(and(
            eq(linearIssuesCache.workspaceId, workspaceId),
            sql`LOWER(${linearIssuesCache.title}) LIKE ${'%' + titleSearch + '%'}`,
          ))
          .limit(3)

        if (directMatches.length > 0) {
          // Direct title match — high confidence, auto-link
          const best = directMatches[0]
          const existing = await db
            .select({ id: dealLinearLinks.id })
            .from(dealLinearLinks)
            .where(and(eq(dealLinearLinks.dealId, dealId), eq(dealLinearLinks.linearIssueId, best.linearIssueId)))
            .limit(1)

          if (!existing.length) {
            await db.insert(dealLinearLinks).values({
              workspaceId,
              dealId,
              linearIssueId: best.linearIssueId,
              linearIssueUrl: best.linearIssueUrl,
              linearTitle: best.title,
              relevanceScore: 90, // high confidence — direct title match
              linkType: 'feature_gap',
              status: 'suggested',
              addressesRisk: feature.title,
            }).onConflictDoNothing()
            linkedCount++
          }
          matched = true
          console.log(`[meeting-intelligence] Direct match: "${feature.title}" → ${best.linearIssueId} (${best.title})`)
          continue
        }

        // Strategy 2: TF-IDF similarity (broader matching)
        const dealData = {
          dealName: deal.dealName,
          prospectCompany: deal.prospectCompany,
          notes: `${feature.title} ${feature.description}`,
          meetingNotes: null as string | null,
          dealRisks: null as unknown,
          description: null as string | null,
        }
        const matches = await findMatchingIssues(dealId, workspaceId, dealData, {
          limit: 3,
          minSimilarity: 0.05,
          skipPgvector: true,
        })

        if (matches.length > 0) {
          const best = matches[0]
          const [issueInfo] = await db
            .select({ title: linearIssuesCache.title, url: linearIssuesCache.linearIssueUrl })
            .from(linearIssuesCache)
            .where(and(eq(linearIssuesCache.workspaceId, workspaceId), eq(linearIssuesCache.linearIssueId, best.issueId)))
            .limit(1)

          const existing = await db
            .select({ id: dealLinearLinks.id })
            .from(dealLinearLinks)
            .where(and(eq(dealLinearLinks.dealId, dealId), eq(dealLinearLinks.linearIssueId, best.issueId)))
            .limit(1)

          if (!existing.length) {
            await db.insert(dealLinearLinks).values({
              workspaceId,
              dealId,
              linearIssueId: best.issueId,
              linearIssueUrl: issueInfo?.url ?? null,
              linearTitle: issueInfo?.title ?? best.issueId,
              relevanceScore: Math.round(best.similarity * 100),
              linkType: 'feature_gap',
              status: 'suggested',
              addressesRisk: feature.title,
            }).onConflictDoNothing()
            linkedCount++
          }
          matched = true
          console.log(`[meeting-intelligence] TF-IDF match: "${feature.title}" → ${best.issueId} (${Math.round(best.similarity * 100)}%)`)
        }
      } catch (e) {
        console.warn('[meeting-intelligence] match failed for feature:', feature.title, e)
      }

      // 4. No match found → CREATE the issue on Linear and link it
      if (!matched && linearApiKey && integration) {
        try {
          const halvexContext = `> **Halvex**: Extracted from ${deal.prospectCompany} deal notes.\n> Feature priority: ${feature.priority}\n\n`
          const newIssue = await createIssue(linearApiKey, integration.teamId, {
            title: feature.title,
            description: `${halvexContext}${feature.description}`,
            priority: feature.priority === 'blocker' ? 2 : 3, // 2=high, 3=medium
          })

          // Cache the new issue
          await db.insert(linearIssuesCache).values({
            workspaceId,
            linearIssueId: newIssue.identifier,
            linearIssueUrl: newIssue.url,
            title: newIssue.title,
            description: newIssue.description,
            status: newIssue.state.name,
            priority: newIssue.priority,
          }).onConflictDoNothing()

          // Link to deal
          await db.insert(dealLinearLinks).values({
            workspaceId,
            dealId,
            linearIssueId: newIssue.identifier,
            linearIssueUrl: newIssue.url,
            linearTitle: newIssue.title,
            relevanceScore: 100, // auto-created for this deal
            linkType: 'feature_gap',
            status: 'suggested',
            addressesRisk: feature.title,
          }).onConflictDoNothing()

          createdCount++
          console.log(`[meeting-intelligence] Created Linear issue: ${newIssue.identifier} — "${feature.title}"`)
        } catch (e) {
          console.warn('[meeting-intelligence] Failed to create Linear issue:', feature.title, e)
        }
      }
    }

    // 5. Send Slack DM to the rep if connected
    // Fire DM whenever features were found in the notes, even if all matching/stub attempts failed
    if (totalFeatures > 0 || extraction.painPoints.length > 0) {
      await notifyRepAboutExtraction(
        workspaceId,
        repClerkUserId,
        deal.dealName,
        deal.prospectCompany,
        linkedCount,
        createdCount,
        totalFeatures,
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
  createdCount: number,
  totalFeatures: number,
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

    let text: string
    if (linkedCount === 0 && createdCount === 0 && totalFeatures > 0) {
      // Features were found but all matching/stub attempts failed — use friendly fallback
      text = `🔍 I analysed *${company}* — I found *${totalFeatures}* potential feature gap${totalFeatures !== 1 ? 's' : ''}. Connect Linear to match them to issues, or ask me anything about this deal in Slack.\n\n_Ask me: "latest on ${company}"_`
    } else if (linkedCount === 0 && createdCount > 0) {
      // No Linear issues matched — stubs created, guide user to connect/review
      text = `🔍 I analysed *${company}* — I found *${createdCount}* potential feature gap${createdCount !== 1 ? 's' : ''}. Connect Linear to match them to issues, or ask me anything about this deal in Slack.\n\n_Ask me: "latest on ${company}"_`
    } else {
      const parts: string[] = [
        `🔍 *Meeting notes analysed for ${company}*`,
        '',
      ]
      if (linkedCount > 0) {
        parts.push(`• Matched *${linkedCount}* existing Linear issue${linkedCount !== 1 ? 's' : ''} to this deal`)
      }
      if (createdCount > 0) {
        parts.push(`• Found *${createdCount}* new feature request${createdCount !== 1 ? 's' : ''} not yet in Linear`)
      }
      parts.push('', `Ask me _"latest on ${company}"_ to review them.`)
      text = parts.join('\n')
    }

    const dmChannel = await slackOpenDm(botToken, slackUserId)
    if (dmChannel) {
      await slackPostMessage(botToken, dmChannel, markdownToBlocks(text), text)
    }
  } catch (e) {
    console.warn('[meeting-intelligence] Slack notify failed:', e)
  }
}
