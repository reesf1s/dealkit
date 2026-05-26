'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { OperatorHeader, OperatorPage, OperatorPanel } from '@/components/shared/OperatorUI'

export const dynamic = 'force-dynamic'

type Task = {
  id: string
  title: string
  dueAt: string | null
  status: string
  priority: string
  source: string
  dealId: string | null
  dealTitle: string | null
  companyName: string | null
}

function due(value: string | null) {
  if (!value) return 'No due date'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(value))
}

export default function TasksPage() {
  const { data, isLoading, mutate } = useSWR<{ data: Task[] }>('/api/crm/tasks?status=todo', fetcher, { revalidateOnFocus: false })
  const [form, setForm] = useState({ title: '', dueAt: '', priority: 'normal' })
  const tasks = data?.data ?? []

  async function complete(taskId: string) {
    await fetch('/api/crm/tasks', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ taskId, action: 'complete' }),
    })
    mutate()
  }

  async function addTask(event: React.FormEvent) {
    event.preventDefault()
    if (!form.title.trim()) return
    await fetch('/api/crm/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    })
    setForm({ title: '', dueAt: '', priority: 'normal' })
    mutate()
  }

  return (
    <OperatorPage>
      <OperatorHeader eyebrow="Tasks" title="Execution list" description="Manual and AI-generated next steps, grouped into one sales workflow." />
      <OperatorPanel>
        <form onSubmit={addTask} className="crm-record-form compact">
          <input className="crm-input" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="Task title" />
          <input className="crm-input" type="date" value={form.dueAt} onChange={event => setForm({ ...form, dueAt: event.target.value })} />
          <select className="crm-select" value={form.priority} onChange={event => setForm({ ...form, priority: event.target.value })}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <button className="operator-button operator-button-primary" type="submit">Add</button>
        </form>
        <div className="crm-table tasks">
          <div className="crm-table-head"><span>Task</span><span>Linked record</span><span>Due</span><span>Priority</span><span /></div>
          {tasks.map(task => (
            <div key={task.id} className="crm-table-row">
              <span><strong>{task.title}</strong><small>{task.source.replace(/_/g, ' ')}</small></span>
              <span>{task.dealId ? <Link href={`/deals/${task.dealId}`}>{task.companyName ?? task.dealTitle}</Link> : task.companyName ?? '—'}</span>
              <span>{due(task.dueAt)}</span>
              <span>{task.priority}</span>
              <span><button className="operator-button" onClick={() => complete(task.id)}><CheckCircle2 size={13} /> Done</button></span>
            </div>
          ))}
          {!isLoading && tasks.length === 0 && <div className="empty-state">No open tasks.</div>}
        </div>
      </OperatorPanel>
    </OperatorPage>
  )
}
