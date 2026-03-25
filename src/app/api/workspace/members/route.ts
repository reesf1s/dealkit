/**
 * GET /api/workspace/members
 * Returns workspace members with their userId, email, and role.
 * Used by deal forms to populate the "Assign Rep" dropdown.
 */
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { workspaceMemberships, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getWorkspaceContext } from '@/lib/workspace'
import { dbErrResponse } from '@/lib/api-helpers'

export interface WorkspaceMember {
  userId: string
  email: string
  role: string
  appRole: string
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)

    const rows = await db
      .select({
        userId: workspaceMemberships.userId,
        email: users.email,
        role: workspaceMemberships.role,
        appRole: workspaceMemberships.appRole,
      })
      .from(workspaceMemberships)
      .innerJoin(users, eq(workspaceMemberships.userId, users.id))
      .where(eq(workspaceMemberships.workspaceId, workspaceId))

    return NextResponse.json({ data: rows })
  } catch (err) {
    return dbErrResponse(err)
  }
}
