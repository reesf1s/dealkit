import { describe, expect, it } from 'vitest'
import {
  getPipelineStageLabelMap,
  getPipelineStages,
  stageLabelFor,
} from '../pipeline-presentation'

describe('pipeline presentation helpers', () => {
  const config = {
    stages: [
      { id: 'prospecting', label: 'Lead In', order: 1 },
      { id: 'custom_security_review', label: 'Security Review', order: 2 },
      { id: 'proposal', label: 'Proposal', order: 3 },
      { id: 'closed_won', label: 'Won', order: 4 },
      { id: 'closed_lost', label: 'Lost', order: 5 },
    ],
  }

  it('uses configured stage labels when present', () => {
    expect(stageLabelFor('custom_security_review', config)).toBe('Security Review')
    expect(stageLabelFor('prospecting', config)).toBe('Lead In')
  })

  it('falls back to a humanized stage label when config is missing', () => {
    expect(stageLabelFor('custom_final_review', null)).toBe('Custom Final Review')
  })

  it('returns ordered, open pipeline stages without closed stages by default option', () => {
    expect(getPipelineStages(config, { includeClosed: false }).map(stage => stage.id)).toEqual([
      'prospecting',
      'custom_security_review',
      'proposal',
    ])
  })

  it('builds a stage label map for fast rendering', () => {
    expect(getPipelineStageLabelMap(config)).toEqual({
      prospecting: 'Lead In',
      custom_security_review: 'Security Review',
      proposal: 'Proposal',
      closed_won: 'Won',
      closed_lost: 'Lost',
    })
  })
})
