export const dynamic = 'force-dynamic'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

// DELETE /api/account — permanently delete the user's account and all data
export async function DELETE() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Delete all DB data first (cascades via FK constraints)
    await db.delete(users).where(eq(users.id, userId))

    // Delete Clerk account (this signs out all sessions too)
    const clerk = await clerkClient()
    await clerk.users.deleteUser(userId)

    return NextResponse.json({ deleted: true })
  } catch (e: unknown) {
    console.error('[account] deletion failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Deletion failed' }, { status: 500 })
  }
}
