// ============================================================
// Asset tiers — one slot per subject, filled in as art arrives
// ============================================================
//
// Corky is authored in Blender, and the only thing the app can rely on today
// is a baked still. Richer art lands at different times for different subjects:
// a frame sequence before a video, a video for one moment and not another. So
// every subject declares a slot rather than a file, and the renderer picks the
// richest tier that slot actually has.
//
// The `model` tier is declared and deliberately never selected. The decision
// was to ship pre-rendered art and keep a named place for a runtime GLB, so
// that adding one later is a renderer change rather than a data migration.
// Nothing loads it yet, and `resolveAsset` says so out loud.

/** Richest first. `still` is last because it is the guaranteed fallback. */
export const TIER_ORDER = ['model', 'video', 'frames', 'still'] as const

export type AssetTierName = (typeof TIER_ORDER)[number]

/** Tiers a renderer exists for. Anything above this is data-only. */
export const RENDERABLE_TIERS = ['video', 'frames', 'still'] as const

export type RenderableTierName = (typeof RENDERABLE_TIERS)[number]

export interface FrameSequence {
  /** In playback order. A single entry is legal and behaves like a still. */
  readonly urls: readonly string[]
  readonly fps: number
  readonly loop: boolean
}

export interface AssetSlot {
  /**
   * Always present. Reduced motion, a failed decode and an unfinished art pass
   * all land here, so a slot without one is a bug rather than a degraded state.
   */
  readonly still: string
  /** Describes the subject, not the file. Read aloud by screen readers. */
  readonly alt: string
  readonly frames?: FrameSequence
  readonly video?: string
  /** Reserved for a future runtime GLB. No renderer consumes it. */
  readonly model?: string
}

export interface AssetPreference {
  /**
   * When true the still wins outright. This is not a quality setting: someone
   * who asked the system for less motion gets none, whatever else is available.
   */
  readonly reducedMotion: boolean
  /**
   * Never rise above this tier. Lets one surface stay calm (a small avatar in a
   * list) while another plays the full clip, from the same slot.
   */
  readonly ceiling?: RenderableTierName
}

export interface AssetResolution {
  readonly tier: RenderableTierName
  readonly still: string
  readonly alt: string
  readonly frames?: FrameSequence
  readonly video?: string
  /** Why a richer available tier was not used, when one was passed over. */
  readonly heldBack?: 'reduced-motion' | 'ceiling' | 'no-renderer'
}

function rank(tier: RenderableTierName): number {
  return RENDERABLE_TIERS.indexOf(tier)
}

/**
 * Picks the tier a renderer should use for this slot. Pure, so the rules are
 * testable without a DOM, a media element or an animation frame.
 */
export function resolveAsset(
  slot: AssetSlot,
  preference: AssetPreference,
): AssetResolution {
  const base = { still: slot.still, alt: slot.alt } as const

  if (preference.reducedMotion) {
    return { ...base, tier: 'still', heldBack: 'reduced-motion' }
  }

  // A declared model tier is data, not a renderer. Say which one was skipped so
  // this does not read as the slot being empty.
  const skippedModel = slot.model !== undefined

  const ceiling = preference.ceiling ?? 'video'
  const allow = (tier: RenderableTierName): boolean =>
    rank(tier) >= rank(ceiling)

  if (slot.video !== undefined && allow('video')) {
    return { ...base, tier: 'video', video: slot.video }
  }
  if (slot.frames !== undefined && slot.frames.urls.length > 0) {
    if (allow('frames')) {
      return { ...base, tier: 'frames', frames: slot.frames }
    }
    return { ...base, tier: 'still', heldBack: 'ceiling' }
  }
  if (slot.video !== undefined) {
    return { ...base, tier: 'still', heldBack: 'ceiling' }
  }
  return {
    ...base,
    tier: 'still',
    ...(skippedModel ? { heldBack: 'no-renderer' as const } : {}),
  }
}

/** Every file a slot could ask the network for, richest tier first. */
export function assetUrls(slot: AssetSlot): readonly string[] {
  return [
    ...(slot.model === undefined ? [] : [slot.model]),
    ...(slot.video === undefined ? [] : [slot.video]),
    ...(slot.frames?.urls ?? []),
    slot.still,
  ]
}
