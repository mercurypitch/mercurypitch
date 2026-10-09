// ============================================================
// Hold engine — one held note: lock, breaks, the lantern's fill and the end
// ============================================================
//
// A pure tick on a state object, the shape of `tickPhysics` in
// `src/lib/glass/resonance.ts`. The room feeds it one pitch reading per
// captured frame and reads everything a frame of UI needs straight off the
// returned state: phase, in-band now, lock length, fill, a needle value, and
// the events this tick fired (so haptics and Merc react exactly once).
//
// Two decisions that are easy to undo by accident:
//
// - "In band" is judged on a short smoothed centre of the pitch, not the raw
//   reading. A singer with a 5.5 Hz, +-40 cent vibrato is outside a +-30 cent
//   band 46 % of the time on raw readings, in 42 ms bursts; the in-band runs
//   are about 98 ms long, so a raw judge could never reach a 250 ms lock. The
//   centre (one-pole, `centreTauSec`) takes that vibrato down to about +-11
//   cents. Readings are clamped to `centreClampCents` first, so a one-frame
//   octave flicker moves the centre by a few cents instead of 180.
// - A break is only ever declared on voiced evidence. Silence after a lock
//   may be the end of the note, and the release must not read as a break, so
//   a silent gap counts as a break when the voice comes back (200-450 ms),
//   while a voiced excursion out of the band breaks live at 200 ms.

import { CONF_MIN, hzToCents } from '@/lib/mirror/metrics'
import type { PitchFrame } from '@/lib/pitch-f0-stream'

/** `glassBreak` (the onboarding glass beat) joins this union in S7b. */
export type HoldMode = 'exercise'

export interface ExerciseHoldPreset {
  mode: 'exercise'
  /** Half-width of the target band, cents. */
  tolCents: number
  /** In band this long (continuously) to lock. */
  lockMs: number
  /** Out of band or silent this long, after a lock, to break. */
  breakMs: number
  /** Silent this long, once the voice has started, ends the note. */
  endMs: number
  /** In-band seconds that fill the lantern. The fill never drains. */
  goalSeconds: number
  /** Time constant of the smoothed centre the band is judged on. */
  centreTauSec: number
  /** Readings are clamped to +-this before smoothing. */
  centreClampCents: number
}

/** Open for `GlassBreakHoldPreset` when the onboarding beat lands. */
export type HoldPreset = ExerciseHoldPreset

export type HoldPresetId = 'exercise'

/** Every feel knob of the hold, one line each. */
export const HOLD_PRESETS: Record<HoldPresetId, HoldPreset> = {
  exercise: {
    mode: 'exercise',
    tolCents: 30,
    lockMs: 250,
    breakMs: 200,
    endMs: 450,
    goalSeconds: 12,
    centreTauSec: 0.1,
    centreClampCents: 100,
  },
}

export type HoldPhase =
  /** Nothing voiced yet. */
  | 'waiting'
  /** Voiced, but the first lock has not happened. */
  | 'voiced'
  | 'locked'
  /** Lost the lock; stays here until the next lock. */
  | 'broken'
  /** The note is over; further ticks change nothing. */
  | 'ended'

export type HoldEventType = 'lock' | 'break' | 'relock' | 'goal' | 'end'

export interface HoldState {
  phase: HoldPhase
  /** Seconds since the first tick (the sum of every `dt`). */
  clock: number
  /** The smoothed centre is inside the band on this tick. */
  inBand: boolean
  /** Smoothed, clamped cents off target for a needle; null until voiced. */
  needleCents: number | null
  /** The lantern's fill, 0..1: inBandSeconds / goalSeconds. */
  charge: number
  inBandSeconds: number
  /** The current lock, band entry to the last in-band tick; 0 unless locked. */
  lockSeconds: number
  longestLockSeconds: number
  breaks: number
  goalReached: boolean
  /** Continuous in-band seconds (resets on any tick out of band). */
  bandRunSeconds: number
  /** Continuous out-of-band-or-silent seconds since the last in-band tick. */
  outRunSeconds: number
  /** Continuous unvoiced seconds (for dimming during a gap). */
  silentSeconds: number
  /** Clock at the start of the first voiced tick. */
  firstVoicedAt: number | null
  /** Clock at the band entry that became the first lock. */
  firstLockAt: number | null
  /** Clock at the band entry of the current lock. */
  lockStartedAt: number | null
  lastInBandAt: number | null
  lastVoicedAt: number | null
  /** The last voiced moment of a note that has ended. */
  noteEndedAt: number | null
  /** What happened on this tick, in order. Empty on most ticks. */
  events: HoldEventType[]
}

