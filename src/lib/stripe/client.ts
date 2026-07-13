import Stripe from 'stripe'

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) throw new Error('Missing environment variable: STRIPE_SECRET_KEY')
  return new Stripe(key, {
    apiVersion: '2026-02-25.clover',
    appInfo: {
      name: 'Halvex',
      url: process.env.NEXT_PUBLIC_APP_URL?.trim(),
    },
  })
}
