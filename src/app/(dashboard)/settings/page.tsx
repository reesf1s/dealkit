import Link from 'next/link'
import { Bot, CreditCard, LockKeyhole, PlugZap, ShieldCheck, Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

const settings = [
  {
    title: 'Channel status',
    description: 'Mail, Instagram, and web leads are available in this build.',
    detail: 'LinkedIn, WhatsApp, and more OAuth providers can plug into the same channel layer next.',
    icon: PlugZap,
  },
  {
    title: 'AI defaults',
    description: 'LLM suggestions are tuned for SME cadence and concise, high-signal replies.',
    detail: 'Future preferences can expose tone, approval flow, and commercial guardrails.',
    icon: Bot,
  },
  {
    title: 'Security',
    description: 'Auth is preserved with Clerk. Billing remains Stripe-driven.',
    detail: 'OAuth channel connections will use scoped grants when enabled.',
    icon: ShieldCheck,
  },
]

export default function SettingsPage() {
  return (
    <div className="mx-auto grid max-w-6xl gap-5">
      <Card>
        <CardHeader className="px-5 pt-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Badge variant="secondary" className="mb-4">Workspace control</Badge>
              <CardTitle className="text-3xl tracking-normal">Settings</CardTitle>
              <CardDescription className="mt-3 max-w-2xl text-sm leading-6">
                Configure the operating layer for your team, connected channels, billing, and AI behavior.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/settings/billing">
                  <CreditCard className="size-4" />
                  Manage billing
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/home">Back to workspace</Link>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <section className="grid gap-4 md:grid-cols-3">
        {settings.map(item => {
          const Icon = item.icon
          return (
            <Card key={item.title}>
              <CardContent className="p-5">
                <span className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                <h2 className="mt-4 text-base font-semibold">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                <p className="mt-4 rounded-lg border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">{item.detail}</p>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="flex items-start gap-4 p-5">
            <span className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
              <Users className="size-4" />
            </span>
            <div>
              <h2 className="text-base font-semibold">Team access</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Invite controls and seat management are staged for the next release.</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-4 p-5">
            <span className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
              <LockKeyhole className="size-4" />
            </span>
            <div>
              <h2 className="text-base font-semibold">Data controls</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Exports, retention rules, and channel scopes will live here as the workspace matures.</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
