import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'

interface Props {
  params: Promise<{ token: string }>
}

function formatDate(d: Date | string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const CATEGORY_COLORS: Record<string, string> = {
  Security: '#EF4444',
  Integration: '#3B82F6',
  Reporting: '#8B5CF6',
  Performance: '#F59E0B',
  Compliance: '#10B981',
  Onboarding: '#06B6D4',
  General: '#6B7280',
}

function categoryColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? '#6366F1'
}

export default async function ShareCriteriaPage({ params }: Props) {
  const { token } = await params

  const [deal] = await db
    .select({
      dealName: dealLogs.dealName,
      prospectCompany: dealLogs.prospectCompany,
      successCriteriaTodos: dealLogs.successCriteriaTodos,
      successCriteriaIsShared: dealLogs.successCriteriaIsShared,
      updatedAt: dealLogs.updatedAt,
    })
    .from(dealLogs)
    .where(eq(dealLogs.successCriteriaShareToken, token))
    .limit(1)

  if (!deal || !deal.successCriteriaIsShared) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '48px', margin: '0 0 16px' }}>404</p>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#EBEBEB', margin: '0 0 8px' }}>This link is not available</h1>
          <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>This success criteria list may have been unshared or does not exist.</p>
        </div>
      </div>
    )
  }

  const criteria: any[] = (deal.successCriteriaTodos as any[]) ?? []
  const categories = [...new Set(criteria.map((c: any) => c.category ?? 'General'))]
  const achieved = criteria.filter((c: any) => c.achieved).length

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0A0A0A', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#EBEBEB' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '48px 24px' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '48px' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#EBEBEB', letterSpacing: '-0.03em' }}>Halvex</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, color: '#888', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
            Powered by Halvex
          </span>
        </div>

        {/* Title */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, color: '#22C55E', backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', marginBottom: '12px' }}>
            Success Criteria
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#EBEBEB', letterSpacing: '-0.03em', margin: '0 0 6px', lineHeight: 1.2 }}>
            {deal.dealName}
          </h1>
          {deal.prospectCompany && (
            <p style={{ fontSize: '14px', color: '#888', margin: '0 0 8px' }}>{deal.prospectCompany}</p>
          )}
          <p style={{ fontSize: '12px', color: '#555', margin: 0 }}>Last updated {formatDate(deal.updatedAt)}</p>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: '28px' }} />

        {/* Progress */}
        {criteria.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', color: '#888' }}>Overall Progress</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: achieved === criteria.length ? '#22C55E' : '#EBEBEB' }}>
                {achieved}/{criteria.length} met
              </span>
            </div>
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${criteria.length ? (achieved / criteria.length) * 100 : 0}%`, background: 'linear-gradient(90deg, #6366F1, #22C55E)', borderRadius: '3px' }} />
            </div>
          </div>
        )}

        {/* Criteria by category */}
        {criteria.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#555', textAlign: 'center', padding: '40px 0' }}>No criteria to display.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {categories.map(cat => (
              <div key={cat} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: categoryColor(cat), flexShrink: 0 }} />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#555', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{cat}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {criteria.filter((c: any) => (c.category ?? 'General') === cat).map((c: any) => (
                    <div key={c.id}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{ marginTop: '2px', flexShrink: 0, width: '16px', height: '16px', borderRadius: '50%', border: c.achieved ? 'none' : '2px solid #444', background: c.achieved ? '#22C55E' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {c.achieved && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4L3.5 6.5L9 1" stroke="#0A0A0A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <span style={{ flex: 1, fontSize: '13px', color: c.achieved ? '#555' : '#C0C0C8', lineHeight: 1.5, textDecoration: c.achieved ? 'line-through' : 'none' }}>
                          {c.text}
                        </span>
                      </div>
                      {c.note && (
                        <div style={{ marginLeft: '26px', marginTop: '5px', fontSize: '11px', color: '#818CF8', background: 'rgba(99,102,241,0.06)', borderRadius: '6px', padding: '5px 8px' }}>
                          {c.note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: '64px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: '#555', margin: 0 }}>
            Track your deals with AI at{' '}
            <a href="https://halvex.ai" target="_blank" rel="noopener noreferrer" style={{ color: '#6366F1', textDecoration: 'none' }}>
              halvex.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
