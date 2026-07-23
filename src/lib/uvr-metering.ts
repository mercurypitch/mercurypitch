// ============================================================
// UVR metering — debit/refund credits around RunPod job dispatch
// ============================================================
// The main worker talks to the db-worker's /api/billing endpoints when a
// server-side separation runs: debit when a job is accepted, refund when it
// fails or is cancelled before completing (docs/plans/premium.md "Metering
// paid jobs"). The jobRef is the `rp_<tier>_<id>` session id, so debit and
// refund stay idempotent per job with no session store.
//
// Paid dispatch fails closed: the main worker requires DB_API_URL, admission
// requires an active non-zero tier price, and an accepted RunPod job must debit
// successfully or it is cancelled. Refunds remain best-effort and require
// BILLING_SERVICE_KEY.

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
  /** False when billing cannot authorize the spend. Paid GPU dispatch fails
   *  closed: a billing outage must never degrade into unmetered jobs. */
  allowed: boolean
  status?: number
  error?: string
  required?: number
  balance?: number
  retryAfter?: number
}

async function readMeteringError(
  response: Response,
  fallback: string,
): Promise<Pick<DebitVerdict, 'error' | 'required' | 'balance'>> {
  const body = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >
  const result: Pick<DebitVerdict, 'error' | 'required' | 'balance'> = {
    error: typeof body.error === 'string' ? body.error : fallback,
  }
  if (typeof body.required === 'number') result.required = body.required
  if (typeof body.balance === 'number') result.balance = body.balance
  return result
}

/** Authenticate, rate-limit, and quote a paid job before any RunPod/R2 spend.
 *  Unlike the post-submit debit, this has no jobRef because no job exists yet. */
export async function admitUvrJob(
  cfg: MeteringConfig,
  authorization: string | null,
  tier: RunpodTier,
  model?: string,
): Promise<DebitVerdict> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (authorization !== null && authorization !== '') {
    headers.Authorization = authorization
  }
  try {
    const response = await fetch(`${cfg.baseUrl}/api/billing/uvr-admit`, {
      method: 'POST',
      headers,
      body: JSON.stringify(model !== undefined ? { tier, model } : { tier }),
    })
    if (!response.ok) {
      const error = await readMeteringError(
        response,
        'Server processing protection is unavailable',
      )
      const verdict: DebitVerdict = {
        allowed: false,
        status: response.status,
        ...error,
      }
      const retryAfter = Number(response.headers?.get('Retry-After'))
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        verdict.retryAfter = retryAfter
      }
      return verdict
    }
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >
    const verdict: DebitVerdict = { allowed: true, status: response.status }
    if (typeof body.cost === 'number') verdict.required = body.cost
    if (typeof body.balance === 'number') verdict.balance = body.balance
    return verdict
  } catch (error) {
    console.error('[metering] UVR admission unreachable:', error)
    return {
      allowed: false,
      error: 'Server processing protection is unavailable',
    }
  }
}

/** Debit the tier's credit cost for a job, forwarding the caller's app JWT
 *  (the db-worker resolves the user from it — the debit is user-authorized,
 *  the amount is server-decided). `model` scales the tier's base cost by
 *  the model's credit multiplier (heavier models cost more GPU time); the
 *  multiplier map lives server-side in billing-core. */
export async function debitForJob(
  cfg: MeteringConfig,
  authorization: string | null,
  tier: RunpodTier,
  jobRef: string,
  model?: string,
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
      body: JSON.stringify(
        model !== undefined ? { tier, jobRef, model } : { tier, jobRef },
      ),
    })
    if (!res.ok) {
      const error = await readMeteringError(
        res,
        'Server processing billing is unavailable',
      )
      const verdict: DebitVerdict = {
        allowed: false,
        status: res.status,
        ...error,
      }
      const retryAfter = Number(res.headers?.get('Retry-After'))
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        verdict.retryAfter = retryAfter
      }
      return verdict
    }
    // Log the outcome — the ledger row is the durable audit; this is the
    // tail-time breadcrumb next to the job's other [runpod] lines.
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
    const debited = typeof body.debited === 'number' ? body.debited : 0
    if (debited > 0) {
      console.log(
        `[metering] ${jobRef} debited ${debited} credit(s)${
          typeof body.balance === 'number' ? ` (balance ${body.balance})` : ''
        }${body.duplicate === true ? ' [duplicate]' : ''}`,
      )
    } else {
      console.log(`[metering] ${jobRef} unmetered (tier cost unset)`)
    }
    return { allowed: true, status: res.status }
  } catch (err) {
    console.error(`[metering] ${jobRef} debit unreachable:`, err)
    return {
      allowed: false,
      error: 'Server processing billing is unavailable',
    }
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
      console.error(`[metering] ${jobRef} refund failed:`, res.status)
      return
    }
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
    // Repeated error polls re-call this; only the first refund (not the
    // idempotent duplicates) is worth a line.
    if (
      typeof body.refunded === 'number' &&
      body.refunded > 0 &&
      body.duplicate !== true
    ) {
      console.log(`[metering] ${jobRef} refunded ${body.refunded} credit(s)`)
    }
  } catch (err) {
    console.error(`[metering] ${jobRef} refund unreachable:`, err)
  }
}
