'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Activity, ArrowUpRight, Bot, BrainCircuit, CalendarDays, CheckCircle2, CircleDollarSign, Clock3, Command, Dot, Gauge, Instagram, Linkedin, ListChecks, Mail, MessageCircle, Plus, Radio, RefreshCw, Save, SendHorizontal, ShieldAlert, Sparkles, Target, TrendingUp, UserRound, Zap } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts'
import { buildRecoveryIntelligence, classifyRecoveryIntent } from '@/lib/recovery-intelligence'
import type { ChannelId, CrmChannelDto, CrmLeadDto, CrmMessageDto, CrmWorkspacePayload } from '@/lib/sme-crm'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { pillInsetClass, pillSurfaceClass, tableRowClass } from '@/components/sme/halvex-system'
import { cn } from '@/lib/utils'

const EMPTY_LEADS: CrmLeadDto[] = []
const EMPTY_CHANNELS: CrmChannelDto[] = []

const CHANNEL_ICONS: Record<ChannelId, ReactNode> = {
  mail: <Mail size={14} strokeWidth={2} />,
  instagram: <Instagram size={14} strokeWidth={2} />,
  linkedin: <Linkedin size={14} strokeWidth={2} />,
  webchat: <MessageCircle size={14} strokeWidth={2} />,
}

type LeadFormState = {
  companyName: string
  primaryPersonName: string
  valueAmount: string
  channel: ChannelId
  risk: CrmLeadDto['risk']
  nextStep: string
}

const EMPTY_LEAD_FORM: LeadFormState = {
  companyName: '',
  primaryPersonName: '',
  valueAmount: '',
  channel: 'mail',
  risk: 'new',
  nextStep: '',
}

type ConversationSentiment = 'Positive' | 'Neutral' | 'Risk'

type ConversationIntelligence = {
  summary: string
  sentiment: ConversationSentiment
  objections: string[]
  buyingSignals: string[]
  competitorMentions: string[]
  nextStep: string
  talkRatio: number
  coaching: string[]
}

const OBJECTION_RULES = [
  { label: 'Price or budget pressure', terms: ['price', 'pricing', 'budget', 'cost', 'expensive', 'discount'] },
  { label: 'Timeline uncertainty', terms: ['timeline', 'timing', 'quarter', 'next month', 'not ready', 'delay'] },
  { label: 'Security or legal review', terms: ['security', 'legal', 'procurement', 'compliance', 'vendor review'] },
  { label: 'Implementation risk', terms: ['implementation', 'onboarding', 'migration', 'training', 'rollout'] },
  { label: 'Need proof or references', terms: ['case study', 'reference', 'proof', 'roi', 'results'] },
]

const SIGNAL_RULES = [
  { label: 'Decision window stated', terms: ['before friday', 'this week', 'monday', 'end of week', 'decision', 'deadline'] },
  { label: 'Budget or seat count shared', terms: ['budget', 'seats', 'users', 'plan', 'package'] },
  { label: 'Meeting intent', terms: ['can we discuss', 'walkthrough', 'demo', 'available', 'call'] },
  { label: 'Business pain confirmed', terms: ['need', 'problem', 'pain', 'risk', 'manual', 'slow'] },
  { label: 'Positive engagement', terms: ['liked', 'interested', 'looks good', 'helpful', 'great'] },
]

const COMPETITOR_TERMS = ['gong', 'hubspot', 'salesforce', 'outreach', 'apollo', 'pipedrive', 'clay']

function money(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value)
}

function timeFromNow(dateIso?: string | Date | null) {
  if (!dateIso) return 'not logged'
  const delta = Math.round((Date.now() - new Date(dateIso).getTime()) / (1000 * 60 * 60 * 24))
  if (delta <= 0) return 'today'
  if (delta === 1) return '1 day ago'
  return `${delta} days ago`
}

function formatShortDate(dateIso?: string | Date | null) {
  if (!dateIso) return 'No date'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(dateIso))
}

function clampPercent(value?: number | string | null) {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(100, Math.round(numeric)))
}

function initials(value?: string | null) {
  const parts = (value ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'HV'
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('')
}

function formatIntent(intent: string) {
  const labels: Record<string, string> = {
    fill_capacity: 'Fill pipeline',
    rebook: 'Book next step',
    reduce_no_show: 'Confirm urgency',
    win_back: 'Win back',
    upsell: 'Expand deal',
    protect_booking: 'Protect deal',
    follow_up: 'Follow up',
  }
  return labels[intent] ?? intent.replaceAll('_', ' ')
}

function formatDraftModel(model: string) {
  if (model === 'demo-fallback') return 'Preview AI'
  if (model.toLowerCase().includes('gpt')) return 'OpenAI'
  return model
}

function formatRole(from: CrmMessageDto['from']) {
  if (from === 'rep') return 'You'
  if (from === 'ai') return 'AI'
  return 'Customer'
}

function riskBadgeVariant(risk: CrmLeadDto['risk']) {
  if (risk === 'hot') return 'destructive'
  if (risk === 'warm') return 'secondary'
  return 'outline'
}

function sentimentTone(sentiment: ConversationSentiment) {
  if (sentiment === 'Positive') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (sentiment === 'Risk') return 'border-red-200 bg-red-50 text-red-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function InitialsMark({ value, className }: { value?: string | null; className?: string }) {
  return (
    <span className={cn('grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-sm font-semibold text-primary', className)}>
      {initials(value)}
    </span>
  )
}

function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-normal text-primary">{eyebrow}</p> : null}
        <h2 className="mt-1 text-base font-semibold tracking-normal text-foreground">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode
  label: string
  value: string | number
  detail: string
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <strong className="text-2xl font-semibold tracking-normal">{value}</strong>
          </div>
          <span className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary">{icon}</span>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}

const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

function DashboardTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-popover-foreground">{label}</p>
      {payload.map((item: any) => (
        <p key={item.name} className="mt-1 text-muted-foreground">
          {item.name}: <span className="font-medium text-foreground">{typeof item.value === 'number' ? money(item.value) : item.value}</span>
        </p>
      ))}
    </div>
  )
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error ?? `Request failed: ${response.status}`)
  return payload as T
}

function emptyMessages(): Record<ChannelId, CrmMessageDto[]> {
  return { mail: [], instagram: [], linkedin: [], webchat: [] }
}

function recalculateWorkspace(workspace: CrmWorkspacePayload): CrmWorkspacePayload {
  return {
    ...workspace,
    intelligence: buildRecoveryIntelligence({ records: workspace.leads, tasks: workspace.tasks, activities: workspace.activities }),
  }
}

function collectLabels(text: string, rules: Array<{ label: string; terms: string[] }>) {
  return rules
    .filter(rule => rule.terms.some(term => text.includes(term)))
    .map(rule => rule.label)
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length
}

function listOrFallback(items: string[], fallback: string) {
  return items.length ? items : [fallback]
}

function buildConversationIntelligence(lead: CrmLeadDto, messages: CrmMessageDto[], notes: string): ConversationIntelligence {
  const conversationText = messages.map(item => item.text).join(' ')
  const text = `${lead.description} ${lead.nextStep} ${lead.notes} ${notes} ${conversationText}`.toLowerCase()
  const objections = collectLabels(text, OBJECTION_RULES)
  const buyingSignals = collectLabels(text, SIGNAL_RULES)
  const competitorMentions = COMPETITOR_TERMS.filter(term => text.includes(term))
    .map(term => term[0].toUpperCase() + term.slice(1))
  const customerWords = messages.filter(item => item.from === 'customer').reduce((total, item) => total + wordCount(item.text), 0)
  const repWords = messages.filter(item => item.from !== 'customer').reduce((total, item) => total + wordCount(item.text), 0)
  const totalWords = customerWords + repWords
  const talkRatio = totalWords ? Math.round((customerWords / totalWords) * 100) : 0
  const sentiment: ConversationSentiment = objections.length > buyingSignals.length + 1 ? 'Risk' : buyingSignals.length ? 'Positive' : 'Neutral'
  const strongestSignal = buyingSignals[0] ?? objections[0] ?? 'No strong signal captured yet'
  const summary = messages.length
    ? `${lead.companyName} is in ${lead.stage} with ${lead.probability}% probability. ${strongestSignal}.`
    : `${lead.companyName} has no captured thread in this channel yet. Use notes or transcript capture to sharpen the AI readout.`
  const coaching = [
    talkRatio > 0 && talkRatio < 35 ? 'Ask a shorter question and let the buyer explain the blocker.' : 'Keep the buyer talking around priority, timeline, and owner.',
    objections.includes('Price or budget pressure') ? 'Anchor the response to outcome and rollout scope before discounting.' : 'Tie the next reply to one business outcome and one calendar step.',
    competitorMentions.length ? `Differentiate against ${competitorMentions[0]} with proof, not feature lists.` : 'Confirm the decision process before sending more material.',
  ]

  return {
    summary,
    sentiment,
    objections,
    buyingSignals,
    competitorMentions,
    nextStep: lead.nextStep || 'Confirm decision owner, deadline, and next meeting.',
    talkRatio,
    coaching,
  }
}

