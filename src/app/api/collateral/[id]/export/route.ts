import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { collateral } from '@/lib/db/schema'
import { generateDocx } from '@/lib/export/docx'
import type { CollateralContent } from '@/types'

interface Params {
  params: Promise<{ id: string }>
}

// POST /api/collateral/[id]/export — generate and download a .docx file
export async function POST(_req: NextRequest, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [item] = await db
    .select()
    .from(collateral)
    .where(and(eq(collateral.id, id), eq(collateral.userId, userId)))
    .limit(1)

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (item.status === 'generating') {
    return NextResponse.json(
      { error: 'Collateral is still being generated. Please try again shortly.' },
      { status: 409 },
    )
  }

  if (!item.content) {
    return NextResponse.json({ error: 'Collateral has no content to export.' }, { status: 422 })
  }

  const buffer = await generateDocx(item.title, item.content as CollateralContent)

  // Sanitise title for use as a filename
  const safeTitle = item.title
    .replace(/[^a-z0-9\s-]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()

  const filename = `${safeTitle || 'collateral'}.docx`

  return new NextResponse(buffer as unknown as ReadableStream, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    },
  })
}
