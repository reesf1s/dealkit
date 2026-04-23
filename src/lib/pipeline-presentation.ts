export type PipelineStageConfig = {
  id: string
  label?: string | null
  color?: string | null
  order?: number | null
  hidden?: boolean | null
  isHidden?: boolean | null
}

export type PipelineConfigLike = {
  currency?: string | null
  stages?: PipelineStageConfig[] | null
} | null | undefined

export const DEFAULT_PIPELINE_STAGES: PipelineStageConfig[] = [
  { id: 'prospecting', label: 'Prospecting', color: '#6B7280', order: 1 },
  { id: 'qualification', label: 'Qualification', color: '#3B82F6', order: 2 },
  { id: 'discovery', label: 'Discovery', color: '#8B5CF6', order: 3 },
  { id: 'proposal', label: 'Proposal', color: '#F59E0B', order: 4 },
  { id: 'negotiation', label: 'Negotiation', color: '#EF4444', order: 5 },
  { id: 'closed_won', label: 'Closed Won', color: '#22C55E', order: 6 },
  { id: 'closed_lost', label: 'Closed Lost', color: '#6B7280', order: 7 },
]

export function humanizeStageId(stage?: string | null) {
  if (!stage) return 'Pipeline'
  return stage.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

function isHiddenStage(stage: PipelineStageConfig) {
  return Boolean(stage.hidden ?? stage.isHidden)
}

export function getPipelineStages(
  config?: PipelineConfigLike,
  options?: { includeClosed?: boolean; includeHidden?: boolean },
) {
  const includeClosed = options?.includeClosed ?? true
  const includeHidden = options?.includeHidden ?? false
  const configured = config?.stages?.length ? config.stages : DEFAULT_PIPELINE_STAGES

  return configured
    .filter(stage => (includeHidden ? true : !isHiddenStage(stage)))
    .filter(stage => (includeClosed ? true : !['closed_won', 'closed_lost'].includes(stage.id)))
    .sort((left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER))
}

export function getPipelineStageLabelMap(config?: PipelineConfigLike) {
  const labelMap: Record<string, string> = {}
  for (const stage of getPipelineStages(config, { includeClosed: true, includeHidden: true })) {
    labelMap[stage.id] = stage.label?.trim() || humanizeStageId(stage.id)
  }
  return labelMap
}

export function stageLabelFor(stage?: string | null, config?: PipelineConfigLike) {
  if (!stage) return 'Pipeline'
  return getPipelineStageLabelMap(config)[stage] ?? humanizeStageId(stage)
}

export function stageOrderFor(stage?: string | null, config?: PipelineConfigLike) {
  if (!stage) return Number.MAX_SAFE_INTEGER
  const ordered = getPipelineStages(config, { includeClosed: true, includeHidden: true })
  const index = ordered.findIndex(item => item.id === stage)
  return index === -1 ? Number.MAX_SAFE_INTEGER : index
}
