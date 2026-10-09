// ============================================================
// Billing service — client for the db-worker /api/billing/* endpoints
// ============================================================
// Mirrors the worker contract (workers/db-worker/src/billing.ts). Pricing is
// public; me/checkout/portal are auth'd with the app JWT. All functions take
// an optional `base` (defaults to API_BASE_URL) so the fetch paths are
// unit-testable even though tests run with VITE_API_BASE_URL unset.

import { requireAuth } from '@/db/services/auth-service'
import { getAuthHeaders } from '@/db/services/user-service'
import { trackEvent } from '@/lib/analytics'
import { API_BASE_URL } from '@/lib/defaults'
// Pure, dependency-free worker module — the single source of truth for the
// per-model credit multipliers (also used by the db-worker's debit/pricing).
import { UVR_MODEL_CREDIT_MULTIPLIERS } from '../../../workers/db-worker/src/billing-core'
// The same for the 14-day withdrawal's model and wording.
import type { WithdrawalMode } from '../../../workers/db-worker/src/withdrawal-wording'

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
  /** Donations: the donor names the amount on Stripe's hosted page. */
  customAmount?: boolean
  /** Donations: days of `supporter` entitlement granted. */
  entitlementDays?: number | null
  /** Donations: perk bullet list. */
  perks?: string[]
}

export interface Pricing {
  currency: string
  tiers: PricingPlan[]
  packs: PricingPlan[]
  /** Supporter donation tiers. Absent on an older db-worker. */
  donations?: PricingPlan[]
  /** Per-song credit cost by server model (registry names: roformer, mdx,
   *  karaoke, ensemble) — tier base cost × the model's multiplier. Absent
   *  on an older db-worker. */
  uvrModelCredits?: Record<string, number>
  stripeConfigured: boolean
  /** The 14-day withdrawal model the packs are sold under (WITHDRAWAL_MODE).
   *  Absent on an older db-worker. */
  withdrawal?: { mode: WithdrawalMode; days: number }
}

export interface BillingMe {
  creditBalance: number
  entitlements: Array<{
    feature: string
    source: string | null
    expiresAt: string | null
    /** Display name of the tier in `source` (e.g. "Voice"). Absent on an
     *  older db-worker, or when the source is not a donation. */
    sourceLabel?: string | null
  }>
  redeemedPromos?: string[]
  /** The promo codes this account claimed, with when. Absent on an older
   *  db-worker, and set aside when it does not read as a list of claims. */
  promoClaims?: PromoClaim[]
  stripeConfigured: boolean
  /** The Karaoke room's songs (plan S8 §8): what a subscription grants, and
   *  what is left of the balance it grants into. Absent on an older
   *  db-worker, and set aside when it does not read as one. */
  songs?: BillingSongs
  /** Where the account stands in the launch offer, or null when it has
   *  none. Absent on an older db-worker, and null when it does not read as
   *  one. */
  offer?: LaunchOffer | null
}

/** The launch offer (workers/db-worker/src/offer-rules.ts): use all of the
 *  launch credits by `deadline` and the next pack comes with `bonusCredits`
 *  more. Earned, it does not expire. */
export interface LaunchOffer {
  /** counting: the window is open. unlocked: earned, waiting for a pack.
   *  used: the bonus came with a pack. lapsed: the window closed short. */
  state: 'counting' | 'unlocked' | 'used' | 'lapsed'
  /** Launch credits used so far, never more than `goal`. */
  used: number
  /** The launch credits there are to use. */
  goal: number
  /** The window's last moment, ISO, in UTC. */
  deadline: string
  /** Extra credits on the next pack. */
  bonusCredits: number
}

/** A promo code the account claimed: typed, tapped, or claimed for it when
 *  its email was confirmed (workers/db-worker/src/launch-offer.ts). */
export interface PromoClaim {
  code: string
  credits: number
  /** ISO timestamp of the claim. */
  claimedAt: string
}

export interface BillingSongs {
  /** A Karaoke subscription that has not ended. */
  subscribed: boolean
  /** Songs that can still be separated. */
  left: number
  /** When the next songs arrive, while subscribed. */
  renewsAt: string | null
  /** Songs a month grants. */
  perPeriod: number
  /** The most songs a grant ever tops the balance up to. */
  cap: number
}

