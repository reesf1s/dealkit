'use client'

import { useState } from 'react'

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `£${(value / 1_000_000).toFixed(1)}m`
  }
  if (value >= 1_000) {
    return `£${(value / 1_000).toFixed(1)}k`
  }
  return `£${value.toFixed(0)}`
}

const DEALKIT_COST = 79 // GBP/month (Starter plan)

export default function ROICalc() {
  const [monthlyDeals, setMonthlyDeals] = useState(20)
  const [avgDealValue, setAvgDealValue] = useState(25000)
  const [currentWinRate, setCurrentWinRate] = useState(30)

  // Calculations
  const dealsWonPerMonth = monthlyDeals * (currentWinRate / 100)
  const revenueWonPerMonth = dealsWonPerMonth * avgDealValue

  const extraDealsPerMonth = monthlyDeals * 0.10
  const extraRevenuePerMonth = extraDealsPerMonth * avgDealValue

  const roi = extraRevenuePerMonth > 0 ? Math.round(extraRevenuePerMonth / DEALKIT_COST) : 0

  const paybackDays =
    extraRevenuePerMonth > 0
      ? Math.max(1, Math.round((DEALKIT_COST / extraRevenuePerMonth) * 30))
      : 0

  const inputStyle: React.CSSProperties = {
    height: '36px',
    borderRadius: '6px',
    backgroundColor: '#1A1A1A',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#EBEBEB',
    fontSize: '14px',
    padding: '0 12px',
    width: '120px',
    textAlign: 'right',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#888',
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
  }

  const outputCardStyle: React.CSSProperties = {
    backgroundColor: '#141414',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '8px',
    padding: '20px',
    flex: 1,
    minWidth: 0,
  }

  return (
    <section style={{ maxWidth: '680px', margin: '0 auto', padding: '0 32px 100px' }}>
      {/* Section header */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          background: 'rgba(99,102,241,0.12)',
          border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: '100px',
          fontSize: '12px',
          color: '#818CF8',
          fontWeight: 500,
          marginBottom: '20px',
        }}>
          ROI Calculator
        </div>
        <h2 style={{
          fontSize: '32px',
          fontWeight: 700,
          letterSpacing: '-0.03em',
          color: '#EBEBEB',
          marginBottom: '12px',
        }}>
          See your return before you sign up
        </h2>
        <p style={{ fontSize: '15px', color: '#888', lineHeight: 1.6 }}>
          Enter your deal metrics and see how DealKit pays for itself
        </p>
      </div>

      {/* Calculator card */}
      <div style={{
        backgroundColor: '#141414',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px',
        padding: '28px',
        marginBottom: '20px',
      }}>
        {/* Inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px' }}>
          {/* Monthly deals */}
          <div style={rowStyle}>
            <label style={labelStyle}>Monthly deals</label>
            <input
              type="number"
              min={1}
              max={200}
              value={monthlyDeals}
              onChange={e => setMonthlyDeals(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
              style={inputStyle}
            />
          </div>

          {/* Average deal value */}
          <div style={rowStyle}>
            <label style={labelStyle}>Average deal value</label>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <span style={{
                position: 'absolute',
                left: '10px',
                color: '#555',
                fontSize: '14px',
                pointerEvents: 'none',
                lineHeight: 1,
              }}>
                £
              </span>
              <input
                type="number"
                min={1000}
                max={500000}
                step={1000}
                value={avgDealValue}
                onChange={e => setAvgDealValue(Math.max(1000, Math.min(500000, Number(e.target.value) || 1000)))}
                style={{ ...inputStyle, paddingLeft: '22px' }}
              />
            </div>
          </div>

          {/* Current win rate */}
          <div style={rowStyle}>
            <label style={labelStyle}>Current win rate</label>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <input
                type="number"
                min={5}
                max={80}
                value={currentWinRate}
                onChange={e => setCurrentWinRate(Math.max(5, Math.min(80, Number(e.target.value) || 5)))}
                style={{ ...inputStyle, paddingRight: '26px' }}
              />
              <span style={{
                position: 'absolute',
                right: '10px',
                color: '#555',
                fontSize: '14px',
                pointerEvents: 'none',
                lineHeight: 1,
              }}>
                %
              </span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', marginBottom: '20px' }} />

        {/* Current snapshot */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '6px', padding: '12px' }}>
            <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Deals won/mo</div>
            <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.03em', color: '#EBEBEB' }}>
              {dealsWonPerMonth.toFixed(1)}
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '6px', padding: '12px' }}>
            <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Revenue won/mo</div>
            <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.03em', color: '#EBEBEB' }}>
              {formatCurrency(revenueWonPerMonth)}
            </div>
          </div>
        </div>

        <div style={{ fontSize: '12px', color: '#555', textAlign: 'center' }}>
          With DealKit targeting a +10% win rate improvement
        </div>
      </div>

      {/* Output cards */}
      <div style={{ display: 'flex', gap: '12px' }}>
        {/* Extra Revenue */}
        <div style={outputCardStyle}>
          <div style={{
            fontSize: '32px',
            fontWeight: 700,
            letterSpacing: '-0.04em',
            color: '#22C55E',
            marginBottom: '6px',
            lineHeight: 1,
          }}>
            {formatCurrency(extraRevenuePerMonth)}
          </div>
          <div style={{ fontSize: '12px', color: '#888' }}>Extra Revenue/mo</div>
        </div>

        {/* ROI */}
        <div style={outputCardStyle}>
          <div style={{
            fontSize: '32px',
            fontWeight: 700,
            letterSpacing: '-0.04em',
            color: '#6366F1',
            marginBottom: '6px',
            lineHeight: 1,
          }}>
            {roi > 0 ? `${roi}x` : '—'}
          </div>
          <div style={{ fontSize: '12px', color: '#888' }}>ROI</div>
        </div>

        {/* Payback */}
        <div style={outputCardStyle}>
          <div style={{
            fontSize: '32px',
            fontWeight: 700,
            letterSpacing: '-0.04em',
            color: '#EBEBEB',
            marginBottom: '6px',
            lineHeight: 1,
          }}>
            {paybackDays > 0 ? `${paybackDays}d` : '—'}
          </div>
          <div style={{ fontSize: '12px', color: '#888' }}>Pays for itself in</div>
        </div>
      </div>

      {/* Fine print */}
      <p style={{
        marginTop: '16px',
        textAlign: 'center',
        fontSize: '12px',
        color: '#444',
        lineHeight: 1.5,
      }}>
        {`Based on DealKit Starter at £${DEALKIT_COST}/mo. Assumes a 10% win rate improvement from better collateral.`}
      </p>
    </section>
  )
}
