// ── Billing core: pure, dependency-free helpers ──────────────────────
// No D1 / auth / Env imports, so this is importable by the frontend test
// suite (src/tests/billing-core.test.ts) as well as the worker. Anything
// that touches the database lives in billing.ts.

const enc = new TextEncoder()

/** Constant-time string compare (avoids leaking how many bytes matched). */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = enc.encode(a)
  const bb = enc.encode(b)
  let diff = ab.length ^ bb.length
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ (bb[i] ?? 0)
  return diff === 0
}

// ── Pricing ──────────────────────────────────────────────────────────

export interface PricingRow {
  id: string
  kind: string
  label: string
  description: string | null
  unit: string | null
  amount: number | null
  currency: string
  credits: number | null
  stripePriceId: string | null
  badge: string | null
  sortOrder: number
}

export interface PricingPlanDto {
  id: string
  kind: string
  label: string
  description: string | null
  unit: string | null
  amount: number | null
  currency: string
  credits: number | null
  badge: string | null
  /** True only when an amount AND a Stripe price are set — i.e. buyable. */
  purchasable: boolean
}

export interface PricingResponse {
  currency: string
  tiers: PricingPlanDto[]
  packs: PricingPlanDto[]
}

/** Shape DB rows into the public pricing DTO. Never leaks stripePriceId;
 *  exposes a `purchasable` flag instead. `amount` NULL passes through so the
 *  client can render "Soon". */
export function mapPricingPlans(rows: PricingRow[]): PricingResponse {
  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder)
  const toDto = (r: PricingRow): PricingPlanDto => ({
    id: r.id,
    kind: r.kind,
    label: r.label,
    description: r.description ?? null,
    unit: r.unit ?? null,
    amount: r.amount ?? null,
    currency: r.currency,
    credits: r.credits ?? null,
    badge: r.badge ?? null,
    purchasable: r.amount != null && (r.stripePriceId ?? '') !== '',
  })
  return {
    currency: sorted[0]?.currency ?? 'eur',
    tiers: sorted.filter((r) => r.kind === 'tier').map(toDto),
    packs: sorted.filter((r) => r.kind === 'pack').map(toDto),
  }
}

/** Credit balance = sum of ledger deltas (grants positive, debits negative). */
export function creditBalance(rows: { delta: number }[]): number {
  return rows.reduce((sum, r) => sum + (r.delta ?? 0), 0)
}

// ── Stripe webhook signature ─────────────────────────────────────────

const WEBHOOK_TOLERANCE_SEC = 300

async function hmacSha256Hex(key: string, data: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data))
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Verify a Stripe webhook signature (the `Stripe-Signature` header, scheme
 * `t=<ts>,v1=<hex>[,v1=<hex>...]`). Recomputes HMAC-SHA256 of `${t}.${payload}`
 * over the RAW body and constant-time compares. `nowSec`, when given, enforces
 * the replay-tolerance window.
 */
export async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
  nowSec?: number,
): Promise<boolean> {
  let t = ''
  const v1s: string[] = []
  for (const part of sigHeader.split(',')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const k = part.slice(0, eq).trim()
    const v = part.slice(eq + 1).trim()
    if (k === 't') t = v
    else if (k === 'v1') v1s.push(v)
  }
  if (t === '' || v1s.length === 0) return false
  if (nowSec !== undefined) {
    const ts = Number(t)
    if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > WEBHOOK_TOLERANCE_SEC) {
      return false
    }
  }
  const expected = await hmacSha256Hex(secret, `${t}.${payload}`)
  return v1s.some(
    (v) => v.length === expected.length && timingSafeEqualStr(v, expected),
  )
}
