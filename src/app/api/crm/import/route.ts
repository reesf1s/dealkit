import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { dbErrResponse } from '@/lib/api-helpers'
import { buildImportPreview, type FieldMapping, type ImportType } from '@/lib/crm/import'
import { createNativeCompany, createNativeContact, createNativeDeal } from '@/lib/crm/core'
import { getWorkspaceContext } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

function importType(value: unknown): ImportType | null {
  return value === 'companies' || value === 'contacts' || value === 'deals' ? value : null
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const body = await req.json()
    const type = importType(body.type)
    if (!type) return NextResponse.json({ error: 'type must be companies, contacts, or deals' }, { status: 400 })
    if (!body.csv || typeof body.csv !== 'string') return NextResponse.json({ error: 'csv is required' }, { status: 400 })

    const preview = buildImportPreview(type, body.csv, body.mapping as FieldMapping | undefined)
    if (preview.totalRows > 1000) {
      return NextResponse.json({ error: 'CSV import is limited to 1,000 rows in V1.' }, { status: 400 })
    }
    if (body.dryRun !== false) return NextResponse.json({ data: preview })

    const imported: Array<{ rowNumber: number; id: string }> = []
    const failed = preview.validation.filter(row => !row.valid).map(row => ({
      rowNumber: row.rowNumber,
      errors: row.errors,
    }))

    for (const row of preview.validation.filter(row => row.valid)) {
      try {
        if (type === 'companies') {
          const company = await createNativeCompany({
            workspaceId,
            userId,
            name: String(row.values.name),
            domain: row.values.domain ? String(row.values.domain) : null,
            website: row.values.website ? String(row.values.website) : null,
            industry: row.values.industry ? String(row.values.industry) : null,
            sizeLabel: row.values.sizeLabel ? String(row.values.sizeLabel) : null,
            source: 'csv_import',
          })
          imported.push({ rowNumber: row.rowNumber, id: company.id })
        } else if (type === 'contacts') {
          const contact = await createNativeContact({
            workspaceId,
            userId,
            fullName: String(row.values.fullName),
            email: row.values.email ? String(row.values.email) : null,
            phone: row.values.phone ? String(row.values.phone) : null,
            jobTitle: row.values.jobTitle ? String(row.values.jobTitle) : null,
            companyName: row.values.companyName ? String(row.values.companyName) : null,
            source: 'csv_import',
          })
          imported.push({ rowNumber: row.rowNumber, id: contact.id })
        } else {
          const deal = await createNativeDeal({
            workspaceId,
            userId,
            title: String(row.values.title),
            companyName: String(row.values.companyName),
            valueAmount: typeof row.values.valueAmount === 'number' ? row.values.valueAmount : null,
            expectedCloseDate: row.values.expectedCloseDate instanceof Date ? row.values.expectedCloseDate : null,
            source: 'csv_import',
          })
          imported.push({ rowNumber: row.rowNumber, id: deal.id })
        }
      } catch (err) {
        failed.push({ rowNumber: row.rowNumber, errors: [(err as Error)?.message ?? 'Import failed.'] })
      }
    }

    return NextResponse.json({
      data: {
        ...preview,
        importedRows: imported.length,
        imported,
        failed,
      },
    })
  } catch (err) {
    return dbErrResponse(err)
  }
}
