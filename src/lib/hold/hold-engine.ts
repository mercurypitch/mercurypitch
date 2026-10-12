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
//   cents. Readings are held to a semitone first (heldCents, hold-reading.ts,
//   the one reading the result shares), so a one-frame octave flicker moves
//   the centre by a few cents instead of 180.
// - A break is only ever declared on voiced evidence. Silence after a lock
//   may be the end of the note, and the release must not read as a break, so
//   a silent gap counts as a break when the voice comes back (200-450 ms),
//   while a voiced excursion out of the band breaks live at 200 ms.
// - The fill counts from the first lock. A vibrato 28 cents sharp crosses
//   the band's edge every half cycle, never stays 250 ms to lock, and still
//   spent 12 s in the band about 21 s in: the room reached the goal on a
//   take the result kept nothing of (review of PR 973, M2). Before the
//   first lock the voice has not found the note, so nothing it does fills
//   the lantern; the run that locks counts whole.
//
// A preset may carry a stretch rule (the Long note lantern's, one for each
// exercise level): past the goal, a second fill grows with steady singing,
// judged by the same steadiness the result scores (hold-steadiness.ts), on
// the same reading of the voice; a voice under the level's bar fills part
// of it. Without one the engine stops at the goal.
//
// The top is judged on everything the voice has sung since the goal, a
// window that only grows, never on its last seconds alone. The top never
// drains, so a short window let a shaky voice's steadier moments add up:
// a fast shake under Singer's bar brimmed after 45 s, though no stretch of
// it was ever steady for long (review of the levels, 12 Oct 2026: time
// alone must never brim a shaky voice).

import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { PitchPoint } from './hold-reading'
import { heldCents, offTarget } from './hold-reading'
import type { GrowingSteadiness } from './hold-steadiness'
import { EMPTY_GROWTH, growingScore, growSteadiness, liveSteadiness, } from './hold-steadiness'

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
  /** After the goal, steady singing fills a second time; absent, nothing. */
  stretch?: StretchRule
}

/**
 * Past the goal, the top fills with steady singing: on the line (in the
 * band) while the voice since the goal (from `windowSeconds` before it,
 * and growing from there) scores at least `steadyScore` on the result's
 * own steadiness (liveSteadiness), checked every `checkSeconds`. `seconds`
 * of it fill the top. A voice under that bar but over `partScore` fills
 * part of the top, in proportion: one halfway between the two fills half
 * of it, and no more until the take since the goal is steadier. Like the
 * goal's fill, it never drains. Before the goal the check reads the last
 * `windowSeconds` of the voice, for the room's words.
 */
export interface StretchRule {
  seconds: number
  windowSeconds: number
  steadyScore: number
  partScore: number
  checkSeconds: number
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
  },
}

/**
 * How far under the steady bar a voice still fills part of the lantern's
 * top, in steadiness points: at the bar, all of it; this far under, none.
 */
const LANTERN_PART_SPAN = 40

/**
 * The Long note lantern at one level: the band either side of the note,
 * and the steadiness (hold-steadiness.ts, 100 less twice the spread) that
 * fills the top to the brim. The goal fills it halfway at every level, 12 s
 * on the line; past it, 12 s at the bar fill the top, and a voice under it
 * fills part of the top (StretchRule).
 */
function lantern(tolCents: number, steadyScore: number): HoldPreset {
  return {
    mode: 'exercise',
    tolCents,
    lockMs: 250,
    breakMs: 200,
    endMs: 450,
    goalSeconds: 12,
    centreTauSec: 0.1,
    stretch: {
      seconds: 12,
      windowSeconds: 2,
      steadyScore,
      partScore: steadyScore - LANTERN_PART_SPAN,
      checkSeconds: 0.15,
    },
  }
}

/**
 * The lantern at each level, which is the Settings accuracy tier
 * (src/stores/exercise-level.ts; owner, 12 Oct 2026). The owner's call
 * (11 Oct 2026): at the easiest level the lantern fills without a perfect
 * 12 seconds, and the hardest makes the brim harder to reach. Calibrated
 * on 26 s takes (a 5.5 Hz vibrato's swing is its depth over root 2 in
 * spread):
 *
 * - Learning: a natural vibrato (+-40 cents, steadiness about 44) and small
 *   wobbles reach the brim; any voice that reaches the goal fills some of
 *   the top.
 * - Singer: a light vibrato (+-15 to 20 cents, about 72 to 79) reaches the
 *   brim, a natural one fills about 40 % of the top, and a shake wider
 *   than a light vibrato does not reach it, however long it is held.
 * - Professional: only a near-straight tone (a spread under 6 cents)
 *   reaches the brim; a natural vibrato fills none of the top.
 *
 * Keyed by the tier ids, so a tier with no lantern fails to compile where
 * the level is looked up.
 */
