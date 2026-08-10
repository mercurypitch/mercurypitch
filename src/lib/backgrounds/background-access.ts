// ============================================================
// Background access — server-evidenced cosmetics and safe selection fallbacks
// ============================================================
//
// localStorage remembers only a preferred id. It is never evidence of access:
// every protected selection is re-resolved against fresh server responses.

import type { BillingMe } from '@/db/services/billing-service'
import { fetchBillingMe, supporterEntitlement, } from '@/db/services/billing-service'
import { getAuthHeaders } from '@/db/services/user-service'
import { API_BASE_URL } from '@/lib/defaults'
import type { SupporterFeaturePerkId } from '../supporter-feature-catalog'
import { isSupporterFeaturePerkId } from '../supporter-feature-catalog'
import type { BackgroundDefinition, BackgroundId, BackgroundPerkId, BackgroundSurface, } from './background-catalog'
import { BACKGROUND_CATALOG, DEFAULT_BACKGROUND_IDS, defaultBackground, getBackgroundDefinition, isBackgroundId, isBackgroundPerkId, } from './background-catalog'
import type { BackgroundSelectionStorage as SelectionStorage } from './background-selection'
import { readPersistedBackgroundId } from './background-selection'

export type { BackgroundSelectionStorage } from './background-selection'
export {
  BACKGROUND_SELECTION_KEYS,
  persistBackgroundId,
  readPersistedBackgroundId,
} from './background-selection'

export type AccessVerification = 'verified' | 'unavailable'

export interface BackgroundAccessState {
  supporter: boolean
  explicitPerks: readonly BackgroundPerkId[]
  verification: {
    supporter: AccessVerification
    explicitPerks: AccessVerification
  }
}

export interface PerksMe {
  perks: readonly string[]
  features: readonly SupporterFeaturePerkId[]
}

export const NO_BACKGROUND_ACCESS: BackgroundAccessState = {
  supporter: false,
  explicitPerks: [],
  verification: {
    supporter: 'unavailable',
    explicitPerks: 'unavailable',
  },
}

function apiBase(base?: string): string {
  const resolved = base ?? API_BASE_URL
  return resolved != null && resolved !== '' ? resolved.replace(/\/+$/, '') : ''
}

function normalizeExplicitPerks(
  perks: readonly unknown[],
): readonly BackgroundPerkId[] {
  return [...new Set(perks.filter(isBackgroundPerkId))]
}

function normalizeFeaturePerks(
  features: readonly unknown[],
): readonly SupporterFeaturePerkId[] {
  return [...new Set(features.filter(isSupporterFeaturePerkId))]
}

/** Explicit cosmetic grants from the authenticated worker. */
export async function fetchPerksMe(base?: string): Promise<PerksMe | null> {
  const resolved = apiBase(base)
  if (resolved === '') return null

  try {
    const response = await fetch(`${resolved}/api/perks/me`, {
      headers: getAuthHeaders(),
    })
    if (!response.ok) return null
    const data = (await response.json()) as {
      features?: unknown
      perks?: unknown
    }
    if (!Array.isArray(data.perks)) return null
    return {
      features: Array.isArray(data.features)
        ? normalizeFeaturePerks(data.features)
        : [],
      perks: normalizeExplicitPerks(data.perks),
    }
  } catch {
    return null
  }
}

/** Feature ids are trusted only after the authenticated response is parsed. */
export function hasSupporterFeatureAccess(
  perks: PerksMe | null,
  featureId: SupporterFeaturePerkId,
): boolean {
  return perks?.features.includes(featureId) ?? false
}

/** Build access only from the two authenticated server responses. */
export function deriveBackgroundAccess(
  billing: BillingMe | null,
  perks: PerksMe | null,
  now: number = Date.now(),
): BackgroundAccessState {
  return {
    supporter: supporterEntitlement(billing, now) !== null,
    explicitPerks: normalizeExplicitPerks(perks?.perks ?? []),
    verification: {
      supporter: billing === null ? 'unavailable' : 'verified',
      explicitPerks: perks === null ? 'unavailable' : 'verified',
    },
  }
}

/**
 * Fetch both independent access sources. Either successful response still
 * counts when the other service is unavailable; missing evidence fails closed.
 */
export async function fetchBackgroundAccess(
  base?: string,
  now: number = Date.now(),
): Promise<BackgroundAccessState> {
  const [billing, perks] = await Promise.all([
    fetchBillingMe(base),
    fetchPerksMe(base),
  ])
  return deriveBackgroundAccess(billing, perks, now)
}

export function hasBackgroundEntitlement(
  background: BackgroundDefinition,
  access: BackgroundAccessState,
): boolean {
  if (background.access.kind === 'free') return true
  return (
    access.supporter ||
    access.explicitPerks.includes(background.access.explicitPerkId)
  )
}

/**
 * Resolve a background the current user is allowed to select. Unreleased,
 * unknown, cross-surface, or unentitled ids all collapse to the free default.
 */
export function resolveBackgroundSelection(
  surface: BackgroundSurface,
  requestedId: unknown,
  access: BackgroundAccessState,
): BackgroundDefinition {
  const requested = getBackgroundDefinition(requestedId)
  if (
    requested === null ||
    requested.surface !== surface ||
    requested.delivery !== 'shipped' ||
    !hasBackgroundEntitlement(requested, access)
  ) {
    return defaultBackground(surface)
  }
  return requested
}

/**
 * Validate a host-authorized shared background for a viewer. Viewers do not
 * need their own entitlement: room ownership controls selection, while every
 * participant sees the selected environment. The transport must authenticate
 * the host, and protected delivery must authorize room viewers, before using
 * this viewer-side resolver.
 */
export function resolveSharedBackgroundSelection(
  surface: BackgroundSurface,
  requestedId: unknown,
): BackgroundDefinition {
  const requested = getBackgroundDefinition(requestedId)
  if (
    requested === null ||
    requested.surface !== surface ||
    requested.delivery !== 'shipped'
  ) {
    return defaultBackground(surface)
  }
  return requested
}

export function resolvePersistedBackgroundSelection(
  surface: BackgroundSurface,
  access: BackgroundAccessState,
  storage: SelectionStorage | null | undefined = undefined,
): BackgroundDefinition {
  return resolveBackgroundSelection(
    surface,
    readPersistedBackgroundId(surface, storage),
    access,
  )
}

const FREE_JAM_BACKGROUNDS = BACKGROUND_CATALOG.filter(
  (background) =>
    background.surface === 'jam' &&
    background.delivery === 'shipped' &&
    background.access.kind === 'free',
)

/** Preserve the existing room-id hash so a later protocol migration is stable. */
export function deterministicFreeJamBackground(
  roomId: string | null,
): BackgroundDefinition {
  if (roomId === null) return defaultBackground('jam')
  let hash = 0
  for (let index = 0; index < roomId.length; index++) {
    hash = (hash * 31 + roomId.charCodeAt(index)) >>> 0
  }
  return (
    FREE_JAM_BACKGROUNDS[hash % FREE_JAM_BACKGROUNDS.length] ??
    defaultBackground('jam')
  )
}

/** Narrowing helper for protocol/storage boundaries. */
export function parseBackgroundId(value: unknown): BackgroundId | null {
  return isBackgroundId(value) ? value : null
}

/** Free defaults are exported here for persistence migrations. */
export function defaultBackgroundId(surface: BackgroundSurface): BackgroundId {
  return DEFAULT_BACKGROUND_IDS[surface]
}
