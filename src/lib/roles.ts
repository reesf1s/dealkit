/**
 * Role helpers — product-feature access control.
 *
 * Halvex has two independent role axes on a workspace member:
 *
 *   role    (workspace_memberships.role)      — workspace admin: owner | admin | member
 *   appRole (workspace_memberships.app_role)  — feature access: sales | product | admin
 *
 * Roles:
 *   sales   — log deals, ask Slack bot, request prioritisation. Cannot approve cycle moves.
 *   product — approve/decline prioritisation, see revenue impact. Cannot manage workspace.
 *   admin   — full access: sales + product + user management + integrations + billing.
 */

import { db } from '@/lib/db'
import { workspaceMemberships, slackUserMappings } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'

export type AppRole = 'sales' | 'product' | 'admin'

/** Role hierarchy: admin > product > sales */
const ROLE_ORDER: Record<AppRole, number> = { sales: 0, product: 1, admin: 2 }

/**
 * Check if a user has at least the given role level.
 */
export function hasRole(userRole: AppRole, requiredRole: AppRole): boolean {
  return ROLE_ORDER[userRole] >= ROLE_ORDER[requiredRole]
}

/**
 * Return the appRole for a given user in a given workspace.
 * Returns 'sales' as the default if no membership record exists.
 */
export async function getUserRole(userId: string, workspaceId: string): Promise<AppRole> {
  const [membership] = await db
    .select({ appRole: workspaceMemberships.appRole })
    .from(workspaceMemberships)
    .where(and(
      eq(workspaceMemberships.userId, userId),
      eq(workspaceMemberships.workspaceId, workspaceId),
    ))
    .limit(1)

  const raw = membership?.appRole
  if (raw === 'product' || raw === 'admin') return raw
  return 'sales'
}

/**
 * Return all members of a workspace with at least the given role, together with
 * their Slack user IDs. Used to find which PMs/admins to DM for approval.
 *
 * appRole === 'product' → returns product + admin members
 * appRole === 'admin'   → returns admin-only members
 */
export async function getMembersWithRole(
  workspaceId: string,
  appRole: AppRole,
): Promise<{ userId: string; slackUserId: string | null }[]> {
  const allMembers = await db
    .select({ userId: workspaceMemberships.userId, appRole: workspaceMemberships.appRole })
    .from(workspaceMemberships)
    .where(eq(workspaceMemberships.workspaceId, workspaceId))

  const matchingUserIds = allMembers
    .filter(m => hasRole((m.appRole ?? 'sales') as AppRole, appRole))
    .map(m => m.userId)

  if (matchingUserIds.length === 0) return []

  const slackMappings = await db
    .select({ clerkUserId: slackUserMappings.clerkUserId, slackUserId: slackUserMappings.slackUserId })
    .from(slackUserMappings)
    .where(eq(slackUserMappings.workspaceId, workspaceId))

  const slackById = new Map(slackMappings.map(m => [m.clerkUserId, m.slackUserId]))

  return matchingUserIds.map(userId => ({
    userId,
    slackUserId: slackById.get(userId) ?? null,
  }))
}
