// The verb: hold the note until it rings, then wave it until it breaks.
// ============================================================
//
// Ported from the 2D Resonance Ring, and pure for the same reason it was
// pure there — this is the rule the whole game rests on, and it must be
// testable without a microphone, a canvas or a clock.
//
// The shape of the rule, and why it is shaped that way:
//
//   A steady in-tune note rises only to `holdCap`. Past that, the only
//   thing that moves it is vibrato. So the player cannot win by being
//   loud or by simply enduring — they have to do the musical thing the
//   physics actually asks for, which is to feed energy at the resonant
//   frequency rather than merely near it.
//
// Two forgivenesses are deliberate. The band widens once ringing, so the
// wobble the player has just been asked for cannot itself throw them out
// of tolerance. And decay is slow, so a breath costs a little charge
// rather than the attempt.

/** What the player is doing, this step. */
export interface VoiceInput {
  /** Sung pitch as a MIDI number, or null when unvoiced. */
  midi: number | null
  /** Whether the voice is currently wavering at a vibrato rate. */
  vibrato: boolean
  /** How strongly, 0..1. Scales the pump. */
  vibratoStrength: number
}

/** One resonating thing — a pane, a wine glass, a chandelier crystal. */
export interface ResonanceState {
  /** The note that breaks it, as a MIDI number. */
  midi: number
  /** Charge, 0..1. At 1 it breaks. */
  res: number
  /** Best absolute cents error across the frames that charged it, and
   * how many there were — the run's accuracy, for scoring and for how
   * hard the shards fly. */
  centsErrorSum: number
  chargedFrames: number
}

export interface RingConfig {
  tolSemis: number
  riseSeconds: number
  holdCap: number
  pumpSeconds: number
  pumpTolBonus: number
  fallSeconds: number
}

export const createResonance = (midi: number): ResonanceState => ({
  midi,
  res: 0,
  centsErrorSum: 0,
  chargedFrames: 0,
})

/** True once a steady hold has done all it can and only vibrato remains. */
export const isRinging = (state: ResonanceState, cfg: RingConfig): boolean =>
  state.res >= cfg.holdCap

/**
 * Advance one resonance by `dt` seconds. Mutates, like the 2D engine —
 * this runs per pane per step and allocating a new object each time is
 * the kind of garbage a mobile frame budget notices.
 *
 * Returns true on the step that reaches 1, so the caller can fire the
 * shatter exactly once.
 */
export const stepResonance = (
  state: ResonanceState,
  input: VoiceInput,
  dt: number,
  cfg: RingConfig,
): boolean => {
  if (state.res >= 1) return false

  const ringing = isRinging(state, cfg)
  const tol = cfg.tolSemis + (ringing ? cfg.pumpTolBonus : 0)
  const semisOff =
    input.midi === null ? Infinity : Math.abs(input.midi - state.midi)
  const inTol = semisOff <= tol

  if (inTol && !ringing) {
    state.res = Math.min(cfg.holdCap, state.res + dt / cfg.riseSeconds)
  } else if (inTol && input.vibrato) {
    const pump = (dt / cfg.pumpSeconds) * input.vibratoStrength
    state.res = Math.min(1, state.res + pump)
  } else if (!inTol) {
    state.res = Math.max(0, state.res - dt / cfg.fallSeconds)
  }
  // The remaining case — in tolerance, ringing, not wavering — holds
  // steady on purpose. The player is doing something right; it is just
  // not the thing that finishes the job.

  if (inTol) {
    state.centsErrorSum += semisOff * 100
    state.chargedFrames += 1
  }

  return state.res >= 1
}

/**
 * Mean cents error over the frames that actually charged it. 0 when
 * nothing ever did, which reads as perfect — so callers deciding how
 * hard to throw the shards should check `chargedFrames` first.
 */
export const meanCentsError = (state: ResonanceState): number =>
  state.chargedFrames === 0 ? 0 : state.centsErrorSum / state.chargedFrames

/**
 * How well the note was sung, 0..1, from the mean cents error. Perfect
 * at 0 cents, zero at a full tolerance band away, linear between — the
 * curve is deliberately dull because it feeds the launch speed, and a
 * player should be able to feel the difference without studying it.
 */
export const accuracy = (state: ResonanceState, cfg: RingConfig): number => {
  if (state.chargedFrames === 0) return 0
  const bandCents = cfg.tolSemis * 100
  return Math.max(0, Math.min(1, 1 - meanCentsError(state) / bandCents))
}