type BillingEntitlement = BillingMe['entitlements'][number]

function isSongCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isBillingSongs(value: unknown): value is BillingSongs {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<BillingSongs>
  return (
    typeof candidate.subscribed === 'boolean' &&
    isSongCount(candidate.left) &&
    (candidate.renewsAt === null || typeof candidate.renewsAt === 'string') &&
    isSongCount(candidate.perPeriod) &&
    isSongCount(candidate.cap)
  )
}

/** A songs summary that does not read as one is set aside, and the rest of
 *  /me stands: the web never reads it, and the room falls back to the
 *  balance. */
function withReadableSongs(me: BillingMe): BillingMe {
  if (me.songs === undefined || isBillingSongs(me.songs)) return me
  const { songs: _unreadable, ...rest } = me
  return rest
}

function isPromoClaim(value: unknown): value is PromoClaim {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<PromoClaim>
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.credits === 'number' &&
    Number.isFinite(candidate.credits) &&
    typeof candidate.claimedAt === 'string' &&
    Number.isFinite(Date.parse(candidate.claimedAt))
  )
}

const OFFER_STATES: readonly string[] = [
  'counting',
  'unlocked',
  'used',
  'lapsed',
]

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

export function isLaunchOffer(value: unknown): value is LaunchOffer {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<LaunchOffer>
  return (
    typeof candidate.state === 'string' &&
    OFFER_STATES.includes(candidate.state) &&
    isCount(candidate.used) &&
    isCount(candidate.goal) &&
    candidate.goal > 0 &&
    isCount(candidate.bonusCredits) &&
    typeof candidate.deadline === 'string' &&
    Number.isFinite(Date.parse(candidate.deadline))
  )
}

/** An offer that does not read as one is no offer: nothing is shown. */
function withReadableOffer(me: BillingMe): BillingMe {
  if (me.offer === undefined || me.offer === null) return me
  return isLaunchOffer(me.offer) ? me : { ...me, offer: null }
}

/** Claims that do not read as claims are set aside the same way: the codes
 *  in `redeemedPromos` still say what was claimed, only not when. */
function withReadableClaims(me: BillingMe): BillingMe {
  const claims: unknown = me.promoClaims
  if (claims === undefined) return me
  if (Array.isArray(claims) && claims.every(isPromoClaim)) return me
  const { promoClaims: _unreadable, ...rest } = me
  return rest
}

function isBillingEntitlement(value: unknown): value is BillingEntitlement {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<BillingEntitlement>
  return (
    typeof candidate.feature === 'string' &&
    (candidate.source === null || typeof candidate.source === 'string') &&
    (candidate.expiresAt === null || typeof candidate.expiresAt === 'string') &&
    (candidate.sourceLabel === undefined ||
      candidate.sourceLabel === null ||
      typeof candidate.sourceLabel === 'string')
  )
}

function isBillingMe(value: unknown): value is BillingMe {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<BillingMe>
  return (
    typeof candidate.creditBalance === 'number' &&
    Number.isFinite(candidate.creditBalance) &&
    Array.isArray(candidate.entitlements) &&
    candidate.entitlements.every(isBillingEntitlement) &&
    (candidate.redeemedPromos === undefined ||
      (Array.isArray(candidate.redeemedPromos) &&
        candidate.redeemedPromos.every((p) => typeof p === 'string'))) &&
    typeof candidate.stripeConfigured === 'boolean'
  )
}

function apiBase(base?: string): string {
  const b = base ?? API_BASE_URL
  return b != null && b !== '' ? b.replace(/\/+$/, '') : ''
}

