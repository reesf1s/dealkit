import { redirect } from 'next/navigation'

export default function ImportsSettingsRedirect() {
  redirect('/settings?section=imports')
}
