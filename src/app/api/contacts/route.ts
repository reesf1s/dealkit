import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

interface Contact {
  id: string
  name: string
  title: string | null
  company: string
  dealId: string
  dealName: string
  dealStage: string
  dealValue: number | null
  email: string | null
  phone: string | null
  source: 'primary' | 'secondary'
  updatedAt: string
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)

    const deals = await db
      .select({
        id: dealLogs.id,
        dealName: dealLogs.dealName,
        prospectCompany: dealLogs.prospectCompany,
        prospectName: dealLogs.prospectName,
        prospectTitle: dealLogs.prospectTitle,
        contacts: dealLogs.contacts,
        stage: dealLogs.stage,
        dealValue: dealLogs.dealValue,
        updatedAt: dealLogs.updatedAt,
      })
      .from(dealLogs)
      .where(eq(dealLogs.workspaceId, workspaceId))
      .orderBy(dealLogs.updatedAt)

    const contacts: Contact[] = []
    const seen = new Set<string>()

    for (const deal of deals) {
      // Primary contact (prospectName)
      if (deal.prospectName) {
        const key = `${deal.prospectName.toLowerCase()}-${deal.prospectCompany.toLowerCase()}`
        if (!seen.has(key)) {
          seen.add(key)
          contacts.push({
            id: `${deal.id}-primary`,
            name: deal.prospectName,
            title: deal.prospectTitle ?? null,
            company: deal.prospectCompany,
            dealId: deal.id,
            dealName: deal.dealName,
            dealStage: deal.stage,
            dealValue: deal.dealValue,
            email: null,
            phone: null,
            source: 'primary',
            updatedAt: deal.updatedAt?.toISOString() ?? new Date().toISOString(),
          })
        }
      }

      // Secondary contacts from JSONB array
      const extras = Array.isArray(deal.contacts) ? deal.contacts as Array<{
        name?: string; title?: string; email?: string; phone?: string
      }> : []

      for (const c of extras) {
        if (!c.name) continue
        const key = `${c.name.toLowerCase()}-${deal.prospectCompany.toLowerCase()}`
        if (!seen.has(key)) {
          seen.add(key)
          contacts.push({
            id: `${deal.id}-${c.name}`,
            name: c.name,
            title: c.title ?? null,
            company: deal.prospectCompany,
            dealId: deal.id,
            dealName: deal.dealName,
            dealStage: deal.stage,
            dealValue: deal.dealValue,
            email: c.email ?? null,
            phone: c.phone ?? null,
            source: 'secondary',
            updatedAt: deal.updatedAt?.toISOString() ?? new Date().toISOString(),
          })
        }
      }
    }

    // Sort by company then name
    contacts.sort((a, b) => {
      const co = a.company.localeCompare(b.company)
      if (co !== 0) return co
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json({ data: contacts })
  } catch (err) {
    return dbErrResponse(err)
  }
}
