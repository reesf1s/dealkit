import { redirect } from 'next/navigation'

export default function MembersSettingsRedirect() {
  redirect('/settings?section=members')
}
