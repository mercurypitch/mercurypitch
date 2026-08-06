// ============================================================
// Karaoke stage transparency — one preference for every Karaoke stage
// ============================================================
//
// The standalone stage and the in-app Stem Mixer deliberately share this
// preference, so moving between them does not unexpectedly reset the glass.

export const KARAOKE_STAGE_ALPHA = {
  storageKey: 'pitchperfect_kn_stage_alpha',
  defaultValue: 0.45,
  min: 0.05,
  max: 1,
  step: 0.02,
} as const

interface StageAlphaStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

function browserStorage(): StageAlphaStorage | null {
  try {
    return localStorage
  } catch {
    return null
  }
}

export function loadKaraokeStageAlpha(
  storage: StageAlphaStorage | null = browserStorage(),
): number {
  try {
    const value = Number(storage?.getItem(KARAOKE_STAGE_ALPHA.storageKey))
    if (
      Number.isFinite(value) &&
      value >= KARAOKE_STAGE_ALPHA.min &&
      value <= KARAOKE_STAGE_ALPHA.max
    ) {
      return value
    }
  } catch {
    /* localStorage unavailable */
  }
  return KARAOKE_STAGE_ALPHA.defaultValue
}

export function persistKaraokeStageAlpha(
  value: number,
  storage: StageAlphaStorage | null = browserStorage(),
): number {
  const normalized = Number.isFinite(value)
    ? Math.min(
        KARAOKE_STAGE_ALPHA.max,
        Math.max(KARAOKE_STAGE_ALPHA.min, value),
      )
    : KARAOKE_STAGE_ALPHA.defaultValue
  try {
    storage?.setItem(KARAOKE_STAGE_ALPHA.storageKey, String(normalized))
  } catch {
    /* localStorage unavailable */
  }
  return normalized
}
