// ============================================================
// Studio effect profile — how much work a live chain does for the same effect list
// ============================================================
//
// An effect list sounds the way export renders it: every chain at full
// quality. A live graph on a slow device can ask its chains for less work
// (playback-quality.ts picks how much), and every reduction here keeps the
// chain's latency exactly as it is at full quality, so lanes stay in line
// with the latencies measured for their full chains.
//
// Offline renders (export, compare, latency and loudness measurements)
// never take a profile: they always run FULL_FX_PROFILE.

/** The effects whose shapers run oversampled at full quality. */
export type StudioShaperEffect = 'saturation' | 'exciter' | 'limiter'

/** What a live chain may trade for less work. */
export interface StudioFxProfile {
  /** A name for logs and tests; the tier it came from. */
  readonly id: string
  /**
   * Oversampling for each effect's shapers, 4x at full quality. A lower
   * rate is made up with a delay (shaper-delay.ts), so the effect is as
   * late as at 4x.
   */
  readonly oversample: Readonly<Record<StudioShaperEffect, OverSampleType>>
}

/** Every effect as export renders it. */
export const FULL_FX_PROFILE: StudioFxProfile = {
  id: 'full',
  oversample: { saturation: '4x', exciter: '4x', limiter: '4x' },
}

/** The oversampling `profile` asks of `effect`'s shapers; 4x without a profile. */
export function shaperOversample(
  profile: StudioFxProfile | undefined,
  effect: StudioShaperEffect,
): OverSampleType {
  return profile?.oversample[effect] ?? '4x'
}
