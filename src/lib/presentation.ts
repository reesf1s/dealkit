const DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  day: 'numeric',
})

const ABSOLUTE_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatCurrencyGBP(
  value: number | null | undefined,
  options?: { compact?: boolean; decimals?: number }
): string {
  if (value == null || Number.isNaN(value)) return '—'

  if (options?.compact) {
    if (Math.abs(value) >= 1_000_000) {
      return `£${(value / 1_000_000).toFixed(options.decimals ?? 1)}M`
    }
    if (Math.abs(value) >= 1_000) {
      return `£${Math.round(value / 1_000)}k`
    }
  }

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: options?.decimals ?? 0,
  }).format(value)
}

export function formatPercentage(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  if (value > 0 && value < 1) return `${value.toFixed(1)}%`
  return `${Math.round(value)}%`
}

export function formatDelta(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return value >= 0 ? `+${Math.round(value)}` : `−${Math.abs(Math.round(value))}`
}

export function formatContextualDate(iso?: string | null, now = new Date()): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'

  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffDays < 0) return ABSOLUTE_DATE_TIME_FORMATTER.format(date)
  if (diffDays === 0) return `Today, ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
  if (diffDays === 1) return `Yesterday, ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
  if (diffDays < 7) return `${diffDays} days ago`
  return DATE_FORMATTER.format(date)
}

export function formatRelativeTime(iso?: string | null, now = new Date()): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'

  const diffMs = now.getTime() - date.getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 2) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return DATE_FORMATTER.format(date)
}

function titleCaseWords(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function humanizeActivityLabel(
  type: string,
  metadata: Record<string, unknown> = {},
  fallbackDealName?: string
): string {
  const deal = String(metadata.dealName ?? metadata.prospectCompany ?? fallbackDealName ?? 'Deal')
  const stage = String(metadata.value ?? metadata.newStage ?? '').replace(/_/g, ' ')

  switch (type) {
    case 'deal_log.created':
    case 'deal_created':
      return `${deal} was added to the pipeline`
    case 'deal_log.closed_won':
    case 'deal_won':
      return `${deal} was marked closed won`
    case 'deal_log.closed_lost':
    case 'deal_lost':
      return `${deal} was marked closed lost`
    case 'deal_log.updated':
      if (metadata.action === 'deleted') return `${deal} was deleted`
      if (metadata.field === 'stage' && stage) return `${deal} moved to ${titleCaseWords(stage)}`
      return `${deal} was updated`
    case 'deal_log.note_added':
    case 'note_added':
      return `Notes were added on ${deal}`
    case 'deal_log.ai_scored':
      return `Deal intelligence rescored ${deal}`
    default:
      return titleCaseWords(type.replace(/[._]/g, ' '))
    }
}

export function avatarGradientFromName(name: string): string {
  const palette = [
    ['#C4621B', '#E89547'],
    ['#2E5AAC', '#4A7BD0'],
    ['#6B3FA0', '#9066C4'],
    ['#1B7E5A', '#2BB37E'],
    ['#9A4B5C', '#C66A82'],
    ['#7C5C1D', '#B78B34'],
  ]

  const hash = Array.from(name).reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const [start, end] = palette[hash % palette.length]
  return `linear-gradient(135deg, ${start} 0%, ${end} 100%)`
}

export function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
}
