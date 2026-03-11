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
          backgroundColor: '#0A0A0A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '48px', margin: '0 0 16px' }}>404</p>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#EBEBEB', margin: '0 0 8px' }}>
            This link is not available
          </h1>
          <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>
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
        backgroundColor: '#0A0A0A',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#EBEBEB',
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
              color: '#EBEBEB',
              letterSpacing: '-0.03em',
            }}
          >
            DealKit
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
              color: '#888',
              backgroundColor: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            Powered by DealKit
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
              color: '#EBEBEB',
              letterSpacing: '-0.03em',
              margin: '0 0 8px',
              lineHeight: 1.2,
            }}
          >
            {item.title}
          </h1>
          <p style={{ fontSize: '12px', color: '#555', margin: 0 }}>
            Generated {formatDate(item.generatedAt)}
          </p>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: '32px' }} />

        {/* Content */}
        {item.content ? (
          <CollateralViewer content={item.content as CollateralContent} />
        ) : (
          <p style={{ fontSize: '13px', color: '#555' }}>No content available.</p>
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: '64px',
            paddingTop: '24px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '12px', color: '#555', margin: 0 }}>
            Create your own AI sales collateral at{' '}
            <a
              href="https://dealkit.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#6366F1', textDecoration: 'none' }}
            >
              dealkit.vercel.app
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
