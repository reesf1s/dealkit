import crypto from 'crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { decrypt, encrypt, getEncryptionKey } from '@/lib/encrypt'
import {
  crmCalendarEvents,
  crmCompanies,
  crmContacts,
  crmDealParticipants,
  crmDeals,
  googleConnections,
} from '@/lib/db/schema'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
]

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

function googleClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Google Calendar OAuth is not configured')
  return { clientId, clientSecret }
}

function signState(payload: Record<string, string>) {
  const secret = process.env.CLERK_SECRET_KEY ?? process.env.ENCRYPTION_KEY ?? 'dev-state-secret'
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

function verifyState(state: string) {
  const secret = process.env.CLERK_SECRET_KEY ?? process.env.ENCRYPTION_KEY ?? 'dev-state-secret'
  const [body, sig] = state.split('.')
  if (!body || !sig) throw new Error('Invalid OAuth state')
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error('Invalid OAuth state signature')
  }
  return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { workspaceId: string; userId: string }
}

export function buildGoogleAuthUrl(workspaceId: string, userId: string) {
  const { clientId } = googleClient()
  const url = new URL(GOOGLE_AUTH_URL)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', `${appUrl()}/api/integrations/google/callback`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('scope', SCOPES.join(' '))
  url.searchParams.set('state', signState({ workspaceId, userId }))
  return url.toString()
}

async function exchangeCode(code: string) {
  const { clientId, clientSecret } = googleClient()
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${appUrl()}/api/integrations/google/callback`,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`)
  return await res.json() as {
    access_token: string
    refresh_token?: string
    expires_in?: number
    scope?: string
  }
}

