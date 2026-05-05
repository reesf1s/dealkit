import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workspaces } from '@/lib/db/schema'
import { dbErrResponse } from '@/lib/api-helpers'
import { type ValueDisplay } from '@/lib/currency'
import { getWorkspaceContext } from '@/lib/workspace'
import type { PipelineConfig, PipelineStageConfig } from '@/types'

type IndustryPresetId =
  | 'saas'
  | 'agency'
  | 'consulting'
  | 'ecommerce'
  | 'real_estate'
  | 'manufacturing'

interface WorkspacePipelineConfig extends PipelineConfig {
  currency?: string
  valueDisplay?: ValueDisplay
  industryPreset?: IndustryPresetId
}

interface RenameStagePayload {
  id: string
  label: string
}

interface AddStagePayload {
  label: string
  color?: string
}

interface UpdateStageColorPayload {
  id: string
  color: string
}

interface PipelineConfigPatchBody {
  stages?: PipelineStageConfig[]
  applyPreset?: IndustryPresetId
  renameStage?: RenameStagePayload
  addStage?: AddStagePayload
  removeStage?: string
  reorderStages?: string[]
  hideStage?: string
  showStage?: string
  updateStageColor?: UpdateStageColorPayload
  currency?: string
  valueDisplay?: ValueDisplay
}

// No-op: pipeline_config column is guaranteed to exist after any brain rebuild.
// DDL only runs inside _doRebuildWorkspaceBrain (via after()) to prevent
// ALTER TABLE locks from cascading into SELECT hangs on concurrent page loads.
async function ensurePipelineConfigCol() {}

const DEFAULT_STAGES: PipelineStageConfig[] = [
  { id: 'prospecting', label: 'Prospecting', color: '#6B7280', order: 1, isDefault: true },
  { id: 'qualification', label: 'Qualification', color: '#3B82F6', order: 2, isDefault: true },
  { id: 'discovery', label: 'Discovery', color: '#8B5CF6', order: 3, isDefault: true },
  { id: 'proposal', label: 'Proposal', color: '#F59E0B', order: 4, isDefault: true },
  { id: 'negotiation', label: 'Negotiation', color: '#EF4444', order: 5, isDefault: true },
  { id: 'closed_won', label: 'Closed Won', color: '#22C55E', order: 6, isDefault: true },
  { id: 'closed_lost', label: 'Closed Lost', color: '#6B7280', order: 7, isDefault: true },
]

