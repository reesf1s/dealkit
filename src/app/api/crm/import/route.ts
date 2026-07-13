export const dynamic = 'force-dynamic'

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

import { logWorkspaceEvent } from '@/lib/audit'
import { CRM_IMPORT_TEMPLATE, importRowToLeadInput, parseCrmImportCsv } from '@/lib/crm-import'
import { addDemoCrmLead, createCrmLead } from '@/lib/sme-crm'
import { getWorkspaceContext } from '@/lib/workspace'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { csv?: unknown; dryRun?: unknown }
    if (typeof body.csv !== 'string') {
      return NextResponse.json({ error: 'CSV text is required', template: CRM_IMPORT_TEMPLATE }, { status: 400 })
    }

    const parsed = parseCrmImportCsv(body.csv)
    if (parsed.errors.length) {
      return NextResponse.json({ rows: parsed.rows, errors: parsed.errors, template: CRM_IMPORT_TEMPLATE }, { status: 400 })
    }

    if (!parsed.rows.length) {
      return NextResponse.json({ error: 'No importable rows found', template: CRM_IMPORT_TEMPLATE }, { status: 400 })
    }

    if (process.env.NODE_ENV === 'development' && process.env.HALVEX_LOCAL_DATABASE !== '1') {
      if (body.dryRun === true) return NextResponse.json({ rows: parsed.rows, errors: [] })
      const leads = parsed.rows.map(row => addDemoCrmLead(importRowToLeadInput(row)))
      return NextResponse.json({ imported: leads.length, leads, rows: parsed.rows, errors: [] })
    }

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (body.dryRun === true) {
      return NextResponse.json({ rows: parsed.rows, errors: [] })
    }

    const user = await currentUser()
    const email = user?.emailAddresses[0]?.emailAddress
    const { workspaceId } = await getWorkspaceContext(userId, email)
    const leads = []

    for (const row of parsed.rows) {
      leads.push(await createCrmLead({ workspaceId, ownerId: userId, data: importRowToLeadInput(row) }))
    }

    await logWorkspaceEvent({
      workspaceId,
      userId,
      type: 'crm.import.completed',
      metadata: {
        imported: leads.length,
        companies: leads.map(lead => lead.companyName).slice(0, 20),
      },
    })

    return NextResponse.json({ imported: leads.length, leads, rows: parsed.rows, errors: [] })
  } catch (error) {
    console.error('[POST /api/crm/import]', error)
    return NextResponse.json({ error: 'Unable to import CRM records' }, { status: 500 })
  }
}
