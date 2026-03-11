import Stripe from 'stripe'

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Missing environment variable: STRIPE_SECRET_KEY')
  return new Stripe(key, {
    apiVersion: '2026-02-25.clover',
    appInfo: {
      name: 'DealKit',
      url: process.env.NEXT_PUBLIC_APP_URL,
    },
  })
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return getStripe()[prop as keyof Stripe]
  },
})
