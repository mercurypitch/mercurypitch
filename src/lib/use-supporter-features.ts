// ============================================================
// useSupporterFeatures — server-held feature perks, as a reactive read
// ============================================================
//
// The Worker is the only authority on feature unlocks (see LabPage). This
// wraps the same fetch-and-verify pattern for surfaces that only need to ask
// "does the signed-in user hold this perk?" — a link that appears for a
// supporter group, not a gate that loads restricted code. Callers get `false`
// while the request is in flight or when it fails, so a perk-gated control
// simply stays hidden for everyone else.

import { createResource } from 'solid-js'
import { authVersion } from '@/db/services/user-service'
import type { PerksMe } from '@/lib/backgrounds/background-access'
import { fetchPerksMe, hasSupporterFeatureAccess, } from '@/lib/backgrounds/background-access'
import type { SupporterFeaturePerkId } from '@/lib/supporter-feature-catalog'

export interface SupporterFeatures {
  /** The raw perks payload, or null while loading / signed out / offline. */
  perks: () => PerksMe | null
  hasFeature: (featureId: SupporterFeaturePerkId) => boolean
}

/** Must be called under a component (it owns a resource). */
export function useSupporterFeatures(): SupporterFeatures {
  const authKey = (): string => `auth:${authVersion()}`
  const [access] = createResource(
    authKey,
    async (
      requestedAuthKey,
    ): Promise<{ authKey: string; perks: PerksMe | null }> => ({
      authKey: requestedAuthKey,
      perks: await fetchPerksMe(),
    }),
  )
  // A response for a previous identity must never leak across a sign-in or
  // sign-out, so a stale payload reads as "no perks" until the refetch lands.
  const perks = (): PerksMe | null => {
    const resolved = access()
    return resolved?.authKey === authKey() ? resolved.perks : null
  }
  return {
    perks,
    hasFeature: (featureId) => hasSupporterFeatureAccess(perks(), featureId),
  }
}
