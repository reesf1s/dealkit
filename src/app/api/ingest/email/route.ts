export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workspaces, dealLogs, unmatchedEmails } from '@/lib/db/schema'
import { requestBrainRebuild } from '@/lib/brain-rebuild'
import { isAutomationEnabled } from '@/lib/automation-policy'

// ── Email body cleaning ─────────────────────────────────────────────────────

/**
 * Strips forwarding headers, reply chains, signatures, and excessive whitespace
 * from an email body to extract only the meaningful content.
 */
export function cleanEmailBody(raw: string): string {
  if (!raw) return ''

  let text = raw

  // Remove forwarding headers
  text = text.replace(/---------- Forwarded message ----------[\s\S]*?(?=\n\n|\n[A-Z])/i, '')
  text = text.replace(/^-+\s*Forwarded message\s*-+$/gm, '')
  text = text.replace(/^Begin forwarded message:$/gm, '')

  // Remove reply chain headers ("On [date], [person] wrote:")
  text = text.replace(/^On .{10,100} wrote:\s*$/gm, '')
  // Remove "> " quoted lines (reply chains)
  text = text.replace(/^>.*$/gm, '')

  // Remove signatures — everything after common signature markers
  const sigPatterns = [
    /^--\s*$/m,
    /^Sent from my (iPhone|iPad|Android|Galaxy|Pixel|mobile)/im,
    /^Sent via /im,
    /^Get Outlook for /im,
    /^Best regards,?\s*$/im,
    /^Kind regards,?\s*$/im,
    /^Regards,?\s*$/im,
    /^Thanks,?\s*$/im,
    /^Thank you,?\s*$/im,
    /^Cheers,?\s*$/im,
    /^Warm regards,?\s*$/im,
    /^Sincerely,?\s*$/im,
  ]
  for (const pattern of sigPatterns) {
    const match = text.match(pattern)
    if (match && match.index !== undefined) {
      // Only trim if the signature marker is in the latter half of the email
      if (match.index > text.length * 0.3) {
        text = text.slice(0, match.index)
      }
    }
  }

  // Clean up excessive whitespace
  text = text.replace(/\n{3,}/g, '\n\n').trim()

  return text
}

// ── Deal matching ───────────────────────────────────────────────────────────

type DealCandidate = {
  id: string
  dealName: string
  prospectCompany: string
  contacts: unknown
  updatedAt: Date
}

/**
 * Tries to match an email to a deal by:
 * 1. Contact email match
 * 2. Company domain match (sender domain → deal company name)
 * 3. Deal name in subject
 * Returns { matchedDealId, suggestedDealIds }
 */
export function matchEmailToDeal(
  fromEmail: string,
  subject: string,
  deals: DealCandidate[],
): { matchedDealId: string | null; suggestedDealIds: string[] } {
  const fromDomain = fromEmail.split('@')[1]?.toLowerCase() ?? ''
  const subjectLower = (subject ?? '').toLowerCase()

  // 1. Contact email match — highest confidence
  for (const deal of deals) {
    const contacts = (deal.contacts ?? []) as Array<{ email?: string }>
    if (contacts.some(c => c.email && c.email.toLowerCase() === fromEmail.toLowerCase())) {
      return { matchedDealId: deal.id, suggestedDealIds: [] }
    }
  }

  // 2. Company domain match — check if sender domain appears in company name
  if (fromDomain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'protonmail.com'].includes(fromDomain)) {
    const domainBase = fromDomain.split('.')[0].toLowerCase()
    for (const deal of deals) {
      const companyLower = deal.prospectCompany.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (companyLower.includes(domainBase) || domainBase.includes(companyLower)) {
        return { matchedDealId: deal.id, suggestedDealIds: [] }
      }
    }
  }

  // 3. Deal name in subject
  for (const deal of deals) {
    const dealNameLower = deal.dealName.toLowerCase()
    if (dealNameLower.length > 3 && subjectLower.includes(dealNameLower)) {
      return { matchedDealId: deal.id, suggestedDealIds: [] }
    }
  }

  // 4. No match — suggest top 3 most recently updated deals
  const suggested = deals
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 3)
    .map(d => d.id)

  return { matchedDealId: null, suggestedDealIds: suggested }
}

// ── Extract sender info from formData / JSON ────────────────────────────────

