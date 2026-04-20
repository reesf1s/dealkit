import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronRight,
  LineChart,
  MessagesSquare,
  PoundSterling,
  ShieldCheck,
  Sparkles,
  Target,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import AIVoice from '@/components/AIVoice'

export const metadata: Metadata = {
  title: 'Halvex — AI Deal Intelligence',
  description:
    'Halvex turns deal updates, meeting notes, and stakeholder signals into a revenue operating system your team can actually run from.',
  openGraph: {
    title: 'Halvex — AI Deal Intelligence',
    description:
      'The deal workspace that turns every update into a briefing, a next action, and a cleaner forecast.',
    type: 'website',
    url: 'https://halvex.ai',
    siteName: 'Halvex',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Halvex — AI Deal Intelligence',
    description:
      'AI that reads the whole deal, not just the CRM field you remembered to update.',
  },
}

type Capability = {
  eyebrow: string
  title: string
  body: string
  icon: LucideIcon
}

const proofPoints = [
  { label: 'Morning briefing', value: 'Live every day' },
  { label: 'Next action', value: 'Always explicit' },
  { label: 'Forecast view', value: 'Deal-aware' },
]

const capabilities: Capability[] = [
  {
    eyebrow: 'Morning Briefing',
    title: 'Start the day with a point of view',
    body:
      'Halvex reads the whole workspace and tells reps what needs action, what is slipping, and which opportunities are actually moving.',
    icon: Sparkles,
  },
  {
    eyebrow: 'Deal Workspace',
    title: 'Run every account from one operating surface',
    body:
      'Notes, tasks, project plans, stakeholders, documents, and AI coaching stay in the same workspace so context never fragments.',
    icon: Workflow,
  },
  {
    eyebrow: 'Signals And Forecast',
    title: 'See pressure before it becomes regret',
    body:
      'Track stakeholder movement, blockers, timing risk, and revenue exposure with a clearer view of what to push, rescue, or deprioritize.',
    icon: LineChart,
  },
]

const operatingModel = [
  {
    step: '01',
    title: 'Capture the truth of the deal',
    body:
      'Reps paste call notes, log updates, or connect the system they already use. Halvex turns raw information into usable structure.',
  },
  {
    step: '02',
    title: 'Create the next move automatically',
    body:
      'Tasks, project steps, stakeholder actions, and recommended follow-ups are generated inside the deal instead of living in scattered tools.',
  },
  {
    step: '03',
    title: 'Run the whole workspace from signal, not guesswork',
    body:
      'Overview, signals, tasks, and the deal workspace stay aligned so the team sees the same pressure and acts from the same picture.',
  },
]

const pricingPoints = [
  'Unlimited deals, contacts, and deal workspaces',
  'AI briefings, recommended actions, and task generation',
  'Signals, forecasting, and deal-level risk detection',
  'Meeting intelligence, stakeholder mapping, and project plans',
]

function CapabilityCard({ eyebrow, title, body, icon: Icon }: Capability) {
  return (
    <article className="surface-glass-strong marketing-card">
      <div className="marketing-card-icon">
        <Icon size={16} strokeWidth={2} />
      </div>
      <div className="marketing-card-eyebrow">{eyebrow}</div>
      <h3 className="marketing-card-title">{title}</h3>
      <p className="marketing-card-body">{body}</p>
    </article>
  )
}

