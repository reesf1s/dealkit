import { z } from 'zod'

import type { ChannelId, CrmLeadDto, LeadMutationInput } from '@/lib/sme-crm'

const importRowSchema = z.object({
  company: z.string().trim().min(1, 'company is required'),
  primary_contact: z.string().trim().optional(),
  owner: z.string().trim().optional(),
  stage: z.string().trim().optional(),
  status: z.string().trim().optional(),
  value: z.coerce.number().nonnegative().optional(),
  probability: z.coerce.number().min(0).max(100).optional(),
  risk: z.enum(['hot', 'warm', 'new']).optional(),
  channel: z.enum(['mail', 'linkedin', 'webchat', 'meetings']).optional(),
  next_step: z.string().trim().optional(),
  description: z.string().trim().optional(),
})

export type CrmImportPreviewRow = {
  rowNumber: number
  companyName: string
  primaryPersonName: string
  owner: string
  stage: string
  valueAmount: number
  probability: number
  channel: ChannelId
  risk: CrmLeadDto['risk']
  nextStep: string
  description: string
}

export type CrmImportParseResult = {
  rows: CrmImportPreviewRow[]
  errors: Array<{ rowNumber: number; message: string }>
}

const headerAliases: Record<string, keyof z.infer<typeof importRowSchema>> = {
  account: 'company',
  company_name: 'company',
  name: 'company',
  contact: 'primary_contact',
  primary_buyer: 'primary_contact',
  primary_person: 'primary_contact',
  deal_stage: 'stage',
  amount: 'value',
  deal_value: 'value',
  prob: 'probability',
  next: 'next_step',
  nextstep: 'next_step',
}

function normalizeHeader(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return headerAliases[normalized] ?? normalized
}

function parseCsvLine(line: string) {
  const cells: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    const next = line[index + 1]
    if (character === '"' && quoted && next === '"') {
      cell += '"'
      index += 1
      continue
    }
    if (character === '"') {
      quoted = !quoted
      continue
    }
    if (character === ',' && !quoted) {
      cells.push(cell.trim())
      cell = ''
      continue
    }
    cell += character
  }

  cells.push(cell.trim())
  return cells
}

function cleanRow(input: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(input)
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => value !== ''),
  )
}

export function parseCrmImportCsv(csv: string): CrmImportParseResult {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim())
  if (!lines.length) return { rows: [], errors: [{ rowNumber: 1, message: 'CSV is empty' }] }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader)
  const errors: CrmImportParseResult['errors'] = []
  const rows: CrmImportPreviewRow[] = []

  for (const [index, line] of lines.slice(1).entries()) {
    const rowNumber = index + 2
    const cells = parseCsvLine(line)
    const raw = cleanRow(Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex] ?? ''])))
    if (!raw.company) {
      errors.push({ rowNumber, message: 'company is required' })
      continue
    }
    const result = importRowSchema.safeParse(raw)

    if (!result.success) {
      errors.push({
        rowNumber,
        message: result.error.issues.map(issue => issue.message).join(', '),
      })
      continue
    }

    const row = result.data
    rows.push({
      rowNumber,
      companyName: row.company,
      primaryPersonName: row.primary_contact || 'Primary contact',
      owner: row.owner || 'Sales owner',
      stage: row.stage || 'Discovery',
      valueAmount: Math.round(row.value ?? 0),
      probability: Math.round(row.probability ?? 35),
      channel: row.channel || 'mail',
      risk: row.risk || 'new',
      nextStep: row.next_step || 'Qualify the opportunity and confirm the next action.',
      description: row.description || 'Imported opportunity awaiting qualification.',
    })
  }

  return { rows, errors }
}

export function importRowToLeadInput(row: CrmImportPreviewRow): LeadMutationInput {
  return {
    title: row.companyName,
    companyName: row.companyName,
    primaryPersonName: row.primaryPersonName,
    owner: row.owner,
    stage: row.stage,
    valueAmount: row.valueAmount,
    probability: row.probability,
    channel: row.channel,
    risk: row.risk,
    nextStep: row.nextStep,
    description: row.description,
  }
}

export const CRM_IMPORT_TEMPLATE = [
  'company,primary_contact,owner,stage,value,probability,risk,channel,next_step,description',
  'Acme Manufacturing,Sam Ellis,Maya Chen,Discovery,24000,45,warm,mail,Book technical validation call,Imported from spreadsheet',
  'Vertex Analytics,Jules Hart,Nina Frost,Proposal,68000,65,warm,linkedin,Send security pack and timeline,Interested in AI follow-up workflows',
].join('\n')
