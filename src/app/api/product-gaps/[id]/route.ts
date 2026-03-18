export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { productGaps, companyProfiles } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    const body = await req.json()
    const { userId: _uid, workspaceId: _wid, ...rest } = body
    const [gap] = await db.update(productGaps).set({ ...rest, updatedAt: new Date() }).where(and(eq(productGaps.id, id), eq(productGaps.workspaceId, workspaceId))).returning()
    if (!gap) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: gap })
  } catch (e: unknown) { console.error('[product-gaps] failed:', e instanceof Error ? e.message : e); return NextResponse.json({ error: 'Operation failed' }, { status: 500 }) }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params

    // Read optional reason from body (DELETE can have a body)
    let reason: string | undefined
    let gapTitle: string | undefined
    try {
      const body = await req.json()
      reason = body?.reason?.trim() || undefined
    } catch { /* no body is fine */ }

    // Fetch the gap title before deleting (for KB entry)
    if (reason) {
      const [gap] = await db
        .select({ title: productGaps.title })
        .from(productGaps)
        .where(and(eq(productGaps.id, id), eq(productGaps.workspaceId, workspaceId)))
        .limit(1)
      gapTitle = gap?.title
    }

    await db.delete(productGaps).where(and(eq(productGaps.id, id), eq(productGaps.workspaceId, workspaceId)))

    // If a reason was provided, add it to the company profile's knownCapabilities so
    // the AI won't flag this as a gap again
    if (reason && gapTitle) {
      const entry = `${gapTitle}: ${reason}`
      const [profile] = await db
        .select({ id: companyProfiles.id, knownCapabilities: companyProfiles.knownCapabilities })
        .from(companyProfiles)
        .where(eq(companyProfiles.workspaceId, workspaceId))
        .limit(1)
      if (profile) {
        const existing = (profile.knownCapabilities as string[]) ?? []
        // Avoid exact duplicates
        if (!existing.includes(entry)) {
          await db.update(companyProfiles)
            .set({ knownCapabilities: [...existing, entry], updatedAt: new Date() })
            .where(eq(companyProfiles.id, profile.id))
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (e: unknown) { console.error('[product-gaps] failed:', e instanceof Error ? e.message : e); return NextResponse.json({ error: 'Operation failed' }, { status: 500 }) }
}
