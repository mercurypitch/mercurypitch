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
//
// One profile is not a playback tier: MONITOR_FX_PROFILE, for the armed
// lane's chain as the singer hears it while they sing
// (src/lib/studio/record/input-monitor.ts). Nothing lines a monitor up with
// the song, so it gives up the chain's latency instead of keeping it: an
// input heard through it is heard no later than a dry one.

/** The effects whose shapers run oversampled at full quality. */
export type StudioShaperEffect = 'saturation' | 'exciter' | 'limiter'

/** The dynamics effects a profile can leave as their lookahead alone (effects/latency-only.ts). */
export type StudioLiteEffect = 'dyneq' | 'deesser'

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
  /**
   * Reverbs that are not ducked send to one of three shared spaces
   * (REVERB_SPACES) instead of each convolving on its own. Each keeps its
   * own pre-delay, cuts and mix; its decay picks the space.
   */
  readonly reverbBus: boolean
  /**
   * Dynamics effects that keep only their lookahead: they pass the signal
   * as they do while their band is quiet, and never cut.
   */
  readonly lite: readonly StudioLiteEffect[]
  /**
   * No effect delays the signal: shapers run without oversampling and make
   * up nothing, the transient shaper looks no way ahead, and the lookahead
   * dynamics (LOOKAHEAD_DYNAMICS) pass the signal through untouched, since
   * a DynamicsCompressorNode cannot run without its lookahead. Only the
   * monitor's profile sets it.
   */
  readonly zeroLatency?: true
}

/** Every effect as export renders it. */
export const FULL_FX_PROFILE: StudioFxProfile = {
  id: 'full',
  oversample: { saturation: '4x', exciter: '4x', limiter: '4x' },
  reverbBus: false,
  lite: [],
}

/**
 * The effects built on a DynamicsCompressorNode: each runs late by its
 * lookahead (288 frames at 48 kHz in Chromium 148), which no setting of
 * the node takes away.
 */
export const LOOKAHEAD_DYNAMICS = [
  'compressor',
  'deesser',
  'dyneq',
  'limiter',
] as const

/**
 * The armed lane's chain while its input is monitored: every effect that
 * adds no delay sounds as it does on the lane (EQ, tilt, gain, stereo,
 * delay, reverb), saturation and the exciter without their oversampling,
 * the transient shaper without its 3 ms lookahead, and the lookahead
 * dynamics not at all. Measured in Chromium 148 at 48 kHz, they would add
 * 6 ms each (the limiter 10), and a voice lane's chain 22 ms in all.
 */
export const MONITOR_FX_PROFILE: StudioFxProfile = {
  id: 'monitor',
  oversample: { saturation: 'none', exciter: 'none', limiter: 'none' },
  reverbBus: false,
  lite: [],
  zeroLatency: true,
}

/** The shared reverb spaces a reverb bus offers, by decay. */
export type StudioReverbSpace = 'room' | 'hall' | 'long'

/**
 * Each space's impulse, from the role chains' reverbs: drums (0.8 s) and
 * electric guitar (1.2 s) in the room, acoustic guitar (1.5 s), other
 * (1.6 s) and piano (2.2 s) in the hall, keys (2.6 s) and backing vocals
 * (2.8 s) in the long space. The voice's reverb is ducked, so it keeps its
 * own.
 */
export const REVERB_SPACES: Readonly<
  Record<
    StudioReverbSpace,
    { readonly decayS: number; readonly damping: number }
  >
> = {
  room: { decayS: 1, damping: 60 },
  hall: { decayS: 1.8, damping: 45 },
  long: { decayS: 2.7, damping: 50 },
}

/** The shared space a reverb of `decayS` seconds sends to. */
export function reverbSpace(decayS: number): StudioReverbSpace {
  if (decayS < 1.35) return 'room'
  return decayS < 2.4 ? 'hall' : 'long'
}

/** Whether `profile` keeps only the lookahead of an effect of `kind`. */
export function keepsOnlyLatency(
  profile: StudioFxProfile | undefined,
  kind: string,
): boolean {
  return profile?.lite.some((lite) => lite === kind) === true
}

/** Whether `profile` passes the signal straight through an effect of `kind`: a lookahead dynamics effect while monitoring. */
export function passesStraightThrough(
  profile: StudioFxProfile | undefined,
  kind: string,
): boolean {
  return (
    profile?.zeroLatency === true &&
    LOOKAHEAD_DYNAMICS.some((dynamics) => dynamics === kind)
  )
}

/**
 * The oversampling `profile` asks of `effect`'s shapers: 4x without a
 * profile, and null while monitoring, a shaper never oversampled that
 * makes nothing up (effect-shell.ts `createShaperPath`).
 */
export function shaperOversample(
  profile: StudioFxProfile | undefined,
  effect: StudioShaperEffect,
): OverSampleType | null {
  if (profile?.zeroLatency === true) return null
  return profile?.oversample[effect] ?? '4x'
}