function parseSenderInfo(from: string): { email: string; name: string | null } {
  // "John Doe <john@example.com>" format
  const match = from.match(/^(.+?)\s*<([^>]+)>/)
  if (match) {
    return { email: match[2].trim().toLowerCase(), name: match[1].trim().replace(/^["']|["']$/g, '') }
  }
  return { email: from.trim().toLowerCase(), name: null }
}

function extractWorkspaceId(toField: string): string | null {
  // Format: {workspaceId}@ingest.halvex.ai or ws-{token}@inbound.halvex.ai
  // Support both formats
  const addresses = toField.split(',').map(a => a.trim())
  for (const addr of addresses) {
    // Extract email from "Name <email>" format
    const emailMatch = addr.match(/<([^>]+)>/)
    const email = emailMatch ? emailMatch[1] : addr

    // New format: {workspaceId}@ingest.halvex.ai
    const ingestMatch = email.match(/^([a-f0-9-]{36})@ingest\.halvex\.ai$/i)
    if (ingestMatch) return ingestMatch[1]

    // Legacy format: ws-{token}@inbound.halvex.ai
    const legacyMatch = email.match(/^ws-([a-f0-9]{8})@inbound\.halvex\.ai$/i)
    if (legacyMatch) return legacyMatch[1] // Returns the token, resolved below
  }
  return null
}

// ── POST handler (SendGrid Inbound Parse webhook) ───────────────────────────

export async function POST(req: NextRequest) {
  try {
    let to = ''
    let from = ''
    let subject = ''
    let textBody = ''

    // SendGrid sends multipart/form-data for Inbound Parse
    const contentType = req.headers.get('content-type') ?? ''
    if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData()
      to = (formData.get('to') as string) ?? ''
      from = (formData.get('from') as string) ?? ''
      subject = (formData.get('subject') as string) ?? ''
      textBody = (formData.get('text') as string) ?? ''
      if (!textBody) {
        textBody = (formData.get('html') as string) ?? ''
      }
    } else {
      // JSON body (Resend, Postmark, or direct API calls)
      const body = await req.json()
      to = (body.to ?? body.To ?? '') as string
      from = (body.from ?? body.From ?? '') as string
      subject = (body.subject ?? body.Subject ?? '') as string
      textBody = (body.text ?? body.TextBody ?? body.html ?? body.HtmlBody ?? '') as string
    }

    if (!to || !from) {
      return NextResponse.json({ ok: true, note: 'missing_fields' })
    }

    // Extract workspace identifier from the to address
    const workspaceIdentifier = extractWorkspaceId(to)
    if (!workspaceIdentifier) {
      console.log('[ingest/email] No workspace identifier found in To:', to)
      return NextResponse.json({ ok: true, note: 'no_workspace_identifier' })
    }

    // Resolve workspace — try direct UUID first, then token lookup
    let workspace: { id: string; pipelineConfig: unknown } | undefined
    if (workspaceIdentifier.length === 36 && workspaceIdentifier.includes('-')) {
      // UUID format — direct workspace ID lookup
      const [ws] = await db
        .select({ id: workspaces.id, pipelineConfig: workspaces.pipelineConfig })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceIdentifier))
        .limit(1)
      workspace = ws
    }
    if (!workspace) {
      // Token format — lookup by inbound_email_token
      const [ws] = await db
        .select({ id: workspaces.id, pipelineConfig: workspaces.pipelineConfig })
        .from(workspaces)
        .where(eq(workspaces.inboundEmailToken, workspaceIdentifier))
        .limit(1)
      workspace = ws
    }

    if (!workspace) {
      console.log('[ingest/email] No workspace found for identifier:', workspaceIdentifier)
      return NextResponse.json({ ok: true, note: 'workspace_not_found' })
    }

    if (!isAutomationEnabled(workspace.pipelineConfig, 'email_ingestion')) {
      return NextResponse.json({ ok: true, matched: false, note: 'email_ingestion_disabled' })
    }

    const { email: fromEmail, name: fromName } = parseSenderInfo(from)
    const cleanedBody = cleanEmailBody(textBody)
    const receivedAt = new Date()

    // Load all active deals for matching
    const allDeals = await db
      .select({
        id: dealLogs.id,
        dealName: dealLogs.dealName,
        prospectCompany: dealLogs.prospectCompany,
        contacts: dealLogs.contacts,
        meetingNotes: dealLogs.meetingNotes,
        updatedAt: dealLogs.updatedAt,
      })
      .from(dealLogs)
      .where(eq(dealLogs.workspaceId, workspace.id))
      .orderBy(desc(dealLogs.updatedAt))

    const { matchedDealId, suggestedDealIds } = matchEmailToDeal(
      fromEmail,
      subject,
      allDeals,
    )

    if (matchedDealId) {
      // Matched — append to deal's meetingNotes
      const deal = allDeals.find(d => d.id === matchedDealId)
      const formattedDate = receivedAt.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
      const noteBlock = `[Email from ${fromName ?? fromEmail}] ${subject}\n\n${cleanedBody}`
      const currentNotes = (deal?.meetingNotes as string) ?? ''
      const newNotes = currentNotes
        ? `${currentNotes}\n---\n${noteBlock}`
        : noteBlock

      await db
        .update(dealLogs)
        .set({
          meetingNotes: newNotes,
          noteSource: 'email',
          updatedAt: new Date(),
        })
        .where(eq(dealLogs.id, matchedDealId))

      // Trigger brain rebuild in background
      const wsId = workspace.id
      after(async () => {
        try {
          await requestBrainRebuild(wsId, `email_ingest:${matchedDealId}`)
        } catch (err) {
          console.error('[ingest/email] Background processing error:', err)
        }
      })

      console.log(`[ingest/email] Matched email from ${fromEmail} to deal ${matchedDealId}`)
      return NextResponse.json({ ok: true, matched: true, dealId: matchedDealId })
    } else {
      // Unmatched — store for manual review
      await db.insert(unmatchedEmails).values({
        workspaceId: workspace.id,
        fromEmail,
        fromName,
        subject,
        body: cleanedBody,
        suggestedDealIds,
        status: 'pending',
        receivedAt,
      })

      console.log(`[ingest/email] Unmatched email from ${fromEmail} for workspace ${workspace.id}`)
      return NextResponse.json({ ok: true, matched: false, note: 'unmatched_stored' })
    }
  } catch (err) {
    console.error('[ingest/email] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
