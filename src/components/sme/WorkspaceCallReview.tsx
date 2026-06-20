'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Brain, CheckCircle2, ClipboardList, FileText, PhoneCall, RefreshCw, Save, ShieldAlert } from 'lucide-react'

import type { CallAnalysis } from '@/lib/call-intelligence'
import type { CrmLeadDto, CrmWorkspacePayload } from '@/lib/sme-crm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { pillInsetClass, pillSurfaceClass } from '@/components/sme/halvex-system'
import { cn } from '@/lib/utils'

type ReviewPayload = {
  analysis: CallAnalysis
  lead: CrmLeadDto
  committed?: boolean
}

const sampleTranscript = `Buyer: We like the idea of Halvex because Gong feels too heavy for our sales team. The concern is security review and whether implementation takes more than two weeks.
Rep: We can share the security notes today and set up a focused pilot next week.
Buyer: Good. Budget is approved if legal signs off. Send the security pack and a close plan before Friday so our owner can make a decision.`

async function apiJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...init?.headers,
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error ?? `Request failed: ${response.status}`)
  return payload as T
}

async function loadWorkspace() {
  return apiJson<CrmWorkspacePayload>('/api/crm/workspace')
}

function money(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value)
}

function sentimentTone(sentiment: CallAnalysis['sentiment']) {
  if (sentiment === 'positive') return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
  if (sentiment === 'risk') return 'border-red-300/20 bg-red-300/10 text-red-100'
  return 'border-yellow-300/20 bg-yellow-300/10 text-yellow-100'
}