export const LANTERN_LEVELS = {
  learning: lantern(40, 35),
  singer: lantern(30, 70),
  professional: lantern(20, 88),
} satisfies Record<string, HoldPreset>

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

export type HoldEventType =
  | 'lock'
  | 'break'
  | 'relock'
  | 'goal'
  /** The stretch's top is full (a stretch rule only). */
  | 'brim'
  | 'end'

export interface HoldState {
  phase: HoldPhase
  /** Seconds since the first tick (the sum of every `dt`). */
  clock: number
  /** The smoothed centre is inside the band on this tick. */
  inBand: boolean
  /** Smoothed, held cents off target for a needle; null until voiced. */
  needleCents: number | null
  /** The lantern's fill, 0..1: inBandSeconds / goalSeconds. */
  charge: number
  /**
   * Seconds in the band from the first lock, the locking run whole; 0 until
   * then. Nothing before the first lock fills the lantern.
   */
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
  /**
   * The voice's last readings (cents off the note, as ticked) that the live
   * steadiness reads, `windowSeconds` of them; empty without a stretch rule.
   */
  recent: readonly PitchPoint[]
  /**
   * Every reading since the goal, from `windowSeconds` before it: the
   * window the top is judged on, which only grows. Null before the goal
   * and without a stretch rule.
   */
  sinceGoal: GrowingSteadiness | null
  /**
   * The last check's steadiness score (hold-steadiness.ts): the last
   * `windowSeconds` of the voice before the goal, everything since the goal
   * after it. Null until there is enough voice to score.
   */
  steadiness: number | null
  /** The last check found the voice as steady as the level's top asks. */
  steady: boolean
  /**
   * How far up the top the last check's steadiness lets it fill, 0..1: 1
   * when steady, in proportion between the stretch's two bars.
   */
  reach: number
  /** When it last checked, clock seconds; null before the first lock. */
  steadyCheckedAt: number | null
  /**
   * The top's fill past the goal, in seconds on the line: steady, or
   * filling part of the way (`reach`).
   */
  steadySeconds: number
  /** The top's fill past the goal, 0..1: steadySeconds / stretch seconds. */
  topCharge: number
  brimReached: boolean
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
    recent: [],
    sinceGoal: null,
    steadiness: null,
    steady: false,
    reach: 0,
    steadyCheckedAt: null,
    steadySeconds: 0,
    topCharge: 0,
    brimReached: false,
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
  const voiced = offCents !== null && Number.isFinite(offCents)
  const next = voiced
    ? tickVoiced(state, offCents, dt, preset)
    : tickUnvoiced(state, dt, preset)
  if (preset.stretch === undefined) return next
  return tickStretch(state, next, voiced ? offCents : null, dt, preset.stretch)
}

/** The window's readings, the oldest past `windowSeconds` let go. */
function withReading(
  recent: readonly PitchPoint[],
  t: number,
  cents: number,
  windowSeconds: number,
): PitchPoint[] {
  let first = 0
  while (first < recent.length && recent[first].t < t - windowSeconds - EPS) {
    first++
  }
  const kept = recent.slice(first)
  kept.push({ t, cents })
  return kept
}

/**
 * The window the top is judged on: from the goal's tick, the readings
 * then in `recent` and every one after; null before the goal.
 */
function growSinceGoal(
  state: HoldState,
  next: HoldState,
  reading: number | null,
  recent: readonly PitchPoint[],
): GrowingSteadiness | null {
  if (!next.goalReached) return null
  if (state.sinceGoal === null) {
    return recent.reduce<GrowingSteadiness>(
      (growth, point) => growSteadiness(growth, point),
      EMPTY_GROWTH,
    )
  }
  return reading === null
    ? state.sinceGoal
    : growSteadiness(state.sinceGoal, { t: next.clock, cents: reading })
}

type Verdict = Pick<
  HoldState,
  'steadiness' | 'steady' | 'reach' | 'steadyCheckedAt'
>

