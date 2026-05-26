import { redirect } from 'next/navigation'

export default function WorkspaceSettingsRedirect() {
  redirect('/settings?section=workspace')
}
