'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, RefreshCw, Send, Table2 } from 'lucide-react'

import { CRM_IMPORT_TEMPLATE, type CrmImportPreviewRow } from '@/lib/crm-import'
import type { CrmLeadDto } from '@/lib/sme-crm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { pillInsetClass, pillSurfaceClass } from '@/components/sme/halvex-system'
import { cn } from '@/lib/utils'

type ImportResponse = {
  imported?: number
  leads?: CrmLeadDto[]
  rows?: CrmImportPreviewRow[]
  errors?: Array<{ rowNumber: number; message: string }>
  error?: string
}

async function importCsv(csv: string, dryRun: boolean) {
  const response = await fetch('/api/crm/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ csv, dryRun }),
  })
  const payload = await response.json().catch(() => ({})) as ImportResponse
  if (!response.ok) {
    const message = payload.error ?? payload.errors?.map(error => `Row ${error.rowNumber}: ${error.message}`).join('; ') ?? `Import failed: ${response.status}`
    throw Object.assign(new Error(message), { payload })
  }
  return payload
}

function money(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value)
}

export default function WorkspaceImport() {
  const [csv, setCsv] = useState(CRM_IMPORT_TEMPLATE)
  const [previewRows, setPreviewRows] = useState<CrmImportPreviewRow[]>([])
  const [errors, setErrors] = useState<Array<{ rowNumber: number; message: string }>>([])
  const [imported, setImported] = useState<CrmLeadDto[]>([])
  const [busy, setBusy] = useState<'preview' | 'import' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function preview() {
    setBusy('preview')
    setNotice(null)
    setErrors([])
    try {
      const payload = await importCsv(csv, true)
      setPreviewRows(payload.rows ?? [])
      setNotice(`${payload.rows?.length ?? 0} rows ready to import`)
    } catch (error) {
      const payload = (error as Error & { payload?: ImportResponse }).payload
      setPreviewRows(payload?.rows ?? [])
      setErrors(payload?.errors ?? [{ rowNumber: 1, message: error instanceof Error ? error.message : 'Unable to preview import' }])
    } finally {
      setBusy(null)
    }
  }

  async function commitImport() {
    setBusy('import')
    setNotice(null)
    setErrors([])
    try {
      const payload = await importCsv(csv, false)
      setPreviewRows(payload.rows ?? [])
      setImported(payload.leads ?? [])
      setNotice(`${payload.imported ?? 0} deals imported`)
    } catch (error) {
      const payload = (error as Error & { payload?: ImportResponse }).payload
      setPreviewRows(payload?.rows ?? [])
      setErrors(payload?.errors ?? [{ rowNumber: 1, message: error instanceof Error ? error.message : 'Unable to import records' }])
    } finally {
      setBusy(null)
    }
  }

  const totalValue = previewRows.reduce((sum, row) => sum + row.valueAmount, 0)

  return (
    <div className="grid gap-4 text-zinc-100">
      <section className={cn(pillSurfaceClass, 'grid gap-5 bg-[#101316] p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end')}>
        <div>
          <Badge variant="outline" className="border-blue-300/20 bg-blue-300/10 text-blue-100">Import</Badge>
          <h1 className="mt-4 font-title text-3xl font-semibold tracking-normal text-white md:text-4xl">Import deals</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Bring spreadsheet pipeline into Halvex with validation, preview, creation, and audit logging.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setCsv(CRM_IMPORT_TEMPLATE)} variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-zinc-100">
            <RefreshCw className="size-4" />
            Reset sample
          </Button>
          <Button asChild className="rounded-full bg-white text-black hover:bg-zinc-200">
            <a href="/api/crm/export?format=csv">
              <Download className="size-4" />
              Export current CSV
            </a>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Rows ready', value: `${previewRows.length}`, detail: 'Validated import rows', icon: Table2 },
          { label: 'Pipeline value', value: money(totalValue), detail: 'Total value in preview', icon: FileSpreadsheet },
          { label: 'Imported', value: `${imported.length}`, detail: 'Deals created this session', icon: CheckCircle2 },
          { label: 'Validation issues', value: `${errors.length}`, detail: 'Rows needing cleanup', icon: AlertCircle },
        ].map(item => {
          const Icon = item.icon
          return (
            <Card key={item.label} className={cn(pillSurfaceClass, 'bg-[#101316]')}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-zinc-500">{item.label}</p>
                    <p className="mt-2 text-2xl font-semibold tracking-normal text-white">{item.value}</p>
                  </div>
                  <span className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-blue-200">
                    <Icon className="size-4" />
                  </span>
                </div>
                <p className="mt-4 text-xs leading-5 text-zinc-500">{item.detail}</p>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
          <CardHeader>
            <CardTitle>CSV input</CardTitle>
            <CardDescription>Use headers: company, primary_contact, owner, stage, value, probability, risk, channel, next_step, description.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {notice ? <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">{notice}</div> : null}
            {errors.length ? (
              <div className="grid gap-2">
                {errors.map(error => (
                  <div key={`${error.rowNumber}-${error.message}`} className="rounded-[18px] border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm text-red-100">
                    Row {error.rowNumber}: {error.message}
                  </div>
                ))}
              </div>
            ) : null}
            <Textarea
              value={csv}
              onChange={event => setCsv(event.target.value)}
              className="min-h-[320px] rounded-[24px] border-white/10 bg-black/20 font-mono text-xs leading-6 text-white placeholder:text-zinc-600"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void preview()} disabled={busy !== null} variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-zinc-100">
                <Table2 className="size-4" />
                {busy === 'preview' ? 'Validating...' : 'Preview rows'}
              </Button>
              <Button type="button" onClick={() => void commitImport()} disabled={busy !== null} className="rounded-full bg-white text-black hover:bg-zinc-200">
                <Send className="size-4" />
                {busy === 'import' ? 'Importing...' : 'Import deals'}
              </Button>
              <Button asChild variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-zinc-100">
                <Link href="/deals">Open deals</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
          <CardHeader>
            <CardTitle>Import preview</CardTitle>
            <CardDescription>Validated rows before they become CRM deals.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-zinc-500">Company</TableHead>
                  <TableHead className="text-zinc-500">Owner</TableHead>
                  <TableHead className="text-zinc-500">Stage</TableHead>
                  <TableHead className="text-zinc-500">Value</TableHead>
                  <TableHead className="text-zinc-500">Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map(row => (
                  <TableRow key={`${row.rowNumber}-${row.companyName}`} className="border-white/8 hover:bg-white/[0.04]">
                    <TableCell>
                      <div>
                        <p className="font-medium text-white">{row.companyName}</p>
                        <p className="mt-1 text-xs text-zinc-500">{row.primaryPersonName}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-zinc-400">{row.owner}</TableCell>
                    <TableCell className="text-zinc-300">{row.stage}</TableCell>
                    <TableCell className="text-zinc-300">{money(row.valueAmount)}</TableCell>
                    <TableCell><Badge variant="outline" className={row.risk === 'hot' ? 'border-red-300/20 bg-red-300/10 text-red-100' : row.risk === 'warm' ? 'border-yellow-300/20 bg-yellow-300/10 text-yellow-100' : 'border-blue-300/20 bg-blue-300/10 text-blue-100'}>{row.risk}</Badge></TableCell>
                  </TableRow>
                ))}
                {!previewRows.length ? (
                  <TableRow className="border-white/8">
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-zinc-500">Preview a CSV to inspect rows before importing.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {imported.length ? (
        <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
          <CardHeader>
            <CardTitle>Created deals</CardTitle>
            <CardDescription>New records created from the latest import.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {imported.map(lead => (
              <div key={lead.id} className={cn(pillInsetClass, 'p-4')}>
                <p className="font-medium text-white">{lead.companyName}</p>
                <p className="mt-1 text-xs text-zinc-500">{lead.primaryPersonName} · {lead.stageName}</p>
                <p className="mt-3 text-sm text-zinc-300">{money(Number(lead.valueAmount ?? 0))} · {lead.probability}% probability</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
