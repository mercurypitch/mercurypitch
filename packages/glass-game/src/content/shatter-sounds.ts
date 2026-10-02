// ============================================================
// Glass fracture recordings — five generated families with material-specific panel takes.
// ============================================================

export type GlassShatterFamily =
  | 'wine-glass'
  | 'bowl'
  | 'vase'
  | 'large-panel'
  | 'tall-column'
export interface GlassShatterProfile {
  readonly form: 'goblet' | 'bowl' | 'vase' | 'panel' | 'column'
  readonly size: 'small' | 'medium' | 'large'
  readonly material:
    | 'thin-crystal'
    | 'thick-crystal'
    | 'frosted-glass'
    | 'faceted-crystal'
    | 'laminated-glass'
}

export const DEFAULT_SHATTER_PROFILE: GlassShatterProfile = Object.freeze({
  form: 'goblet',
  size: 'small',
  material: 'thin-crystal',
})
export const SHATTER_SOUND_TAKES = [
  ['wine-glass', '01'],
  ['wine-glass', '02'],
  ['bowl', '01'],
  ['bowl', '02'],
  ['vase', '01'],
  ['vase', '02'],
  ['large-panel', '01'],
  ['large-panel', '02'],
  ['large-panel', '03'],
  ['large-panel', '04'],
  ['large-panel', '05'],
  ['large-panel', '06'],
  ['tall-column', '01'],
  ['tall-column', '02'],
] as const
export const SHATTER_SOUND_ASSET_FILES: Readonly<Record<string, string>> =
  Object.fromEntries(
    SHATTER_SOUND_TAKES.map(([family, variant]) => [
      `audio-shatter-${family}-${variant}`,
      `shatter-sounds-v1/${family}-${variant}.mp3`,
    ]),
  )

export function shatterSoundFamily(
  profile: GlassShatterProfile,
): GlassShatterFamily {
  if (profile.form === 'panel') return 'large-panel'
  if (profile.form === 'column') return 'tall-column'
  if (profile.form === 'bowl') return 'bowl'
  if (profile.form === 'vase') return 'vase'
  return 'wine-glass'
}

/** Physical panel scale and material select recordings, without pitch-shifting one take. */
export function shatterSoundAssetIds(
  profile: GlassShatterProfile,
): readonly string[] {
  const family = shatterSoundFamily(profile)
  const first =
    family !== 'large-panel' ||
    profile.material === 'thin-crystal' ||
    profile.material === 'frosted-glass' ||
    profile.material === 'laminated-glass'
      ? 1
      : profile.size === 'large'
        ? 5
        : 3
  return [first, first + 1].map(
    (index) => `audio-shatter-${family}-${String(index).padStart(2, '0')}`,
  )
}

/** One stable sequence per visit/course; adjacent uses of a pool never repeat a take. */
export function createShatterVariantSelector() {
  const previous = new Map<string, string>()
  return (profile: GlassShatterProfile, identity: string, seed = 0): string => {
    const ids = shatterSoundAssetIds(profile)
    const key = ids.join('|')
    let hash = seed >>> 0
    for (const char of `${identity}:${profile.size}:${profile.material}`)
      hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0
    let id = ids[hash % ids.length]!
    if (id === previous.get(key)) id = ids[(ids.indexOf(id) + 1) % ids.length]!
    previous.set(key, id)
    return id
  }
}

const profile = (
  form: GlassShatterProfile['form'],
  size: GlassShatterProfile['size'],
  material: GlassShatterProfile['material'],
): GlassShatterProfile => Object.freeze({ form, size, material })
/** Explicit acoustic metadata for established authored exhibits, independent from render assets. */
const EXHIBIT_PROFILES: Readonly<Record<string, GlassShatterProfile>> = {
  goblet: DEFAULT_SHATTER_PROFILE,
  coupe: DEFAULT_SHATTER_PROFILE,
  'g01-sunlit-diadem': profile('goblet', 'medium', 'faceted-crystal'),
  'g22-aurora-lotus-bowl': profile('bowl', 'medium', 'thick-crystal'),
  vase: profile('vase', 'medium', 'thin-crystal'),
  fluted: profile('vase', 'medium', 'thin-crystal'),
  amphora: profile('vase', 'medium', 'thin-crystal'),
  decanter: profile('vase', 'medium', 'faceted-crystal'),
  'g14-tidal-wave-carafe': profile('vase', 'medium', 'thin-crystal'),
  'amber-v6': profile('vase', 'medium', 'thick-crystal'),
  'opaline-v6': profile('vase', 'medium', 'thick-crystal'),
  'celadon-lark-decanter-fracture-v4': profile(
    'vase',
    'large',
    'faceted-crystal',
  ),
  'resonance-rosebud-v1': profile('bowl', 'medium', 'thick-crystal'),
  portrait: profile('panel', 'medium', 'thin-crystal'),
  'portrait-awakened-muse': profile('panel', 'medium', 'thin-crystal'),
  'portrait-interval': profile('panel', 'medium', 'thin-crystal'),
  'portrait-wave-keeper': profile('panel', 'medium', 'thin-crystal'),
  'archive-glazing-v5': profile('panel', 'medium', 'laminated-glass'),
  'frosted-scroll-wall': profile('panel', 'large', 'frosted-glass'),
  'frost-gold-arch-breakwall-a': profile('panel', 'large', 'frosted-glass'),
  'cloudway-lab-voice': profile('goblet', 'small', 'thin-crystal'),
}

export function exhibitShatterProfile(target?: {
  readonly variant: string
  readonly soundProfile?: GlassShatterProfile
}): GlassShatterProfile {
  return (
    target?.soundProfile ??
    EXHIBIT_PROFILES[target?.variant ?? ''] ??
    DEFAULT_SHATTER_PROFILE
  )
}
