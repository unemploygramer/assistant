import Stripe from 'stripe'

const secretKey = process.env.STRIPE_SECRET_KEY ?? ''

export const stripe =
  secretKey.length > 0
    ? new Stripe(secretKey, { apiVersion: '2023-10-16' })
    : (null as unknown as Stripe)

export const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRICE_ID_MONTHLY ?? process.env.STRIPE_PRO_PRICE_ID ?? ''

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && STRIPE_PRO_PRICE_ID.length > 0
}