/** Public pricing. Returns null when no cloud API is configured. */
export async function fetchPricing(
  base?: string,
  signal?: AbortSignal,
): Promise<Pricing | null> {
  const b = apiBase(base)
  if (b === '') return null
  const res = await fetch(`${b}/api/billing/pricing`, { signal })
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

/** The live `supporter` grant, or null when absent or lapsed.
 *
 *  A row with `expiresAt` in the past is a donation that ran out — the worker
 *  leaves it in place as history, so the expiry check belongs here. A null
 *  `expiresAt` means "no expiry" (a manual grant); malformed dates fail
 *  closed rather than turning corrupt server data into access. */
export function supporterEntitlement(
  me: BillingMe | null,
  now: number = Date.now(),
): BillingMe['entitlements'][number] | null {
  if (me === null || !Array.isArray(me.entitlements)) return null
  const grant = me.entitlements.find(
    (entry: unknown) =>
      typeof entry === 'object' &&
      entry !== null &&
      (entry as { feature?: unknown }).feature === 'supporter',
  )
  if (!isBillingEntitlement(grant)) return null
  if (grant.expiresAt === null) return grant
  if (grant.expiresAt === '') return null
  const expires = Date.parse(grant.expiresAt)
  if (
    !Number.isFinite(expires) ||
    new Date(expires).toISOString() !== grant.expiresAt
  ) {
    return null
  }
  return expires <= now ? null : grant
}

/** The donation tier id behind a grant (`donation:sup-voice` → `sup-voice`). */
export function supporterPlanId(
  grant: { source?: string | null } | null,
): string | null {
  const source = grant?.source
  if (source == null || !source.startsWith('donation:')) return null
  const id = source.slice('donation:'.length)
  return id === '' ? null : id
}

/** Expiry date for a supporter grant.
 *
 *  The year is included whenever it differs from the current one — a bare
 *  "23 Jul" on a grant that runs into next year reads as if it already
 *  expired. Same-year dates stay short.
 */
export function formatSupporterExpiry(
  iso: string | null,
  now: Date = new Date(),
): string {
  if (iso == null || iso === '') return ''
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return ''
  const date = new Date(ms)
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== now.getFullYear()
      ? { year: 'numeric' }
      : undefined),
  })
}

