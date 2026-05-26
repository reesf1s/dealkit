export type ImportType = 'companies' | 'contacts' | 'deals'

export type CsvRow = Record<string, string>
export type FieldMapping = Record<string, string>

export type ImportValidationResult = {
  rowNumber: number
  valid: boolean
  errors: string[]
  values: Record<string, string | number | Date | null>
}

const FIELD_ALIASES: Record<ImportType, Record<string, string[]>> = {
  companies: {
    name: ['name', 'company', 'company name', 'account', 'account name'],
    domain: ['domain', 'company domain'],
    website: ['website', 'url', 'company website'],
    industry: ['industry', 'sector'],
    sizeLabel: ['size', 'company size', 'employees'],
  },
  contacts: {
    fullName: ['full name', 'name', 'contact name', 'person'],
    firstName: ['first name', 'firstname'],
    lastName: ['last name', 'lastname', 'surname'],
    email: ['email', 'email address', 'work email'],
    phone: ['phone', 'phone number', 'mobile'],
    jobTitle: ['title', 'job title', 'role'],
    companyName: ['company', 'company name', 'account', 'account name'],
  },
  deals: {
    title: ['deal', 'deal name', 'opportunity', 'opportunity name', 'title'],
    companyName: ['company', 'company name', 'account', 'account name'],
    valueAmount: ['value', 'amount', 'deal value', 'contract value', 'arr', 'mrr'],
    expectedCloseDate: ['close date', 'expected close date', 'close', 'close_date'],
  },
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
}

function parseCsvLine(line: string) {
  const cells: string[] = []
  let current = ''
  let quoted = false

  for (let index = 0; index < line.length; index++) {
    const char = line[index]
    const next = line[index + 1]
    if (char === '"' && quoted && next === '"') {
      current += '"'
      index++
      continue
    }
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (char === ',' && !quoted) {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += char
  }

  cells.push(current.trim())
  return cells
}

export function parseCsv(csv: string) {
  const normalized = csv.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n').filter(line => line.trim().length > 0)
  if (lines.length === 0) return { headers: [] as string[], rows: [] as CsvRow[] }

  const headers = parseCsvLine(lines[0]).map(header => header.trim())
  const rows = lines.slice(1).map(line => {
    const cells = parseCsvLine(line)
    return headers.reduce<CsvRow>((row, header, index) => {
      row[header] = cells[index]?.trim() ?? ''
      return row
    }, {})
  })

  return { headers, rows }
}

export function guessMapping(type: ImportType, headers: string[]): FieldMapping {
  const normalized = new Map(headers.map(header => [normalizeHeader(header), header]))
  const aliases = FIELD_ALIASES[type]
  return Object.fromEntries(Object.entries(aliases).flatMap(([field, options]) => {
    const match = options.map(option => normalized.get(normalizeHeader(option))).find(Boolean)
    return match ? [[field, match]] : []
  }))
}

function value(row: CsvRow, mapping: FieldMapping, field: string) {
  const header = mapping[field]
  return header ? row[header]?.trim() ?? '' : ''
}

function numberValue(raw: string) {
  if (!raw) return null
  const parsed = Number(raw.replace(/[£$€,]/g, '').trim())
  return Number.isFinite(parsed) ? Math.round(parsed) : null
}

function dateValue(raw: string) {
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

export function validateImportRows(type: ImportType, rows: CsvRow[], mapping: FieldMapping) {
  return rows.map<ImportValidationResult>((row, index) => {
    const errors: string[] = []
    const rowNumber = index + 2

    if (type === 'companies') {
      const name = value(row, mapping, 'name')
      if (!name) errors.push('Company name is required.')
      const values: Record<string, string | number | Date | null> = {
        name,
        domain: value(row, mapping, 'domain') || null,
        website: value(row, mapping, 'website') || null,
        industry: value(row, mapping, 'industry') || null,
        sizeLabel: value(row, mapping, 'sizeLabel') || null,
      }
      return {
        rowNumber,
        valid: errors.length === 0,
        errors,
        values,
      }
    }

    if (type === 'contacts') {
      const firstName = value(row, mapping, 'firstName')
      const lastName = value(row, mapping, 'lastName')
      const fullName = value(row, mapping, 'fullName') || [firstName, lastName].filter(Boolean).join(' ')
      if (!fullName) errors.push('Contact name is required.')
      const values: Record<string, string | number | Date | null> = {
        fullName,
        email: value(row, mapping, 'email') || null,
        phone: value(row, mapping, 'phone') || null,
        jobTitle: value(row, mapping, 'jobTitle') || null,
        companyName: value(row, mapping, 'companyName') || null,
      }
      return {
        rowNumber,
        valid: errors.length === 0,
        errors,
        values,
      }
    }

    const title = value(row, mapping, 'title')
    const companyName = value(row, mapping, 'companyName')
    const valueAmount = numberValue(value(row, mapping, 'valueAmount'))
    const expectedCloseDate = dateValue(value(row, mapping, 'expectedCloseDate'))
    if (!title) errors.push('Deal title is required.')
    if (!companyName) errors.push('Company name is required.')
    if (value(row, mapping, 'valueAmount') && valueAmount === null) errors.push('Deal value must be a number.')
    if (value(row, mapping, 'expectedCloseDate') && expectedCloseDate === null) errors.push('Close date is invalid.')
    const values: Record<string, string | number | Date | null> = { title, companyName, valueAmount, expectedCloseDate }

    return {
      rowNumber,
      valid: errors.length === 0,
      errors,
      values,
    }
  })
}

export function buildImportPreview(type: ImportType, csv: string, mapping?: FieldMapping) {
  const { headers, rows } = parseCsv(csv)
  const resolvedMapping = mapping ?? guessMapping(type, headers)
  const validation = validateImportRows(type, rows, resolvedMapping)
  return {
    headers,
    mapping: resolvedMapping,
    totalRows: rows.length,
    validRows: validation.filter(row => row.valid).length,
    failedRows: validation.filter(row => !row.valid).length,
    sampleRows: validation.slice(0, 5),
    validation,
  }
}
