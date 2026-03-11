import { eq, and } from 'drizzle-orm'
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

/**
 * Ensures the user row exists and returns their active workspace context.
 * Auto-creates a personal workspace on first sign-in (zero friction onboarding).
 */
export async function getWorkspaceContext(userId: string, userEmail?: string): Promise<WorkspaceContext> {
  // 1. Ensure user row exists
  const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1)
  if (!existingUser) {
    await db.insert(users).values({
      id: userId,
      email: userEmail ?? `${userId}@clerk.placeholder`,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  // 2. Find membership
  const [membership] = await db
    .select({
      role: workspaceMemberships.role,
      workspaceId: workspaceMemberships.workspaceId,
      workspacePlan: workspaces.plan,
      workspaceName: workspaces.name,
      workspaceSlug: workspaces.slug,
      stripeCustomerId: workspaces.stripeCustomerId,
    })
    .from(workspaceMemberships)
    .innerJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.id))
    .where(eq(workspaceMemberships.userId, userId))
    .limit(1)

  if (membership) {
    return {
      workspaceId: membership.workspaceId,
      role: membership.role,
      plan: membership.workspacePlan,
      workspace: {
        id: membership.workspaceId,
        name: membership.workspaceName,
        slug: membership.workspaceSlug,
        plan: membership.workspacePlan,
        stripeCustomerId: membership.stripeCustomerId,
      },
    }
  }

  // 3. No workspace yet — auto-create a personal workspace
  let slug = generateSlug()
  // Retry until unique (very unlikely to collide but safe)
  for (let i = 0; i < 5; i++) {
    const [existing] = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.slug, slug)).limit(1)
    if (!existing) break
    slug = generateSlug()
  }

  const [workspace] = await db.insert(workspaces).values({
    name: 'My Workspace',
    slug,
    ownerId: userId,
    plan: 'free',
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning()

  await db.insert(workspaceMemberships).values({
    workspaceId: workspace.id,
    userId,
    role: 'owner',
    createdAt: new Date(),
  })

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