const INDUSTRY_PRESETS: Record<IndustryPresetId, { label: string; stages: PipelineStageConfig[] }> = {
  saas: {
    label: 'SaaS / Software',
    stages: DEFAULT_STAGES,
  },
  agency: {
    label: 'Agency / Services',
    stages: [
      { id: 'prospecting', label: 'Lead In', color: '#6B7280', order: 1, isDefault: true },
      { id: 'qualification', label: 'Scoping', color: '#3B82F6', order: 2, isDefault: true },
      { id: 'discovery', label: 'Pitch / Proposal', color: '#8B5CF6', order: 3, isDefault: true },
      { id: 'proposal', label: 'SOW Review', color: '#F59E0B', order: 4, isDefault: true },
      { id: 'negotiation', label: 'Contract', color: '#EF4444', order: 5, isDefault: true },
      { id: 'closed_won', label: 'Won', color: '#22C55E', order: 6, isDefault: true },
      { id: 'closed_lost', label: 'Lost', color: '#6B7280', order: 7, isDefault: true },
    ],
  },
  consulting: {
    label: 'Consulting',
    stages: [
      { id: 'prospecting', label: 'Outreach', color: '#6B7280', order: 1, isDefault: true },
      { id: 'qualification', label: 'Needs Assessment', color: '#3B82F6', order: 2, isDefault: true },
      { id: 'discovery', label: 'Solution Design', color: '#8B5CF6', order: 3, isDefault: true },
      { id: 'proposal', label: 'Proposal', color: '#F59E0B', order: 4, isDefault: true },
      { id: 'negotiation', label: 'Engagement', color: '#EF4444', order: 5, isDefault: true },
      { id: 'closed_won', label: 'Engaged', color: '#22C55E', order: 6, isDefault: true },
      { id: 'closed_lost', label: 'Declined', color: '#6B7280', order: 7, isDefault: true },
    ],
  },
  ecommerce: {
    label: 'E-Commerce / Wholesale',
    stages: [
      { id: 'prospecting', label: 'Lead', color: '#6B7280', order: 1, isDefault: true },
      { id: 'qualification', label: 'Contact Made', color: '#3B82F6', order: 2, isDefault: true },
      { id: 'discovery', label: 'Sample / Trial', color: '#8B5CF6', order: 3, isDefault: true },
      { id: 'proposal', label: 'Quote Sent', color: '#F59E0B', order: 4, isDefault: true },
      { id: 'negotiation', label: 'Order Review', color: '#EF4444', order: 5, isDefault: true },
      { id: 'closed_won', label: 'Order Won', color: '#22C55E', order: 6, isDefault: true },
      { id: 'closed_lost', label: 'Lost', color: '#6B7280', order: 7, isDefault: true },
    ],
  },
  real_estate: {
    label: 'Real Estate',
    stages: [
      { id: 'prospecting', label: 'Enquiry', color: '#6B7280', order: 1, isDefault: true },
      { id: 'qualification', label: 'Viewing', color: '#3B82F6', order: 2, isDefault: true },
      { id: 'discovery', label: 'Offer', color: '#8B5CF6', order: 3, isDefault: true },
      { id: 'proposal', label: 'Under Offer', color: '#F59E0B', order: 4, isDefault: true },
      { id: 'negotiation', label: 'Conveyancing', color: '#EF4444', order: 5, isDefault: true },
      { id: 'closed_won', label: 'Exchanged', color: '#22C55E', order: 6, isDefault: true },
      { id: 'closed_lost', label: 'Fell Through', color: '#6B7280', order: 7, isDefault: true },
    ],
  },
  manufacturing: {
    label: 'Manufacturing / Industrial',
    stages: [
      { id: 'prospecting', label: 'Enquiry', color: '#6B7280', order: 1, isDefault: true },
      { id: 'qualification', label: 'Technical Review', color: '#3B82F6', order: 2, isDefault: true },
      { id: 'discovery', label: 'Spec & Quote', color: '#8B5CF6', order: 3, isDefault: true },
      { id: 'proposal', label: 'RFQ Response', color: '#F59E0B', order: 4, isDefault: true },
      { id: 'negotiation', label: 'Contract Review', color: '#EF4444', order: 5, isDefault: true },
      { id: 'closed_won', label: 'PO Received', color: '#22C55E', order: 6, isDefault: true },
      { id: 'closed_lost', label: 'No PO', color: '#6B7280', order: 7, isDefault: true },
    ],
  },
}

function cloneStages(stages: PipelineStageConfig[]) {
  return stages.map((stage) => ({ ...stage }))
}

function getDefaultConfig(): WorkspacePipelineConfig {
  return {
    stages: cloneStages(DEFAULT_STAGES),
    updatedAt: new Date().toISOString(),
  }
}

function normalizeConfig(raw: unknown): WorkspacePipelineConfig {
  if (!raw || typeof raw !== 'object') return getDefaultConfig()

  const config = raw as Partial<WorkspacePipelineConfig>
  return {
    ...config,
    stages: Array.isArray(config.stages) && config.stages.length > 0
      ? cloneStages(config.stages)
      : cloneStages(DEFAULT_STAGES),
    updatedAt: typeof config.updatedAt === 'string' ? config.updatedAt : new Date().toISOString(),
  }
}

