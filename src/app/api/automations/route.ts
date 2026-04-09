export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workspaces } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'

// ─────────────────────────────────────────────────────────────────────────────
// Automation templates
// ─────────────────────────────────────────────────────────────────────────────

type AutomationCategory = 'intelligence' | 'alerts' | 'automation'

interface AutomationTemplate {
  id: string
  name: string
  description: string
  category: AutomationCategory
  alwaysOn: boolean
}

const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: 'deal_scoring',
    name: 'AI Deal Scoring',
    description: 'Score all deals using ML pipeline',
    category: 'intelligence',
    alwaysOn: true,
  },
  {
    id: 'stale_alerts',
    name: 'Stale Deal Alerts',
    description: 'Flag deals with no activity in 14+ days',
    category: 'alerts',
    alwaysOn: false,
  },
  {
    id: 'risk_detection',
    name: 'Risk Signal Detection',
    description: 'Detect objections, competitor mentions from notes',
    category: 'intelligence',
    alwaysOn: false,
  },
  {
    id: 'email_ingestion',
    name: 'Email-to-Deal Matching',
    description: 'Auto-match incoming emails to deals',
    category: 'automation',
    alwaysOn: false,
  },
  {
    id: 'follow_up_reminders',
    name: 'Follow-up Reminders',
    description: 'Surface deals needing follow-up in daily briefing',
    category: 'alerts',
    alwaysOn: false,
  },
  {
    id: 'auto_stage_suggestions',
    name: 'Stage Progression Hints',
    description: 'Suggest stage changes based on activity patterns',
    category: 'intelligence',
    alwaysOn: false,
  },
  {
    id: 'champion_tracking',
    name: 'Champion Tracking',
    description: 'Alert when champion contact goes quiet',
    category: 'alerts',
    alwaysOn: false,
  },
  {
    id: 'deal_decay_alerts',
    name: 'Deal Decay Monitoring',
    description: 'Warn when deal score drops significantly',
    category: 'alerts',
    alwaysOn: false,
  },
  {
    id: 'competitor_alerts',
    name: 'Competitor Intelligence',
    description: 'Track competitor mentions across deals',
    category: 'intelligence',
    alwaysOn: false,
  },
  {
    id: 'close_date_monitoring',
    name: 'Close Date Monitoring',
    description: 'Alert on approaching/overdue close dates',
    category: 'alerts',
    alwaysOn: false,
  },
]

const VALID_IDS = new Set(AUTOMATION_TEMPLATES.map((t) => t.id))

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getEnabledAutomations(pipelineConfig: any): string[] {
  const stored: unknown = pipelineConfig?.enabledAutomations
  if (Array.isArray(stored)) return stored.filter((id) => typeof id === 'string')
  // Default: only always-on automations
  return AUTOMATION_TEMPLATES.filter((t) => t.alwaysOn).map((t) => t.id)
}

// ─────────────────────────────────────────────────────────────────────────────
// GET — list all automation templates with enabled status
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ctx = await getWorkspaceContext(userId)
    const [ws] = await db
      .select({ pipelineConfig: workspaces.pipelineConfig })
      .from(workspaces)
      .where(eq(workspaces.id, ctx.workspaceId))

    const enabled = new Set(getEnabledAutomations(ws?.pipelineConfig))

    const data = AUTOMATION_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      enabled: t.alwaysOn ? true : enabled.has(t.id),
      alwaysOn: t.alwaysOn,
    }))

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[GET /api/automations]', err)
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? (err as Error).message : undefined },
      { status: 500 },
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH — toggle an automation on/off
// ─────────────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId, role } = await getWorkspaceContext(userId)
    if (role !== 'owner' && role !== 'admin')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { automationId, enabled } = body as { automationId?: string; enabled?: boolean }

    if (!automationId || typeof enabled !== 'boolean')
      return NextResponse.json({ error: 'automationId (string) and enabled (boolean) are required' }, { status: 400 })

    if (!VALID_IDS.has(automationId))
      return NextResponse.json({ error: `Unknown automation: ${automationId}` }, { status: 400 })

    // Prevent disabling always-on automations
    const template = AUTOMATION_TEMPLATES.find((t) => t.id === automationId)!
    if (template.alwaysOn && !enabled)
      return NextResponse.json({ error: `${template.name} cannot be disabled` }, { status: 400 })

    // Read current config
    const [ws] = await db
      .select({ pipelineConfig: workspaces.pipelineConfig })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))

    const config = (ws?.pipelineConfig as any) ?? {}
    const current = new Set(getEnabledAutomations(config))

    if (enabled) {
      current.add(automationId)
    } else {
      current.delete(automationId)
    }

    const updatedConfig = { ...config, enabledAutomations: Array.from(current) }

    await db
      .update(workspaces)
      .set({ pipelineConfig: updatedConfig, updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId))

    return NextResponse.json({
      data: {
        id: automationId,
        name: template.name,
        enabled,
        alwaysOn: template.alwaysOn,
      },
    })
  } catch (err) {
    console.error('[PATCH /api/automations]', err)
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? (err as Error).message : undefined },
      { status: 500 },
    )
  }
}