export default async function LandingPage() {
  try {
    const { userId } = await auth()
    if (userId) redirect('/dashboard')
  } catch {
    // Clerk not configured — render marketing page
  }

  return (
    <main className="marketing-shell">
      <style>{`
        .marketing-shell {
          position: relative;
          z-index: 1;
          min-height: 100vh;
          color: var(--ink);
        }
        .marketing-frame {
          width: min(1180px, calc(100vw - 40px));
          margin: 0 auto;
        }
        .marketing-nav-wrap {
          position: sticky;
          top: 0;
          z-index: 40;
          padding: 18px 0 0;
        }
        .marketing-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 12px 16px;
          border-radius: 14px;
        }
        .marketing-brand {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .marketing-mark {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: var(--ink);
          color: var(--bg);
          display: grid;
          place-items: center;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: -0.04em;
        }
        .marketing-brand-copy {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .marketing-brand-name {
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -0.02em;
          color: var(--ink);
        }
        .marketing-beta {
          display: inline-flex;
          align-items: center;
          padding: 4px 8px;
          border-radius: 999px;
          background: rgba(29, 184, 106, 0.1);
          color: var(--signal);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .marketing-nav-links {
          display: inline-flex;
          align-items: center;
          gap: 18px;
          flex-wrap: wrap;
          justify-content: center;
        }
        .marketing-nav-links a {
          color: var(--ink-3);
          font-size: 12px;
          font-weight: 500;
          transition: color 0.16s ease;
        }
        .marketing-nav-links a:hover {
          color: var(--ink);
        }
        .marketing-nav-actions {
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }
        .marketing-section {
          padding: 36px 0;
        }
        .marketing-hero {
          padding-top: 46px;
          padding-bottom: 26px;
        }
        .marketing-hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.02fr) minmax(360px, 0.98fr);
          gap: 28px;
          align-items: stretch;
        }
        .marketing-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.52);
          border: 1px solid rgba(255, 255, 255, 0.72);
          color: var(--ink-2);
          font-size: 11px;
          font-weight: 600;
          margin-bottom: 18px;
        }
        .marketing-eyebrow-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--signal);
          box-shadow: 0 0 0 4px rgba(29, 184, 106, 0.12);
        }
        .marketing-hero-panel {
          padding: 26px;
          border-radius: 14px;
        }
        .marketing-title {
          font-size: clamp(42px, 6vw, 72px);
          line-height: 0.96;
          letter-spacing: -0.075em;
          font-weight: 600;
          color: var(--ink);
          max-width: 9.5em;
        }
        .marketing-title-muted {
          color: rgba(21, 19, 14, 0.46);
          display: block;
        }
        .marketing-subtitle {
          margin-top: 22px;
          max-width: 650px;
          font-size: 15px;
          line-height: 1.75;
          color: var(--ink-3);
        }
        .marketing-hero-note {
          margin-top: 18px;
          max-width: 620px;
          font-size: 28px;
          line-height: 1.26;
          color: var(--ink);
        }
        .marketing-hero-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 28px;
        }
        .marketing-proof-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 26px;
        }
        .marketing-proof-card {
          padding: 14px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.46);
          border: 1px solid rgba(255, 255, 255, 0.74);
        }
        .marketing-proof-label {
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink-4);
          margin-bottom: 6px;
          font-weight: 600;
        }
        .marketing-proof-value {
          font-size: 16px;
          line-height: 1.1;
          letter-spacing: -0.04em;
          color: var(--ink);
          font-weight: 600;
        }
        .marketing-preview {
          padding: 18px;
          border-radius: 14px;
          min-height: 100%;
          overflow: hidden;
        }
        .preview-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding-bottom: 14px;
          border-bottom: 1px solid rgba(20, 17, 10, 0.06);
          margin-bottom: 16px;
        }
        .preview-breadcrumb {
          font-size: 12px;
          color: var(--ink-3);
        }
        .preview-toolbar {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .preview-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.08fr) 300px;
          gap: 16px;
        }
        .preview-main {
          display: grid;
          gap: 14px;
        }
        .preview-title-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: end;
        }
        .preview-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          font-size: 11px;
          color: var(--ink-4);
          margin-bottom: 12px;
        }
        .preview-title {
          font-size: clamp(28px, 3vw, 44px);
          line-height: 0.98;
          letter-spacing: -0.065em;
          font-weight: 600;
          color: var(--ink);
          max-width: 8.4em;
        }
        .preview-value {
          text-align: right;
        }
        .preview-value .mono {
          font-size: 18px;
          font-weight: 600;
          letter-spacing: -0.04em;
        }
        .preview-value span:last-child {
          display: block;
          margin-top: 6px;
          color: var(--ink-4);
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .preview-score {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto auto;
          gap: 12px;
          align-items: center;
          padding: 16px 18px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.68);
          border: 1px solid rgba(255, 255, 255, 0.82);
          box-shadow: var(--glass-shadow);
        }
        .preview-score-ring {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: 4px solid rgba(29, 184, 106, 0.18);
          border-top-color: var(--signal);
          display: grid;
          place-items: center;
          font-size: 18px;
          font-weight: 700;
          color: var(--ink);
        }
        .preview-score-copy strong {
          display: block;
          font-size: 26px;
          line-height: 1;
          letter-spacing: -0.05em;
          color: var(--ink);
          font-weight: 500;
        }
        .preview-score-copy span {
          display: block;
          margin-top: 7px;
          color: var(--ink-3);
          font-size: 12px;
          line-height: 1.5;
        }
        .preview-delta {
          font-size: 13px;
          font-weight: 700;
          color: var(--signal);
          white-space: nowrap;
        }
        .preview-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 12px;
          border-radius: 999px;
          background: rgba(29, 184, 106, 0.12);
          color: #0d7a43;
          font-size: 11px;
          font-weight: 600;
        }
        .preview-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--signal);
        }
        .preview-tabs {
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 0 10px;
          border-bottom: 1px solid rgba(20, 17, 10, 0.08);
        }
        .preview-tab {
          position: relative;
          padding: 0 0 11px;
          color: var(--ink-3);
          font-size: 12px;
          font-weight: 500;
        }
        .preview-tab.active {
          color: var(--ink);
        }
        .preview-tab.active::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: -1px;
          height: 2px;
          border-radius: 999px;
          background: var(--ink);
        }
        .preview-briefing {
          padding: 22px;
          border-radius: 14px;
          position: relative;
          overflow: hidden;
        }
        .preview-briefing::before {
          content: "";
          position: absolute;
          inset: 0 auto 0 0;
          width: 3px;
          background: linear-gradient(180deg, var(--signal) 0%, rgba(29, 184, 106, 0.12) 100%);
        }
        .preview-section-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 14px;
          flex-wrap: wrap;
        }
        .preview-ai-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 999px;
          background: var(--ink);
          color: var(--bg);
          font-size: 10px;
          font-weight: 600;
        }
        .preview-ai-badge .preview-dot {
          box-shadow: 0 0 0 3px rgba(29, 184, 106, 0.18);
        }
        .preview-briefing-time {
          font-size: 11px;
          color: var(--ink-4);
        }
        .preview-briefing-copy {
          font-size: 28px;
          line-height: 1.33;
          color: var(--ink);
        }
        .preview-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 18px;
          padding-top: 18px;
          border-top: 1px solid rgba(20, 17, 10, 0.06);
        }
        .preview-action-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.82);
          color: var(--ink-2);
          font-size: 11px;
          font-weight: 500;
        }
        .preview-signals {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .preview-signal-card {
          padding: 14px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.46);
          border: 1px solid rgba(255, 255, 255, 0.74);
        }
        .preview-signal-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--ink-4);
          margin-bottom: 8px;
          font-weight: 600;
        }
        .preview-signal-body {
          font-size: 13px;
          line-height: 1.5;
          color: var(--ink);
        }
        .preview-side {
          display: grid;
          gap: 12px;
          align-content: start;
        }
        .preview-next-action {
          padding: 18px;
          border-radius: 14px;
          background:
            linear-gradient(180deg, rgba(40, 36, 31, 0.98), rgba(20, 17, 10, 0.98)),
            linear-gradient(135deg, rgba(29, 184, 106, 0.1), transparent 60%);
          color: var(--bg);
          box-shadow: 0 14px 34px rgba(20, 17, 10, 0.22);
        }
        .preview-next-label {
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(250, 250, 247, 0.5);
          margin-bottom: 10px;
          font-weight: 600;
        }
        .preview-next-copy {
          font-size: 16px;
          line-height: 1.5;
          color: var(--bg);
        }
        .preview-next-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 14px;
        }
        .preview-next-actions button {
          height: 34px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
        }
        .preview-next-actions button:first-child {
          background: var(--signal);
          color: #0d2417;
        }
        .preview-next-actions button:last-child {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: rgba(250, 250, 247, 0.78);
        }
        .preview-side-card {
          padding: 16px;
          border-radius: 14px;
        }
        .preview-side-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 10px;
        }
        .preview-side-title {
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink-4);
          font-weight: 600;
        }
        .preview-side-meta {
          font-size: 11px;
          color: var(--ink-4);
        }
        .preview-list {
          display: grid;
          gap: 10px;
        }
        .preview-list-item {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
        }
        .preview-avatar {
          width: 32px;
          height: 32px;
          border-radius: 9px;
          display: grid;
          place-items: center;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
        }
        .preview-avatar.orange { background: linear-gradient(135deg, #df8f4d, #b66127); }
        .preview-avatar.blue { background: linear-gradient(135deg, #5d88dd, #3357b7); }
        .preview-avatar.purple { background: linear-gradient(135deg, #8f73d8, #6541c7); }
        .preview-avatar.green { background: linear-gradient(135deg, #58ca86, #1b9f57); }
        .preview-person {
          min-width: 0;
        }
        .preview-person strong {
          display: block;
          font-size: 13px;
          color: var(--ink);
          font-weight: 600;
        }
        .preview-person span {
          display: block;
          margin-top: 3px;
          font-size: 11px;
          color: var(--ink-4);
          line-height: 1.4;
        }
        .preview-status {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--signal);
        }
        .preview-status.warn { background: var(--warn); }
        .preview-status.idle { background: rgba(20, 17, 10, 0.22); }
        .preview-forecast-row {
          display: grid;
          gap: 10px;
        }
        .preview-forecast-line {
          display: grid;
          gap: 4px;
        }
        .preview-forecast-line strong {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 12px;
          color: var(--ink-2);
          font-weight: 500;
        }
        .preview-track {
          height: 6px;
          border-radius: 999px;
          background: rgba(20, 17, 10, 0.08);
          overflow: hidden;
        }
        .preview-track > span {
          display: block;
          height: 100%;
          border-radius: inherit;
        }
        .preview-track > span.green { background: var(--signal); width: 68%; }
        .preview-track > span.orange { background: var(--warn); width: 24%; }
        .preview-track > span.red { background: var(--risk); width: 8%; }
        .marketing-band {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          padding: 16px;
          border-radius: 14px;
        }
        .marketing-band-card {
          padding: 16px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.46);
          border: 1px solid rgba(255, 255, 255, 0.74);
        }
        .marketing-band-card strong {
          display: block;
          font-size: 12px;
          color: var(--ink);
          margin-bottom: 6px;
        }
        .marketing-band-card span {
          display: block;
          font-size: 12px;
          line-height: 1.6;
          color: var(--ink-3);
        }
        .marketing-section-header {
          display: grid;
          gap: 12px;
          margin-bottom: 24px;
          max-width: 760px;
        }
        .marketing-kicker {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--ink-4);
        }
        .marketing-section-title {
          font-size: clamp(30px, 4vw, 52px);
          line-height: 0.98;
          letter-spacing: -0.06em;
          color: var(--ink);
          font-weight: 600;
        }
        .marketing-section-copy {
          font-size: 14px;
          line-height: 1.75;
          color: var(--ink-3);
          max-width: 640px;
        }
        .marketing-card-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }
        .marketing-card {
          padding: 18px;
          border-radius: 14px;
        }
        .marketing-card-icon {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: rgba(20, 17, 10, 0.06);
          color: var(--ink);
          margin-bottom: 18px;
        }
        .marketing-card-eyebrow {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--ink-4);
          margin-bottom: 10px;
        }
        .marketing-card-title {
          font-size: 20px;
          line-height: 1.02;
          letter-spacing: -0.04em;
          color: var(--ink);
          font-weight: 600;
        }
        .marketing-card-body {
          margin-top: 12px;
          font-size: 13px;
          line-height: 1.7;
          color: var(--ink-3);
        }
        .marketing-operating-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.92fr) minmax(320px, 1.08fr);
          gap: 18px;
          align-items: start;
        }
        .marketing-steps,
        .marketing-operator-panel,
        .marketing-pricing-card,
        .marketing-enterprise-card,
        .marketing-cta-panel {
          padding: 20px;
          border-radius: 14px;
        }
        .marketing-step-list {
          display: grid;
          gap: 12px;
        }
        .marketing-step {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 14px;
          align-items: start;
          padding: 14px 0;
          border-top: 1px solid rgba(20, 17, 10, 0.06);
        }
        .marketing-step:first-child {
          border-top: 0;
          padding-top: 0;
        }
        .marketing-step-num {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: rgba(20, 17, 10, 0.06);
          color: var(--ink);
          display: grid;
          place-items: center;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .marketing-step h3 {
          font-size: 16px;
          line-height: 1.2;
          letter-spacing: -0.03em;
          color: var(--ink);
          font-weight: 600;
        }
        .marketing-step p {
          margin-top: 8px;
          font-size: 13px;
          line-height: 1.7;
          color: var(--ink-3);
        }
        .marketing-operator-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: 18px;
        }
        .marketing-operator-cell {
          padding: 16px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.52);
          border: 1px solid rgba(255, 255, 255, 0.76);
        }
        .marketing-operator-cell strong {
          display: block;
          font-size: 13px;
          color: var(--ink);
          margin-bottom: 6px;
          font-weight: 600;
        }
        .marketing-operator-cell span {
          display: block;
          font-size: 12px;
          line-height: 1.65;
          color: var(--ink-3);
        }
        .marketing-pricing-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.95fr) minmax(280px, 0.75fr);
          gap: 16px;
          align-items: stretch;
        }
        .marketing-pricing-card {
          display: grid;
          gap: 18px;
        }
        .marketing-price {
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .marketing-price strong {
          font-size: clamp(40px, 5vw, 58px);
          line-height: 1;
          letter-spacing: -0.07em;
          color: var(--ink);
          font-weight: 600;
        }
        .marketing-price span {
          font-size: 14px;
          color: var(--ink-3);
        }
        .marketing-checklist {
          display: grid;
          gap: 10px;
        }
        .marketing-check {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 13px;
          color: var(--ink-2);
          line-height: 1.55;
        }
        .marketing-check-icon {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--signal-soft);
          color: var(--signal);
          display: grid;
          place-items: center;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .marketing-enterprise-card {
          display: grid;
          gap: 14px;
        }
        .marketing-enterprise-card p {
          font-size: 13px;
          line-height: 1.7;
          color: var(--ink-3);
        }
        .marketing-cta-panel {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 20px;
          align-items: center;
        }
        .marketing-cta-copy h2 {
          font-size: clamp(30px, 4vw, 52px);
          line-height: 0.98;
          letter-spacing: -0.06em;
          color: var(--ink);
          font-weight: 600;
        }
        .marketing-cta-copy p {
          margin-top: 14px;
          font-size: 14px;
          line-height: 1.75;
          color: var(--ink-3);
          max-width: 620px;
        }
        .marketing-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 24px 0 34px;
          color: var(--ink-4);
          font-size: 12px;
        }
        .marketing-footer-links {
          display: inline-flex;
          align-items: center;
          gap: 18px;
          flex-wrap: wrap;
        }
        .marketing-footer-links a:hover {
          color: var(--ink-2);
        }
        @media (max-width: 1120px) {
          .marketing-hero-grid,
          .marketing-operating-grid,
          .marketing-pricing-grid,
          .marketing-cta-panel,
          .preview-grid {
            grid-template-columns: 1fr;
          }
          .preview-side {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 960px) {
          .marketing-nav {
            flex-wrap: wrap;
            justify-content: center;
          }
          .marketing-nav-links {
            order: 3;
            width: 100%;
          }
          .marketing-card-grid,
          .marketing-band,
          .marketing-proof-row,
          .marketing-operator-grid,
          .preview-signals {
            grid-template-columns: 1fr;
          }
          .preview-title-row,
          .preview-score {
            grid-template-columns: 1fr;
          }
          .preview-value {
            text-align: left;
          }
        }
        @media (max-width: 720px) {
          .marketing-frame {
            width: min(100vw - 24px, 1180px);
          }
          .marketing-hero-panel,
          .marketing-preview,
          .marketing-steps,
          .marketing-operator-panel,
          .marketing-pricing-card,
          .marketing-enterprise-card,
          .marketing-cta-panel {
            padding: 18px;
          }
          .marketing-nav-actions {
            width: 100%;
            justify-content: center;
          }
          .marketing-hero-note,
          .preview-briefing-copy {
            font-size: 22px;
          }
          .preview-side {
            grid-template-columns: 1fr;
          }
          .preview-next-actions {
            grid-template-columns: 1fr;
          }
          .marketing-cta-panel {
            justify-items: start;
          }
          .marketing-footer {
            flex-direction: column;
            text-align: center;
          }
        }
      `}</style>

      <div className="marketing-frame marketing-nav-wrap">
        <nav className="surface-glass-heavy marketing-nav">
          <Link href="/" className="marketing-brand">
            <div className="marketing-mark">H</div>
            <div className="marketing-brand-copy">
              <span className="marketing-brand-name">Halvex</span>
              <span className="marketing-beta">Beta</span>
            </div>
          </Link>

          <div className="marketing-nav-links">
            <a href="#product">Product</a>
            <a href="#workflow">Workflow</a>
            <a href="#pricing">Pricing</a>
          </div>

          <div className="marketing-nav-actions">
            <Link href="/sign-in" className="btn">
              Sign in
            </Link>
            <Link href="/sign-up" className="btn btn-primary">
              Start free
              <ArrowRight size={13} strokeWidth={2} />
            </Link>
          </div>
        </nav>
      </div>

      <section className="marketing-section marketing-hero">
        <div className="marketing-frame marketing-hero-grid">
          <div className="surface-glass-heavy marketing-hero-panel">
            <div className="marketing-eyebrow">
              <span className="marketing-eyebrow-dot" />
              AI deal intelligence for revenue teams
            </div>

            <h1 className="marketing-title">
              The deal workspace that thinks like your best operator.
              <span className="marketing-title-muted">Every note becomes a next move.</span>
            </h1>

            <p className="marketing-subtitle">
              Halvex turns meeting notes, stakeholder movement, blockers, and pipeline drift into a workspace your team can actually run from. Morning briefing, tasks, signals, forecasting, and the live deal all stay connected.
            </p>

            <AIVoice as="p" className="marketing-hero-note">
              You should never have to remember what matters in a deal. The system should already know.
            </AIVoice>

            <div className="marketing-hero-actions">
              <Link href="/sign-up" className="btn btn-primary">
                Start free
                <ArrowRight size={13} strokeWidth={2} />
              </Link>
              <Link href="/sign-in" className="btn">
                Open product
              </Link>
            </div>

            <div className="marketing-proof-row">
              {proofPoints.map(point => (
                <div key={point.label} className="marketing-proof-card">
                  <div className="marketing-proof-label">{point.label}</div>
                  <div className="marketing-proof-value">{point.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="surface-glass-heavy marketing-preview">
            <div className="preview-topbar">
              <div className="preview-breadcrumb">Deals / Enterprise Pipeline / Meridian Partners</div>
              <div className="preview-toolbar">
                <div className="btn">Log activity</div>
                <div className="btn btn-primary">Advance stage</div>
              </div>
            </div>

            <div className="preview-grid">
              <div className="preview-main">
                <div className="preview-title-row">
                  <div>
                    <div className="preview-meta">
                      <span className="surface-glass" style={{ padding: '5px 10px', borderRadius: '999px' }}>Meridian Partners</span>
                      <span>Financial Services</span>
                      <span>London, UK</span>
                      <span>#DE-0428</span>
                    </div>
                    <div className="preview-title">Platform expansion, EMEA rollout</div>
                  </div>

                  <div className="preview-value">
                    <span className="mono">£248,500</span>
                    <span>Annual contract value</span>
                  </div>
                </div>

                <div className="preview-score">
                  <div className="preview-score-ring">76</div>
                  <div className="preview-score-copy">
                    <strong>Likely to close this quarter</strong>
                    <span>Strong champion engagement · Budget confirmed · 2 outstanding objections</span>
                  </div>
                  <div className="preview-delta">+14<br /><span style={{ color: 'var(--ink-4)', fontSize: 10, fontWeight: 500 }}>7d change</span></div>
                  <div className="preview-pill">
                    <span className="preview-dot" />
                    Proposal
                  </div>
                </div>

                <div className="preview-tabs">
                  <span className="preview-tab active">Overview</span>
                  <span className="preview-tab">Manage</span>
                  <span className="preview-tab">Intelligence</span>
                  <span className="preview-tab">Conversations</span>
                  <span className="preview-tab">Documents</span>
                </div>

                <div className="surface-glass-strong preview-briefing">
                  <div className="preview-section-head">
                    <div className="preview-ai-badge">
                      <span className="preview-dot" />
                      Morning briefing
                    </div>
                    <div className="preview-briefing-time">Generated 06:42 · based on 23 signals</div>
                  </div>

                  <AIVoice as="div" className="preview-briefing-copy">
                    Sarah Chen forwarded your proposal to their CFO yesterday evening. The main blocker is the SSO integration question raised on the May 14th call; sending the technical brief to Marcus before Thursday’s follow-up would remove the last procurement objection.
                  </AIVoice>

                  <div className="preview-actions">
                    <div className="preview-action-chip">
                      <MessagesSquare size={12} strokeWidth={2} />
                      Draft email to Marcus
                    </div>
                    <div className="preview-action-chip">
                      <CalendarClock size={12} strokeWidth={2} />
                      Prep for Thursday&apos;s call
                    </div>
                    <div className="preview-action-chip">
                      <Target size={12} strokeWidth={2} />
                      Remind me tomorrow
                    </div>
                  </div>
                </div>

                <div className="preview-signals">
                  <div className="preview-signal-card">
                    <div className="preview-signal-label">Signal</div>
                    <div className="preview-signal-body">Forwarding behaviour from the champion suggests internal momentum rather than passive review.</div>
                  </div>
                  <div className="preview-signal-card">
                    <div className="preview-signal-label">Watch</div>
                    <div className="preview-signal-body">Legal has been quiet for 12 days. If the brief lands late, procurement timing may slip the quarter.</div>
                  </div>
                </div>
              </div>

              <div className="preview-side">
                <div className="preview-next-action">
                  <div className="preview-next-label">Recommended next action</div>
                  <AIVoice as="div" className="preview-next-copy">
                    Send the SSO technical brief to Marcus before Thursday&apos;s follow-up call.
                  </AIVoice>
                  <div className="preview-next-actions">
                    <button type="button">Draft now</button>
                    <button type="button">Skip</button>
                  </div>
                </div>

                <div className="surface-glass-strong preview-side-card">
                  <div className="preview-side-head">
                    <div className="preview-side-title">Stakeholders</div>
                    <div className="preview-side-meta">7 mapped</div>
                  </div>
                  <div className="preview-list">
                    <div className="preview-list-item">
                      <div className="preview-avatar orange">SC</div>
                      <div className="preview-person">
                        <strong>Sarah Chen</strong>
                        <span>Head of Operations · Champion</span>
                      </div>
                      <span className="preview-status" />
                    </div>
                    <div className="preview-list-item">
                      <div className="preview-avatar blue">JH</div>
                      <div className="preview-person">
                        <strong>James Holloway</strong>
                        <span>VP Finance · Economic buyer</span>
                      </div>
                      <span className="preview-status idle" />
                    </div>
                    <div className="preview-list-item">
                      <div className="preview-avatar purple">MD</div>
                      <div className="preview-person">
                        <strong>Marcus Devlin</strong>
                        <span>IT Director · Technical gatekeeper</span>
                      </div>
                      <span className="preview-status warn" />
                    </div>
                    <div className="preview-list-item">
                      <div className="preview-avatar green">PL</div>
                      <div className="preview-person">
                        <strong>Priya Laghari</strong>
                        <span>Regional Director · Active sponsor</span>
                      </div>
                      <span className="preview-status" />
                    </div>
                  </div>
                </div>

                <div className="surface-glass-strong preview-side-card">
                  <div className="preview-side-head">
                    <div className="preview-side-title">Close forecast</div>
                    <div className="preview-side-meta">Model view</div>
                  </div>
                  <div className="preview-forecast-row">
                    <div className="preview-forecast-line">
                      <strong><span>Q2 (this quarter)</span><span>68%</span></strong>
                      <div className="preview-track"><span className="green" /></div>
                    </div>
                    <div className="preview-forecast-line">
                      <strong><span>Q3 (slips)</span><span>24%</span></strong>
                      <div className="preview-track"><span className="orange" /></div>
                    </div>
                    <div className="preview-forecast-line">
                      <strong><span>Lost / stalled</span><span>8%</span></strong>
                      <div className="preview-track"><span className="red" /></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-section" id="product">
        <div className="marketing-frame">
          <div className="surface-glass-strong marketing-band">
            <div className="marketing-band-card">
              <strong>Run the workspace from one surface</strong>
              <span>Overview, tasks, signals, documents, and stakeholder context stay tied to the same deal state.</span>
            </div>
            <div className="marketing-band-card">
              <strong>Give reps a clearer next move</strong>
              <span>Every recommendation is grounded in actual notes, actual people, and actual timing risk.</span>
            </div>
            <div className="marketing-band-card">
              <strong>Give leaders a forecast they can trust</strong>
              <span>Pipeline view, risk pressure, and execution lag roll up from the work already happening in deals.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-frame">
          <div className="marketing-section-header">
            <div className="marketing-kicker">Product</div>
            <h2 className="marketing-section-title">Built to feel like an operating system for revenue, not another dashboard.</h2>
            <p className="marketing-section-copy">
              Halvex is designed around the way deals actually move: conversations create signal, signal creates action, action changes forecast quality. The product keeps that chain visible.
            </p>
          </div>

          <div className="marketing-card-grid">
            {capabilities.map(capability => (
              <CapabilityCard key={capability.title} {...capability} />
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-section" id="workflow">
        <div className="marketing-frame marketing-operating-grid">
          <div className="surface-glass-strong marketing-steps">
            <div className="marketing-section-header" style={{ marginBottom: 0 }}>
              <div className="marketing-kicker">Workflow</div>
              <h2 className="marketing-section-title">From every call note to a confident next move.</h2>
            </div>

            <div className="marketing-step-list">
              {operatingModel.map(item => (
                <div key={item.step} className="marketing-step">
                  <div className="marketing-step-num">{item.step}</div>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="surface-glass-strong marketing-operator-panel">
            <div className="marketing-kicker">What teams get back</div>
            <h2 className="marketing-section-title" style={{ fontSize: '38px' }}>Less drift. Better follow-through. Cleaner decisions.</h2>
            <p className="marketing-section-copy" style={{ marginTop: 12 }}>
              The value is not just AI output. It is the shared rhythm: one place to see what matters, one place to act, and a clearer line from execution to forecast.
            </p>

            <div className="marketing-operator-grid">
              <div className="marketing-operator-cell">
                <strong>Recommended actions</strong>
                <span>Action cards are specific enough to draft, send, schedule, or assign immediately.</span>
              </div>
              <div className="marketing-operator-cell">
                <strong>Stakeholder clarity</strong>
                <span>See who is active, who is blocking, and where political gaps are starting to form.</span>
              </div>
              <div className="marketing-operator-cell">
                <strong>Execution pressure</strong>
                <span>Tasks, project-plan milestones, and success criteria all feed the same prioritized queue.</span>
              </div>
              <div className="marketing-operator-cell">
                <strong>Forecast quality</strong>
                <span>Leaders see revenue pressure shaped by real activity, not just stage labels and optimism.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-section" id="pricing">
        <div className="marketing-frame marketing-pricing-grid">
          <div className="surface-glass-strong marketing-pricing-card">
            <div>
              <div className="marketing-kicker">Pricing</div>
              <h2 className="marketing-section-title" style={{ fontSize: '42px', marginTop: 12 }}>Simple enough to start fast.</h2>
              <p className="marketing-section-copy" style={{ marginTop: 12 }}>
                Start with one workspace, bring in the team, and let the system prove its value in the way your pipeline gets run day to day.
              </p>
            </div>

            <div className="marketing-price">
              <strong>£79</strong>
              <span>per workspace / month</span>
            </div>

            <div className="marketing-checklist">
              {pricingPoints.map(item => (
                <div key={item} className="marketing-check">
                  <span className="marketing-check-icon">
                    <Check size={11} strokeWidth={3} />
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Link href="/sign-up" className="btn btn-primary">
                Start free
                <ArrowRight size={13} strokeWidth={2} />
              </Link>
              <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>14-day free trial. No credit card required.</span>
            </div>
          </div>

          <div className="surface-glass-strong marketing-enterprise-card">
            <div className="marketing-kicker">For larger teams</div>
            <h2 className="marketing-section-title" style={{ fontSize: '34px' }}>Designed for the whole operating rhythm.</h2>
            <p>
              Halvex works best when reps, managers, and revenue leaders are all looking at the same live picture. The product language, workflows, and reporting are built around that shared system.
            </p>
            <div className="marketing-checklist">
              <div className="marketing-check">
                <span className="marketing-check-icon"><ShieldCheck size={11} strokeWidth={3} /></span>
                <span>Shared deal workspaces with the same narrative across rep and leader views</span>
              </div>
              <div className="marketing-check">
                <span className="marketing-check-icon"><PoundSterling size={11} strokeWidth={3} /></span>
                <span>Commercially aware pipeline and forecast views anchored in real deal execution</span>
              </div>
              <div className="marketing-check">
                <span className="marketing-check-icon"><CalendarClock size={11} strokeWidth={3} /></span>
                <span>Daily operating rhythm across overview, tasks, signals, and the live deal workspace</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-frame">
          <div className="surface-glass-heavy marketing-cta-panel">
            <div className="marketing-cta-copy">
              <div className="marketing-kicker">Start now</div>
              <h2>Stop reconstructing the deal from memory.</h2>
              <p>
                Halvex gives your team a clearer way to run the day: one morning briefing, one deal workspace, one place to turn signal into action and action into revenue.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link href="/sign-up" className="btn btn-primary">
                Create workspace
                <ArrowRight size={13} strokeWidth={2} />
              </Link>
              <Link href="/sign-in" className="btn">
                Sign in
                <ChevronRight size={13} strokeWidth={2} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="marketing-frame marketing-footer">
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <div className="marketing-mark" style={{ width: 24, height: 24, borderRadius: 8, fontSize: 11 }}>H</div>
          <span>© {new Date().getFullYear()} Halvex</span>
        </div>

        <div className="marketing-footer-links">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/sign-in">Sign in</Link>
        </div>
      </footer>
    </main>
  )
}
