// ============================================================
// UVR metering — debit/refund credits around RunPod job dispatch
// ============================================================
// The main worker talks to the db-worker's /api/billing endpoints when a
// server-side separation runs: debit when a job is accepted, refund when it
// fails or is cancelled before completing (docs/plans/premium.md "Metering
// paid jobs"). The jobRef is the `rp_<tier>_<id>` session id, so debit and
// refund stay idempotent per job with no session store.
//
// Dormant by default, in layers: without DB_API_URL there is no metering at
// all; with it, debits still no-op while a tier's credit cost is unset in
// pricingPlans; and refunds are skipped without BILLING_SERVICE_KEY. So the
// env can be wired ahead of pricing decisions without changing behavior.

import type { RunpodTier } from './runpod'

/** The subset of worker env this module reads. */
export interface MeteringEnvLike {
  DB_API_URL?: string
  BILLING_SERVICE_KEY?: string
}

export interface MeteringConfig {
  /** db-worker base URL (no trailing slash). */
  baseUrl: string
  /** Authorizes refunds (service-to-service); refunds no-op without it. */
  serviceKey?: string
}

/** Resolve metering config from env, or null when metering is off. */
export function getMeteringConfig(env: MeteringEnvLike): MeteringConfig | null {
  const base = env.DB_API_URL
  if (base === undefined || base === '') return null
  const cfg: MeteringConfig = { baseUrl: base.replace(/\/+$/, '') }
  if (env.BILLING_SERVICE_KEY !== undefined && env.BILLING_SERVICE_KEY !== '') {
    cfg.serviceKey = env.BILLING_SERVICE_KEY
  }
  return cfg
}

export interface DebitVerdict {
  /** False only when the db-worker explicitly refused (402 insufficient
   *  credits). Transport/server errors fail OPEN — a billing outage should
   *  degrade to unmetered jobs, not break separation for paying users. */
  allowed: boolean
  status?: number
  error?: string
  required?: number
  balance?: number
}

/** Debit the tier's credit cost for a job, forwarding the caller's app JWT
 *  (the db-worker resolves the user from it — the debit is user-authorized,
 *  the amount is server-decided). */
export async function debitForJob(
  cfg: MeteringConfig,
  authorization: string | null,
  tier: RunpodTier,
  jobRef: string,
): Promise<DebitVerdict> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (authorization !== null && authorization !== '') {
    headers.Authorization = authorization
  }
  try {
    const res = await fetch(`${cfg.baseUrl}/api/billing/debit`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tier, jobRef }),
    })
    if (res.status === 402) {
      const body = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >
      const verdict: DebitVerdict = {
        allowed: false,
        status: 402,
        error:
          typeof body.error === 'string' ? body.error : 'Insufficient credits',
      }
      if (typeof body.required === 'number') verdict.required = body.required
      if (typeof body.balance === 'number') verdict.balance = body.balance
      return verdict
    }
    if (!res.ok) {
      console.error('[metering] debit failed:', res.status)
    }
    return { allowed: true, status: res.status }
  } catch (err) {
    console.error('[metering] debit unreachable:', err)
    return { allowed: true }
  }
}

/** Refund a failed/cancelled job's debit. Idempotent server-side (at most
 *  one refund per jobRef), so calling it on every error-status poll is safe.
 *  Best-effort: failures are logged, never surfaced to the client. */
export async function refundJob(
  cfg: MeteringConfig,
  jobRef: string,
): Promise<void> {
  if (cfg.serviceKey === undefined) return
  try {
    const res = await fetch(`${cfg.baseUrl}/api/billing/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': cfg.serviceKey,
      },
      body: JSON.stringify({ jobRef }),
    })
    if (!res.ok) {
      console.error('[metering] refund failed:', res.status)
    }
  } catch (err) {
    console.error('[metering] refund unreachable:', err)
  }
}
