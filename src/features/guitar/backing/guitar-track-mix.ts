// Guitar track mix values give every authored score lane one shared dB contract.
// ============================================================

/** The slider floor is an intentional hard mute, not a very quiet finite gain. */
export const GUITAR_TRACK_MIX_MIN_DB = -30
export const GUITAR_TRACK_MIX_MAX_DB = 6
export const GUITAR_TRACK_MIX_DEFAULT_DB = 0
export const GUITAR_TRACK_MIX_MAX_GAIN = 2

/**
 * Keep UI and audio state on one canonical scale. Values at the slider floor
 * are stored as negative infinity so mute survives every later mask/unmask.
 */
export function normalizeGuitarTrackMixDb(value: number): number {
  if (Number.isNaN(value)) return GUITAR_TRACK_MIX_DEFAULT_DB
  if (value <= GUITAR_TRACK_MIX_MIN_DB) return Number.NEGATIVE_INFINITY
  return Math.min(GUITAR_TRACK_MIX_MAX_DB, value)
}

/** Convert a canonical fader value to a bounded Web Audio gain target. */
export function guitarTrackMixDbToGain(value: number): number {
  const db = normalizeGuitarTrackMixDb(value)
  if (db === Number.NEGATIVE_INFINITY) return 0
  return Math.min(GUITAR_TRACK_MIX_MAX_GAIN, Math.max(0, 10 ** (db / 20)))
}

/** Clamp a direct engine gain without interpreting it as a UI slider value. */
export function clampGuitarTrackMixGain(value: number): number {
  if (!Number.isFinite(value)) return value > 0 ? GUITAR_TRACK_MIX_MAX_GAIN : 0
  return Math.min(GUITAR_TRACK_MIX_MAX_GAIN, Math.max(0, value))
}

/**
 * Derive the live gate after an M click from retained mute state, never from
 * the Solo-filtered audible list. Muting the soloed lane also ends Solo in the
 * canonical controller, so the other lanes can return through its reactive
 * full-mix update.
 */
export function guitarTrackAudibleAfterMuteToggle(
  trackId: string,
  mutedTrackIds: readonly string[],
  soloedTrackId: string | null,
): boolean {
  const nextMuted = !mutedTrackIds.includes(trackId)
  const nextSoloed =
    nextMuted && soloedTrackId === trackId ? null : soloedTrackId
  return !nextMuted && (nextSoloed === null || nextSoloed === trackId)
}

/** Compact fader readout shared by every mixer surface. */
export function formatGuitarTrackMixDb(value: number): string {
  const db = normalizeGuitarTrackMixDb(value)
  if (db === Number.NEGATIVE_INFINITY) return '−∞ dB'
  const rounded = Math.round(db * 10) / 10
  if (Object.is(rounded, -0) || rounded === 0) return '0 dB'
  return `${rounded > 0 ? '+' : ''}${rounded} dB`
}
