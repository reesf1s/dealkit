import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, count, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workspaces, workspaceMemberships, users } from '@/lib/db/schema'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await req.json()
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 })

  // Ensure user row exists without triggering workspace auto-creation
  await db.insert(users).values({
    id: userId,
    email: `${userId}@clerk.placeholder`,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoNothing()

  // Find the target workspace by slug
  const [target] = await db.select().from(workspaces).where(eq(workspaces.slug, slug.toLowerCase().trim())).limit(1)
  if (!target) return NextResponse.json({ error: 'Workspace not found. Check the join code and try again.' }, { status: 404 })

  // Check if user already has a membership
  const [existing] = await db
    .select({ id: workspaceMemberships.id, workspaceId: workspaceMemberships.workspaceId, role: workspaceMemberships.role })
    .from(workspaceMemberships)
    .where(eq(workspaceMemberships.userId, userId))
    .limit(1)

  if (existing) {
    // Already in the target workspace — idempotent
    if (existing.workspaceId === target.id) {
      return NextResponse.json({ data: { workspaceId: target.id, name: target.name, slug: target.slug } })
    }

    if (existing.role === 'owner') {
      // Only allow auto-swap if they are the SOLE member of their own workspace
      const [{ value: memberCount }] = await db
        .select({ value: count() })
        .from(workspaceMemberships)
        .where(eq(workspaceMemberships.workspaceId, existing.workspaceId))

      if (Number(memberCount) > 1) {
        return NextResponse.json(
          { error: 'You own a workspace with other members. Transfer ownership before joining another workspace.' },
          { status: 409 },
        )
      }

      // Sole owner of a personal workspace — delete it to make way for team join
      await db.delete(workspaces).where(and(
        eq(workspaces.id, existing.workspaceId),
        eq(workspaces.ownerId, userId),
      ))
      // workspace_memberships cascade-deletes with the workspace
    } else {
      return NextResponse.json(
        { error: 'You are already a member of a workspace. Leave your current workspace first.' },
        { status: 409 },
      )
    }
  }

  await db.insert(workspaceMemberships).values({
    workspaceId: target.id,
    userId,
    role: 'member',
    createdAt: new Date(),
  })

  return NextResponse.json({ data: { workspaceId: target.id, name: target.name, slug: target.slug } })
}
