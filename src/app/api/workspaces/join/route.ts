import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, count, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workspaces, workspaceMemberships, users } from '@/lib/db/schema'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const code: string = body?.code?.trim()?.toLowerCase()
    if (!code) return NextResponse.json({ error: 'Join code is required' }, { status: 400 })

    // Find the target workspace by slug (join code)
    const [targetWorkspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.slug, code))
      .limit(1)

    if (!targetWorkspace) {
      return NextResponse.json(
        { error: 'No workspace found with that code. Double-check and try again.' },
        { status: 404 },
      )
    }

    // Already a member — just return success
    const [existing] = await db
      .select()
      .from(workspaceMemberships)
      .where(and(eq(workspaceMemberships.workspaceId, targetWorkspace.id), eq(workspaceMemberships.userId, userId)))
      .limit(1)

    if (existing) {
      return NextResponse.json({ data: { workspaceId: targetWorkspace.id, workspaceName: targetWorkspace.name } })
    }

    // Ensure user row exists
    await db.insert(users).values({
      id: userId,
      email: `${userId}@clerk.placeholder`,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoNothing()

    // Check if user has an auto-created personal workspace to clean up
    const [personalMembership] = await db
      .select({ workspaceId: workspaceMemberships.workspaceId, role: workspaceMemberships.role })
      .from(workspaceMemberships)
      .where(eq(workspaceMemberships.userId, userId))
      .limit(1)

    if (personalMembership?.role === 'owner') {
      const [ws] = await db
        .select({ name: workspaces.name })
        .from(workspaces)
        .where(eq(workspaces.id, personalMembership.workspaceId))
        .limit(1)

      const [{ value: memberCount }] = await db
        .select({ value: count() })
        .from(workspaceMemberships)
        .where(eq(workspaceMemberships.workspaceId, personalMembership.workspaceId))

      // Only delete the workspace if it is the default placeholder with no other members
      if (ws?.name === 'My Workspace' && Number(memberCount) <= 1) {
        await db.delete(workspaces).where(eq(workspaces.id, personalMembership.workspaceId))
      }
    }

    // Add user to the target workspace as a member
    await db.insert(workspaceMemberships).values({
      workspaceId: targetWorkspace.id,
      userId,
      role: 'member',
      createdAt: new Date(),
    }).onConflictDoNothing()

    return NextResponse.json({ data: { workspaceId: targetWorkspace.id, workspaceName: targetWorkspace.name } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
