// ============================================================
// Supporter feature catalog — server-authorized early-access perks
// ============================================================
//
// Feature ids cross the Admin Studio, D1, API and app route boundary. Keep the
// allowlist here so a typo or unknown database row can never unlock a surface.

export const SUPPORTER_FEATURE_PERKS = [
  {
    id: 'lab-access',
    label: 'MercuryPitch Lab',
    description:
      'Early access to experimental audio tools and development previews.',
  },
] as const

export type SupporterFeaturePerk = (typeof SUPPORTER_FEATURE_PERKS)[number]
export type SupporterFeaturePerkId = SupporterFeaturePerk['id']

export const SUPPORTER_FEATURE_PERK_IDS = SUPPORTER_FEATURE_PERKS.map(
  (perk) => perk.id,
) as readonly SupporterFeaturePerkId[]

export function isSupporterFeaturePerkId(
  value: unknown,
): value is SupporterFeaturePerkId {
  return (
    typeof value === 'string' &&
    (SUPPORTER_FEATURE_PERK_IDS as readonly string[]).includes(value)
  )
}

export function getSupporterFeaturePerk(
  id: unknown,
): SupporterFeaturePerk | null {
  if (!isSupporterFeaturePerkId(id)) return null
  return SUPPORTER_FEATURE_PERKS.find((perk) => perk.id === id) ?? null
}
