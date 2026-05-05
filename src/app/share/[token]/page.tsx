import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { collateral } from '@/lib/db/schema'
import { CollateralViewer } from '@/components/collateral/CollateralViewer'
import { CollateralTypeBadge } from '@/components/collateral/CollateralTypeBadge'
import type { CollateralContent } from '@/types'

interface SharePageProps {
  params: Promise<{ token: string }>
}

function formatDate(d: Date | string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params

  const [item] = await db
    .select()
    .from(collateral)
    .where(eq(collateral.shareToken, token))
    .limit(1)

  if (!item || !item.isShared) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--surface-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '48px', margin: '0 0 16px' }}>404</p>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#37352f', margin: '0 0 8px' }}>
            This link is not available
          </h1>
          <p style={{ fontSize: '13px', color: '#787774', margin: 0 }}>
            This piece of collateral may have been unshared or does not exist.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--surface-1)',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#37352f',
      }}
    >
      <div
        style={{
          maxWidth: '860px',
          margin: '0 auto',
          padding: '48px 24px',
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '48px',
          }}
        >
          <span
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: '#37352f',
              letterSpacing: 0,
            }}
          >
            Halvex
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: '22px',
              padding: '0 10px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#9b9a97',
              backgroundColor: 'rgba(55,53,47,0.05)',
              border: '1px solid rgba(55,53,47,0.10)',
            }}
          >
            Powered by Halvex
          </span>
        </div>

        {/* Title section */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <CollateralTypeBadge type={item.type} />
          </div>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 700,
              color: '#37352f',
              letterSpacing: 0,
              margin: '0 0 8px',
              lineHeight: 1.2,
            }}
          >
            {item.title}
          </h1>
          <p style={{ fontSize: '12px', color: '#9b9a97', margin: 0 }}>
            Generated {formatDate(item.generatedAt)}
          </p>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', backgroundColor: 'rgba(55,53,47,0.09)', marginBottom: '32px' }} />

        {/* Content */}
        {item.content ? (
          <CollateralViewer content={item.content as CollateralContent} />
        ) : (
          <p style={{ fontSize: '13px', color: '#787774' }}>No content available.</p>
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: '64px',
            paddingTop: '24px',
            borderTop: '1px solid rgba(55,53,47,0.09)',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '12px', color: '#9b9a97', margin: 0 }}>
            Create your own AI sales collateral at{' '}
            <a
              href="https://halvex.ai"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--brand)', textDecoration: 'none' }}
            >
              halvex.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
