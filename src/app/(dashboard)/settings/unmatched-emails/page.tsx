import { redirect } from 'next/navigation'

export default function UnmatchedEmailsRedirect() {
  redirect('/inbox')
}
