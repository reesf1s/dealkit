import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workspaces, workspaceMemberships } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { slug } = await req.json()
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 })
  // Ensure user row exists
  await getWorkspaceContext(userId)
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.slug, slug.toLowerCase().trim())).limit(1)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found. Check the join code and try again.' }, { status: 404 })
  const [existing] = await db.select({ id: workspaceMemberships.id }).from(workspaceMemberships).where(eq(workspaceMemberships.userId, userId)).limit(1)
  if (existing) return NextResponse.json({ error: 'You are already a member of a workspace. Leave your current workspace first.' }, { status: 409 })
  await db.insert(workspaceMemberships).values({ workspaceId: workspace.id, userId, role: 'member', createdAt: new Date() })
  return NextResponse.json({ data: { workspaceId: workspace.id, name: workspace.name, slug: workspace.slug } })
}
