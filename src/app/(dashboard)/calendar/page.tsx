import { redirect } from 'next/navigation'

export default function CalendarRedirect() {
  redirect('/settings?section=integrations')
}
