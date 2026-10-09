// ============================================================
// stripe-api — Stripe's REST API, form-encoded, no SDK
// ============================================================
//
// Moved out of billing.ts when the withdrawal (withdrawal.ts) needed to ask
// Stripe for a refund too. The answer is never thrown: a caller reads `ok`
// and `status`, and `data` is whatever JSON came back, or {}.

import type { Env } from './auth'

export const STRIPE_API = 'https://api.stripe.com/v1'

export interface StripeAnswer {
  ok: boolean
  status: number
  data: Record<string, unknown>
}

export function isStripeConfigured(env: Env): boolean {
  return env.STRIPE_SECRET_KEY != null && env.STRIPE_SECRET_KEY !== ''
}

/**
 * POST to Stripe. `idempotencyKey` makes Stripe answer a repeat of the same
 * request, within 24 hours, with the first one's result instead of doing it
 * twice: what keeps a retried refund from paying out twice.
 */
export async function stripeRequest(
  env: Env,
  path: string,
  params: Record<string, string>,
  idempotencyKey?: string,
): Promise<StripeAnswer> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY as string}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(idempotencyKey === undefined
        ? {}
        : { 'Idempotency-Key': idempotencyKey }),
    },
    body: new URLSearchParams(params),
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { ok: res.ok, status: res.status, data }
}

export async function stripeGet(
  env: Env,
  pathWithQuery: string,
): Promise<StripeAnswer> {
  const res = await fetch(`${STRIPE_API}${pathWithQuery}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY as string}` },
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { ok: res.ok, status: res.status, data }
}
