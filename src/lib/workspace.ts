import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users, workspaces, workspaceMemberships } from '@/lib/db/schema'
import type { Plan } from '@/types'

// Generates a short human-friendly join code, e.g. "crane-47"
function generateSlug(): string {
  const words = [
    'atlas', 'bolt', 'crane', 'delta', 'echo', 'flux', 'gear',
    'helm', 'iris', 'jade', 'kite', 'lark', 'mars', 'nova',
    'onyx', 'pike', 'quad', 'reef', 'sage', 'tide', 'ursa',
    'vale', 'wren', 'xero', 'yoke', 'zest',
  ]
  const word = words[Math.floor(Math.random() * words.length)]
  const num = Math.floor(10 + Math.random() * 90)
  return `${word}-${num}`
}

export type WorkspaceContext = {
  workspaceId: string
  role: 'owner' | 'admin' | 'member'
  plan: Plan
  workspace: { id: string; name: string; slug: string; plan: Plan; stripeCustomerId: string | null }
}

const CONTEXT_FIELDS = {
  userExists: users.id,
  role: workspaceMemberships.role,
  workspaceId: workspaceMemberships.workspaceId,
  workspacePlan: workspaces.plan,
  workspaceName: workspaces.name,
  workspaceSlug: workspaces.slug,
  stripeCustomerId: workspaces.stripeCustomerId,
}

async function queryContext(userId: string) {
  const [row] = await db
    .select(CONTEXT_FIELDS)
    .from(users)
    .leftJoin(workspaceMemberships, eq(workspaceMemberships.userId, users.id))
    .leftJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.id))
    .where(eq(users.id, userId))
    .orderBy(desc(workspaceMemberships.createdAt))
    .limit(1)
  return row
}

function buildContext(row: NonNullable<Awaited<ReturnType<typeof queryContext>>>): WorkspaceContext {
  return {
    workspaceId: row.workspaceId!,
    role: row.role!,
    plan: row.workspacePlan!,
    workspace: {
      id: row.workspaceId!,
      name: row.workspaceName!,
      slug: row.workspaceSlug!,
      plan: row.workspacePlan!,
      stripeCustomerId: row.stripeCustomerId ?? null,
    },
  }
}

/**
 * Ensures the user row exists and returns their active workspace context.
 * Auto-creates a personal workspace on first sign-in (zero friction onboarding).
 *
 * Race-safe: concurrent requests on first login use onConflictDoNothing + re-query
 * so only one request wins the INSERT race; all others find the created data.
 */
export async function getWorkspaceContext(userId: string, userEmail?: string): Promise<WorkspaceContext> {
  // Step 1: Happy path — single LEFT JOIN query covers user + workspace in one round trip
  const row = await queryContext(userId)
  if (row?.workspaceId && row.workspacePlan) return buildContext(row)

  // Step 2: Ensure user row exists — onConflictDoNothing handles concurrent first-logins
  if (!row) {
    await db.insert(users).values({
      id: userId,
      email: userEmail ?? `${userId}@clerk.placeholder`,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoNothing()
  }

  // Step 3: Re-query — a concurrent request may have already created workspace+membership
  const row2 = await queryContext(userId)
  if (row2?.workspaceId && row2.workspacePlan) return buildContext(row2)

  // Step 4: We're first — create workspace + membership
  let slug = generateSlug()
  for (let i = 0; i < 5; i++) {
    const [existing] = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.slug, slug)).limit(1)
    if (!existing) break
    slug = generateSlug()
  }

  let workspace: typeof workspaces.$inferSelect | undefined
  try {
    const [created] = await db.insert(workspaces).values({
      name: 'My Workspace',
      slug,
      ownerId: userId,
      plan: 'free',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning()
    workspace = created
  } catch {
    // Another concurrent request created a workspace first — re-query and return it
    const row3 = await queryContext(userId)
    if (row3?.workspaceId && row3.workspacePlan) return buildContext(row3)
    throw new Error('Failed to create workspace')
  }

  await db.insert(workspaceMemberships).values({
    workspaceId: workspace.id,
    userId,
    role: 'owner',
    createdAt: new Date(),
  }).onConflictDoNothing()

  return {
    workspaceId: workspace.id,
    role: 'owner',
    plan: 'free',
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      plan: 'free',
      stripeCustomerId: null,
    },
  }
}
