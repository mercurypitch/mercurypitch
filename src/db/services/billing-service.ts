// ============================================================
// Billing service — client for the db-worker /api/billing/* endpoints
// ============================================================
// Mirrors the worker contract (workers/db-worker/src/billing.ts). Pricing is
// public; me/checkout/portal are auth'd with the app JWT. All functions take
// an optional `base` (defaults to API_BASE_URL) so the fetch paths are
// unit-testable even though tests run with VITE_API_BASE_URL unset.

import { getAuthHeaders } from '@/db/services/user-service'
import { trackEvent } from '@/lib/analytics'
import { API_BASE_URL } from '@/lib/defaults'
// Pure, dependency-free worker module — the single source of truth for the
// per-model credit multipliers (also used by the db-worker's debit/pricing).
import { UVR_MODEL_CREDIT_MULTIPLIERS } from '../../../workers/db-worker/src/billing-core'

export interface PricingPlan {
  id: string
  kind: string
  label: string
  description: string | null
  unit: string | null
  /** Minor units (e.g. cents); null = price not set ("Soon"). */
  amount: number | null
  currency: string
  credits: number | null
  badge: string | null
  purchasable: boolean
}

export interface Pricing {
  currency: string
  tiers: PricingPlan[]
  packs: PricingPlan[]
  /** Per-song credit cost by server model (registry names: roformer, mdx,
   *  karaoke, ensemble) — tier base cost × the model's multiplier. Absent
   *  on an older db-worker. */
  uvrModelCredits?: Record<string, number>
  stripeConfigured: boolean
}

export interface BillingMe {
  creditBalance: number
  entitlements: Array<{
    feature: string
    source: string | null
    expiresAt: string | null
  }>
  stripeConfigured: boolean
}

function apiBase(base?: string): string {
  const b = base ?? API_BASE_URL
  return b != null && b !== '' ? b.replace(/\/+$/, '') : ''
}

/** Public pricing. Returns null when no cloud API is configured. */
export async function fetchPricing(base?: string): Promise<Pricing | null> {
  const b = apiBase(base)
  if (b === '') return null
  const res = await fetch(`${b}/api/billing/pricing`)
  if (!res.ok) throw new Error(`Failed to load pricing: ${res.statusText}`)
  return withModelCredits((await res.json()) as Pricing)
}

/** Fill in `uvrModelCredits` when the backend predates it (a db-worker not
 *  yet redeployed): derive it from the GPU tier's base credits × the shared
 *  multiplier map — the exact computation the new backend performs, from
 *  the same imported constants, so the values can't drift. The tier base
 *  itself still always comes from the server. */
export function withModelCredits(pricing: Pricing): Pricing {
  if (pricing.uvrModelCredits !== undefined) return pricing
  const gpuBase =
    pricing.tiers.find((t) => t.id === 'tier-runpod-gpu')?.credits ?? 0
  const uvrModelCredits: Record<string, number> = {}
  for (const [model, mult] of Object.entries(UVR_MODEL_CREDIT_MULTIPLIERS)) {
    uvrModelCredits[model] = gpuBase * mult
  }
  return { ...pricing, uvrModelCredits }
}

/** Signed-in user's credit balance + entitlements. Null when no API / unreachable. */
export async function fetchBillingMe(base?: string): Promise<BillingMe | null> {
  const b = apiBase(base)
  if (b === '') return null
  try {
    const res = await fetch(`${b}/api/billing/me`, {
      headers: getAuthHeaders(),
    })
    if (!res.ok) return null
    return (await res.json()) as BillingMe
  } catch {
    // Backend unreachable — degrade to "no billing info" instead of throwing.
    return null
  }
}

// ── Expected-credits stash (checkout → success-return round trip) ────
// Written just before redirecting to Stripe, read back on /billing/success.
// Knowing the exact balance to expect is what lets the return page VERIFY the
// webhook grant landed instead of just hoping (2026-07: webhooks silently
// died for 10 days and buyers saw a success toast over an unchanged balance).
// sessionStorage survives the same-tab redirect, like the ads stash in
// consent.ts.