async function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = googleClient()
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`)
  return await res.json() as { access_token: string; expires_in?: number; scope?: string }
}

async function fetchGoogleEmail(accessToken: string) {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const user = await res.json() as { email?: string }
  return user.email ?? null
}

export async function handleGoogleCallback(code: string, state: string) {
  const parsed = verifyState(state)
  const token = await exchangeCode(code)
  const key = getEncryptionKey()
  const googleEmail = await fetchGoogleEmail(token.access_token)
  const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null

  await db.insert(googleConnections).values({
    workspaceId: parsed.workspaceId,
    userId: parsed.userId,
    googleAccountEmail: googleEmail,
    accessTokenEnc: encrypt(token.access_token, key),
    refreshTokenEnc: token.refresh_token ? encrypt(token.refresh_token, key) : null,
    expiresAt,
    scopes: token.scope?.split(' ') ?? SCOPES,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: [googleConnections.workspaceId, googleConnections.userId],
    set: {
      googleAccountEmail: googleEmail,
      accessTokenEnc: encrypt(token.access_token, key),
      refreshTokenEnc: token.refresh_token ? encrypt(token.refresh_token, key) : undefined,
      expiresAt,
      scopes: token.scope?.split(' ') ?? SCOPES,
      syncError: null,
      updatedAt: new Date(),
    },
  })

  return parsed
}

async function getFreshAccessToken(connection: typeof googleConnections.$inferSelect) {
  const key = getEncryptionKey()
  let accessToken = decrypt(connection.accessTokenEnc, key)
  const needsRefresh = connection.expiresAt && connection.expiresAt.getTime() < Date.now() + 60_000
  if (!needsRefresh) return accessToken
  if (!connection.refreshTokenEnc) return accessToken

  const refreshed = await refreshAccessToken(decrypt(connection.refreshTokenEnc, key))
  accessToken = refreshed.access_token
  await db.update(googleConnections).set({
    accessTokenEnc: encrypt(accessToken, key),
    expiresAt: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : connection.expiresAt,
    updatedAt: new Date(),
  }).where(eq(googleConnections.id, connection.id))
  return accessToken
}

async function matchEventToCrm(workspaceId: string, attendeeEmails: string[]) {
  const emails = attendeeEmails.map(email => email.toLowerCase()).filter(Boolean)
  if (emails.length === 0) return { contactId: null, companyId: null, dealId: null }

  for (const email of emails) {
    const [contact] = await db
      .select({
        contactId: crmContacts.id,
        companyId: crmContacts.companyId,
      })
      .from(crmContacts)
      .where(and(eq(crmContacts.workspaceId, workspaceId), eq(crmContacts.email, email)))
      .limit(1)

    if (contact) {
      const [participant] = await db
        .select({ dealId: crmDealParticipants.dealId })
        .from(crmDealParticipants)
        .innerJoin(crmDeals, eq(crmDeals.id, crmDealParticipants.dealId))
        .where(and(
          eq(crmDealParticipants.workspaceId, workspaceId),
          eq(crmDealParticipants.contactId, contact.contactId),
          eq(crmDeals.status, 'open'),
        ))
        .limit(1)
      return { contactId: contact.contactId, companyId: contact.companyId, dealId: participant?.dealId ?? null }
    }
  }

  for (const email of emails) {
    const domain = email.split('@')[1]
    if (!domain) continue
    const [company] = await db
      .select({ companyId: crmCompanies.id })
      .from(crmCompanies)
      .where(and(eq(crmCompanies.workspaceId, workspaceId), eq(crmCompanies.domain, domain)))
      .limit(1)
    if (!company) continue
    const [deal] = await db
      .select({ dealId: crmDeals.id })
      .from(crmDeals)
      .where(and(eq(crmDeals.workspaceId, workspaceId), eq(crmDeals.companyId, company.companyId), eq(crmDeals.status, 'open')))
      .limit(1)
    return { contactId: null, companyId: company.companyId, dealId: deal?.dealId ?? null }
  }

  return { contactId: null, companyId: null, dealId: null }
}

export async function listGoogleStatus(workspaceId: string, userId: string) {
  const [connection] = await db
    .select({
      id: googleConnections.id,
      googleAccountEmail: googleConnections.googleAccountEmail,
      lastCalendarSyncAt: googleConnections.lastCalendarSyncAt,
      syncError: googleConnections.syncError,
      createdAt: googleConnections.createdAt,
    })
    .from(googleConnections)
    .where(and(eq(googleConnections.workspaceId, workspaceId), eq(googleConnections.userId, userId)))
    .limit(1)
  return { connected: Boolean(connection), connection: connection ?? null }
}

export async function disconnectGoogle(workspaceId: string, userId: string) {
  await db.delete(googleConnections).where(and(eq(googleConnections.workspaceId, workspaceId), eq(googleConnections.userId, userId)))
}

export async function syncGoogleCalendar(workspaceId: string, userId: string) {
  const [connection] = await db
    .select()
    .from(googleConnections)
    .where(and(eq(googleConnections.workspaceId, workspaceId), eq(googleConnections.userId, userId)))
    .limit(1)
  if (!connection) throw new Error('Google Calendar is not connected')

  const accessToken = await getFreshAccessToken(connection)
  const timeMin = new Date().toISOString()
  const timeMax = new Date(Date.now() + 30 * 86_400_000).toISOString()
  const url = new URL(GOOGLE_CALENDAR_EVENTS_URL)
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.set('orderBy', 'startTime')
  url.searchParams.set('maxResults', '50')
  url.searchParams.set('timeMin', timeMin)
  url.searchParams.set('timeMax', timeMax)

  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } })
  if (!res.ok) {
    const error = await res.text()
    await db.update(googleConnections).set({ syncError: error, updatedAt: new Date() }).where(eq(googleConnections.id, connection.id))
    throw new Error(`Google Calendar sync failed: ${error}`)
  }
  const payload = await res.json() as { items?: Array<{
    id: string
    summary?: string
    description?: string
    hangoutLink?: string
    htmlLink?: string
    start?: { dateTime?: string; date?: string }
    end?: { dateTime?: string; date?: string }
    attendees?: Array<{ email?: string; displayName?: string; responseStatus?: string }>
  }> }

  let imported = 0
  let linked = 0
  for (const item of payload.items ?? []) {
    const startsAtRaw = item.start?.dateTime ?? item.start?.date
    if (!startsAtRaw) continue
    const endsAtRaw = item.end?.dateTime ?? item.end?.date
    const attendees = (item.attendees ?? []).filter(attendee => attendee.email)
    const attendeeEmails = attendees.map(attendee => attendee.email!).filter(email => email !== connection.googleAccountEmail)
    const match = await matchEventToCrm(workspaceId, attendeeEmails)
    if (match.dealId || match.companyId || match.contactId) linked++

    await db.insert(crmCalendarEvents).values({
      workspaceId,
      dealId: match.dealId,
      companyId: match.companyId,
      contactId: match.contactId,
      provider: 'google_calendar',
      externalId: item.id,
      title: item.summary ?? 'Untitled meeting',
      description: item.description ?? null,
      startsAt: new Date(startsAtRaw),
      endsAt: endsAtRaw ? new Date(endsAtRaw) : null,
      attendees,
      meetingUrl: item.hangoutLink ?? item.htmlLink ?? null,
      source: 'google_calendar',
      metadata: { htmlLink: item.htmlLink },
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [crmCalendarEvents.workspaceId, crmCalendarEvents.provider, crmCalendarEvents.externalId],
      set: {
        dealId: match.dealId,
        companyId: match.companyId,
        contactId: match.contactId,
        title: item.summary ?? 'Untitled meeting',
        description: item.description ?? null,
        startsAt: new Date(startsAtRaw),
        endsAt: endsAtRaw ? new Date(endsAtRaw) : null,
        attendees,
        meetingUrl: item.hangoutLink ?? item.htmlLink ?? null,
        metadata: { htmlLink: item.htmlLink },
        updatedAt: new Date(),
      },
    })
    imported++
  }

  await db.update(googleConnections).set({
    lastCalendarSyncAt: new Date(),
    syncError: null,
    updatedAt: new Date(),
  }).where(eq(googleConnections.id, connection.id))

  return { imported, linked }
}