export default function SalesCommandCenter() {
  const [payload, setPayload] = useState<CrmWorkspacePayload | null>(null)
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null)
  const [channelId, setChannelId] = useState<ChannelId>('mail')
  const [message, setMessage] = useState('')
  const [aiInstruction, setAiInstruction] = useState('')
  const [lastDraftModel, setLastDraftModel] = useState<string | null>(null)
  const [draftNotes, setDraftNotes] = useState('')
  const [transcript, setTranscript] = useState('')
  const [leadForm, setLeadForm] = useState<LeadFormState>(EMPTY_LEAD_FORM)
  const [showLeadForm, setShowLeadForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const setWorkspace = useCallback((next: CrmWorkspacePayload | null) => {
    setPayload(next)
  }, [])

  function updateWorkspace(updater: (previous: CrmWorkspacePayload) => CrmWorkspacePayload) {
    setPayload(previous => {
      if (!previous) return previous
      const next = updater(previous)
      return next
    })
  }

  const loadWorkspace = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const workspace = await jsonFetch<CrmWorkspacePayload>('/api/crm/workspace')
      setWorkspace(workspace)
      setActiveLeadId(previous => previous && workspace.leads.some(lead => lead.id === previous) ? previous : workspace.leads[0]?.id ?? null)
      setChannelId(workspace.leads[0]?.channel ?? 'mail')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load workspace')
    } finally {
      setLoading(false)
    }
  }, [setWorkspace])

  useEffect(() => {
    void loadWorkspace()
  }, [loadWorkspace])

  const leads = payload?.leads ?? EMPTY_LEADS
  const channels = payload?.channels ?? EMPTY_CHANNELS
  const payloadMessages = payload?.messages
  const messages = useMemo(() => payloadMessages ?? emptyMessages(), [payloadMessages])
  const activeLead = leads.find(item => item.id === activeLeadId) ?? leads[0] ?? null

  useEffect(() => {
    if (!activeLead) return
    setDraftNotes(activeLead.notes)
    setChannelId(activeLead.channel)
  }, [activeLead])

  const leadIntel = useMemo(() => {
    if (!activeLead || !payload) return null
    return buildRecoveryIntelligence({
      records: [activeLead],
      tasks: payload.tasks.filter(task => task.companyName === activeLead.companyName),
      activities: payload.activities.filter(activity => activity.companyName === activeLead.companyName),
      now: new Date(),
    })
  }, [activeLead, payload])

  const globalIntel = useMemo(() => {
    if (!payload) return null
    return payload.intelligence ?? buildRecoveryIntelligence({ records: payload.leads, tasks: payload.tasks, activities: payload.activities })
  }, [payload])

  const intent = useMemo(() => activeLead ? classifyRecoveryIntent(activeLead, new Date()) : 'follow_up', [activeLead])
  const connected = channels.find(item => item.id === channelId)?.connected ?? false
  const activeMessageList = useMemo(
    () => activeLead ? (messages[channelId] ?? []).filter(item => item.leadId === activeLead.id) : [],
    [activeLead, channelId, messages]
  )
  const conversationIntel = useMemo(
    () => activeLead ? buildConversationIntelligence(activeLead, activeMessageList, draftNotes) : null,
    [activeLead, activeMessageList, draftNotes]
  )
  const activeTasks = useMemo(
    () => !activeLead || !payload ? [] : payload.tasks.filter(task => task.companyName === activeLead.companyName).slice(0, 3),
    [activeLead, payload]
  )
  const activeActivities = useMemo(
    () => !activeLead || !payload ? [] : payload.activities.filter(activity => activity.companyName === activeLead.companyName).slice(0, 3),
    [activeLead, payload]
  )
  const channelStats = useMemo(() => channels.map(channel => ({
    ...channel,
    count: (messages[channel.id] ?? []).length,
  })), [channels, messages])
  const weightedPipeline = useMemo(
    () => leads.reduce((total, lead) => total + (Number(lead.valueAmount ?? 0) * Number(lead.probability ?? 0)) / 100, 0),
    [leads]
  )
  const totalPipeline = useMemo(
    () => leads.reduce((total, lead) => total + Number(lead.valueAmount ?? 0), 0),
    [leads]
  )
  const averageProbability = useMemo(
    () => leads.length ? Math.round(leads.reduce((total, lead) => total + clampPercent(lead.probability), 0) / leads.length) : 0,
    [leads]
  )
  const pipelineCoverage = totalPipeline ? Math.round((weightedPipeline / totalPipeline) * 100) : 0
  const atRiskLeads = useMemo(
    () => leads.filter(lead => lead.risk === 'hot' || Number(lead.probability ?? 0) < 45).length,
    [leads]
  )
  const forecastRows = useMemo(
    () => [...leads].sort((a, b) => Number(b.valueAmount ?? 0) - Number(a.valueAmount ?? 0)).slice(0, 4),
    [leads]
  )
  const stageRows = useMemo(() => {
    const stages = new Map<string, { label: string; count: number; value: number }>()
    for (const lead of leads) {
      const label = lead.stageName || lead.stage || 'Unstaged'
      const current = stages.get(label) ?? { label, count: 0, value: 0 }
      current.count += 1
      current.value += Number(lead.valueAmount ?? 0)
      stages.set(label, current)
    }
    return [...stages.values()].sort((a, b) => b.value - a.value).slice(0, 4)
  }, [leads])
  const forecastChartData = useMemo(
    () => forecastRows.map(lead => {
      const company = lead.companyName ?? lead.title ?? 'Account'
      return {
        name: company.length > 14 ? `${company.slice(0, 12)}...` : company,
        pipeline: Number(lead.valueAmount ?? 0),
        weighted: Math.round((Number(lead.valueAmount ?? 0) * clampPercent(lead.probability)) / 100),
      }
    }),
    [forecastRows],
  )
  const trendChartData = useMemo(() => {
    const labels = ['Mar 8', 'Mar 18', 'Mar 29', 'Apr 8', 'Apr 18', 'May 1', 'May 18', 'Jun 20']
    const base = Math.max(weightedPipeline, totalPipeline * 0.52, 1)

    return labels.map((label, index) => {
      const lead = leads[index % Math.max(leads.length, 1)]
      const lift = Number(lead?.valueAmount ?? 0) * 0.08

      return {
        label,
        value: Math.round(base * (0.58 + index * 0.065) + lift),
      }
    })
  }, [leads, totalPipeline, weightedPipeline])
  const trendPointString = useMemo(() => {
    const values = trendChartData.map(item => item.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const spread = Math.max(1, max - min)

    return trendChartData.map((item, index) => {
      const x = trendChartData.length > 1 ? (index / (trendChartData.length - 1)) * 100 : 0
      const y = 78 - ((item.value - min) / spread) * 48
      return `${x.toFixed(2)},${y.toFixed(2)}`
    }).join(' ')
  }, [trendChartData])
  const trendAreaString = `0,88 ${trendPointString} 100,88`
  const stageChartData = useMemo(
    () => stageRows.map((stage, index) => ({
      ...stage,
      fill: CHART_COLORS[index % CHART_COLORS.length],
    })),
    [stageRows],
  )
  const stageGradient = useMemo(() => {
    const total = stageChartData.reduce((sum, stage) => sum + stage.value, 0)
    if (!total) return 'var(--muted) 0% 100%'

    let cursor = 0
    return stageChartData.map(stage => {
      const start = cursor
      cursor += (stage.value / total) * 100
      return `${stage.fill} ${start}% ${cursor}%`
    }).join(', ')
  }, [stageChartData])
  const totalOpenTasks = payload?.tasks.length ?? 0
  const activeLeadProbability = clampPercent(activeLead?.probability)
  const activeChannelName = channels.find(item => item.id === channelId)?.name ?? channelId
  const nextBestRecommendation = leadIntel?.recommendations[0] ?? globalIntel?.recommendations[0] ?? null
  const connectedChannelCount = channelStats.filter(channel => channel.connected).length
  const messageCount = channelStats.reduce((total, channel) => total + channel.count, 0)

  function updateLead(updated: Partial<CrmLeadDto> & { id: string }) {
    updateWorkspace(previous => {
      const leads = previous.leads.map(lead => lead.id === updated.id ? { ...lead, ...updated } : lead)
      return recalculateWorkspace({ ...previous, leads })
    })
  }

  function updateChannel(updated: CrmChannelDto) {
    updateWorkspace(previous => ({
      ...previous,
      channels: previous.channels.map(channel => channel.id === updated.id ? updated : channel),
    }))
  }

  function addMessage(created: CrmMessageDto) {
    updateWorkspace(previous => {
      const leads = previous.leads.map(lead => lead.id === created.leadId ? { ...lead, latestActivityAt: created.sentAt, channel: created.channel } : lead)
      return recalculateWorkspace({
        ...previous,
        leads,
        messages: {
          ...previous.messages,
          [created.channel]: [...(previous.messages[created.channel] ?? []), created],
        },
      })
    })
  }

  async function createLead() {
    const companyName = leadForm.companyName.trim()
    if (!companyName) return
    setBusy('lead')
    setError(null)
    try {
      const probability = leadForm.risk === 'hot' ? 72 : leadForm.risk === 'warm' ? 48 : 24
      const result = await jsonFetch<{ lead: CrmLeadDto }>('/api/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: companyName,
          companyName,
          primaryPersonName: leadForm.primaryPersonName.trim() || 'New contact',
          valueAmount: Number(leadForm.valueAmount || 0),
          channel: leadForm.channel,
          risk: leadForm.risk,
          probability,
          stage: 'New',
          nextStep: leadForm.nextStep.trim() || 'Qualify the opportunity and confirm the next step.',
        }),
      })
      updateWorkspace(previous => {
        const leads = [result.lead, ...previous.leads]
        return recalculateWorkspace({
          ...previous,
          leads,
        })
      })
      setActiveLeadId(result.lead.id)
      setChannelId(result.lead.channel)
      setLeadForm({ ...EMPTY_LEAD_FORM })
      setShowLeadForm(false)
    } catch (leadError) {
      setError(leadError instanceof Error ? leadError.message : 'Unable to create lead')
    } finally {
      setBusy(null)
    }
  }

  async function saveNotes() {
    if (!activeLead) return
    setBusy('notes')
    setError(null)
    try {
      const result = await jsonFetch<{ lead: Partial<CrmLeadDto> & { id: string } }>(`/api/crm/leads/${activeLead.id}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: draftNotes }),
      })
      updateLead({ ...result.lead, id: activeLead.id, notes: draftNotes })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save notes')
    } finally {
      setBusy(null)
    }
  }

  async function send() {
    if (!activeLead || !message.trim() || !connected) return
    setBusy('message')
    setError(null)
    try {
      const result = await jsonFetch<{ message: CrmMessageDto }>('/api/crm/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: activeLead.id, channel: channelId, text: message.trim() }),
      })
      addMessage(result.message)
      setMessage('')
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to send message')
    } finally {
      setBusy(null)
    }
  }

  async function useAIDraft() {
    if (!activeLead) return
    setBusy('draft')
    setError(null)
    try {
      const result = await jsonFetch<{ draft: string; model: string; intent: string }>('/api/ai/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: activeLead.id, lead: activeLead, channel: channelId, instruction: aiInstruction }),
      })
      setMessage(result.draft)
      setLastDraftModel(result.model)
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : 'Unable to generate draft')
    } finally {
      setBusy(null)
    }
  }

  async function toggleChannel(channel: CrmChannelDto) {
    setBusy(`channel:${channel.id}`)
    setError(null)
    try {
      const result = await jsonFetch<{ channel: CrmChannelDto }>(`/api/crm/channels/${channel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connected: !channel.connected }),
      })
      updateChannel(result.channel)
    } catch (channelError) {
      setError(channelError instanceof Error ? channelError.message : 'Unable to update channel')
    } finally {
      setBusy(null)
    }
  }

  async function captureTranscript() {
    if (!activeLead || !transcript.trim()) return

    setBusy('transcript')
    setError(null)

    const sentAt = new Date()
    const transcriptText = transcript.trim()
    const nextNotes = `${draftNotes.trim()}\n\n## Conversation capture ${sentAt.toLocaleDateString('en-GB')}\n${transcriptText}`.trim()
    const analysisText = `Transcript analyzed\n\n${buildConversationIntelligence({ ...activeLead, notes: nextNotes }, activeMessageList, transcriptText).summary}`

    try {
      const notesResult = await jsonFetch<{ lead: Partial<CrmLeadDto> & { id: string } }>(`/api/crm/leads/${activeLead.id}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: nextNotes }),
      })
      const messageResult = await jsonFetch<{ message: CrmMessageDto }>('/api/crm/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: activeLead.id, channel: channelId, from: 'ai', text: analysisText }),
      })

      setDraftNotes(nextNotes)
      updateLead({ ...notesResult.lead, id: activeLead.id, notes: nextNotes, latestActivityAt: sentAt.toISOString() })
      addMessage(messageResult.message)
      setTranscript('')
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : 'Unable to analyze transcript')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="grid min-w-0 max-w-full gap-5">
        <Skeleton className="h-36 rounded-lg" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
        </div>
        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)_360px]">
          <Skeleton className="h-[620px] rounded-lg" />
          <Skeleton className="h-[620px] rounded-lg" />
          <Skeleton className="h-[620px] rounded-lg xl:col-span-2 2xl:col-span-1" />
        </div>
      </div>
    )
  }

  if (!activeLead || !payload || !globalIntel) {
    return (
      <Alert className="max-w-2xl">
        <RefreshCw className="size-4" />
        <AlertTitle>Workspace unavailable</AlertTitle>
        <AlertDescription className="gap-4">
          <p>{error ?? 'No CRM workspace could be loaded.'}</p>
          <Button type="button" onClick={loadWorkspace}>
            <RefreshCw className="size-4" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const panelClass = cn(pillSurfaceClass, 'overflow-hidden bg-[#111417] py-0 text-zinc-100 shadow-none')
  const softPanelClass = cn(pillInsetClass, 'bg-white/[0.04]')
  const topDeals = forecastRows.slice(0, 2)

  if (activeLead.id) {
    return (
      <div className="grid w-full min-w-0 gap-3 text-zinc-100">
        {error ? (
          <Alert variant="destructive" className="border-red-500/30 bg-red-500/10 text-red-100">
            <ShieldAlert className="size-4" />
            <AlertTitle>Action failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <section className="grid items-start gap-3 xl:grid-cols-[minmax(260px,0.9fr)_minmax(380px,1.08fr)_minmax(260px,0.76fr)]">
          <div className="grid content-start gap-3">
            <Card className={panelClass} id="forecast">
              <CardHeader className="flex-row items-start justify-between gap-3 px-4 pb-0 pt-4">
                <div>
                  <CardTitle className="text-sm font-semibold">My Deals</CardTitle>
                  <CardDescription className="mt-1 text-[11px] text-zinc-500">
                    {connectedChannelCount} channels live across {leads.length} accounts.
                  </CardDescription>
                </div>
                <Select defaultValue="finance">
                  <SelectTrigger className="h-8 w-[104px] rounded-lg border-white/10 bg-black/30 text-[11px] text-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="risk">Risk</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                <div className={cn(softPanelClass, 'p-3')}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-zinc-100">Overview</p>
                      <p className="mt-1 text-[11px] text-zinc-500">
                        {atRiskLeads} risks need attention
                      </p>
                    </div>
                    <Badge className="rounded-full border-emerald-400/20 bg-emerald-400/10 text-[10px] text-emerald-200" variant="outline">
                      +{pipelineCoverage || averageProbability}%
                    </Badge>
                  </div>

                  <Tabs defaultValue="month" className="mt-3">
                    <TabsList className="grid h-8 grid-cols-3 rounded-full bg-black/30 p-1">
                      <TabsTrigger value="day" className="rounded-full text-[10px] data-[state=active]:bg-white/10">24h</TabsTrigger>
                      <TabsTrigger value="week" className="rounded-full text-[10px] data-[state=active]:bg-white/10">Week</TabsTrigger>
                      <TabsTrigger value="month" className="rounded-full text-[10px] data-[state=active]:bg-white/10">Month</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <div className="mt-3 h-36">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-[116px] w-full overflow-visible">
                      <defs>
                        <linearGradient id="dealTrendSvg" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="#4ea4ff" stopOpacity="0.5" />
                          <stop offset="95%" stopColor="#4ea4ff" stopOpacity="0.03" />
                        </linearGradient>
                      </defs>
                      {[24, 48, 72].map(y => (
                        <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="rgba(255,255,255,0.06)" vectorEffect="non-scaling-stroke" />
                      ))}
                      <polygon points={trendAreaString} fill="url(#dealTrendSvg)" />
                      <polyline points={trendPointString} fill="none" stroke="#4ea4ff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    </svg>
                    <div className="grid grid-cols-6 gap-1 text-[10px] text-zinc-600">
                      {trendChartData.slice(1).map(item => (
                        <span key={item.label} className="truncate text-center">{item.label}</span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-2xl font-semibold tracking-normal">+{Math.max(1, pipelineCoverage).toFixed(2)}%</p>
                      <p className="mt-1 text-[10px] text-zinc-500">Pipeline coverage</p>
                    </div>
                    <p className="text-right text-[10px] leading-4 text-zinc-500">
                      Last updated<br />
                      Today, 06:49 AM
                    </p>
                  </div>
                </div>

                <div className={cn(softPanelClass, 'p-3')}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium">My Top Deals</p>
                    <p className="text-[10px] text-zinc-500">{topDeals.length || 0} of {leads.length}</p>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    {topDeals.map(lead => (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => setActiveLeadId(lead.id)}
                        className={cn(
                          'rounded-[22px] border p-3 text-left transition hover:bg-white/[0.06]',
                          lead.id === activeLead.id ? 'border-blue-400/35 bg-blue-400/10' : 'border-white/10 bg-black/20',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold">{lead.companyName}</p>
                            <p className="mt-1 text-[11px] text-zinc-500">{money(Number(lead.valueAmount ?? 0))}</p>
                          </div>
                          <span className="grid size-7 place-items-center rounded-full bg-white text-black">
                            <Plus className="size-3.5" />
                          </span>
                        </div>
                        <div className="mt-3 flex -space-x-2">
                          {[lead.companyName, lead.primaryPersonName, lead.stageName].map(item => (
                            <InitialsMark key={item} value={item} className="size-6 rounded-full border border-[#111417] bg-zinc-800 text-[9px] text-zinc-100" />
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={panelClass} id="leads">
              <CardHeader className="flex-row items-center justify-between gap-3 px-4 pb-0 pt-4">
                <div>
                  <CardTitle className="text-sm">Pipeline Mix</CardTitle>
                  <CardDescription className="text-[11px] text-zinc-500">{stageRows.length} stages</CardDescription>
                </div>
                <Button size="sm" type="button" variant="outline" className="h-8 rounded-full border-white/10 bg-white/[0.04] text-xs" onClick={() => setShowLeadForm(previous => !previous)}>
                  <Plus className="size-3.5" />
                  Lead
                </Button>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                {showLeadForm ? (
                  <form
                    className={cn(softPanelClass, 'grid gap-3 p-3')}
                    onSubmit={event => {
                      event.preventDefault()
                      void createLead()
                    }}
                  >
                    <Field label="Company">
                      <Input
                        value={leadForm.companyName}
                        onChange={event => setLeadForm(previous => ({ ...previous, companyName: event.target.value }))}
                        required
                        className="h-9 border-white/10 bg-black/25"
                      />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      <Field label="Contact">
                        <Input
                          value={leadForm.primaryPersonName}
                          onChange={event => setLeadForm(previous => ({ ...previous, primaryPersonName: event.target.value }))}
                          className="h-9 border-white/10 bg-black/25"
                        />
                      </Field>
                      <Field label="Value">
                        <Input
                          inputMode="numeric"
                          value={leadForm.valueAmount}
                          onChange={event => setLeadForm(previous => ({ ...previous, valueAmount: event.target.value.replace(/\D/g, '') }))}
                          className="h-9 border-white/10 bg-black/25"
                        />
                      </Field>
                    </div>
                    <Field label="Next step">
                      <Input
                        value={leadForm.nextStep}
                        onChange={event => setLeadForm(previous => ({ ...previous, nextStep: event.target.value }))}
                        className="h-9 border-white/10 bg-black/25"
                      />
                    </Field>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" type="button" size="sm" onClick={() => setShowLeadForm(false)}>Cancel</Button>
                      <Button type="submit" size="sm" disabled={busy === 'lead'}>{busy === 'lead' ? 'Creating' : 'Create'}</Button>
                    </div>
                  </form>
                ) : null}

                {stageRows.map(stage => {
                  const width = totalPipeline ? Math.max(8, Math.round((stage.value / totalPipeline) * 100)) : 8
                  return (
                    <div key={stage.label} className="grid gap-2">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="truncate text-zinc-300">{stage.label}</span>
                        <span className="text-zinc-500">{money(stage.value)}</span>
                      </div>
                      <Progress value={width} className="h-1.5 bg-white/10" />
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>

          <div className="grid content-start gap-3">
            <Card className={panelClass}>
              <CardHeader className="flex-row items-start justify-between gap-3 px-4 pb-0 pt-4">
                <div>
                  <CardTitle className="text-sm">Total Balance</CardTitle>
                  <CardDescription className="text-[11px] text-zinc-500">
                    The sum of all open amounts in your wallet.
                  </CardDescription>
                </div>
                <Select defaultValue="gbp">
                  <SelectTrigger className="h-8 w-[108px] rounded-lg border-white/10 bg-black/30 text-[11px] text-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gbp">GB Pound</SelectItem>
                    <SelectItem value="usd">US Dollar</SelectItem>
                    <SelectItem value="eur">Euro</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-3xl font-semibold tracking-normal">
                      <span className="text-blue-400">£</span> {Math.round(totalPipeline).toLocaleString('en-GB')}
                    </p>
                    <p className="mt-2 text-[11px] text-zinc-500">
                      Weighted forecast {money(weightedPipeline)}
                    </p>
                  </div>
                  <div className="text-right text-[11px] text-zinc-500">
                    <p>Compared to last month</p>
                    <p className="mt-1 font-semibold text-emerald-300">+{Math.max(1, averageProbability - atRiskLeads).toFixed(1)}%</p>
                  </div>
                </div>

                <div className="relative mt-4 h-44 overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,#101923,#071018_55%,#111318)]">
                  <div className="absolute left-4 top-4 z-10">
                    <p className="flex items-center gap-2 text-xs font-medium text-blue-100">
                      <Sparkles className="size-3.5 text-blue-300" />
                      AI Assistant
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">Updating the forecast right now...</p>
                  </div>
                  <div className="absolute inset-x-4 bottom-4 top-16">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
                      <defs>
                        <linearGradient id="balanceTrendSvg" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="#4ea4ff" stopOpacity="0.58" />
                          <stop offset="95%" stopColor="#4ea4ff" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <polygon points={trendAreaString} fill="url(#balanceTrendSvg)" />
                      <polyline points={trendPointString} fill="none" stroke="#4ea4ff" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                    </svg>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={panelClass}>
              <CardHeader className="flex-row items-center justify-between gap-3 px-4 pb-0 pt-4">
                <div>
                  <CardTitle className="text-sm">Popular Deals</CardTitle>
                  <CardDescription className="text-[11px] text-zinc-500">Ranked by value and engagement</CardDescription>
                </div>
                <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-[10px] text-zinc-300">
                  {leads.length} list
                </Badge>
              </CardHeader>
              <CardContent className="p-0 pt-3">
                <div className="space-y-2 px-3 pb-3">
                  <div className="grid grid-cols-[48px_minmax(0,1fr)_90px_88px] gap-3 px-3 text-[10px] uppercase text-zinc-500">
                    <span>Rank</span>
                    <span>Name</span>
                    <span>Stage</span>
                    <span className="text-right">Action</span>
                  </div>
                  {leads.slice(0, 6).map((lead, index) => {
                    const selected = lead.id === activeLead.id
                    return (
                      <button
                        key={lead.id}
                        type="button"
                        data-state={selected ? 'selected' : undefined}
                        className={cn(
                          tableRowClass,
                          'grid w-full grid-cols-[48px_minmax(0,1fr)_90px_88px] items-center gap-3 text-left text-xs data-[state=selected]:border-blue-400/30 data-[state=selected]:bg-blue-400/10',
                        )}
                        onClick={() => setActiveLeadId(lead.id)}
                      >
                        <span className="text-zinc-500">#{index + 1}</span>
                        <span className="flex min-w-0 items-center gap-2">
                          <InitialsMark value={lead.companyName} className="size-7 rounded-full bg-zinc-800 text-[10px] text-zinc-100" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-zinc-100">{lead.companyName}</span>
                            <span className="block truncate text-[10px] text-zinc-500">{lead.primaryPersonName}</span>
                          </span>
                        </span>
                        <span className="truncate text-zinc-400">{lead.stageName}</span>
                        <span className="justify-self-end rounded-full bg-white px-3 py-1.5 text-[11px] font-medium text-black">
                          {selected ? 'Open' : 'Join'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid content-start gap-3">
            <Card className={cn(panelClass, 'bg-[#121411]')}>
              <CardHeader className="flex-row items-center justify-between gap-3 px-4 pb-0 pt-4">
                <div>
                  <CardTitle className="text-xs">Ads</CardTitle>
                  <CardDescription className="text-[10px] text-zinc-500">Powered by Halvex</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="h-7 rounded-full text-[11px] text-zinc-300 hover:bg-white/[0.06]">
                  Next
                  <ArrowUpRight className="size-3" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                <div className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-center text-[11px] text-zinc-300">
                  Just for today
                </div>
                <div>
                  <p className="flex items-center gap-2 text-base font-semibold">
                    <Zap className="size-4 text-zinc-100" />
                    Let&apos;s Recover More
                    <span className="rounded-full bg-yellow-300 px-1.5 py-0.5 text-xs font-bold text-black">40%</span>
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-500">This is your AI campaign scanner.</p>
                </div>
                <p className="text-[11px] leading-5 text-zinc-500">
                  Unlock a sharper revenue motion with prioritized deal recovery and AI-written next steps.
                </p>
                <Button variant="link" className="h-auto p-0 text-xs text-zinc-100">
                  Learn more
                  <ArrowUpRight className="size-3" />
                </Button>
                <div className="flex items-center justify-between gap-3 pt-3">
                  <Button variant="ghost" size="sm" className="h-8 text-[11px] text-zinc-500 hover:bg-white/[0.06]">Don&apos;t show again</Button>
                  <Button size="sm" className="h-8 rounded-full bg-white px-4 text-[11px] text-black hover:bg-zinc-200" onClick={useAIDraft} disabled={busy === 'draft'}>
                    Get started
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className={panelClass}>
              <CardHeader className="flex-row items-start justify-between gap-3 px-4 pb-0 pt-4">
                <div className="min-w-0">
                  <CardDescription className="text-[10px] uppercase text-zinc-500">Active deal</CardDescription>
                  <CardTitle className="mt-1 truncate text-sm">{activeLead.companyName}</CardTitle>
                </div>
                <Badge variant={riskBadgeVariant(activeLead.risk)} className="rounded-full text-[10px]">{activeLead.risk}</Badge>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: <CircleDollarSign className="size-3.5" />, label: 'Value', value: money(Number(activeLead.valueAmount ?? 0)) },
                    { icon: <Target className="size-3.5" />, label: 'Prob.', value: `${activeLeadProbability}%` },
                    { icon: <CalendarDays className="size-3.5" />, label: 'Close', value: formatShortDate(activeLead.expectedCloseDate) },
                    { icon: <Clock3 className="size-3.5" />, label: 'Last', value: timeFromNow(activeLead.latestActivityAt) },
                  ].map(item => (
                    <div key={item.label} className={cn(softPanelClass, 'rounded-[20px] p-3')}>
                      <p className="flex items-center gap-1.5 text-[10px] text-zinc-500">{item.icon}{item.label}</p>
                      <p className="mt-1 truncate text-xs font-semibold">{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className={cn(softPanelClass, 'rounded-[20px] p-3')}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Health</span>
                    <span>{activeLeadProbability}%</span>
                  </div>
                  <Progress value={activeLeadProbability} className="mt-2 h-1.5 bg-white/10" />
                  <p className="mt-3 text-xs leading-5 text-zinc-400">{activeLead.nextStep}</p>
                </div>
              </CardContent>
            </Card>

            <Card className={panelClass} id="inbox">
              <CardHeader className="px-4 pb-0 pt-4">
                <SectionHeader
                  title={activeChannelName}
                  description={`${activeMessageList.length} messages in this deal`}
                  action={<Badge variant={connected ? 'secondary' : 'outline'} className="rounded-full text-[10px]">{connected ? 'Live' : 'Off'}</Badge>}
                />
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                <Tabs value={channelId} onValueChange={value => setChannelId(value as ChannelId)}>
                  <TabsList className="grid h-8 grid-cols-4 rounded-full bg-black/30 p-1">
                    {channels.map(channel => (
                      <TabsTrigger key={channel.id} value={channel.id} className="rounded-full px-1 text-[0px] data-[state=active]:bg-white/10 sm:text-[10px] xl:text-[0px] 2xl:text-[10px]">
                        {CHANNEL_ICONS[channel.id]}
                        <span className="hidden sm:inline xl:hidden 2xl:inline">{channel.name}</span>
                        <Dot className={cn('size-3', channel.connected ? 'text-emerald-400' : 'text-zinc-600')} strokeWidth={4} />
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <div className="grid max-h-56 gap-2 overflow-y-auto rounded-[24px] border border-white/10 bg-black/20 p-3">
                  {activeMessageList.slice(-4).map(item => (
                    <article
                      key={item.id}
                      className={cn(
                        'max-w-[88%] rounded-[20px] border p-3 text-xs',
                        item.from === 'rep' && 'ml-auto border-blue-400/30 bg-blue-500 text-white',
                        item.from === 'ai' && 'border-blue-400/20 bg-blue-400/10 text-blue-100',
                        item.from === 'customer' && 'border-white/10 bg-white/[0.04] text-zinc-300',
                      )}
                    >
                      <p className="leading-5">{item.text}</p>
                      <p className={cn('mt-2 text-[10px] text-zinc-500', item.from === 'rep' && 'text-blue-50/80')}>
                        {formatRole(item.from)} · {item.time}
                      </p>
                    </article>
                  ))}
                  {(!connected || !activeMessageList.length) && (
                    <div className="rounded-[24px] border border-dashed border-white/10 p-5 text-center text-xs text-zinc-500">
                      {!connected ? 'Connect this channel to start live sync.' : 'No messages for this lead yet.'}
                    </div>
                  )}
                </div>
                <form
                  className="grid gap-2"
                  onSubmit={event => {
                    event.preventDefault()
                    void send()
                  }}
                >
                  <Textarea
                    value={message}
                    onChange={event => setMessage(event.target.value)}
                    placeholder={connected ? `Reply on ${activeChannelName}...` : 'Connect channel to send messages'}
                    className="min-h-20 resize-none rounded-[22px] border-white/10 bg-black/25 text-xs"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <Button type="button" size="sm" variant="outline" className="h-8 rounded-full border-white/10 bg-white/[0.04] text-xs" disabled={busy === 'draft'} onClick={useAIDraft}>
                      <Sparkles className="size-3.5" />
                      AI
                    </Button>
                    <Button type="submit" size="sm" className="h-8 rounded-full bg-white px-4 text-xs text-black hover:bg-zinc-200" disabled={!connected || busy === 'message'}>
                      <SendHorizontal className="size-3.5" />
                      {busy === 'message' ? 'Sending' : 'Send'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)_minmax(280px,0.72fr)]">
          <Card className={panelClass} aria-label="Lead markdown notes">
            <CardHeader className="flex-row items-center justify-between gap-3 px-4 pb-0 pt-4">
              <div>
                <CardTitle className="text-sm">Deal Notes</CardTitle>
                <CardDescription className="text-[11px] text-zinc-500">{activeLead.title}</CardDescription>
              </div>
              <Button variant="outline" size="sm" type="button" className="h-8 rounded-full border-white/10 bg-white/[0.04] text-xs" onClick={saveNotes} disabled={busy === 'notes' || draftNotes === activeLead.notes}>
                <Save className="size-3.5" />
                {busy === 'notes' ? 'Saving' : 'Save'}
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <Textarea
                id="markdown-notes"
                aria-label="Markdown notes"
                value={draftNotes}
                onChange={event => setDraftNotes(event.target.value)}
                rows={8}
                className="min-h-52 resize-none rounded-[22px] border-white/10 bg-black/25 font-mono text-xs"
              />
              <div className={cn(softPanelClass, 'space-y-3 p-3')}>
                <p className="flex items-center gap-2 text-xs font-semibold">
                  <BrainCircuit className="size-3.5 text-blue-300" />
                  Call intelligence
                </p>
                <Textarea
                  value={transcript}
                  onChange={event => setTranscript(event.target.value)}
                  placeholder="Paste call notes or transcript..."
                  rows={5}
                  className="min-h-32 resize-none rounded-[22px] border-white/10 bg-black/25 text-xs"
                />
                <Button variant="outline" size="sm" className="h-8 w-full rounded-full border-white/10 bg-white/[0.04] text-xs" type="button" onClick={() => void captureTranscript()} disabled={!transcript.trim() || busy === 'transcript'}>
                  <BrainCircuit className="size-3.5" />
                  {busy === 'transcript' ? 'Analyzing' : 'Analyze'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className={panelClass} id="copilot">
            <CardHeader className="px-4 pb-0 pt-4">
              <SectionHeader
                title={formatIntent(intent)}
                description={`${leadIntel?.summary.confidence ?? activeLead.score}% confidence`}
                action={<Bot className="size-4 text-blue-300" />}
              />
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              <div className={cn(softPanelClass, 'space-y-3 p-3')}>
                <p className="flex items-center gap-2 text-xs font-semibold">
                  <Sparkles className="size-3.5 text-blue-300" />
                  Reply brief
                </p>
                <Textarea
                  value={aiInstruction}
                  onChange={event => setAiInstruction(event.target.value)}
                  placeholder="Tone, objection, or commercial angle..."
                  rows={3}
                  className="resize-none rounded-[22px] border-white/10 bg-black/25 text-xs"
                />
                <Button onClick={useAIDraft} type="button" size="sm" className="h-8 w-full rounded-full bg-white text-xs text-black hover:bg-zinc-200" disabled={busy === 'draft'}>
                  <Bot className="size-3.5" />
                  {busy === 'draft' ? 'Thinking' : 'Generate reply'}
                </Button>
                {lastDraftModel ? <p className="text-[10px] text-zinc-500">Last draft: {formatDraftModel(lastDraftModel)}</p> : null}
              </div>

              {conversationIntel ? (
                <div className="grid gap-2">
                  <div className={cn(softPanelClass, 'p-3')}>
                    <p className="flex items-center gap-2 text-xs font-semibold">
                      <Gauge className="size-3.5 text-yellow-300" />
                      Conversation read
                    </p>
                    <p className="mt-2 text-xs leading-5 text-zinc-400">{conversationIntel.summary}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className={cn(softPanelClass, 'p-3')}>
                      <p className="text-[10px] text-zinc-500">Signal</p>
                      <p className="mt-1 truncate text-xs">{conversationIntel.buyingSignals[0] ?? 'Awaiting signal'}</p>
                    </div>
                    <div className={cn(softPanelClass, 'p-3')}>
                      <p className="text-[10px] text-zinc-500">Risk</p>
                      <p className="mt-1 truncate text-xs">{conversationIntel.objections[0] ?? 'Clean'}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="rounded-[24px] border border-blue-400/20 bg-blue-400/10 p-3">
                <p className="flex items-center gap-2 text-xs font-semibold text-blue-100">
                  <Sparkles className="size-3.5" />
                  Next best action
                </p>
                <p className="mt-2 text-xs font-semibold">{nextBestRecommendation?.title ?? activeLead.nextStep}</p>
                <p className="mt-2 text-[11px] leading-5 text-zinc-400">{nextBestRecommendation?.body ?? 'No recommendation generated yet.'}</p>
              </div>
            </CardContent>
          </Card>

          <Card className={panelClass} id="channels">
            <CardHeader className="px-4 pb-0 pt-4">
              <SectionHeader
                title="Channel Health"
                description={`${connectedChannelCount}/${channelStats.length} live · ${messageCount} messages`}
              />
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {channelStats.map(channel => {
                const active = busy === `channel:${channel.id}`
                return (
                  <div className={cn(softPanelClass, 'p-3')} key={channel.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-xs font-semibold">
                          {CHANNEL_ICONS[channel.id]}
                          {channel.name}
                        </p>
                        <p className="mt-1 text-[10px] text-zinc-500">
                          {channel.connected ? `${channel.count} synced messages` : channel.status.replaceAll('_', ' ')}
                        </p>
                      </div>
                      <Badge variant={channel.connected ? 'secondary' : 'outline'} className="rounded-full text-[10px]">{channel.connected ? 'Live' : 'Off'}</Badge>
                    </div>
                    <Button
                      className="mt-3 h-8 w-full rounded-full border-white/10 bg-white/[0.04] text-xs"
                      variant="outline"
                      type="button"
                      onClick={() => void toggleChannel(channel)}
                      disabled={active}
                    >
                      {active ? 'Updating' : channel.connected ? 'Disconnect' : 'Connect'}
                    </Button>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </section>
      </div>
    )
  }

  return (
    <div className="grid w-full min-w-0 max-w-full gap-5">
      <Card className="w-full max-w-full overflow-hidden border-primary/10 bg-card">
        <CardContent className="p-5 sm:p-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1 border-primary/10 bg-primary/10 text-primary">
                  <BrainCircuit className="size-3" />
                  Halvex Revenue OS
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Radio className="size-3" />
                  {channelStats.filter(channel => channel.connected).length}/{channelStats.length} channels live
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <ListChecks className="size-3" />
                  {totalOpenTasks} open tasks
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Target className="size-3" />
                  {averageProbability}% avg probability
                </Badge>
              </div>
              <h1 className="mt-4 max-w-full text-2xl font-semibold tracking-normal text-foreground sm:max-w-4xl sm:text-3xl">
                Professional sales workspace for every deal conversation.
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {activeLead.companyName} is the current focus, with {activeLead.primaryPersonName} tied to a {formatIntent(intent).toLowerCase()} motion.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <Button variant="outline" type="button" onClick={() => setShowLeadForm(true)}>
                <Plus className="size-4" />
                Add lead
              </Button>
              <Button type="button" onClick={useAIDraft} disabled={busy === 'draft'}>
                <Bot className="size-4" />
                {busy === 'draft' ? 'Drafting' : 'Draft reply'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <ShieldAlert className="size-4" />
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section id="forecast" className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Revenue pulse">
        <MetricCard
          icon={<CircleDollarSign className="size-4" />}
          label="Weighted pipeline"
          value={money(weightedPipeline)}
          detail={`${pipelineCoverage}% of ${money(totalPipeline)} pipeline`}
        />
        <MetricCard
          icon={<Sparkles className="size-4" />}
          label="AI confidence"
          value={`${globalIntel.summary.confidence}%`}
          detail="Intent, activity, and stage coverage"
        />
        <MetricCard
          icon={<Zap className="size-4" />}
          label="Recoverable value"
          value={money(globalIntel.summary.recoveredEstimate)}
          detail="Forecast upside from suggested plays"
        />
        <MetricCard
          icon={<ShieldAlert className="size-4" />}
          label="At-risk accounts"
          value={atRiskLeads}
          detail="Needs manager attention"
        />
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]" aria-label="Dashboard charts">
        <Card>
          <CardHeader className="px-5 pt-5">
            <SectionHeader
              title="Pipeline forecast"
              description="Open value compared with weighted forecast by account."
            />
          </CardHeader>
          <CardContent className="h-72 p-5 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecastChartData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={10} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={value => `£${Math.round(Number(value) / 1000)}k`} fontSize={12} width={44} />
                <RechartsTooltip content={<DashboardTooltip />} cursor={{ fill: 'var(--muted)' }} />
                <Bar dataKey="pipeline" name="Pipeline" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="weighted" name="Weighted" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-5 pt-5">
            <SectionHeader
              title="Stage mix"
              description={`${stageRows.length} active stages by value`}
            />
          </CardHeader>
          <CardContent className="grid gap-4 p-5 pt-2 sm:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[220px_minmax(0,1fr)]">
            <div className="flex h-56 min-w-0 items-center justify-center">
              <div
                className="relative grid size-44 place-items-center rounded-full"
                style={{ background: `conic-gradient(${stageGradient})` }}
                aria-label="Pipeline stage value mix"
              >
                <div className="grid size-24 place-items-center rounded-full border bg-card text-center shadow-sm">
                  <span>
                    <strong className="block text-lg">{stageRows.length}</strong>
                    <small className="text-xs text-muted-foreground">stages</small>
                  </span>
                </div>
              </div>
            </div>
            <div className="grid content-center gap-3">
              {stageChartData.map(stage => (
                <div key={stage.label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: stage.fill }} />
                    <span className="truncate">{stage.label}</span>
                  </span>
                  <span className="font-medium">{money(stage.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)_360px]" aria-label="Sales intelligence workspace">
        <aside className="grid min-w-0 gap-5 xl:self-start" id="leads">
          <Card>
            <CardHeader className="px-5 pt-5">
              <SectionHeader
                eyebrow="Pipeline"
                title="Account queue"
                description={`${leads.length} active accounts across ${stageRows.length} stages`}
                action={(
                  <Button size="sm" variant="outline" type="button" onClick={() => setShowLeadForm(previous => !previous)}>
                    <Plus className="size-4" />
                    Lead
                  </Button>
                )}
              />
            </CardHeader>
            <CardContent className="grid gap-4 p-5">
              {showLeadForm ? (
                <form
                  className="grid gap-3 rounded-lg border bg-muted/30 p-3"
                  onSubmit={event => {
                    event.preventDefault()
                    void createLead()
                  }}
                >
                  <Field label="Company">
                    <Input
                      value={leadForm.companyName}
                      onChange={event => setLeadForm(previous => ({ ...previous, companyName: event.target.value }))}
                      required
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <Field label="Contact">
                      <Input
                        value={leadForm.primaryPersonName}
                        onChange={event => setLeadForm(previous => ({ ...previous, primaryPersonName: event.target.value }))}
                      />
                    </Field>
                    <Field label="Value">
                      <Input
                        inputMode="numeric"
                        value={leadForm.valueAmount}
                        onChange={event => setLeadForm(previous => ({ ...previous, valueAmount: event.target.value.replace(/\D/g, '') }))}
                      />
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Channel">
                      <Select value={leadForm.channel} onValueChange={value => setLeadForm(previous => ({ ...previous, channel: value as ChannelId }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mail">Mail</SelectItem>
                          <SelectItem value="instagram">Instagram</SelectItem>
                          <SelectItem value="linkedin">LinkedIn</SelectItem>
                          <SelectItem value="webchat">Web chat</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Heat">
                      <Select value={leadForm.risk} onValueChange={value => setLeadForm(previous => ({ ...previous, risk: value as CrmLeadDto['risk'] }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="warm">Warm</SelectItem>
                          <SelectItem value="hot">Hot</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <Field label="Next step">
                    <Input
                      value={leadForm.nextStep}
                      onChange={event => setLeadForm(previous => ({ ...previous, nextStep: event.target.value }))}
                    />
                  </Field>
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" type="button" onClick={() => setShowLeadForm(false)}>Cancel</Button>
                    <Button type="submit" disabled={busy === 'lead'}>{busy === 'lead' ? 'Creating' : 'Create lead'}</Button>
                  </div>
                </form>
              ) : null}

              <div className="grid gap-3">
                {stageRows.map(stage => {
                  const width = totalPipeline ? Math.max(8, Math.round((stage.value / totalPipeline) * 100)) : 8
                  return (
                    <div key={stage.label} className="grid gap-2 rounded-md border bg-background p-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{stage.label}</p>
                          <p className="text-xs text-muted-foreground">{stage.count} {stage.count === 1 ? 'account' : 'accounts'}</p>
                        </div>
                        <span className="text-sm font-semibold">{money(stage.value)}</span>
                      </div>
                      <Progress value={width} className="h-1.5" />
                    </div>
                  )
                })}
              </div>

              <Separator />

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="min-w-28">Prob.</TableHead>
                    <TableHead>Risk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map(lead => {
                    const selected = lead.id === activeLead.id
                    const probability = clampPercent(lead.probability)
                    return (
                      <TableRow
                        key={lead.id}
                        data-state={selected ? 'selected' : undefined}
                        className="cursor-pointer"
                        tabIndex={0}
                        onClick={() => setActiveLeadId(lead.id)}
                        onKeyDown={event => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setActiveLeadId(lead.id)
                          }
                        }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <InitialsMark value={lead.companyName} className="size-8 text-xs" />
                            <div className="min-w-0">
                              <p className="max-w-36 truncate font-medium">{lead.title}</p>
                              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                <UserRound className="size-3" />
                                {lead.primaryPersonName}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{lead.stageName}</TableCell>
                        <TableCell className="text-right font-medium">{money(Number(lead.valueAmount ?? 0))}</TableCell>
                        <TableCell>
                          <div className="grid gap-1">
                            <span className="text-xs text-muted-foreground">{probability}%</span>
                            <Progress value={probability} className="h-1.5" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={riskBadgeVariant(lead.risk)}>{lead.risk}</Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-5 pt-5">
              <SectionHeader
                title="Forecast watch"
                description={`${money(globalIntel.summary.openCapacity)} open gap`}
              />
            </CardHeader>
            <CardContent className="grid gap-2 p-5">
              {forecastRows.map(lead => (
                <Button
                  key={lead.id}
                  type="button"
                  variant="ghost"
                  className="h-auto justify-start rounded-md border bg-background p-3 text-left"
                  onClick={() => setActiveLeadId(lead.id)}
                >
                  <div className="grid w-full gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium">{lead.companyName}</span>
                      <strong className="text-sm">{money(Number(lead.valueAmount ?? 0))}</strong>
                    </div>
                    <p className="text-xs text-muted-foreground">{lead.probability}% | {lead.stageName} | {formatShortDate(lead.expectedCloseDate)}</p>
                    <Progress value={clampPercent(lead.probability)} className="h-1.5" />
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>
        </aside>

        <main className="grid min-w-0 gap-5">
          <Card>
            <CardHeader className="px-5 pt-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 gap-4">
                  <InitialsMark value={activeLead.companyName} className="size-14 text-base" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-normal text-primary">Active opportunity</p>
                    <CardTitle className="mt-1 text-2xl leading-tight">{activeLead.title}</CardTitle>
                    <CardDescription className="mt-2 max-w-3xl text-sm leading-6">{activeLead.description}</CardDescription>
                  </div>
                </div>
                <Button variant="outline" className="shrink-0" type="button">
                  Open record
                  <ArrowUpRight className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-5 p-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { icon: <CircleDollarSign className="size-4" />, label: 'Value', value: money(Number(activeLead.valueAmount ?? 0)) },
                  { icon: <Target className="size-4" />, label: 'Probability', value: `${activeLeadProbability}%` },
                  { icon: <CalendarDays className="size-4" />, label: 'Close', value: formatShortDate(activeLead.expectedCloseDate) },
                  { icon: <Clock3 className="size-4" />, label: 'Last activity', value: timeFromNow(activeLead.latestActivityAt) },
                ].map(item => (
                  <div key={item.label} className="rounded-lg border bg-muted/20 p-3">
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">{item.icon}{item.label}</p>
                    <p className="mt-2 text-sm font-semibold">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 rounded-lg border bg-background p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">Deal health</p>
                    <p className="mt-1 text-sm font-semibold">{activeLead.stageName}</p>
                  </div>
                  <Badge variant={riskBadgeVariant(activeLead.risk)}>{activeLead.risk}</Badge>
                </div>
                <Progress value={activeLeadProbability} />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Next action</p>
                  <p className="mt-1 text-sm leading-6">{activeLead.nextStep}</p>
                </div>
              </div>

              {conversationIntel ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Deal signal canvas">
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <p className="text-xs font-medium text-primary">Deal</p>
                    <p className="mt-2 text-sm font-semibold">{activeLead.companyName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{activeLead.stageName} | {money(Number(activeLead.valueAmount ?? 0))}</p>
                  </div>
                  <div className="rounded-lg border bg-background p-4">
                    <p className="text-xs font-medium text-muted-foreground">Signal</p>
                    <p className="mt-2 text-sm font-semibold">{conversationIntel.buyingSignals[0] ?? 'Awaiting signal'}</p>
                    <Badge className={cn('mt-2 border', sentimentTone(conversationIntel.sentiment))} variant="outline">
                      {conversationIntel.sentiment}
                    </Badge>
                  </div>
                  <div className="rounded-lg border bg-background p-4">
                    <p className="text-xs font-medium text-muted-foreground">Risk</p>
                    <p className="mt-2 text-sm font-semibold">{conversationIntel.objections[0] ?? 'Clean'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {conversationIntel.competitorMentions[0] ? `${conversationIntel.competitorMentions[0]} mentioned` : 'No competitor'}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-background p-4">
                    <p className="text-xs font-medium text-muted-foreground">Buyer talk</p>
                    <p className="mt-2 text-sm font-semibold">{conversationIntel.talkRatio}% of thread</p>
                    <Progress value={conversationIntel.talkRatio} className="mt-3 h-1.5" />
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card id="inbox">
            <CardHeader className="px-5 pt-5">
              <SectionHeader
                eyebrow="Unified inbox"
                title={activeChannelName}
                description={connected ? 'Live sync is available for this channel.' : 'This channel needs to be connected before sending.'}
                action={(
                  <Badge variant={connected ? 'secondary' : 'outline'}>{connected ? 'Live sync' : 'Needs auth'}</Badge>
                )}
              />
            </CardHeader>
            <CardContent className="grid gap-4 p-5">
              <Tabs value={channelId} onValueChange={value => setChannelId(value as ChannelId)}>
                <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-muted p-1 lg:grid-cols-4">
                  {channels.map(channel => (
                    <TabsTrigger key={channel.id} value={channel.id} className="gap-1.5">
                      {CHANNEL_ICONS[channel.id]}
                      <span className="truncate">{channel.name}</span>
                      <Dot className={cn('size-4', channel.connected ? 'text-emerald-500' : 'text-muted-foreground')} strokeWidth={4} />
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              {conversationIntel ? (
                <div className="grid gap-3 md:grid-cols-4" aria-label="Conversation scorecard">
                  {[
                    ['Sentiment', conversationIntel.sentiment],
                    ['Buyer talk', `${conversationIntel.talkRatio}%`],
                    ['Competitor', conversationIntel.competitorMentions[0] ?? 'None'],
                    ['Risk signal', conversationIntel.objections[0] ?? 'Clean'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="grid max-h-[420px] gap-3 overflow-y-auto rounded-lg border bg-muted/20 p-3">
                {activeMessageList.map(item => (
                  <article
                    key={item.id}
                    className={cn(
                      'max-w-[86%] rounded-lg border bg-card p-3 text-sm shadow-sm',
                      item.from === 'rep' && 'ml-auto border-primary/20 bg-primary text-primary-foreground',
                      item.from === 'ai' && 'border-primary/20 bg-primary/10',
                    )}
                  >
                    <p className="leading-6">{item.text}</p>
                    <p className={cn('mt-2 text-xs text-muted-foreground', item.from === 'rep' && 'text-primary-foreground/75')}>
                      <span className="font-medium">{formatRole(item.from)}</span> | {item.time}
                    </p>
                  </article>
                ))}
                {(!connected || !activeMessageList.length) && (
                  <div className="rounded-lg border border-dashed bg-background p-6 text-center text-sm text-muted-foreground">
                    {!connected ? 'Connect this channel to start live sync.' : 'No messages for this lead on this channel yet.'}
                  </div>
                )}
              </div>

              <form
                className="grid gap-3"
                onSubmit={event => {
                  event.preventDefault()
                  void send()
                }}
              >
                <Textarea
                  value={message}
                  onChange={event => setMessage(event.target.value)}
                  placeholder={connected ? `Reply on ${activeChannelName}...` : 'Connect channel to send messages'}
                  className="min-h-28 resize-none bg-background"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button type="button" disabled={busy === 'draft'} variant="outline" onClick={useAIDraft}>
                    <Sparkles className="size-4" />
                    AI draft
                  </Button>
                  <Button type="submit" disabled={!connected || busy === 'message'}>
                    <SendHorizontal className="size-4" />
                    {busy === 'message' ? 'Sending' : 'Send'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <section className="grid gap-5 lg:grid-cols-2">
            <Card aria-label="Lead markdown notes">
              <CardHeader className="px-5 pt-5">
                <SectionHeader
                  title="Account notes"
                  description="Markdown-friendly context for the account."
                  action={(
                    <Button variant="outline" size="sm" type="button" onClick={saveNotes} disabled={busy === 'notes' || draftNotes === activeLead.notes}>
                      <Save className="size-4" />
                      {busy === 'notes' ? 'Saving' : 'Save'}
                    </Button>
                  )}
                />
              </CardHeader>
              <CardContent className="p-5">
                <Textarea
                  id="markdown-notes"
                  aria-label="Markdown notes"
                  value={draftNotes}
                  onChange={event => setDraftNotes(event.target.value)}
                  rows={8}
                  className="min-h-56 resize-none bg-background font-mono text-sm"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="px-5 pt-5">
                <SectionHeader
                  title="Call intelligence"
                  description={`${activeActivities.length} captured signals`}
                />
              </CardHeader>
              <CardContent className="grid gap-3 p-5">
                <Textarea
                  value={transcript}
                  onChange={event => setTranscript(event.target.value)}
                  placeholder="Paste call notes or transcript..."
                  rows={8}
                  className="min-h-56 resize-none bg-background"
                />
                <div className="flex justify-end">
                  <Button variant="outline" type="button" onClick={() => void captureTranscript()} disabled={!transcript.trim() || busy === 'transcript'}>
                    <BrainCircuit className="size-4" />
                    {busy === 'transcript' ? 'Analyzing' : 'Analyze'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        </main>

        <aside className="grid min-w-0 gap-5 xl:col-span-2 xl:self-start 2xl:col-span-1" id="copilot">
          <Card>
            <CardHeader className="px-5 pt-5">
              <SectionHeader
                eyebrow="AI deal coach"
                title={formatIntent(intent)}
                description={`${leadIntel?.summary.confidence ?? activeLead.score}% confidence`}
              />
            </CardHeader>
            <CardContent className="grid gap-5 p-5">
              <div className="grid gap-3 rounded-lg border bg-muted/20 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Command className="size-4 text-primary" />
                  Reply brief
                </p>
                <Textarea
                  value={aiInstruction}
                  onChange={event => setAiInstruction(event.target.value)}
                  placeholder="Tone, objection, or commercial angle..."
                  rows={3}
                  className="resize-none bg-background"
                />
                <Button onClick={useAIDraft} type="button" disabled={busy === 'draft'}>
                  <Bot className="size-4" />
                  {busy === 'draft' ? 'Thinking' : 'Generate reply'}
                </Button>
                {lastDraftModel ? <p className="text-xs text-muted-foreground">Last draft: {formatDraftModel(lastDraftModel)}</p> : null}
              </div>

              {conversationIntel ? (
                <div className="grid gap-4">
                  <div className="rounded-lg border bg-background p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <ShieldAlert className="size-4 text-primary" />
                      Conversation intelligence
                    </p>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{conversationIntel.summary}</p>
                  </div>

                  <div className="grid gap-3">
                    <div className="rounded-lg border bg-background p-4">
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <TrendingUp className="size-4 text-emerald-600" />
                        Buying signals
                      </p>
                      <ul className="mt-3 grid gap-2 text-sm text-muted-foreground">
                        {listOrFallback(conversationIntel.buyingSignals, 'No buying signal captured yet').map(item => <li key={item}>- {item}</li>)}
                      </ul>
                    </div>
                    <div className="rounded-lg border bg-background p-4">
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <Gauge className="size-4 text-amber-600" />
                        Objections
                      </p>
                      <ul className="mt-3 grid gap-2 text-sm text-muted-foreground">
                        {listOrFallback(conversationIntel.objections, 'No objection detected').map(item => <li key={item}>- {item}</li>)}
                      </ul>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-background p-4">
                    <p className="text-sm font-semibold">Coaching</p>
                    <div className="mt-3 grid gap-2">
                      {conversationIntel.coaching.map(item => <p key={item} className="text-sm leading-6 text-muted-foreground">{item}</p>)}
                    </div>
                    {conversationIntel.competitorMentions.length ? (
                      <Badge variant="outline" className="mt-3">Competitor: {conversationIntel.competitorMentions.join(', ')}</Badge>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Sparkles className="size-4" />
                  Next best action
                </p>
                <p className="mt-3 text-sm font-semibold">{nextBestRecommendation?.title ?? activeLead.nextStep}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{nextBestRecommendation?.body ?? 'No recommendation generated yet.'}</p>
              </div>

              <div className="grid gap-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <ListChecks className="size-4 text-primary" />
                  Open work
                </p>
                {activeTasks.length ? activeTasks.map(task => (
                  <article key={task.id} className="flex gap-3 rounded-lg border bg-background p-3">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{task.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{task.priority} priority | due {formatShortDate(task.dueAt)}</p>
                    </div>
                  </article>
                )) : <p className="text-sm text-muted-foreground">No task attached to this account.</p>}
              </div>

              <div className="grid gap-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Activity className="size-4 text-primary" />
                  Recent signals
                </p>
                {activeActivities.length ? activeActivities.map(activity => (
                  <article key={activity.id} className="rounded-lg border bg-background p-3">
                    <p className="text-sm font-medium">{activity.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{activity.body}</p>
                  </article>
                )) : <p className="text-sm text-muted-foreground">No captured signal for this account yet.</p>}
              </div>
            </CardContent>
          </Card>

          <Card id="channels">
            <CardHeader className="px-5 pt-5">
              <SectionHeader
                title="Channel health"
                description={`${channelStats.filter(channel => channel.connected).length}/${channelStats.length} live`}
              />
            </CardHeader>
            <CardContent className="grid gap-3 p-5">
              {channelStats.map(channel => {
                const active = busy === `channel:${channel.id}`
                return (
                  <div className="rounded-lg border bg-background p-4" key={channel.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          {CHANNEL_ICONS[channel.id]}
                          {channel.name}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {channel.connected ? `${channel.count} synced messages` : channel.status.replaceAll('_', ' ')}
                        </p>
                      </div>
                      <Badge variant={channel.connected ? 'secondary' : 'outline'}>{channel.connected ? 'Live' : 'Off'}</Badge>
                    </div>
                    <Button
                      className="mt-3 w-full"
                      variant="outline"
                      type="button"
                      onClick={() => void toggleChannel(channel)}
                      disabled={active}
                    >
                      {active ? 'Updating' : channel.connected ? 'Disconnect' : 'Connect'}
                    </Button>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </aside>
      </section>
    </div>
  )
}
