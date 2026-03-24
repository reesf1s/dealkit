import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workspaces } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { dbErrResponse } from '@/lib/api-helpers'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)

    const [ws] = await db
      .select({ knowledgeBaseText: workspaces.knowledgeBaseText })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1)

    return NextResponse.json({ data: { text: ws?.knowledgeBaseText ?? '' } })
  } catch (err) {
    return dbErrResponse(err)
  }
}

export async function PUT(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)
    const body = await req.json()
    const text: string = body.text ?? ''

    await db
      .update(workspaces)
      .set({ knowledgeBaseText: text || null, updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId))

    return NextResponse.json({ data: { text } })
  } catch (err) {
    return dbErrResponse(err)
  }
}