export interface HoldTick {
  /** Cents off the target, or null while unvoiced. */
  offCents: number | null
  /** Input RMS 0..1. Unused by `exercise`; the glass beat's fatigue reads it. */
  level: number
  /** Seconds since the previous tick. */
  dt: number
}

/** Float sums of 1/60 drift by 1e-15; thresholds compare with this slack. */
const EPS = 1e-6

export function createHoldState(): HoldState {
  return {
    phase: 'waiting',
    clock: 0,
    inBand: false,
    needleCents: null,
    charge: 0,
    inBandSeconds: 0,
    lockSeconds: 0,
    longestLockSeconds: 0,
    breaks: 0,
    goalReached: false,
    bandRunSeconds: 0,
    outRunSeconds: 0,
    silentSeconds: 0,
    firstVoicedAt: null,
    firstLockAt: null,
    lockStartedAt: null,
    lastInBandAt: null,
    lastVoicedAt: null,
    noteEndedAt: null,
    events: [],
  }
}

export function tickHold(
  state: HoldState,
  tick: HoldTick,
  preset: HoldPreset = HOLD_PRESETS.exercise,
): HoldState {
  if (state.phase === 'ended') {
    return state.events.length === 0 ? state : { ...state, events: [] }
  }
  const dt = Number.isFinite(tick.dt) && tick.dt > 0 ? tick.dt : 0
  const offCents = tick.offCents
  return offCents === null || !Number.isFinite(offCents)
    ? tickUnvoiced(state, dt, preset)
    : tickVoiced(state, offCents, dt, preset)
}

/** A tick with no voice: a gap in the note, or its end once long enough. */
function tickUnvoiced(
  state: HoldState,
  dt: number,
  preset: HoldPreset,
): HoldState {
  const clock = state.clock + dt
  const events: HoldEventType[] = []
  if (state.firstVoicedAt === null) return { ...state, clock, events }
  const next: HoldState = {
    ...state,
    clock,
    inBand: false,
    bandRunSeconds: 0,
    outRunSeconds: state.outRunSeconds + dt,
    silentSeconds: state.silentSeconds + dt,
    events,
  }
  if (next.silentSeconds < preset.endMs / 1000 - EPS) return next
  events.push('end')
  return {
    ...next,
    phase: 'ended',
    lockSeconds: 0,
    lockStartedAt: null,
    noteEndedAt: state.lastVoicedAt,
  }
}

/** The needle for a voiced tick: clamped, then smoothed. */
function centreFor(
  state: HoldState,
  offCents: number,
  dt: number,
  preset: HoldPreset,
): number {
  const clamp = preset.centreClampCents
  const raw = Math.max(-clamp, Math.min(clamp, offCents))
  // A fresh start (first voice, or back after a gap long enough to break)
  // takes the reading as is; anything else is smoothed.
  const previous = state.needleCents
  if (previous === null || state.silentSeconds >= preset.breakMs / 1000 - EPS) {
    return raw
  }
  const alpha =
    preset.centreTauSec > 0 ? 1 - Math.exp(-dt / preset.centreTauSec) : 1
  return previous + alpha * (raw - previous)
}

/** The fields a voiced tick changes, worked on in place. */
interface VoicedDraft {
  phase: HoldPhase
  breaks: number
  lockStartedAt: number | null
  firstLockAt: number | null
  lastInBandAt: number | null
  inBandSeconds: number
  bandRunSeconds: number
  outRunSeconds: number
  events: HoldEventType[]
}

