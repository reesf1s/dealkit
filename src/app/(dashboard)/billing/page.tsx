import { redirect } from 'next/navigation'

export default function BillingSettingsRedirect() {
  redirect('/settings?section=billing')
}
