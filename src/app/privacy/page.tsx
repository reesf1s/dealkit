import Link from 'next/link'
import { FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export const metadata = {
  title: 'Privacy Policy - Halvex',
  description: 'How Halvex collects, uses, and protects your personal data.',
}

const EFFECTIVE_DATE = '11 March 2025'
const COMPANY_EMAIL = 'privacy@halvex.ai'
const COMPANY_NAME = 'Halvex'
const COMPANY_JURISDICTION = 'England & Wales'

const sections = [
  {
    title: '1. Who we are',
    body: [
      `${COMPANY_NAME} operates the Halvex platform and is registered in ${COMPANY_JURISDICTION}.`,
      `We act as the data controller for personal data processed through our platform. For questions about this policy or to exercise your rights, contact ${COMPANY_EMAIL}.`,
    ],
  },
  {
    title: '2. What data we collect',
    body: [
      'Account data: name, email address, and authentication details collected when you sign up via Clerk.',
      'Company and sales data: workspaces, companies, contacts, deals, tasks, notes, activities, calendar events, and sales process data you add to the product.',
      'Usage data: page views, feature usage events, and interaction logs used to improve the product and protect the service.',
      'Payment data: Stripe handles billing information. We never store card numbers or bank details.',
    ],
  },
  {
    title: '3. Legal basis for processing',
    body: [
      'Contract performance: processing your account and sales data to provide the service.',
      'Legitimate interests: security monitoring, fraud prevention, and product analytics.',
      'Consent: optional cookies and marketing communications where you have opted in.',
      'Legal obligation: retaining billing records as required by applicable law.',
    ],
  },
  {
    title: '4. How we use your data',
    body: [
      'Provide and operate the Halvex platform.',
      'Process subscription payments and manage billing.',
      'Send transactional emails such as account confirmations, invoices, and password resets.',
      'Detect and prevent security incidents, improve product quality, and comply with legal obligations.',
      'We do not sell your personal data.',
    ],
  },
  {
    title: '5. Who we share data with',
    body: [
      'We share data with sub-processors only to the extent needed to provide the service.',
      'Current providers include Clerk for authentication, Supabase for database hosting, Stripe for payments, and Vercel for hosting and CDN.',
    ],
  },
  {
    title: '6. International data transfers',
    body: [
      'Our primary infrastructure is located in the United States.',
      'For EU/EEA and UK users, transfers rely on safeguards such as the EU-US Data Privacy Framework and Standard Contractual Clauses where applicable.',
    ],
  },
  {
    title: '7. Your rights',
    body: [
      'Depending on your location, you may have rights to access, correct, delete, export, restrict, or object to processing of your personal data.',
      `To exercise these rights, email ${COMPANY_EMAIL}. We will respond to verified requests within 30 days under GDPR or 45 days under CCPA.`,
    ],
  },
  {
    title: '8. Cookies',
    body: [
      'Strictly necessary cookies support authentication sessions and are required for the service to function.',
      'Functional preferences may be stored in localStorage. Analytics may be added in future with appropriate notice and consent where required.',
    ],
  },
  {
    title: '9. Data retention',
    body: [
      'We retain personal data while your account is active.',
      'If you delete your account, account and sales data is removed from our database, while billing records may be retained for 7 years as required by financial regulations.',
    ],
  },
  {
    title: '10. Security',
    body: [
      'We use industry-standard protections including TLS encryption, encrypted database connections, access controls, and security reviews.',
      'No system is completely secure. If a breach affects your rights, we will notify affected users and relevant authorities as required by law.',
    ],
  },
  {
    title: '11. Children privacy',
    body: [
      'Halvex is a B2B product intended for users aged 18 and over.',
      'We do not knowingly collect data from children under 16 in the EU or under 13 in the US.',
    ],
  },
  {
    title: '12. Changes to this policy',
    body: [
      'We may update this policy from time to time and will notify users of material changes where practical.',
      'The effective date at the top of this page reflects the latest version.',
    ],
  },
  {
    title: '13. Contact and supervisory authority',
    body: [
      `For privacy enquiries, email ${COMPANY_EMAIL}.`,
      'EU/EEA users may lodge a complaint with their local data protection authority. UK users may complain to the Information Commissioner Office.',
    ],
  },
]

export default function PrivacyPage() {
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
            <h1 className="text-3xl font-semibold tracking-normal">Privacy Policy</h1>
            <p className="mt-2 text-sm text-muted-foreground">Effective date: {EFFECTIVE_DATE} | Last updated: {EFFECTIVE_DATE}</p>
            <Separator className="my-6" />
            <div className="grid gap-7">
              {sections.map(section => (
                <section key={section.title}>
                  <h2 className="text-lg font-semibold">{section.title}</h2>
                  <div className="mt-3 grid gap-2">
                    {section.body.map(item => (
                      <p key={item} className="text-sm leading-7 text-muted-foreground">{item}</p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