/** An in-band tick: its time counts, and a long enough run locks. */
function holdInBand(
  draft: VoicedDraft,
  state: HoldState,
  clock: number,
  dt: number,
  preset: HoldPreset,
): void {
  draft.bandRunSeconds = (state.inBand ? state.bandRunSeconds : 0) + dt
  draft.inBandSeconds += dt
  draft.lastInBandAt = clock
  if (
    draft.phase === 'locked' ||
    draft.bandRunSeconds < preset.lockMs / 1000 - EPS
  ) {
    return
  }
  draft.lockStartedAt = clock - draft.bandRunSeconds
  if (draft.firstLockAt === null) {
    draft.firstLockAt = draft.lockStartedAt
    draft.events.push('lock')
  } else {
    draft.events.push('relock')
  }
  draft.phase = 'locked'
}

function tickVoiced(
  state: HoldState,
  offCents: number,
  dt: number,
  preset: HoldPreset,
): HoldState {
  const clock = state.clock + dt
  const centre = centreFor(state, offCents, dt, preset)
  const inBand = Math.abs(centre) <= preset.tolCents + EPS
  const draft: VoicedDraft = {
    phase: state.phase === 'waiting' ? 'voiced' : state.phase,
    breaks: state.breaks,
    lockStartedAt: state.lockStartedAt,
    firstLockAt: state.firstLockAt,
    lastInBandAt: state.lastInBandAt,
    inBandSeconds: state.inBandSeconds,
    bandRunSeconds: 0,
    outRunSeconds: 0,
    events: [],
  }

  // The out-run that just ended, or is still going, breaks a lock once it
  // reaches breakMs. This tick is voiced, so the note has not ended.
  const pendingOut = inBand ? state.outRunSeconds : state.outRunSeconds + dt
  if (draft.phase === 'locked' && pendingOut >= preset.breakMs / 1000 - EPS) {
    draft.events.push('break')
    draft.breaks += 1
    draft.phase = 'broken'
    draft.lockStartedAt = null
  }

  if (inBand) holdInBand(draft, state, clock, dt, preset)
  else draft.outRunSeconds = pendingOut

  const lockSeconds =
    draft.phase === 'locked' &&
    draft.lockStartedAt !== null &&
    draft.lastInBandAt !== null
      ? draft.lastInBandAt - draft.lockStartedAt
      : 0
  const goalReached =
    state.goalReached || draft.inBandSeconds >= preset.goalSeconds - EPS
  if (goalReached && !state.goalReached) draft.events.push('goal')

  return {
    phase: draft.phase,
    clock,
    inBand,
    needleCents: centre,
    charge: Math.min(1, draft.inBandSeconds / preset.goalSeconds),
    inBandSeconds: draft.inBandSeconds,
    lockSeconds,
    longestLockSeconds: Math.max(state.longestLockSeconds, lockSeconds),
    breaks: draft.breaks,
    goalReached,
    bandRunSeconds: draft.bandRunSeconds,
    outRunSeconds: draft.outRunSeconds,
    silentSeconds: 0,
    firstVoicedAt: state.firstVoicedAt ?? clock - dt,
    firstLockAt: draft.firstLockAt,
    lockStartedAt: draft.lockStartedAt,
    lastInBandAt: draft.lastInBandAt,
    lastVoicedAt: clock,
    noteEndedAt: null,
    events: draft.events,
  }
}

/**
 * One captured pitch frame as an engine tick. Feed the engine through this,
 * frame by frame, and its clock reads `frame.t - frames[0].t`, which is what
 * `computeHoldResult` relies on to find the held part of the take. Voicing
 * follows the Voice Mirror's rule (f0 > 0 and confidence >= CONF_MIN).
 */
export function holdTickFromFrame(
  frame: PitchFrame,
  previous: PitchFrame | null,
  targetMidi: number,
): HoldTick {
  const voiced = frame.f0 > 0 && frame.conf >= CONF_MIN
  return {
    offCents: voiced ? hzToCents(frame.f0) - targetMidi * 100 : null,
    level: frame.rms,
    dt: previous === null ? 0 : Math.max(0, frame.t - previous.t),
  }
}

/** Replay a whole take through the engine; the final state. */
export function runHold(
  frames: readonly PitchFrame[],
  targetMidi: number,
  preset: HoldPreset = HOLD_PRESETS.exercise,
): HoldState {
  let state = createHoldState()
  let previous: PitchFrame | null = null
  for (const frame of frames) {
    state = tickHold(
      state,
      holdTickFromFrame(frame, previous, targetMidi),
      preset,
    )
    previous = frame
  }
  return state
}