export default function WorkspaceCallReview() {
  const [workspace, setWorkspace] = useState<CrmWorkspacePayload | null>(null)
  const [leadId, setLeadId] = useState('')
  const [transcript, setTranscript] = useState(sampleTranscript)
  const [analysis, setAnalysis] = useState<CallAnalysis | null>(null)
  const [busy, setBusy] = useState<'load' | 'analyze' | 'commit' | null>('load')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setBusy('load')
    setError(null)
    try {
      const payload = await loadWorkspace()
      setWorkspace(payload)
      setLeadId(current => current || payload.leads[0]?.id || '')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load workspace')
    } finally {
      setBusy(null)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const selectedLead = useMemo(() => workspace?.leads.find(lead => lead.id === leadId) ?? null, [workspace, leadId])

  async function review(commit: boolean) {
    if (!leadId || transcript.trim().length < 40) {
      setError('Select a deal and paste at least 40 characters of transcript.')
      return
    }
    setBusy(commit ? 'commit' : 'analyze')
    setError(null)
    setNotice(null)
    try {
      const payload = await apiJson<ReviewPayload>('/api/crm/call-review', {
        method: 'POST',
        body: JSON.stringify({ leadId, transcript, commit }),
      })
      setAnalysis(payload.analysis)
      setNotice(commit ? 'Call review saved to CRM' : 'Transcript analyzed')
      if (commit) await refresh()
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Unable to review transcript')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid gap-4 text-zinc-100">
      <section className={cn(pillSurfaceClass, 'grid gap-5 bg-[#101316] p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end')}>
        <div>
          <Badge variant="outline" className="border-blue-300/20 bg-blue-300/10 text-blue-100">Call intelligence</Badge>
          <h1 className="mt-4 font-title text-3xl font-semibold tracking-normal text-white md:text-4xl">Call review</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Turn a transcript into CRM evidence: summary, risks, objections, decision signals, next steps, activity, and task.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void refresh()} className="rounded-full border-white/10 bg-white/[0.04] text-zinc-100">
            <RefreshCw className="size-4" />
            Refresh
          </Button>
          <Button asChild className="rounded-full bg-white text-black hover:bg-zinc-200">
            <Link href="/meetings">
              <PhoneCall className="size-4" />
              Meetings
            </Link>
          </Button>
        </div>
      </section>

      {notice || error ? (
        <div className={cn('rounded-full border px-4 py-2 text-sm', error ? 'border-red-300/20 bg-red-300/10 text-red-100' : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100')}>
          {error ?? notice}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Selected deal', value: selectedLead?.companyName ?? 'None', detail: selectedLead ? `${money(Number(selectedLead.valueAmount ?? 0))} pipeline` : 'Choose a deal', icon: PhoneCall },
          { label: 'Sentiment', value: analysis?.sentiment ?? 'Pending', detail: 'Derived from transcript signals', icon: Brain },
          { label: 'Risks', value: `${analysis?.risks.filter(item => !item.startsWith('No explicit')).length ?? 0}`, detail: 'Commercial and process risks', icon: ShieldAlert },
          { label: 'Next steps', value: `${analysis?.nextSteps.length ?? 0}`, detail: 'Actionable follow-up items', icon: ClipboardList },
        ].map(item => {
          const Icon = item.icon
          return (
            <Card key={item.label} className={cn(pillSurfaceClass, 'bg-[#101316]')}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-500">{item.label}</p>
                    <p className="mt-2 truncate text-2xl font-semibold tracking-normal text-white">{busy === 'load' ? '...' : item.value}</p>
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

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
          <CardHeader>
            <CardTitle>Transcript</CardTitle>
            <CardDescription>Select the deal, paste a call transcript, then preview or commit the review.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <select value={leadId} onChange={event => setLeadId(event.target.value)} className="h-10 rounded-full border border-white/10 bg-black/40 px-3 text-sm text-zinc-100 outline-none">
              {(workspace?.leads ?? []).map(lead => <option key={lead.id} value={lead.id}>{lead.companyName}</option>)}
            </select>
            <Textarea value={transcript} onChange={event => setTranscript(event.target.value)} className="min-h-[280px] rounded-[24px] border-white/10 bg-black/20 font-mono text-xs leading-6 text-white placeholder:text-zinc-600" />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void review(false)} disabled={busy !== null} className="rounded-full border-white/10 bg-white/[0.04] text-zinc-100">
                <Brain className="size-4" />
                {busy === 'analyze' ? 'Analyzing...' : 'Analyze'}
              </Button>
              <Button type="button" onClick={() => void review(true)} disabled={busy !== null || !analysis} className="rounded-full bg-white text-black hover:bg-zinc-200">
                <Save className="size-4" />
                {busy === 'commit' ? 'Saving...' : 'Save activity and task'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
          <CardHeader>
            <CardTitle>Review output</CardTitle>
            <CardDescription>What will be written back to the CRM when committed.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {analysis ? (
              <>
                <div className={cn(pillInsetClass, 'p-4')}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={sentimentTone(analysis.sentiment)}>{analysis.sentiment}</Badge>
                    {analysis.competitors.map(competitor => <Badge key={competitor} variant="outline" className="border-white/10 bg-white/[0.04] text-zinc-300">{competitor}</Badge>)}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-300">{analysis.summary}</p>
                </div>

                {[
                  { title: 'Risks', items: analysis.risks, icon: ShieldAlert },
                  { title: 'Objections', items: analysis.objections, icon: FileText },
                  { title: 'Decision signals', items: analysis.decisionSignals, icon: CheckCircle2 },
                  { title: 'Next steps', items: analysis.nextSteps, icon: ClipboardList },
                ].map(section => {
                  const Icon = section.icon
                  return (
                    <div key={section.title} className={cn(pillInsetClass, 'p-4')}>
                      <div className="flex items-center gap-2">
                        <Icon className="size-4 text-blue-200" />
                        <p className="font-semibold text-white">{section.title}</p>
                      </div>
                      <div className="mt-3 grid gap-2">
                        {section.items.map(item => <p key={item} className="text-sm leading-6 text-zinc-400">{item}</p>)}
                      </div>
                    </div>
                  )
                })}

                <div className={cn(pillInsetClass, 'p-4')}>
                  <p className="font-semibold text-white">{analysis.recommendedTask.title}</p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-zinc-400">{analysis.recommendedTask.description}</p>
                </div>
              </>
            ) : (
              <div className="py-20 text-center text-sm text-zinc-500">Analyze a transcript to see call intelligence here.</div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
