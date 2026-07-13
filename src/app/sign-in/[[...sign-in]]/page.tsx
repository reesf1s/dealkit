import { ClerkLoaded, ClerkLoading, SignIn } from '@clerk/nextjs'
import Link from 'next/link'

import {
  AuthShell,
  AuthWidgetSkeleton,
  authAppearance,
} from '@/components/sme/halvex-system'

export default function SignInPage() {
  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to your revenue workspace."
      footer={(
        <>
          New to Halvex?{' '}
          <Link href="/sign-up" className="font-medium text-white">
            Create a workspace
          </Link>
        </>
      )}
    >
      <ClerkLoading>
        <AuthWidgetSkeleton />
      </ClerkLoading>
      <ClerkLoaded>
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/home"
          appearance={authAppearance}
        />
      </ClerkLoaded>
    </AuthShell>
  )
}
