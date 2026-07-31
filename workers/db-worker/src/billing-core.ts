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

// ── UVR job metering ─────────────────────────────────────────────────
// A server-side separation debits the tier's per-song credit cost when the
// job is accepted and refunds it if the job fails or is cancelled
// (docs/plans/premium.md "Metering paid jobs"). The cost lives in the
// pricingPlans tier rows' `credits` column — NULL/0 means the tier is not
// metered yet and debits no-op, so the endpoints are safe to wire before
// pricing is decided.

/** pricingPlans row ids carrying each server tier's per-song credit cost. */
export const UVR_TIER_PLAN_IDS = {
  gpu: 'tier-runpod-gpu',
  cpu: 'tier-runpod-cpu',
} as const

export type UvrTier = keyof typeof UVR_TIER_PLAN_IDS

export function isUvrTier(value: unknown): value is UvrTier {
  return value === 'gpu' || value === 'cpu'
}

// ── Per-model pricing ────────────────────────────────────────────────
// The tier row's `credits` is the BASE per-song cost; models multiply it.
// Measured 2026-07-06 (same folder, same image): RoFormer is CHEAPER and
// faster than MDX on the GPU ($0.0054 vs $0.0064/song), so the single
// server quality (BS-RoFormer) costs the plain base — 1 credit per song.
// Only the two-model ensemble (~2x compute, not user-exposed) carries a
// multiplier. Keep the names in sync with MODEL_REGISTRY
// (runpod/handler.py) and RUNPOD_ALLOWED_MODELS (src/lib/runpod.ts).
//
// The Demucs multi-stem tiers are priced off compute, not stem count:
// `demucs` is one model pass, `demucs-6s` one pass over six sources, and
// `demucs-ft` bags FOUR fine-tuned models (~4x). `shifts` (default 2)
// multiplies all three, which is why even the single-model tiers sit
// above the RoFormer base. These are provisional — measure a real song
// with runpod/test_input.json and correct them before launch.
export const UVR_MODEL_CREDIT_MULTIPLIERS = {
  mdx: 1,
  roformer: 1,
  karaoke: 1,
  ensemble: 2,
  demucs: 2,
  'demucs-6s': 2,
  'demucs-ft': 4,
} as const

export type UvrModelName = keyof typeof UVR_MODEL_CREDIT_MULTIPLIERS

/** Legacy job payloads name the MDX weights file directly. */
const UVR_MODEL_ALIASES: Record<string, UvrModelName> = {
  'UVR-MDX-NET-Inst_HQ_3': 'mdx',
  'UVR-MDX-NET-Inst_HQ_3.onnx': 'mdx',
}

/** Song length included in the base price. Mirrors the RunPod handler's
 *  UVR_MAX_INPUT_MINUTES default — with a declared duration the handler
 *  cap is raised and length is priced instead of rejected. */
export const UVR_BASE_MINUTES = 12
/** Each STARTED block of this many minutes past the base adds one extra
 *  multiple of the model cost (an 18.0-min song costs 2×). */
export const UVR_SURCHARGE_BLOCK_MINUTES = 6

/** Length multiplier: 1 within the base window, +1 per started surcharge
 *  block past it. Unknown/absent duration charges the base — the handler
 *  independently probes the real length and rejects a job whose actual
 *  billing factor exceeds the declared one, so under-declaring cannot buy
 *  a cheap long job. */
export function uvrLengthFactor(durationSeconds?: number): number {
  if (
    durationSeconds === undefined ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return 1
  }
  const overage = durationSeconds - UVR_BASE_MINUTES * 60
  if (overage <= 0) return 1
  return 1 + Math.ceil(overage / (UVR_SURCHARGE_BLOCK_MINUTES * 60))
}

/** Credit cost of one job: tier base × the model's multiplier × the length
 *  factor. Absent or unknown models charge the base — an older main worker
 *  that doesn't send a model is running the old MDX default, and pricing
 *  must never turn a version skew into a refused job. */
export function uvrJobCost(
  tierCredits: number,
  model?: string,
  durationSeconds?: number,
): number {
  const modelCost =
    model === undefined || model === ''
      ? tierCredits
      : tierCredits *
        ((UVR_MODEL_CREDIT_MULTIPLIERS as Record<string, number>)[
          UVR_MODEL_ALIASES[model] ?? model
        ] ?? 1)
  return modelCost * uvrLengthFactor(durationSeconds)
}

/** Absolute per-model credit costs for the pricing endpoint (UI display),
 *  derived from the GPU tier's base cost. */
export function uvrModelCredits(
  tierCredits: number,
): Record<UvrModelName, number> {
  // Derived from the multiplier map rather than hand-listed, so a new
  // registry model is priced by adding one line above and nothing here.
  const entries = Object.entries(UVR_MODEL_CREDIT_MULTIPLIERS) as [
    UvrModelName,
    number,
  ][]
  return Object.fromEntries(
    entries.map(([model, mult]) => [model, tierCredits * mult]),
  ) as Record<UvrModelName, number>
}

/** Job refs are worker-issued session ids (`rp_<tier>_<runpodJobId>`); keep
 *  the charset tight so ledger idempotency keys stay clean. */
const JOB_REF_RE = /^[A-Za-z0-9_-]{1,200}$/

export function isValidJobRef(value: unknown): value is string {
  return typeof value === 'string' && JOB_REF_RE.test(value)
}

/** Ledger idempotency key tying a job's debit to its jobRef — a retried
 *  debit for the same job is dropped by the UNIQUE constraint. */
export function uvrDebitKey(jobRef: string): string {
  return `uvr:${jobRef}`
}

/** Idempotency key for the (at most one) refund of a job's debit. */
export function uvrRefundKey(jobRef: string): string {
  return `uvr-refund:${jobRef}`
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