const PENDING_CREDITS_KEY = 'pitchperfect_pending_credits'
/** Ignore stashes older than this — an abandoned checkout must not make some
 *  unrelated future return wait for credits that were never bought. */
const PENDING_CREDITS_TTL_MS = 2 * 60 * 60 * 1000

interface PendingCredits {
  expectedMin: number
  ts: number
}

/** Remember the balance the account should reach once the purchase lands. */
export function stashExpectedCredits(
  balanceBefore: number,
  credits: number,
): void {
  try {
    const record: PendingCredits = {
      expectedMin: balanceBefore + credits,
      ts: Date.now(),
    }
    sessionStorage.setItem(PENDING_CREDITS_KEY, JSON.stringify(record))
  } catch {
    // No storage — the return page falls back to blind refreshes.
  }
}

/** One-shot read of the expected post-purchase balance (clears the stash).
 *  Null when absent, expired, or malformed. */
export function takeExpectedCredits(): number | null {
  try {
    const raw = sessionStorage.getItem(PENDING_CREDITS_KEY)
    if (raw == null || raw === '') return null
    sessionStorage.removeItem(PENDING_CREDITS_KEY)
    const stash = JSON.parse(raw) as PendingCredits
    if (
      typeof stash.ts !== 'number' ||
      Date.now() - stash.ts > PENDING_CREDITS_TTL_MS
    ) {
      return null
    }
    return typeof stash.expectedMin === 'number' &&
      Number.isFinite(stash.expectedMin) &&
      stash.expectedMin > 0
      ? stash.expectedMin
      : null
  } catch {
    return null
  }
}

/** Start checkout for a pack; returns the Stripe-hosted URL to redirect to. */
export async function startCheckout(
  planId: string,
  base?: string,
): Promise<string> {
  const b = apiBase(base)
  if (b === '') throw new Error('Billing is not available in this build')
  const res = await fetch(`${b}/api/billing/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ planId }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    url?: string
    error?: string
  }
  if (!res.ok || data.url == null || data.url === '') {
    throw new Error(data.error ?? `Checkout failed: ${res.statusText}`)
  }
  trackEvent('checkout_start')
  return data.url
}

/** Open the Stripe Customer Portal; returns the URL to redirect to. */
export async function openBillingPortal(base?: string): Promise<string> {
  const b = apiBase(base)
  if (b === '') throw new Error('Billing is not available in this build')
  const res = await fetch(`${b}/api/billing/portal`, {
    headers: getAuthHeaders(),
  })
  const data = (await res.json().catch(() => ({}))) as {
    url?: string
    error?: string
  }
  if (!res.ok || data.url == null || data.url === '') {
    throw new Error(data.error ?? `Could not open portal: ${res.statusText}`)
  }
  return data.url
}

/** Render a price: null → "Soon", 0 → "Free", else a localized currency. */
export function formatPrice(amount: number | null, currency: string): string {
  if (amount == null) return 'Soon'
  if (amount === 0) return 'Free'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100)
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`
  }
}

/** Cost label for a separation tier. Tiers are priced in CREDITS per song,
 *  not money — so a live tier has `amount` NULL but `credits` set, which
 *  formatPrice alone would wrongly render as "Soon". Show the per-song credit
 *  cost instead; fall back to formatPrice for the free tier (amount 0), any
 *  money-priced tier, and a genuinely-unlaunched tier (no amount, no credits →
 *  "Soon"). The unit suffix is rendered separately by the panel. */
export function formatTierPrice(
  plan: Pick<PricingPlan, 'amount' | 'credits' | 'currency'>,
): string {
  if (plan.amount == null && plan.credits != null) {
    return `${plan.credits} credit${plan.credits === 1 ? '' : 's'}`
  }
  return formatPrice(plan.amount, plan.currency)
}

/** A tier is "Soon" only when it has neither a money price nor a credit
 *  cost — i.e. not launched. Metered tiers (credits set) are available. */
export function isTierSoon(
  plan: Pick<PricingPlan, 'amount' | 'credits'>,
): boolean {
  return plan.amount == null && plan.credits == null
}
