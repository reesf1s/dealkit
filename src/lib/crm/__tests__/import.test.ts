import { describe, expect, it } from 'vitest'
import { buildImportPreview, guessMapping, parseCsv, validateImportRows } from '@/lib/crm/import'

describe('crm csv import', () => {
  it('parses quoted csv cells', () => {
    const parsed = parseCsv('Company,Notes\n"Acme, Ltd","Said ""yes"" today"\n')
    expect(parsed.headers).toEqual(['Company', 'Notes'])
    expect(parsed.rows[0]).toEqual({ Company: 'Acme, Ltd', Notes: 'Said "yes" today' })
  })

  it('guesses mappings from common CRM export headers', () => {
    expect(guessMapping('deals', ['Opportunity Name', 'Account Name', 'Contract Value'])).toEqual({
      title: 'Opportunity Name',
      companyName: 'Account Name',
      valueAmount: 'Contract Value',
    })
  })

  it('validates deals while allowing valid rows through', () => {
    const preview = buildImportPreview(
      'deals',
      'Deal Name,Company,Value,Close Date\nBig renewal,Acme,12000,2026-06-30\nNo company,,abc,tomorrowish\n',
    )
    expect(preview.totalRows).toBe(2)
    expect(preview.validRows).toBe(1)
    expect(preview.failedRows).toBe(1)
    expect(preview.validation[1].errors).toContain('Company name is required.')
    expect(preview.validation[1].errors).toContain('Deal value must be a number.')
  })

  it('builds full names from first and last name columns', () => {
    const validation = validateImportRows(
      'contacts',
      [{ First: 'Ada', Last: 'Lovelace', Email: 'ada@example.com' }],
      { firstName: 'First', lastName: 'Last', email: 'Email' },
    )
    expect(validation[0].values.fullName).toBe('Ada Lovelace')
    expect(validation[0].valid).toBe(true)
  })
})