function renumberStages(stages: PipelineStageConfig[]) {
  return stages.map((stage, index) => ({ ...stage, order: index + 1 }))
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    await ensurePipelineConfigCol()

    const [workspace] = await db
      .select({ pipelineConfig: workspaces.pipelineConfig })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1)

    const config = normalizeConfig(workspace?.pipelineConfig)

    return NextResponse.json({
      data: config,
      presets: Object.entries(INDUSTRY_PRESETS).map(([id, preset]) => ({ id, label: preset.label })),
      defaults: cloneStages(DEFAULT_STAGES),
    })
  } catch (err) {
    return dbErrResponse(err)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    await ensurePipelineConfigCol()

    const body = (await req.json()) as PipelineConfigPatchBody
    const {
      stages,
      applyPreset,
      renameStage,
      addStage,
      removeStage,
      reorderStages,
      hideStage,
      showStage,
      updateStageColor,
      currency,
      valueDisplay,
    } = body

    const [workspace] = await db
      .select({ pipelineConfig: workspaces.pipelineConfig })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1)

    let config = normalizeConfig(workspace?.pipelineConfig)

    if (applyPreset && INDUSTRY_PRESETS[applyPreset]) {
      config = {
        stages: cloneStages(INDUSTRY_PRESETS[applyPreset].stages),
        industryPreset: applyPreset,
        updatedAt: new Date().toISOString(),
      }
    } else if (stages) {
      config = {
        ...config,
        stages: cloneStages(stages),
        updatedAt: new Date().toISOString(),
      }
    } else if (renameStage) {
      config = {
        ...config,
        stages: config.stages.map((stage) =>
          stage.id === renameStage.id ? { ...stage, label: renameStage.label } : stage
        ),
        updatedAt: new Date().toISOString(),
      }
    } else if (addStage) {
      const slug = addStage.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
      const openStages = config.stages.filter((stage) => stage.id !== 'closed_won' && stage.id !== 'closed_lost')
      const closedStages = config.stages.filter((stage) => stage.id === 'closed_won' || stage.id === 'closed_lost')

      config = {
        ...config,
        stages: renumberStages([
          ...openStages,
          {
            id: `custom_${slug}_${Date.now()}`,
            label: addStage.label,
            color: addStage.color || '#8B5CF6',
            order: openStages.length + 1,
            isDefault: false,
          },
          ...closedStages,
        ]),
        updatedAt: new Date().toISOString(),
      }
    } else if (removeStage) {
      const stageToRemove = config.stages.find((stage) => stage.id === removeStage)
      const nextStages = stageToRemove && !stageToRemove.isDefault
        ? renumberStages(config.stages.filter((stage) => stage.id !== removeStage))
        : config.stages

      config = {
        ...config,
        stages: nextStages,
        updatedAt: new Date().toISOString(),
      }
    } else if (hideStage) {
      config = {
        ...config,
        stages: config.stages.map((stage) =>
          stage.id === hideStage ? { ...stage, isHidden: true } : stage
        ),
        updatedAt: new Date().toISOString(),
      }
    } else if (showStage) {
      config = {
        ...config,
        stages: config.stages.map((stage) =>
          stage.id === showStage ? { ...stage, isHidden: false } : stage
        ),
        updatedAt: new Date().toISOString(),
      }
    } else if (updateStageColor) {
      config = {
        ...config,
        stages: config.stages.map((stage) =>
          stage.id === updateStageColor.id ? { ...stage, color: updateStageColor.color } : stage
        ),
        updatedAt: new Date().toISOString(),
      }
    } else if (reorderStages) {
      const orderMap = new Map(reorderStages.map((id, index) => [id, index + 1]))
      config = {
        ...config,
        stages: config.stages
          .map((stage) => ({ ...stage, order: orderMap.get(stage.id) ?? stage.order }))
          .sort((left, right) => left.order - right.order),
        updatedAt: new Date().toISOString(),
      }
    } else if (currency !== undefined) {
      config = {
        ...config,
        currency,
        updatedAt: new Date().toISOString(),
      }
    } else if (valueDisplay !== undefined) {
      config = {
        ...config,
        valueDisplay,
        updatedAt: new Date().toISOString(),
      }
    }

    await db
      .update(workspaces)
      .set({ pipelineConfig: config, updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId))

    return NextResponse.json({ data: config })
  } catch (err) {
    return dbErrResponse(err)
  }
}