/** Signed-in user's credit balance + entitlements. Null when no API / unreachable. */
export async function fetchBillingMe(
  base?: string,
  signal?: AbortSignal,
): Promise<BillingMe | null> {
  const b = apiBase(base)
  if (b === '') return null
  try {
    const res = await fetch(`${b}/api/billing/me`, {
      headers: getAuthHeaders(),
      signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as unknown
    return isBillingMe(data)
      ? withReadableOffer(withReadableClaims(withReadableSongs(data)))
      : null
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
  // Buying credits needs somewhere to put them — provision on demand, since
  // identities are no longer minted at startup.
  await requireAuth()
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

/** How long a donation's perks last, in the roundest words that fit.
 *  Months once it divides evenly, so "90 days" reads as "3 months". */
export function formatSupportDuration(days: number | null): string {
  if (days == null || days <= 0) return ''
  if (days % 30 === 0) {
    const months = days / 30
    return `${months} month${months === 1 ? '' : 's'} of perks`
  }
  return `${days} day${days === 1 ? '' : 's'} of perks`
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

/** The code the app offers with one click (GET /api/billing/promo/featured). */
export interface FeaturedPromo {
  code: string
  credits: number
  /** When the offer ends (UTC); null when it has no end. */
  expiresAt: string | null
}

function isFeaturedPromo(value: unknown): value is FeaturedPromo {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<FeaturedPromo>
  return (
    typeof candidate.code === 'string' &&
    candidate.code !== '' &&
    typeof candidate.credits === 'number' &&
    Number.isInteger(candidate.credits) &&
    candidate.credits > 0 &&
    (candidate.expiresAt === null ||
      (typeof candidate.expiresAt === 'string' &&
        Number.isFinite(Date.parse(candidate.expiresAt))))
  )
}

/**
 * The promo the server features, or null: none featured, none open, no API
 * configured, or an answer that does not read as one. Never throws. The
 * offer is an extra; a failed look-up must not break the header that asks.
 */
export async function fetchFeaturedPromo(
  base?: string,
): Promise<FeaturedPromo | null> {
  const b = apiBase(base)
  if (b === '') return null
  try {
    const res = await fetch(`${b}/api/billing/promo/featured`)
    if (!res.ok) return null
    const body = (await res.json()) as { promo?: unknown } | null
    const promo = body?.promo
    return isFeaturedPromo(promo) ? promo : null
  } catch {
    return null
  }
}

export interface RedeemPromoResponse {
  success: boolean
  code: string
  creditsGranted: number
  newBalance: number
}

/** Redeem a promo code for credits. Requires auth with a verified email. */
export async function redeemPromoCode(
  code: string,
  base?: string,
): Promise<RedeemPromoResponse> {
  await requireAuth()
  const authHeaders = getAuthHeaders()
  if (!authHeaders.Authorization) {
    throw new Error('Please sign in to redeem promo codes.')
  }

  const b = apiBase(base)
  const res = await fetch(`${b}/api/billing/promo/redeem`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({ code: code.trim() }),
  })

  if (res.status === 401) {
    throw new Error('Your session has expired. Please log in again.')
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : 'Failed to redeem promo code',
    )
  }

  return {
    success: data.success === true,
    code: typeof data.code === 'string' ? data.code : code.trim().toUpperCase(),
    creditsGranted: Number(data.creditsGranted ?? 0),
    newBalance: Number(data.newBalance ?? 0),
  }
}

// ── The 14-day withdrawal (workers/db-worker/src/withdrawal.ts) ──────

/** What cancelling a pack refunds: the unused paid credits' share of the
 *  price, or the whole price for a pack with no consent on record. */
export type RefundBasis = 'unused' | 'full'

/** A pack that can still be cancelled, under the terms its checkout
 *  recorded. */
export interface CancellablePack {
  /** Names the purchase in a withdrawal statement. */
  purchaseId: string
  packLabel: string
  purchasedAt: string
  /** The last day to cancel, as the buyer is told it: YYYY-MM-DD. */
  deadline: string
  basis: RefundBasis
  paidCredits: number
  unusedCredits: number
  /** The pack's unused bonus credits, which leave with it. */
  bonusCredits: number
  /** What cancelling refunds, or null when the price is not on record. */
  refund: { amountMinor: number; currency: string } | null
}

/** A withdrawal statement, as the worker recorded it. */
export interface WithdrawalStatement {
  id: string
  purchaseId: string
  packLabel: string
  submittedAt: string
  /** Where the acknowledgement goes. */
  email: string
  unusedCredits: number
  bonusCredits: number
  basis: RefundBasis
  /** Null while the price paid is not known: Stripe has not answered yet,
   *  or the owner refunds by hand. */
  refundMinor: number | null
  currency: string
  refundStatus: 'pending' | 'refunded' | 'failed' | 'manual' | 'none'
  /** The acknowledgement mail: 'sent' once it went, else on its way or
   *  failed so far. */
  mailStatus: string | null
}

export interface Withdrawals {
  mode: WithdrawalMode
  /** The account's email, to prefill the form. */
  email: string | null
  packs: CancellablePack[]
  statements: WithdrawalStatement[]
}

/** The packs this account can still cancel. Null when there is no cloud API
 *  or no signed-in account. */
export async function fetchWithdrawals(
  base?: string,
  signal?: AbortSignal,
): Promise<Withdrawals | null> {
  const b = apiBase(base)
  const headers = getAuthHeaders()
  if (b === '' || !headers.Authorization) return null
  const res = await fetch(`${b}/api/billing/withdrawals`, { headers, signal })
  if (res.status === 401) return null
  if (!res.ok) throw new Error(`Failed to load your purchases: ${res.status}`)
  return (await res.json()) as Withdrawals
}

export interface WithdrawalRequest {
  purchaseId: string
  name: string
  email: string
}

/** Send the withdrawal statement for one pack. The worker answers a second
 *  statement for the same pack with the first (`duplicate`). */
export async function submitWithdrawal(
  request: WithdrawalRequest,
  base?: string,
): Promise<{ duplicate: boolean; statement: WithdrawalStatement }> {
  const headers = getAuthHeaders()
  if (!headers.Authorization) {
    throw new Error('Sign in to cancel a purchase.')
  }
  const res = await fetch(`${apiBase(base)}/api/billing/withdrawals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(request),
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : "We couldn't send your cancellation. Try again, or reply to your purchase email.",
    )
  }
  return {
    duplicate: data.duplicate === true,
    statement: data.statement as WithdrawalStatement,
  }
}
