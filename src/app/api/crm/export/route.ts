export const dynamic = 'force-dynamic'

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

import { getCrmWorkspacePayload, getDemoCrmWorkspacePayload, getDemoCrmWorkspaceState } from '@/lib/sme-crm'
import { getWorkspaceContext } from '@/lib/workspace'

function csvCell(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}

function csvDate(value?: string | Date | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function workspaceToCsv(workspace: ReturnType<typeof getDemoCrmWorkspacePayload>) {
  const rows = [
    ['company', 'primary_contact', 'owner', 'stage', 'status', 'value', 'probability', 'close_date', 'risk', 'channel', 'next_step'],
    ...workspace.leads.map(lead => [
      lead.companyName,
      lead.primaryPersonName,
      lead.owner,
      lead.stageName,
      lead.status,
      lead.valueAmount,
      lead.probability,
      csvDate(lead.expectedCloseDate),
      lead.risk,
      lead.channel,
      lead.nextStep,
    ]),
  ]

  return rows.map(row => row.map(csvCell).join(',')).join('\n')
}

export async function GET(req: NextRequest) {
  try {
    const format = req.nextUrl.searchParams.get('format') === 'json' ? 'json' : 'csv'
    let workspace: Awaited<ReturnType<typeof getCrmWorkspacePayload>>

    if (process.env.NODE_ENV === 'development' && process.env.HALVEX_LOCAL_DATABASE !== '1') {
      workspace = getDemoCrmWorkspaceState()
    } else {
      const { userId } = await auth()
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      const user = await currentUser()
      const email = user?.emailAddresses[0]?.emailAddress
      const { workspaceId } = await getWorkspaceContext(userId, email)
      workspace = await getCrmWorkspacePayload(workspaceId)
    }

    if (format === 'json') {
      return NextResponse.json(workspace, {
        headers: {
          'Cache-Control': 'no-store',
          'Content-Disposition': 'attachment; filename="halvex-crm-export.json"',
        },
      })
    }

    return new NextResponse(workspaceToCsv(workspace), {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Disposition': 'attachment; filename="halvex-deals-export.csv"',
        'Content-Type': 'text/csv; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('[GET /api/crm/export]', error)
    return NextResponse.json({ error: 'Unable to export workspace' }, { status: 500 })
  }
}
