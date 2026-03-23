import Link from 'next/link'
import { FileText } from 'lucide-react'

export const metadata = {
  title: 'Terms of Service — Halvex',
  description: 'Terms and conditions for using the Halvex platform.',
}

const EFFECTIVE_DATE = '11 March 2025'
const COMPANY_EMAIL = 'legal@halvex.ai'

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#07050F', color: '#E5E7EB', fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", sans-serif' }}>

      {/* Nav */}
      <nav style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 32px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '9px', textDecoration: 'none' }}>
          <div style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={13} color="#fff" />
          </div>
          <span style={{ fontWeight: '700', fontSize: '14px', color: '#F0EEFF' }}>Halvex</span>
        </Link>
        <Link href="/" style={{ fontSize: '13px', color: '#9CA3AF', textDecoration: 'none' }}>← Back to home</Link>
      </nav>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '60px 32px 80px' }}>
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-0.04em', color: '#F0EEFF', marginBottom: '10px' }}>Terms of Service</h1>
          <p style={{ fontSize: '14px', color: '#6B7280' }}>Effective date: {EFFECTIVE_DATE} · Last updated: {EFFECTIVE_DATE}</p>
        </div>

        <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px', padding: '16px 20px', marginBottom: '32px' }}>
          <p style={{ fontSize: '13px', color: '#A78BFA', lineHeight: '1.7' }}>
            <strong>Summary:</strong> By using Halvex you agree to these terms. We provide a sales intelligence platform on a subscription basis. You own your data. We may suspend accounts that violate these terms. You can cancel any time.
          </p>
        </div>

        <Section title="1. Acceptance of terms">
          <P>By creating an account or using any part of the Halvex platform (&quot;Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;) and our Privacy Policy. If you are using the Service on behalf of a company or other legal entity, you represent that you have authority to bind that entity to these Terms.</P>
          <P>If you do not agree to these Terms, do not use the Service.</P>
        </Section>

        <Section title="2. Description of service">
          <P>Halvex is a B2B sales intelligence platform that provides AI-powered sales collateral generation, competitor tracking, deal management, meeting preparation, and related tools for sales teams.</P>
          <P>We reserve the right to modify, suspend, or discontinue any part of the Service with reasonable notice. We will provide at least 30 days&apos; notice before discontinuing the Service entirely.</P>
        </Section>

        <Section title="3. Account registration">
          <P>You must provide accurate and complete registration information. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.</P>
          <P>You must be at least 18 years old to use the Service. By using the Service, you represent that you meet this requirement.</P>
          <P>You must notify us immediately at <a href={`mailto:${COMPANY_EMAIL}`} style={{ color: '#818CF8' }}>{COMPANY_EMAIL}</a> if you suspect any unauthorised use of your account.</P>
        </Section>

        <Section title="4. Subscription and payment">
          <P><strong>Free plan:</strong> We offer a limited free tier at no charge, subject to the usage limits described on our pricing page.</P>
          <P><strong>Paid plans:</strong> Paid subscriptions are billed monthly in advance. Prices are shown in USD and are exclusive of any applicable taxes (VAT, GST, sales tax) which will be added at checkout where required by law.</P>
          <P><strong>Upgrades:</strong> When you upgrade, you are charged immediately on a pro-rata basis for the remainder of your billing period, then the full amount at each subsequent renewal.</P>
          <P><strong>Cancellation:</strong> You may cancel your subscription at any time from your account settings. Cancellation takes effect at the end of your current billing period. No refunds are issued for partial months.</P>
          <P><strong>Failed payments:</strong> If a payment fails, we will retry up to 3 times over 7 days and notify you by email. If payment remains outstanding after that period, your account will be downgraded to the free plan.</P>
          <P>All payments are processed by Stripe. We do not store your payment card details.</P>
        </Section>

        <Section title="5. Acceptable use">
          <P>You agree not to use the Service to:</P>
          <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', color: '#9CA3AF', fontSize: '14px', lineHeight: '1.7' }}>
            <li>Violate any applicable law or regulation</li>
            <li>Infringe the intellectual property rights of others</li>
            <li>Transmit confidential information of third parties without authorisation</li>
            <li>Attempt to gain unauthorised access to our systems or other users&apos; data</li>
            <li>Use the AI features to generate content that is false, misleading, or harmful</li>
            <li>Resell or sublicense the Service without our written consent</li>
            <li>Reverse-engineer, decompile, or disassemble any part of the Service</li>
            <li>Use automated means to scrape or extract data from the Service</li>
          </ul>
        </Section>

        <Section title="6. Your content and data">
          <P>You retain all ownership rights to the data and content you upload to Halvex (&quot;Your Content&quot;). By using the Service, you grant us a limited, non-exclusive licence to process Your Content solely to provide and improve the Service.</P>
          <P>You are responsible for ensuring you have the right to upload and process any data you enter into the Service, including data about third parties (prospects, competitors, etc.).</P>
          <P>We will not use Your Content to train AI models or share it with third parties except as described in our Privacy Policy and as strictly necessary to provide the Service.</P>
        </Section>

        <Section title="7. AI-generated content">
          <P>Halvex uses AI (powered by Anthropic&apos;s Claude) to generate sales materials, analyses, and recommendations. You acknowledge that:</P>
          <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', color: '#9CA3AF', fontSize: '14px', lineHeight: '1.7' }}>
            <li>AI-generated content may contain inaccuracies and should be reviewed before use</li>
            <li>You are responsible for verifying the accuracy of AI-generated content</li>
            <li>We make no warranty that AI outputs are factually correct or legally compliant</li>
            <li>AI outputs do not constitute legal, financial, or professional advice</li>
          </ul>
        </Section>

        <Section title="8. Intellectual property">
          <P>The Halvex platform, including its software, design, and documentation, is owned by us and protected by copyright, trademark, and other intellectual property laws. These Terms do not grant you any rights to use our trademarks, logos, or brand names.</P>
          <P>Subject to your compliance with these Terms and payment of applicable fees, we grant you a limited, non-exclusive, non-transferable licence to use the Service during your subscription term.</P>
        </Section>

        <Section title="9. Confidentiality">
          <P>Each party may have access to confidential information of the other. Both parties agree to keep such information confidential and not disclose it to third parties except as required to perform obligations under these Terms or as required by law.</P>
        </Section>

        <Section title="10. Disclaimers and limitation of liability">
          <P>THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.</P>
          <P>TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY TO YOU FOR ANY CLAIMS ARISING FROM OR RELATED TO THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM, OR (B) £100 GBP.</P>
          <P>WE WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, LOSS OF PROFITS, LOSS OF DATA, OR BUSINESS INTERRUPTION, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</P>
          <P><strong>Consumer rights:</strong> Nothing in these Terms limits any rights you may have under applicable consumer protection laws that cannot be excluded by contract.</P>
        </Section>

        <Section title="11. Indemnification">
          <P>You agree to indemnify and hold us harmless from any claims, damages, losses, or expenses (including reasonable legal fees) arising from your use of the Service in violation of these Terms, your violation of any applicable law, or your infringement of any third-party rights.</P>
        </Section>

        <Section title="12. Term and termination">
          <P>These Terms remain in effect while you use the Service. We may suspend or terminate your account if you materially breach these Terms and fail to remedy the breach within 14 days of written notice.</P>
          <P>On termination: (a) your right to use the Service ceases; (b) you may export your data within 30 days; (c) after 30 days we may delete your data in accordance with our Privacy Policy.</P>
        </Section>

        <Section title="13. Governing law and disputes">
          <P>These Terms are governed by the laws of England and Wales. Any disputes will be subject to the exclusive jurisdiction of the courts of England and Wales.</P>
          <P><strong>EU consumers:</strong> If you are a consumer in the EU, you may also have the right to use the EU Online Dispute Resolution platform at <a href="https://ec.europa.eu/odr" target="_blank" rel="noopener noreferrer" style={{ color: '#818CF8' }}>ec.europa.eu/odr</a>.</P>
          <P><strong>US consumers:</strong> For California residents, any dispute resolution will comply with California consumer protection law requirements.</P>
        </Section>

        <Section title="14. Changes to these terms">
          <P>We may update these Terms from time to time. We will provide at least 30 days&apos; notice of material changes by email or in-app notification. Continued use of the Service after changes take effect constitutes acceptance of the updated Terms.</P>
        </Section>

        <Section title="15. Contact">
          <P>For legal enquiries: <a href={`mailto:${COMPANY_EMAIL}`} style={{ color: '#818CF8' }}>{COMPANY_EMAIL}</a></P>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '40px' }}>
      <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#F0EEFF', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{children}</div>
    </div>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: '14px', color: '#9CA3AF', lineHeight: '1.8' }}>{children}</p>
}
