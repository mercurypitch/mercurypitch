// ============================================================
// Billing service — client for the db-worker /api/billing/* endpoints
// ============================================================
// Mirrors the worker contract (workers/db-worker/src/billing.ts). Pricing is
// public; me/checkout/portal are auth'd with the app JWT. All functions take
// an optional `base` (defaults to API_BASE_URL) so the fetch paths are
// unit-testable even though tests run with VITE_API_BASE_URL unset.

import { getAuthHeaders } from '@/db/services/user-service'
import { API_BASE_URL } from '@/lib/defaults'

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
  return (await res.json()) as Pricing
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
