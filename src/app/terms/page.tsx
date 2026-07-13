import Link from 'next/link'
import { FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export const metadata = {
  title: 'Terms of Service - Halvex',
  description: 'Terms and conditions for using Halvex.',
}

const EFFECTIVE_DATE = '1 June 2026'

const sections = [
  ['Service', 'Halvex provides an AI-first sales workspace for SMEs, including omnichannel conversations, lead notes, CRM records, tasks, and workspace billing.'],
  ['Your Data', 'You retain ownership of the data you add to the service. We process it only to provide and operate the product, keep the service secure, support billing, and comply with applicable law.'],
  ['Acceptable Use', 'You must not misuse the service, attempt unauthorized access, infringe third-party rights, upload unlawful content, or interfere with other users.'],
  ['Billing', 'Paid subscriptions are processed by Stripe. You can manage billing from workspace settings.'],
  ['Availability', 'The service is provided as available. We may update, suspend, or discontinue features with reasonable notice where practical.'],
]

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto grid max-w-3xl gap-6">
        <nav className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
              <FileText className="size-4" />
            </span>
            <span className="text-sm font-semibold">Halvex</span>
          </Link>
          <Button asChild variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
        </nav>

        <Card>
          <CardContent className="p-6 sm:p-8">
            <h1 className="text-3xl font-semibold tracking-normal">Terms of Service</h1>
            <p className="mt-2 text-sm text-muted-foreground">Effective date: {EFFECTIVE_DATE}</p>
            <Separator className="my-6" />
            <div className="grid gap-7">
              {sections.map(([title, body]) => (
                <section key={title}>
                  <h2 className="text-lg font-semibold">{title}</h2>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{body}</p>
                </section>
              ))}
              <section>
                <h2 className="text-lg font-semibold">Contact</h2>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  For legal enquiries, contact <a className="font-medium text-primary" href="mailto:legal@halvex.ai">legal@halvex.ai</a>.
                </p>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