/**
 * The steadiness verdict after this tick: checked on a voiced tick once
 * the note has been found, every `checkSeconds`; before the goal over the
 * last `windowSeconds` (at least half full), after it over everything
 * since the goal. Otherwise the last verdict stands.
 */
function checkSteady(
  state: HoldState,
  next: HoldState,
  voiced: boolean,
  recent: readonly PitchPoint[],
  sinceGoal: GrowingSteadiness | null,
  rule: StretchRule,
): Verdict {
  const last = state.steadyCheckedAt
  const due =
    voiced &&
    next.firstLockAt !== null &&
    (last === null || next.clock - last >= rule.checkSeconds - EPS)
  if (!due) {
    return {
      steadiness: state.steadiness,
      steady: state.steady,
      reach: state.reach,
      steadyCheckedAt: last,
    }
  }
  const span = recent[recent.length - 1].t - recent[0].t
  const score =
    sinceGoal !== null
      ? growingScore(sinceGoal)
      : span >= rule.windowSeconds / 2 - EPS
        ? liveSteadiness(recent)
        : null
  return {
    steadiness: score,
    steady: score !== null && score >= rule.steadyScore,
    reach: score === null ? 0 : reachOf(score, rule),
    steadyCheckedAt: next.clock,
  }
}

/** How far up the top a steadiness score lets it fill, 0..1. */
function reachOf(score: number, rule: StretchRule): number {
  if (score >= rule.steadyScore) return 1
  const part = (score - rule.partScore) / (rule.steadyScore - rule.partScore)
  return Math.max(0, Math.min(1, part))
}

/** The stretch past the goal: steady seconds on the line fill the top. */
function tickStretch(
  state: HoldState,
  next: HoldState,
  reading: number | null,
  dt: number,
  rule: StretchRule,
): HoldState {
  const recent =
    reading === null
      ? state.recent
      : withReading(state.recent, next.clock, reading, rule.windowSeconds)
  const sinceGoal = growSinceGoal(state, next, reading, recent)
  const verdict = checkSteady(
    state,
    next,
    reading !== null,
    recent,
    sinceGoal,
    rule,
  )
  // The top fills as far as this steadiness reaches, and no further.
  const room = verdict.reach * rule.seconds - state.steadySeconds
  const counts = state.goalReached && next.inBand && room > 0
  const steadySeconds = state.steadySeconds + (counts ? Math.min(dt, room) : 0)
  const brimReached = state.brimReached || steadySeconds >= rule.seconds - EPS
  return {
    ...next,
    recent,
    sinceGoal,
    ...verdict,
    steadySeconds,
    topCharge: Math.min(1, steadySeconds / rule.seconds),
    brimReached,
    events:
      brimReached && !state.brimReached
        ? [...next.events, 'brim']
        : next.events,
  }
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

/** The needle for a voiced tick: held, then smoothed. */
function centreFor(
  state: HoldState,
  offCents: number,
  dt: number,
  preset: HoldPreset,
): number {
  const raw = heldCents(offCents)
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

/**
 * An in-band tick: a long enough run locks, and from the first lock its
 * time counts. The run that locked counts whole, from its band entry.
 */
function holdInBand(
  draft: VoicedDraft,
  state: HoldState,
  clock: number,
  dt: number,
  preset: HoldPreset,
): void {
  draft.bandRunSeconds = (state.inBand ? state.bandRunSeconds : 0) + dt
  if (draft.firstLockAt !== null) draft.inBandSeconds += dt
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
    draft.inBandSeconds += draft.bandRunSeconds
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
    recent: state.recent,
    sinceGoal: state.sinceGoal,
    steadiness: state.steadiness,
    steady: state.steady,
    reach: state.reach,
    steadyCheckedAt: state.steadyCheckedAt,
    steadySeconds: state.steadySeconds,
    topCharge: state.topCharge,
    brimReached: state.brimReached,
    events: draft.events,
  }
}

/**
 * One captured pitch frame as an engine tick. Feed the engine through this,
 * frame by frame, and its clock reads `frame.t - frames[0].t`, which is what
 * `computeHoldResult` relies on to find the held part of the take. Voicing
 * follows the Voice Mirror's rule (f0 > 0 and confidence >= CONF_MIN), the
 * result's own (offTarget, hold-reading.ts).
 */
export function holdTickFromFrame(
  frame: PitchFrame,
  previous: PitchFrame | null,
  targetMidi: number,
): HoldTick {
  return {
    offCents: offTarget(frame, targetMidi),
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
