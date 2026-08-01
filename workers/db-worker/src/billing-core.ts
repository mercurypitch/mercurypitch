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
  /** Donations: days of `supporter` entitlement this row grants. */
  entitlementDays?: number | null
  /** Donations: 1 when the Stripe price uses custom_unit_amount. */
  customAmount?: number | null
  /** Donations: JSON array of perk strings. */
  perks?: string | null
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
  /** True when a Stripe price is set AND either the amount is fixed or the
   *  donor picks it on Stripe's page (custom_unit_amount). */
  purchasable: boolean
  /** Donations: the donor names the amount on Stripe's hosted page. */
  customAmount: boolean
  /** Donations: days of `supporter` entitlement granted (null = none). */
  entitlementDays: number | null
  /** Donations: perk bullet list ([] when unset or malformed). */
  perks: string[]
}

export interface PricingResponse {
  currency: string
  tiers: PricingPlanDto[]
  packs: PricingPlanDto[]
  donations: PricingPlanDto[]
}

/** Parse the `perks` JSON column. Bad data is a copy bug, not a reason to 500
 *  the whole pricing endpoint — degrade to no bullets. */
function parsePerks(raw: string | null | undefined): string[] {
  if (raw == null || raw === '') return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((p): p is string => typeof p === 'string')
      : []
  } catch {
    return []
  }
}

/** Shape DB rows into the public pricing DTO. Never leaks stripePriceId;
 *  exposes a `purchasable` flag instead. `amount` NULL passes through so the
 *  client can render "Soon". */
export function mapPricingPlans(rows: PricingRow[]): PricingResponse {
  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder)
  const toDto = (r: PricingRow): PricingPlanDto => {
    const customAmount = r.customAmount === 1
    return {
      id: r.id,
      kind: r.kind,
      label: r.label,
      description: r.description ?? null,
      unit: r.unit ?? null,
      amount: r.amount ?? null,
      currency: r.currency,
      credits: r.credits ?? null,
      badge: r.badge ?? null,
      // A custom-amount row has no `amount` by design — the donor types it on
      // Stripe's page — so requiring one here would make it permanently "Soon".
      purchasable:
        (r.amount != null || customAmount) && (r.stripePriceId ?? '') !== '',
      customAmount,
      entitlementDays: r.entitlementDays ?? null,
      perks: parsePerks(r.perks),
    }
  }
  return {
    currency: sorted[0]?.currency ?? 'eur',
    tiers: sorted.filter((r) => r.kind === 'tier').map(toDto),
    packs: sorted.filter((r) => r.kind === 'pack').map(toDto),
    donations: sorted.filter((r) => r.kind === 'donation').map(toDto),
  }
}

// ── Donations ────────────────────────────────────────────────────────

/** Entitlement length for a "choose your own amount" donation: one block per
 *  DONATION_SCALE_UNIT paid. Fixed tiers ignore this and use their own value. */
const DONATION_SCALE_UNIT = 500 // minor units (EUR 5.00)
const DONATION_SCALE_DAYS = 30
/** Nobody buys a decade of supporter status with one generous donation. */
const DONATION_MAX_DAYS = 365

/** How many days of `supporter` a completed donation grants.
 *
 *  Fixed tiers grant exactly what the row says. A custom-amount row scales with
 *  what was actually paid, floored at the row's own value so a minimum donation
 *  still counts, and capped so a large one stays sane. */
export function donationDays(
  plan: { entitlementDays?: number | null; customAmount?: number | null },
  amountTotalMinor: number | null | undefined,
): number {
  // Metadata from a session created outside handleCheckout can carry a
  // non-numeric entitlementDays; NaN sails past every <= 0 guard and later
  // throws inside toISOString - in the reconciliation sweep that poisoned
  // one event's grant on every run. Unparseable means "grants nothing".
  const rawBase = plan.entitlementDays
  const base = typeof rawBase === 'number' && Number.isFinite(rawBase) ? rawBase : 0
  if (plan.customAmount !== 1) return Math.max(0, base)
  const paid =
    typeof amountTotalMinor === 'number' && Number.isFinite(amountTotalMinor)
      ? amountTotalMinor
      : 0
  const scaled =
    Math.floor(paid / DONATION_SCALE_UNIT) * DONATION_SCALE_DAYS
  return Math.min(DONATION_MAX_DAYS, Math.max(base, scaled))
}

/** A fixed-price donation tier, for level resolution. */
export interface DonationTier {
  id: string
  amount: number | null
}

/** Which supporter level an amount earns.
 *
 *  Fixed tiers resolve to themselves; a custom amount reaches the highest tier
 *  it covers, so EUR 59 lands on Voice rather than a nameless "custom" badge.
 *  Below the cheapest tier it still counts — a donation is a thank-you, not a
 *  purchase — so it floors at the lowest tier rather than resolving to nothing.
 *  Null only when no priced tier exists at all. */
export function supporterLevel(
  tiers: DonationTier[],
  amountPaidMinor: number | null | undefined,
): string | null {
  const priced = tiers
    .filter((t): t is { id: string; amount: number } => t.amount != null)
    .sort((a, b) => b.amount - a.amount)
  if (priced.length === 0) return null
  const paid =
    typeof amountPaidMinor === 'number' && Number.isFinite(amountPaidMinor)
      ? amountPaidMinor
      : 0
  return (priced.find((t) => paid >= t.amount) ?? priced[priced.length - 1]).id
}

/** Keep the better of two levels when donations stack.
 *
 *  Donating EUR 5 after EUR 59 must not demote a Voice supporter to Fund — the
 *  badge reflects the high-water mark for as long as the grant runs. */
export function bestSupporterLevel(
  tiers: DonationTier[],
  a: string | null,
  b: string | null,
): string | null {
  if (a == null) return b
  if (b == null) return a
  const rank = (id: string): number =>
    tiers.find((t) => t.id === id)?.amount ?? -1
  return rank(a) >= rank(b) ? a : b
}

/** The planId embedded in an entitlement's `source` (`donation:<planId>`). */
export function sourcePlanId(source: string | null | undefined): string | null {
  if (source == null || !source.startsWith('donation:')) return null
  const id = source.slice('donation:'.length)
  return id === '' ? null : id
}

/** New `supporter` expiry after a donation.
 *
 *  Stacks: a second donation while the first is still live ADDS its days on top
 *  rather than resetting the clock. An expired (or absent) grant restarts from
 *  now, so lapsed supporters aren't credited for the gap. */
export function extendSupporterExpiry(
  existingIso: string | null | undefined,
  nowIso: string,
  days: number,
): string {
  const now = Date.parse(nowIso)
  const existing =
    existingIso != null && existingIso !== '' ? Date.parse(existingIso) : NaN
  const from = Number.isFinite(existing) && existing > now ? existing : now
  return new Date(from + days * 24 * 60 * 60 * 1000).toISOString()
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
