/**
 * POST /api/integrations/linear/connect
 * Validate and save a Linear API key for the workspace.
 */
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { linearIntegrations } from '@/lib/db/schema'
import { validateApiKey } from '@/lib/linear-client'
import { encrypt, getEncryptionKey } from '@/lib/encrypt'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : ''
    if (!apiKey) return NextResponse.json({ error: 'apiKey is required' }, { status: 400 })

    const { workspaceId } = await getWorkspaceContext(userId)

    // Validate the key against Linear API
    const info = await validateApiKey(apiKey)

    // Encrypt and store
    const apiKeyEnc = encrypt(apiKey, getEncryptionKey())

    await db
      .insert(linearIntegrations)
      .values({
        workspaceId,
        apiKeyEnc,
        teamId: info.teamId,
        teamName: info.teamName,
        workspaceName: info.workspaceName,
      })
      .onConflictDoUpdate({
        target: linearIntegrations.workspaceId,
        set: {
          apiKeyEnc,
          teamId: info.teamId,
          teamName: info.teamName,
          workspaceName: info.workspaceName,
          syncError: null,
          updatedAt: new Date(),
        },
      })

    return NextResponse.json({
      data: {
        connected: true,
        teamName: info.teamName,
        workspaceName: info.workspaceName,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
