import Link from 'next/link'
import { FileText } from 'lucide-react'

export const metadata = {
  title: 'Privacy Policy — Halvex',
  description: 'How Halvex collects, uses, and protects your personal data.',
}

const EFFECTIVE_DATE = '11 March 2025'
const COMPANY_EMAIL = 'privacy@halvex.ai'
const COMPANY_NAME = 'Halvex'
const COMPANY_JURISDICTION = 'England & Wales'

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-1)', color: '#37352f', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Nav */}
      <nav style={{ borderBottom: '1px solid rgba(55,53,47,0.09)', padding: '0 32px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '9px', textDecoration: 'none' }}>
          <div style={{ width: '28px', height: '28px', background: '#37352f', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={13} color="#fff" />
          </div>
          <span style={{ fontWeight: '700', fontSize: '14px', color: '#37352f' }}>Halvex</span>
        </Link>
        <Link href="/" style={{ fontSize: '13px', color: '#9b9a97', textDecoration: 'none' }}>← Back to home</Link>
      </nav>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '60px 32px 80px' }}>
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '800', letterSpacing: 0, color: '#37352f', marginBottom: '10px' }}>Privacy Policy</h1>
          <p style={{ fontSize: '14px', color: '#9b9a97' }}>Effective date: {EFFECTIVE_DATE} · Last updated: {EFFECTIVE_DATE}</p>
        </div>

        <Section title="1. Who we are">
          <P>{COMPANY_NAME} (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the Halvex sales intelligence platform at halvex.ai. We are registered in {COMPANY_JURISDICTION}.</P>
          <P>We act as the <strong>data controller</strong> for personal data processed through our platform. For questions about this policy or to exercise your rights, contact us at <a href={`mailto:${COMPANY_EMAIL}`} style={{ color: 'var(--brand)' }}>{COMPANY_EMAIL}</a>.</P>
        </Section>

        <Section title="2. What data we collect">
          <P><strong>Account data</strong> — name, email address, and authentication credentials collected when you sign up via Clerk (our authentication provider).</P>
          <P><strong>Company & sales data</strong> — information you enter about your company, competitors, deals, case studies, and product gaps. This data is stored in our database and used solely to power the features you use.</P>
          <P><strong>Usage data</strong> — page views, feature usage events, and interaction logs collected to improve the product and for security purposes.</P>
          <P><strong>Payment data</strong> — billing information is handled entirely by Stripe. We never store card numbers or bank details. We receive only a Stripe customer ID and subscription status.</P>
          <P><strong>AI-generated content</strong> — text you paste into AI features (meeting notes, company descriptions) is sent to Anthropic&apos;s API to generate responses. Anthropic processes this data subject to their privacy policy.</P>
        </Section>

        <Section title="3. Legal basis for processing (GDPR — EU/EEA users)">
          <P>We process your personal data under the following legal bases:</P>
          <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', color: '#787774', fontSize: '14px', lineHeight: '1.7' }}>
            <li><strong style={{ color: '#37352f' }}>Contract performance</strong> — processing your account and sales data to provide the service you signed up for.</li>
            <li><strong style={{ color: '#37352f' }}>Legitimate interests</strong> — security monitoring, fraud prevention, and product analytics (where not overridden by your rights).</li>
            <li><strong style={{ color: '#37352f' }}>Consent</strong> — optional cookies and marketing communications where you have opted in.</li>
            <li><strong style={{ color: '#37352f' }}>Legal obligation</strong> — retaining billing records as required by applicable law.</li>
          </ul>
        </Section>

        <Section title="4. How we use your data">
          <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', color: '#787774', fontSize: '14px', lineHeight: '1.7' }}>
            <li>Provide and operate the Halvex platform</li>
            <li>Generate AI-powered sales collateral, meeting prep, and deal scoring</li>
            <li>Process subscription payments and manage your billing</li>
            <li>Send transactional emails (account confirmation, invoices, password reset)</li>
            <li>Detect and prevent security incidents</li>
            <li>Improve product quality and user experience</li>
            <li>Comply with legal obligations</li>
          </ul>
          <P>We do <strong>not</strong> sell your personal data. We do not use your sales or company data to train AI models.</P>
        </Section>

        <Section title="5. Who we share data with">
          <P>We share data with the following sub-processors only to the extent necessary to provide the service:</P>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginTop: '12px' }}>
            <thead>
              <tr>
                {['Sub-processor', 'Purpose', 'Location', 'Privacy policy'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', background: '#f7f6f3', color: '#787774', fontWeight: '600', borderBottom: '1px solid rgba(55,53,47,0.09)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Clerk', 'Authentication & user management', 'US (SOC 2)', 'clerk.com/legal/privacy'],
                ['Supabase', 'Database hosting', 'AWS US-East-1', 'supabase.com/privacy'],
                ['Anthropic', 'AI text generation', 'US', 'anthropic.com/privacy'],
                ['Stripe', 'Payment processing', 'US/EU (PCI-DSS)', 'stripe.com/privacy'],
                ['Vercel', 'Hosting & CDN', 'US/Global', 'vercel.com/legal/privacy'],
              ].map(([sp, purpose, loc, link]) => (
                <tr key={sp}>
                  {[sp, purpose, loc].map((val, i) => (
                    <td key={i} style={{ padding: '10px 12px', borderBottom: '1px solid rgba(55,53,47,0.06)', color: '#787774' }}>{val}</td>
                  ))}
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(55,53,47,0.06)' }}>
                    <a href={`https://${link}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)', fontSize: '12px' }}>{link}</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="6. International data transfers">
          <P>Our primary infrastructure is located in the United States. If you are located in the EU/EEA or UK, your data is transferred to the US under the following safeguards:</P>
          <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', color: '#787774', fontSize: '14px', lineHeight: '1.7' }}>
            <li>Clerk and Stripe are certified under the EU–US Data Privacy Framework</li>
            <li>Vercel and Supabase use Standard Contractual Clauses (SCCs) approved by the European Commission</li>
            <li>Anthropic processes data under SCCs and their Data Processing Addendum</li>
          </ul>
        </Section>

        <Section title="7. Your rights">
          <P>Depending on your location, you have the following rights over your personal data:</P>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginTop: '12px' }}>
            <thead>
              <tr>
                {['Right', 'GDPR (EU/EEA/UK)', 'CCPA (California)'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', background: '#f7f6f3', color: '#787774', fontWeight: '600', borderBottom: '1px solid rgba(55,53,47,0.09)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Access your data', '✓', '✓'],
                ['Correct inaccurate data', '✓', '✓'],
                ['Delete your data (erasure)', '✓', '✓'],
                ['Export your data (portability)', '✓', '✓'],
                ['Restrict processing', '✓', '—'],
                ['Object to processing', '✓', '—'],
                ['Opt out of data sale', 'N/A (we don\'t sell data)', '✓ (we don\'t sell data)'],
                ['Lodge a complaint with supervisory authority', '✓', 'CA AG / CPPA'],
              ].map(([right, gdpr, ccpa]) => (
                <tr key={right}>
                  {[right, gdpr, ccpa].map((val, i) => (
                    <td key={i} style={{ padding: '10px 12px', borderBottom: '1px solid rgba(55,53,47,0.06)', color: i === 0 ? '#E5E7EB' : '#9CA3AF' }}>{val}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <P>To exercise any of these rights, you can:</P>
          <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', color: '#787774', fontSize: '14px', lineHeight: '1.7' }}>
            <li>Use the <strong style={{ color: '#37352f' }}>Delete Account</strong> or <strong style={{ color: '#37352f' }}>Export My Data</strong> buttons in your account settings</li>
            <li>Email us at <a href={`mailto:${COMPANY_EMAIL}`} style={{ color: 'var(--brand)' }}>{COMPANY_EMAIL}</a></li>
          </ul>
          <P>We will respond to verified requests within <strong>30 days</strong> (GDPR) or <strong>45 days</strong> (CCPA).</P>
        </Section>

        <Section title="8. Cookies">
          <P>We use the following categories of cookies:</P>
          <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', color: '#787774', fontSize: '14px', lineHeight: '1.7' }}>
            <li><strong style={{ color: '#37352f' }}>Strictly necessary</strong> — authentication session cookies set by Clerk. These are essential for the service to function and do not require consent.</li>
            <li><strong style={{ color: '#37352f' }}>Functional</strong> — preferences such as sidebar collapsed state, stored in localStorage. No consent required.</li>
            <li><strong style={{ color: '#37352f' }}>Analytics</strong> — we may add analytics in future. If we do, we will update this policy and request consent.</li>
          </ul>
          <P>You can control cookies via your browser settings. Blocking strictly necessary cookies will prevent you from signing in.</P>
        </Section>

        <Section title="9. Data retention">
          <P>We retain your personal data for as long as your account is active. If you delete your account:</P>
          <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', color: '#787774', fontSize: '14px', lineHeight: '1.7' }}>
            <li>Account and sales data is deleted immediately from our database</li>
            <li>Billing records are retained for 7 years as required by financial regulations</li>
            <li>Anonymised, aggregated analytics data may be retained indefinitely</li>
          </ul>
        </Section>

        <Section title="10. Security">
          <P>We implement industry-standard security measures including TLS encryption in transit, encrypted database connections, and access controls. Authentication is handled by Clerk, a SOC 2 Type II certified provider. We conduct regular security reviews and promptly address vulnerabilities.</P>
          <P>Despite these measures, no system is 100% secure. In the event of a data breach affecting your rights, we will notify affected users and relevant authorities as required by law.</P>
        </Section>

        <Section title="11. Children's privacy">
          <P>Halvex is a B2B product intended for users aged 18 and over. We do not knowingly collect data from children under 16 (EU) or 13 (US). If we become aware of such collection, we will delete it promptly.</P>
        </Section>

        <Section title="12. Changes to this policy">
          <P>We may update this policy from time to time. We will notify you of material changes by email or in-app notice at least 30 days before changes take effect. The effective date at the top of this page will always reflect the latest version.</P>
        </Section>

        <Section title="13. Contact & supervisory authority">
          <P>For privacy enquiries: <a href={`mailto:${COMPANY_EMAIL}`} style={{ color: 'var(--brand)' }}>{COMPANY_EMAIL}</a></P>
          <P><strong>EU/EEA users</strong> may lodge a complaint with their local data protection authority. A list is available at <a href="https://edpb.europa.eu/about-edpb/about-edpb/members_en" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)' }}>edpb.europa.eu</a>.</P>
          <P><strong>UK users</strong> may complain to the Information Commissioner&apos;s Office (ICO) at <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)' }}>ico.org.uk</a>.</P>
          <P><strong>California residents</strong> may contact the California Privacy Protection Agency at <a href="https://cppa.ca.gov" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)' }}>cppa.ca.gov</a>.</P>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '40px' }}>
      <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#37352f', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid rgba(55,53,47,0.09)' }}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{children}</div>
    </div>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: '14px', color: '#787774', lineHeight: '1.8', margin: 0 }}>{children}</p>
}
