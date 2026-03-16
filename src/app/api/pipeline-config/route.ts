import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workspaces } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'

let colMigrated = false
async function ensurePipelineConfigCol() {
  if (colMigrated) return
  try {
    await db.execute(sql`
      ALTER TABLE workspaces
      ADD COLUMN IF NOT EXISTS pipeline_config jsonb
    `)
  } catch { /* already exists */ }
  colMigrated = true
}

const DEFAULT_STAGES = [
  { id: 'prospecting',   label: 'Prospecting',   color: '#6B7280', order: 1, isDefault: true },
  { id: 'qualification', label: 'Qualification',  color: '#3B82F6', order: 2, isDefault: true },
  { id: 'discovery',     label: 'Discovery',      color: '#8B5CF6', order: 3, isDefault: true },
  { id: 'proposal',      label: 'Proposal',       color: '#F59E0B', order: 4, isDefault: true },
  { id: 'negotiation',   label: 'Negotiation',    color: '#EF4444', order: 5, isDefault: true },
  { id: 'closed_won',    label: 'Closed Won',     color: '#22C55E', order: 6, isDefault: true },
  { id: 'closed_lost',   label: 'Closed Lost',    color: '#6B7280', order: 7, isDefault: true },
]

const INDUSTRY_PRESETS: Record<string, { label: string; stages: typeof DEFAULT_STAGES }> = {
  saas: {
    label: 'SaaS / Software',
    stages: DEFAULT_STAGES,
  },
  agency: {
    label: 'Agency / Services',
    stages: [
      { id: 'prospecting',   label: 'Lead In',         color: '#6B7280', order: 1, isDefault: true },
      { id: 'qualification', label: 'Scoping',          color: '#3B82F6', order: 2, isDefault: true },
      { id: 'discovery',     label: 'Pitch / Proposal', color: '#8B5CF6', order: 3, isDefault: true },
      { id: 'proposal',      label: 'SOW Review',       color: '#F59E0B', order: 4, isDefault: true },
      { id: 'negotiation',   label: 'Contract',         color: '#EF4444', order: 5, isDefault: true },
      { id: 'closed_won',    label: 'Won',              color: '#22C55E', order: 6, isDefault: true },
      { id: 'closed_lost',   label: 'Lost',             color: '#6B7280', order: 7, isDefault: true },
    ],
  },
  consulting: {
    label: 'Consulting',
    stages: [
      { id: 'prospecting',   label: 'Outreach',        color: '#6B7280', order: 1, isDefault: true },
      { id: 'qualification', label: 'Needs Assessment', color: '#3B82F6', order: 2, isDefault: true },
      { id: 'discovery',     label: 'Solution Design',  color: '#8B5CF6', order: 3, isDefault: true },
      { id: 'proposal',      label: 'Proposal',         color: '#F59E0B', order: 4, isDefault: true },
      { id: 'negotiation',   label: 'Engagement',       color: '#EF4444', order: 5, isDefault: true },
      { id: 'closed_won',    label: 'Engaged',          color: '#22C55E', order: 6, isDefault: true },
      { id: 'closed_lost',   label: 'Declined',         color: '#6B7280', order: 7, isDefault: true },
    ],
  },
  ecommerce: {
    label: 'E-Commerce / Wholesale',
    stages: [
      { id: 'prospecting',   label: 'Lead',             color: '#6B7280', order: 1, isDefault: true },
      { id: 'qualification', label: 'Contact Made',     color: '#3B82F6', order: 2, isDefault: true },
      { id: 'discovery',     label: 'Sample / Trial',   color: '#8B5CF6', order: 3, isDefault: true },
      { id: 'proposal',      label: 'Quote Sent',       color: '#F59E0B', order: 4, isDefault: true },
      { id: 'negotiation',   label: 'Order Review',     color: '#EF4444', order: 5, isDefault: true },
      { id: 'closed_won',    label: 'Order Won',        color: '#22C55E', order: 6, isDefault: true },
      { id: 'closed_lost',   label: 'Lost',             color: '#6B7280', order: 7, isDefault: true },
    ],
  },
  real_estate: {
    label: 'Real Estate',
    stages: [
      { id: 'prospecting',   label: 'Enquiry',         color: '#6B7280', order: 1, isDefault: true },
      { id: 'qualification', label: 'Viewing',          color: '#3B82F6', order: 2, isDefault: true },
      { id: 'discovery',     label: 'Offer',            color: '#8B5CF6', order: 3, isDefault: true },
      { id: 'proposal',      label: 'Under Offer',      color: '#F59E0B', order: 4, isDefault: true },
      { id: 'negotiation',   label: 'Conveyancing',     color: '#EF4444', order: 5, isDefault: true },
      { id: 'closed_won',    label: 'Exchanged',        color: '#22C55E', order: 6, isDefault: true },
      { id: 'closed_lost',   label: 'Fell Through',     color: '#6B7280', order: 7, isDefault: true },
    ],
  },
  manufacturing: {
    label: 'Manufacturing / Industrial',
    stages: [
      { id: 'prospecting',   label: 'Enquiry',         color: '#6B7280', order: 1, isDefault: true },
      { id: 'qualification', label: 'Technical Review', color: '#3B82F6', order: 2, isDefault: true },
      { id: 'discovery',     label: 'Spec & Quote',     color: '#8B5CF6', order: 3, isDefault: true },
      { id: 'proposal',      label: 'RFQ Response',     color: '#F59E0B', order: 4, isDefault: true },
      { id: 'negotiation',   label: 'Contract Review',  color: '#EF4444', order: 5, isDefault: true },
      { id: 'closed_won',    label: 'PO Received',      color: '#22C55E', order: 6, isDefault: true },
      { id: 'closed_lost',   label: 'No PO',            color: '#6B7280', order: 7, isDefault: true },
    ],
  },
}

