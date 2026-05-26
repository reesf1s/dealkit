import { redirect } from 'next/navigation'

export default function IntegrationsSettingsRedirect() {
  redirect('/settings?section=integrations')
}
