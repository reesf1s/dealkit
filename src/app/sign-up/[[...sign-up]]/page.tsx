import { ClerkLoaded, ClerkLoading, SignUp } from '@clerk/nextjs'
import Link from 'next/link'

import {
  AuthShell,
  AuthWidgetSkeleton,
  authAppearance,
} from '@/components/sme/halvex-system'

export default function SignUpPage() {
  return (
    <AuthShell
      title="Create your workspace"
      description="Set up one sales cockpit for inbox, notes, deals, and AI guidance."
      footer={(
        <>
          Already have an account?{' '}
          <Link href="/sign-in" className="font-medium text-white">
            Sign in
          </Link>
        </>
      )}
    >
      <ClerkLoading>
        <AuthWidgetSkeleton />
      </ClerkLoading>
      <ClerkLoaded>
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          fallbackRedirectUrl="/home"
          appearance={authAppearance}
        />
      </ClerkLoaded>
    </AuthShell>
  )
}
