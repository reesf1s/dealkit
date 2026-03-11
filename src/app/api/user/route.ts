import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { dbErrResponse } from '@/lib/api-helpers'

// GET /api/user — returns user + workspace context
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get real email from Clerk so we never store a placeholder
    const clerkUser = await currentUser()
    const realEmail = clerkUser?.emailAddresses?.[0]?.emailAddress

    const ctx = await getWorkspaceContext(userId, realEmail)

    // Sync real email into DB if it was stored as a placeholder
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    if (user && realEmail && user.email !== realEmail) {
      await db.update(users).set({ email: realEmail, updatedAt: new Date() }).where(eq(users.id, userId))
    }

    return NextResponse.json({
      data: {
        id: userId,
        email: realEmail ?? user?.email ?? '',
        createdAt: user?.createdAt ?? new Date(),
        updatedAt: user?.updatedAt ?? new Date(),
        plan: ctx.plan,
        workspaceId: ctx.workspaceId,
        workspaceName: ctx.workspace.name,
        workspaceSlug: ctx.workspace.slug,
        role: ctx.role,
      }
    })
  } catch (err) {
    return dbErrResponse(err)
  }
}
