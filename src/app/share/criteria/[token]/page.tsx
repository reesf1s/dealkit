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
  Security: '#e03e3e',
  Integration: '#2e78c6',
  Reporting: '#787774',
  Performance: '#cb6c2c',
  Compliance: '#0f7b6c',
  Onboarding: 'var(--brand)',
  General: '#9b9a97',
}

function categoryColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? '#9b9a97'
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
      <div style={{
        minHeight: '100vh',
        backgroundColor: 'var(--surface-1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '48px', margin: '0 0 16px', color: 'rgba(55,53,47,0.20)' }}>404</p>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#37352f', margin: '0 0 8px' }}>This link is not available</h1>
          <p style={{ fontSize: '13px', color: '#9b9a97', margin: 0 }}>This success criteria list may have been unshared or does not exist.</p>
        </div>
      </div>
    )
  }

  const criteria: any[] = (deal.successCriteriaTodos as any[]) ?? []
  const categories = [...new Set(criteria.map((c: any) => c.category ?? 'General'))]
  const achieved = criteria.filter((c: any) => c.achieved).length

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--surface-1)',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#37352f',
    }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '48px 24px' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '48px' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#37352f', letterSpacing: 0 }}>Halvex</span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 10px',
            borderRadius: '4px', fontSize: '11px', fontWeight: 600, color: '#9b9a97',
            backgroundColor: 'rgba(55,53,47,0.05)', border: '1px solid rgba(55,53,47,0.10)',
          }}>
            Powered by Halvex
          </span>
        </div>

        {/* Title */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 10px',
            borderRadius: '4px', fontSize: '11px', fontWeight: 600,
            color: '#0f7b6c', backgroundColor: 'rgba(15,123,108,0.08)', border: '1px solid rgba(15,123,108,0.20)',
            marginBottom: '12px',
          }}>
            Success Criteria
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#37352f', letterSpacing: 0, margin: '0 0 6px', lineHeight: 1.2 }}>
            {deal.dealName}
          </h1>
          {deal.prospectCompany && (
            <p style={{ fontSize: '14px', color: '#787774', margin: '0 0 8px' }}>{deal.prospectCompany}</p>
          )}
          <p style={{ fontSize: '12px', color: '#9b9a97', margin: 0 }}>Last updated {formatDate(deal.updatedAt)}</p>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', backgroundColor: 'rgba(55,53,47,0.09)', marginBottom: '28px' }} />

        {/* Progress */}
        {criteria.length > 0 && (
          <div style={{
            background: 'var(--surface-1)',
            border: '1px solid rgba(55,53,47,0.09)',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', color: '#9b9a97' }}>Overall Progress</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: achieved === criteria.length ? '#0f7b6c' : '#37352f' }}>
                {achieved}/{criteria.length} met
              </span>
            </div>
            <div style={{ height: '6px', background: 'rgba(55,53,47,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${criteria.length ? (achieved / criteria.length) * 100 : 0}%`, background: '#0f7b6c', borderRadius: '3px' }} />
            </div>
          </div>
        )}

        {/* Criteria by category */}
        {criteria.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#9b9a97', textAlign: 'center', padding: '40px 0' }}>No criteria to display.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {categories.map(cat => (
              <div key={cat} style={{
                background: 'var(--surface-1)',
                border: '1px solid rgba(55,53,47,0.09)',
                borderRadius: '10px',
                padding: '16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: categoryColor(cat), flexShrink: 0 }} />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#9b9a97', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{cat}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {criteria.filter((c: any) => (c.category ?? 'General') === cat).map((c: any) => (
                    <div key={c.id}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{
                          marginTop: '2px', flexShrink: 0, width: '16px', height: '16px', borderRadius: '50%',
                          border: c.achieved ? 'none' : '2px solid rgba(55,53,47,0.20)',
                          background: c.achieved ? '#0f7b6c' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {c.achieved && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4L3.5 6.5L9 1" stroke="var(--surface-1)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <span style={{ flex: 1, fontSize: '13px', color: c.achieved ? '#9b9a97' : '#37352f', lineHeight: 1.5, textDecoration: c.achieved ? 'line-through' : 'none' }}>
                          {c.text}
                        </span>
                      </div>
                      {c.note && (
                        <div style={{
                          marginLeft: '26px', marginTop: '5px', fontSize: '11px', color: '#787774',
                          background: 'rgba(55,53,47,0.04)', borderRadius: '6px', padding: '5px 8px',
                          border: '1px solid rgba(55,53,47,0.08)',
                        }}>
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
        <div style={{ marginTop: '64px', paddingTop: '24px', borderTop: '1px solid rgba(55,53,47,0.09)', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: '#9b9a97', margin: 0 }}>
            Track your deals with AI at{' '}
            <a href="https://halvex.ai" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)', textDecoration: 'none' }}>
              halvex.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