// GET: Return current pipeline config (or defaults)
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    await ensurePipelineConfigCol()

    const [ws] = await db.select({ pipelineConfig: workspaces.pipelineConfig })
      .from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1)

    const config = (ws?.pipelineConfig as any) ?? { stages: DEFAULT_STAGES, updatedAt: new Date().toISOString() }

    return NextResponse.json({
      data: config,
      presets: Object.entries(INDUSTRY_PRESETS).map(([key, val]) => ({ id: key, label: val.label })),
      defaults: DEFAULT_STAGES,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

// PATCH: Update pipeline config (rename stages, reorder, add custom, apply preset)
export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    await ensurePipelineConfigCol()

    const body = await req.json()
    const { stages, applyPreset, renameStage, addStage, removeStage, reorderStages, hideStage, showStage, updateStageColor } = body

    // Get current config
    const [ws] = await db.select({ pipelineConfig: workspaces.pipelineConfig })
      .from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1)
    let config = (ws?.pipelineConfig as any) ?? { stages: [...DEFAULT_STAGES], updatedAt: new Date().toISOString() }

    // Apply preset
    if (applyPreset && INDUSTRY_PRESETS[applyPreset]) {
      config = {
        stages: INDUSTRY_PRESETS[applyPreset].stages,
        industryPreset: applyPreset,
        updatedAt: new Date().toISOString(),
      }
    }

    // Full stages replacement
    else if (stages) {
      config = { ...config, stages, updatedAt: new Date().toISOString() }
    }

    // Rename a stage
    else if (renameStage) {
      config.stages = config.stages.map((s: any) =>
        s.id === renameStage.id ? { ...s, label: renameStage.label } : s
      )
      config.updatedAt = new Date().toISOString()
    }

    // Add custom stage
    else if (addStage) {
      const slug = addStage.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
      const maxOrder = Math.max(...config.stages.filter((s: any) => s.id !== 'closed_won' && s.id !== 'closed_lost').map((s: any) => s.order))
      // Insert before closed stages
      config.stages = [
        ...config.stages.filter((s: any) => s.id !== 'closed_won' && s.id !== 'closed_lost'),
        {
          id: `custom_${slug}_${Date.now()}`,
          label: addStage.label,
          color: addStage.color || '#8B5CF6',
          order: maxOrder + 1,
          isDefault: false,
        },
        ...config.stages.filter((s: any) => s.id === 'closed_won' || s.id === 'closed_lost'),
      ]
      // Re-number orders
      config.stages = config.stages.map((s: any, i: number) => ({ ...s, order: i + 1 }))
      config.updatedAt = new Date().toISOString()
    }

    // Remove custom stage (can't remove defaults)
    else if (removeStage) {
      const stage = config.stages.find((s: any) => s.id === removeStage)
      if (stage && !stage.isDefault) {
        config.stages = config.stages.filter((s: any) => s.id !== removeStage)
        config.stages = config.stages.map((s: any, i: number) => ({ ...s, order: i + 1 }))
      }
      config.updatedAt = new Date().toISOString()
    }

    // Hide/show stage
    else if (hideStage) {
      config.stages = config.stages.map((s: any) =>
        s.id === hideStage ? { ...s, isHidden: true } : s
      )
      config.updatedAt = new Date().toISOString()
    }
    else if (showStage) {
      config.stages = config.stages.map((s: any) =>
        s.id === showStage ? { ...s, isHidden: false } : s
      )
      config.updatedAt = new Date().toISOString()
    }

    // Update stage color
    else if (updateStageColor) {
      config.stages = config.stages.map((s: any) =>
        s.id === updateStageColor.id ? { ...s, color: updateStageColor.color } : s
      )
      config.updatedAt = new Date().toISOString()
    }

    // Reorder stages
    else if (reorderStages) {
      const orderMap = new Map(reorderStages.map((id: string, i: number) => [id, i + 1]))
      config.stages = config.stages
        .map((s: any) => ({ ...s, order: orderMap.get(s.id) ?? s.order }))
        .sort((a: any, b: any) => a.order - b.order)
      config.updatedAt = new Date().toISOString()
    }

    await db.update(workspaces)
      .set({ pipelineConfig: config, updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId))

    return NextResponse.json({ data: config })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
