import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Halvex CRM — The CRM that updates itself',
  description: 'The AI-native CRM for small teams who hate CRM admin.',
  openGraph: {
    title: 'Halvex CRM',
    description: 'Pipeline, contacts, tasks, meetings, and next actions in one fast AI-native CRM.',
    type: 'website',
    url: 'https://halvex.ai',
    siteName: 'Halvex CRM',
  },
}

export default async function LandingPage() {
  try {
    const { userId } = await auth()
    if (userId) redirect('/home')
  } catch {
    // Clerk may be unset in local static previews.
  }

  return (
    <main className="landing-surface">
      <nav className="landing-nav">
        <Link href="/" className="landing-brand"><span>H</span>Halvex CRM</Link>
        <div>
          <Link href="/sign-in">Sign in</Link>
          <Link href="/sign-up" className="landing-button">Start</Link>
        </div>
      </nav>

      <section className="landing-hero">
        <p>The AI-native CRM for small teams who hate CRM admin</p>
        <h1>The CRM that updates itself and tells you what to do next.</h1>
        <p>
          Halvex keeps your pipeline, tasks, meetings, contacts, and deal intelligence in one fast workspace,
          built for founder-led sales teams and service businesses.
        </p>
        <div>
          <Link href="/sign-up" className="landing-button">Get started</Link>
          <Link href="/sign-in" className="landing-secondary">Open workspace</Link>
        </div>
      </section>

      <section className="landing-grid">
        {[
          ['Home first', 'Open the app and see stale deals, overdue tasks, upcoming meetings, and AI-prioritized actions.'],
          ['Native pipeline', 'A fast visual CRM pipeline with companies, contacts, activities, tasks, and deal pages as first-class records.'],
          ['Evidence-backed AI', 'Deal summaries, risk signals, and next actions cite real CRM activity instead of generic chatbot guesses.'],
          ['Calendar aware', 'Google Calendar sync brings meetings into Home and links them to relevant contacts and deals.'],
        ].map(([title, body]) => (
          <article key={title}>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>
    </main>
  )
}
