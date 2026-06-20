import { desc, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { events, type EventRow } from '@/lib/db/schema'
import type { CrmWorkspacePayload } from '@/lib/sme-crm'

export type AuditEventDto = {
  id: string
  type: string
  actorId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

function metadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

function eventToDto(event: EventRow): AuditEventDto {
  return {
    id: event.id,
    type: event.type,
    actorId: event.userId,
    metadata: metadata(event.metadata),
    createdAt: event.createdAt.toISOString(),
  }
}

export async function logWorkspaceEvent(input: {
  workspaceId: string
  userId: string | null
  type: string
  metadata?: Record<string, unknown>
}) {
  await db.insert(events).values({
    workspaceId: input.workspaceId,
    userId: input.userId,
    type: input.type,
    metadata: input.metadata ?? {},
    createdAt: new Date(),
  })
}

export async function getWorkspaceAuditEvents(workspaceId: string, limit = 50) {
  const rows = await db
    .select()
    .from(events)
    .where(eq(events.workspaceId, workspaceId))
    .orderBy(desc(events.createdAt))
    .limit(limit)

  return rows.map(eventToDto)
}

export function getDemoAuditEvents(workspace: CrmWorkspacePayload): AuditEventDto[] {
  const latestLeads = workspace.leads.slice(0, 4)
  const latestTasks = workspace.tasks.slice(0, 3)
  const latestActivities = workspace.activities.slice(0, 3)

  return [
    ...latestLeads.map((lead, index) => ({
      id: `demo-audit-lead-${lead.id}`,
      type: index === 0 ? 'crm.lead.created' : 'crm.lead.updated',
      actorId: 'demo-user',
      metadata: {
        leadId: lead.id,
        companyName: lead.companyName,
        stage: lead.stageName,
        valueAmount: lead.valueAmount,
        risk: lead.risk,
      },
      createdAt: new Date(Date.now() - (index + 1) * 3_600_000).toISOString(),
    })),
    ...latestTasks.map((task, index) => ({
      id: `demo-audit-task-${task.id}`,
      type: 'crm.task.created',
      actorId: 'demo-user',
      metadata: {
        taskId: task.id,
        title: task.title,
        companyName: task.companyName,
        priority: task.priority,
      },
      createdAt: new Date(Date.now() - (index + 5) * 3_600_000).toISOString(),
    })),
    ...latestActivities.map((activity, index) => ({
      id: `demo-audit-activity-${activity.id}`,
      type: 'crm.activity.created',
      actorId: 'demo-user',
      metadata: {
        activityId: activity.id,
        title: activity.title,
        companyName: activity.companyName,
        type: activity.type,
      },
      createdAt: new Date(Date.now() - (index + 8) * 3_600_000).toISOString(),
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}
