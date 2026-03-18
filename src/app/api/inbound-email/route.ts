import { NextRequest, NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workspaces, dealLogs } from '@/lib/db/schema'
import crypto from 'crypto'

// Ensure the inbound_email_token column exists (safe ADD COLUMN IF NOT EXISTS)
let _columnEnsured = false
async function ensureInboundEmailTokenColumn() {
  if (_columnEnsured) return
  _columnEnsured = true
  try {
    await db.execute(sql`
      ALTER TABLE workspaces
      ADD COLUMN IF NOT EXISTS inbound_email_token text
    `)
  } catch { /* already exists */ }
}

function extractTextBody(body: Record<string, unknown>): string {
  // Resend inbound: body.text / body.html
  // Postmark inbound: body.TextBody / body.HtmlBody
  const text = (body.text ?? body.TextBody) as string | undefined
  const html = (body.html ?? body.HtmlBody) as string | undefined
  return (text ?? html ?? '').trim()
}

function extractFrom(body: Record<string, unknown>): string {
  // Resend: body.from (string)
  // Postmark: body.From (string)
  const from = (body.from ?? body.From ?? '') as string
  // Extract email address from "Name <email>" format
  const match = from.match(/<([^>]+)>/)
  return match ? match[1].toLowerCase() : from.toLowerCase()
}

function extractTo(body: Record<string, unknown>): string[] {
  // Resend: body.to (string | string[])
  // Postmark: body.To (string), body.ToFull (array of {Email})
  const toRaw = body.to ?? body.To ?? ''
  const toFull = body.ToFull as Array<{ Email?: string }> | undefined

  const addresses: string[] = []

  if (toFull && Array.isArray(toFull)) {
    for (const t of toFull) {
      if (t.Email) addresses.push(t.Email.toLowerCase())
    }
  }

  if (addresses.length === 0) {
    const toStr = Array.isArray(toRaw) ? toRaw.join(',') : String(toRaw)
    // Split by comma and extract each address
    for (const part of toStr.split(',')) {
      const match = part.trim().match(/<([^>]+)>/)
      const addr = match ? match[1] : part.trim()
      if (addr) addresses.push(addr.toLowerCase())
    }
  }

  return addresses
}

function extractSubject(body: Record<string, unknown>): string {
  return ((body.subject ?? body.Subject ?? '') as string).trim()
}

function extractDate(body: Record<string, unknown>): string {
  const d = body.date ?? body.Date ?? body.timestamp ?? body.Timestamp
  if (!d) return new Date().toISOString()
  try { return new Date(d as string).toISOString() } catch { return new Date().toISOString() }
}

function extractTokenFromTo(toAddresses: string[]): string | null {
  // Look for ws-{token}@inbound.sellsight.ai in any of the To addresses
  for (const addr of toAddresses) {
    const match = addr.match(/^ws-([a-f0-9]{8})@inbound\.sellsight\.ai$/)
    if (match) return match[1]
  }
  return null
}

export async function POST(req: NextRequest) {
  // Verify shared secret
  const secret = process.env.INBOUND_EMAIL_SECRET
  if (secret) {
    const provided = req.headers.get('x-webhook-secret')
    if (!provided) {
      // Also check query param for providers that can't set headers
      const { searchParams } = new URL(req.url)
      const qsSecret = searchParams.get('secret')
      if (qsSecret !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } else {
      // Constant-time comparison
      const secretBuf = Buffer.from(secret)
      const providedBuf = Buffer.from(provided)
      if (secretBuf.length !== providedBuf.length || !crypto.timingSafeEqual(secretBuf, providedBuf)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    await ensureInboundEmailTokenColumn()

    const toAddresses = extractTo(body)
    const token = extractTokenFromTo(toAddresses)

    if (!token) {
      console.log('[inbound-email] No workspace token found in To addresses:', toAddresses)
      return NextResponse.json({ ok: true, note: 'no_token_found' })
    }

    // Look up workspace by token
    const [workspace] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.inboundEmailToken, token))
      .limit(1)

    if (!workspace) {
      console.log('[inbound-email] No workspace found for token:', token)
      return NextResponse.json({ ok: true, note: 'workspace_not_found' })
    }

    const fromEmail = extractFrom(body)
    const subject = extractSubject(body)
    const textBody = extractTextBody(body)
    const dateStr = extractDate(body)
    const formattedDate = new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

    // Build the formatted note block
    const emailBlock = [
      `[Email — ${formattedDate}]`,
      `From: ${fromEmail}`,
      `Subject: ${subject}`,
      '',
      textBody,
      '---',
    ].join('\n')

    // Try to match to a deal by contact email
    // contacts is jsonb array of {email?, name?, title?, phone?} objects
    const allDeals = await db
      .select({ id: dealLogs.id, contacts: dealLogs.contacts, meetingNotes: dealLogs.meetingNotes })
      .from(dealLogs)
      .where(eq(dealLogs.workspaceId, workspace.id))

    let matchedDealId: string | null = null
    for (const deal of allDeals) {
      const contacts = (deal.contacts ?? []) as Array<{ email?: string }>
      const hasMatch = contacts.some(c =>
        c.email && c.email.toLowerCase() === fromEmail
      )
      if (hasMatch) {
        matchedDealId = deal.id
        break
      }
    }

    if (matchedDealId) {
      // Append to meetingNotes
      const existing = allDeals.find(d => d.id === matchedDealId)
      const currentNotes = existing?.meetingNotes ?? ''
      const separator = currentNotes.trim() ? '\n\n' : ''
      const newNotes = currentNotes + separator + emailBlock

      await db
        .update(dealLogs)
        .set({ meetingNotes: newNotes, updatedAt: new Date() })
        .where(eq(dealLogs.id, matchedDealId))

      console.log(`[inbound-email] Appended to deal ${matchedDealId} for workspace ${workspace.id}`)
      return NextResponse.json({ ok: true, matched: true, dealId: matchedDealId })
    } else {
      // TODO: unmatched email — no deal contact matched fromEmail
      console.log(`[inbound-email] Unmatched email from ${fromEmail} for workspace ${workspace.id} — no contact match found`)
      return NextResponse.json({ ok: true, matched: false, note: 'no_deal_match' })
    }
  } catch (err) {
    console.error('[inbound-email] Error processing inbound email:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
