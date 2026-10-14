// ============================================================
// Glide engine — a voice following a moving target: the lit share of each arch
// ============================================================
//
// Ng slides' engine, and Lip roll's. The room feeds it every captured frame
// on the path's clock and reads a frame of UI straight off the state (on the
// path now, the smoothed error, the arch, the lag), with the events this
// tick fired, so the reveal, Merc and haptics react exactly once.
//
// Each frame (DESIGN-ng-slides.md §3):
//
// - The reading is the hold engine's (hold-reading.ts): voiced by offTarget,
//   and held to a semitone by heldCents, so a tracker's octave slip costs
//   one semitone, not twelve.
// - The lag allowance: singers trail a moving target. The error is the
//   smallest distance from the voice now to the path anywhere from `lagMs`
//   behind this moment to `leadMs` ahead of it, sampled every 25 ms.
// - On the path: that error, held, then smoothed by a one-pole of 60 ms (a
//   glide moves too fast for the hold's 100 ms), inside the level's band.
// - Coverage: per arch, the time on the path over the arch's sung time (up,
//   top and down). Silence is not lit; the landing and the breath are not
//   judged.
// - Break: unvoiced for the level's break time inside an arch, once the
//   voice has sounded in it. Jump: the voice moves 150 cents or more within
//   50 ms while the path moves under 50. Top (Pro): within the level's
//   cents of the top note, long enough, around the top.
//
// Rules that are easy to undo by accident:
//
// - A jump is confirmed only once the voice has stayed away from where it
//   jumped from for JUMP_CONFIRM_SEC. A pitch tracker slips an octave for a
//   frame or two and comes back; a voice that flips register stays flipped
//   (the same tenth of a second hold-reading.ts uses for slips). A slip's
//   frames then leave the jump check's memory, so the return from a slip
//   is not a jump either.
// - Light never drains: coverage only grows, as the room's reveal does.
//   A bridged gap (Lip roll) keeps the voice on or off the path as it was,
//   and its time stays counted even if the gap turns out longer.
// - The state is updated in place and returned. A frame that fires no
//   event, or only onPath or offPath, allocates nothing: the per-arch tallies
//   are typed arrays sized once by createGlideState, the jump check's memory
//   is a fixed ring, and the events array is emptied, never replaced. Only
//   a break, a jump, a top, an arch's end and the run's end make a record.

import { heldCents, offTarget } from '@/lib/hold/hold-reading'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { GlidePath } from './glide-path'
import { judgedArchAt, segmentIndexAt, targetAt } from './glide-path'
import type { GlidePreset } from './glide-presets'

/** The lag allowance samples the path this often, seconds. */
export const LAG_STEP_SEC = 0.025

/** The one-pole smoother on the error, seconds. */
export const CENTRE_TAU_SEC = 0.06

/** A jump: the voice moves at least this far ... */
export const JUMP_CENTS = 150
/** ... within this long ... */
export const JUMP_WITHIN_SEC = 0.05
/** ... while the path moves less than this. */
export const JUMP_PATH_CENTS = 50
/** ... and stays away from where it jumped from this long. */
export const JUMP_CONFIRM_SEC = 0.1

/**
 * The mean lag only reads frames where the path moves at least this far
 * across the lag window: on a flat top every moment matches.
 */
const MOVING_CENTS = 50

/**
 * A frame credits at most this much time to coverage. A stalled frame
 * clock (a dropped run of frames) is not a voice heard on the path.
 */
const MAX_CREDIT_SEC = 0.1

/** Recent voiced readings the jump check compares: 50 ms at up to 240 fps. */
const RING_SIZE = 16

/** Float sums of frame times drift; thresholds compare with this slack. */
const EPS = 1e-6

export interface GlideMark {
  /** The arch it happened in. */
  readonly arch: number
  /** When: a break's last voiced moment, a jump's first frame, seconds. */
  readonly t: number
  /** The path's note then, MIDI (fractional while it moves). */
  readonly midi: number
}

export interface GlideJump extends GlideMark {
  /** The voice before the jump and after it, MIDI. */
  readonly fromMidi: number
  readonly toMidi: number
}

export type GlideEvent =
  | { readonly type: 'onPath' }
  | { readonly type: 'offPath' }
  | ({ readonly type: 'break' } & GlideMark)
  | ({ readonly type: 'jump' } & GlideJump)
  | { readonly type: 'top'; readonly arch: number; readonly t: number }
  | {
      readonly type: 'archEnd'
      readonly arch: number
      /** The arch's on-path time over its sung time, 0..1. */
      readonly coverage: number
      /** Coverage reached the level's line. */
      readonly lit: boolean
    }
  | { readonly type: 'end' }

const ON_PATH: GlideEvent = Object.freeze({ type: 'onPath' })
const OFF_PATH: GlideEvent = Object.freeze({ type: 'offPath' })
const END: GlideEvent = Object.freeze({ type: 'end' })

export interface GlideState {
  /** The path's end has passed; further ticks change nothing. */
  ended: boolean
  /** The last frame's time; null before the first. */
  previousT: number | null

  // ---- What a frame of UI reads ----
  /** The arch whose sung part holds this frame, or -1. */
  arch: number
  /** The path's segment now (path.segments), or -1 outside the path. */
  segment: number
  /** The path's note now, MIDI; null in a breath. */
  targetMidi: number | null
  /** The voice now, MIDI; null when unvoiced. */
  voiceMidi: number | null
  /** The smoothed, held error from the path, cents; null when not heard. */
  centre: number | null
  /** On the path now, inside an arch's sung part. */
  onPath: boolean
  /** On the path now, judged or not (coverage reads this). */
  following: boolean
  /** Where on the path the voice matched: + behind, - ahead, seconds. */
  lagSec: number

  // ---- The voice's gaps ----
  lastVoicedAt: number | null
  /** The current gap has already been called a break. */
  gapBroken: boolean

  // ---- Per arch, index = arch ----
  /** Seconds of the arch's sung part spent on the path. */
  litSeconds: Float64Array
  /** The voice has sounded in the arch's sung part. */
  archVoiced: Uint8Array
  /** archEnd has fired. */
  archDone: Uint8Array
  /** The top note was reached (Pro). */
  topReached: Uint8Array
  /** Sum and count of held readings off the top note, during the top. */
  topSum: Float64Array
  topCount: Float64Array
  /** The first arch whose end has not passed. */
  nextArch: number

  // ---- The top check ----
  topCentre: number | null
  topRunSec: number

  // ---- The mean lag ----
  lagSum: number
  lagCount: number

  // ---- The jump check ----
  ringT: Float64Array
  ringCents: Float64Array
  ringSize: number
  pending: boolean
  pendingT: number
  pendingFrom: number
  pendingTo: number
  pendingArch: number
  /** The pending move happened while the path held still: a jump. */
  pendingCounts: boolean

  // ---- Records ----
  jumps: GlideJump[]
  breaks: GlideMark[]
  /** What happened on this tick, in order. Emptied each tick, never replaced. */
  events: GlideEvent[]

  // ---- Scratch for the lag window (allocation-free) ----
  windowMin: number
  windowMax: number
}

export function createGlideState(path: GlidePath): GlideState {
  const arches = path.arches.length
  return {
    ended: false,
    previousT: null,
    arch: -1,
    segment: -1,
    targetMidi: null,
    voiceMidi: null,
    centre: null,
    onPath: false,
    following: false,
    lagSec: 0,
    lastVoicedAt: null,
    gapBroken: false,
    litSeconds: new Float64Array(arches),
    archVoiced: new Uint8Array(arches),
    archDone: new Uint8Array(arches),
    topReached: new Uint8Array(arches),
    topSum: new Float64Array(arches),
    topCount: new Float64Array(arches),
    nextArch: 0,
    topCentre: null,
    topRunSec: 0,
    lagSum: 0,
    lagCount: 0,
    ringT: new Float64Array(RING_SIZE),
    ringCents: new Float64Array(RING_SIZE),
    ringSize: 0,
    pending: false,
    pendingT: 0,
    pendingFrom: 0,
    pendingTo: 0,
    pendingArch: -1,
    pendingCounts: false,
    jumps: [],
    breaks: [],
    events: [],
    windowMin: 0,
    windowMax: 0,
  }
}

/** An arch's coverage so far: on-path time over its sung time, 0..1. */
export function archCoverage(
  state: GlideState,
  path: GlidePath,
  arch: number,
): number {
  const a = path.arches[arch]
  const sung = a.end - a.start
  return sung > 0 ? Math.min(1, state.litSeconds[arch] / sung) : 0
}

// ---- The lag window -------------------------------------------------------

/**
 * The signed error (cents) from the voice to the nearest moment of the path
 * from `lagMs` behind `t` to `leadMs` ahead of it, or NaN when the window
 * holds no target (a breath). Ties go to the moment nearest now. Leaves the
 * matched moment's offset in `lagSec` and the path's range in the window.
 */
function windowError(
  state: GlideState,
  path: GlidePath,
  t: number,
  voiceCents: number,
  preset: GlidePreset,
): number {
  const lag = preset.lagMs / 1000
  const lead = preset.leadMs / 1000
  const back = Math.floor(lag / LAG_STEP_SEC + EPS)
  const ahead = Math.floor(lead / LAG_STEP_SEC + EPS)
  let best = Number.NaN
  let bestOffset = 0
  state.windowMin = Number.POSITIVE_INFINITY
  state.windowMax = Number.NEGATIVE_INFINITY
  // The sampled offsets, then the window's two ends exactly.
  for (let k = -back - 1; k <= ahead + 1; k++) {
    const offset = k < -back ? -lag : k > ahead ? lead : k * LAG_STEP_SEC
    const target = targetAt(path, t + offset)
    if (target === null) continue
    const cents = target * 100
    if (cents < state.windowMin) state.windowMin = cents
    if (cents > state.windowMax) state.windowMax = cents
    const error = voiceCents - cents
    if (closer(error, offset, best, bestOffset)) {
      best = error
      bestOffset = offset
    }
  }
  state.lagSec = Number.isNaN(best) ? 0 : -bestOffset
  return best
}

/** Whether (error, offset) beats the best so far: smaller, or as small and nearer now. */
function closer(
  error: number,
  offset: number,
  best: number,
  bestOffset: number,
): boolean {
  if (Number.isNaN(best)) return true
  const a = Math.abs(error)
  const b = Math.abs(best)
  if (a < b - EPS) return true
  return a <= b + EPS && Math.abs(offset) < Math.abs(bestOffset)
}

// ---- The reading ----------------------------------------------------------

/**
 * A voiced frame: the lag-allowed error, held, smoothed. A fresh start
 * (first voice, back after a gap as long as a break, or the first frame
 * with a path to follow) takes the reading as it is.
 */
function readVoiced(
  state: GlideState,
  path: GlidePath,
  t: number,
  dt: number,
  voiceCents: number,
  preset: GlidePreset,
): void {
  const error = windowError(state, path, t, voiceCents, preset)
  if (Number.isNaN(error)) {
    state.centre = null
    state.following = false
    return
  }
  const held = heldCents(error)
  const gap = state.lastVoicedAt === null ? 0 : t - state.lastVoicedAt
  const fresh = state.centre === null || gap >= preset.breakMs / 1000 - EPS
  state.centre = fresh ? held : smooth(state.centre ?? held, held, dt)
  state.following = Math.abs(state.centre) <= preset.bandCents + EPS
  if (state.following) countLag(state, error, preset)
}

/** One step of the one-pole smoother. */
function smooth(previous: number, reading: number, dt: number): number {
  const alpha = 1 - Math.exp(-dt / CENTRE_TAU_SEC)
  return previous + alpha * (reading - previous)
}

/** The mean lag reads frames on the path where the path is moving. */
function countLag(state: GlideState, error: number, preset: GlidePreset) {
  if (state.windowMax - state.windowMin < MOVING_CENTS - EPS) return
  if (Math.abs(error) > preset.bandCents + EPS) return
  if (state.arch < 0) return
  state.lagSum += state.lagSec
  state.lagCount += 1
}

/**
 * An unvoiced frame: a bridged gap keeps the voice where it was; past the
 * bridge, the voice is gone and nothing it does is on the path.
 */
function readUnvoiced(state: GlideState, t: number, preset: GlidePreset) {
  if (bridged(state, t, preset)) return
  state.following = false
}

/** Whether the current gap is short enough to bridge. */
function bridged(state: GlideState, t: number, preset: GlidePreset): boolean {
  if (preset.bridgeGapMs <= 0 || state.lastVoicedAt === null) return false
  return t - state.lastVoicedAt <= preset.bridgeGapMs / 1000 + EPS
}

// ---- Breaks ---------------------------------------------------------------

/** An unvoiced frame inside an arch the voice started: a break, once a gap. */
function checkBreak(
  state: GlideState,
  path: GlidePath,
  t: number,
  preset: GlidePreset,
): void {
  const arch = state.arch
  const last = state.lastVoicedAt
  if (arch < 0 || last === null || state.gapBroken) return
  if (state.archVoiced[arch] === 0) return
  const gap = t - last
  if (gap < preset.breakMs / 1000 - EPS) return
  if (gap <= preset.bridgeGapMs / 1000 + EPS) return
  state.gapBroken = true
  const mark = {
    arch,
    t: last,
    midi: targetAt(path, last) ?? state.targetMidi ?? 0,
  }
  state.breaks.push(mark)
  state.events.push({ type: 'break', ...mark })
}

// ---- Jumps ----------------------------------------------------------------

/** Keep a voiced reading, the oldest let go past the jump window. */
function remember(state: GlideState, t: number, cents: number): void {
  let drop = 0
  while (
    drop < state.ringSize &&
    state.ringT[drop] < t - JUMP_WITHIN_SEC - EPS
  ) {
    drop++
  }
  if (state.ringSize - drop === RING_SIZE) drop++
  if (drop > 0) {
    state.ringT.copyWithin(0, drop, state.ringSize)
    state.ringCents.copyWithin(0, drop, state.ringSize)
    state.ringSize -= drop
  }
  state.ringT[state.ringSize] = t
  state.ringCents[state.ringSize] = cents
  state.ringSize += 1
}

/** Forget the readings from `t` on: a slip's frames. */
function forgetFrom(state: GlideState, t: number): void {
  while (state.ringSize > 0 && state.ringT[state.ringSize - 1] >= t - EPS) {
    state.ringSize -= 1
  }
}

/**
 * The newest reading within the jump window at least JUMP_CENTS from
 * `cents`, as its index, or -1. The newest, so the path's move is read
 * over the voice's own move, not over the whole window.
 */
function jumpFrom(state: GlideState, t: number, cents: number): number {
  for (let i = state.ringSize - 1; i >= 0; i--) {
    if (state.ringT[i] < t - JUMP_WITHIN_SEC - EPS) return -1
    if (Math.abs(cents - state.ringCents[i]) >= JUMP_CENTS - EPS) return i
  }
  return -1
}

/** The path's move between two moments, cents; infinite across a breath. */
function pathMove(path: GlidePath, from: number, to: number): number {
  const a = targetAt(path, from)
  const b = targetAt(path, to)
  if (a === null || b === null) return Number.POSITIVE_INFINITY
  return Math.abs(b - a) * 100
}

/**
 * A move to settle, when the voice just moved JUMP_CENTS. Every such move
 * waits, a jump or not: a slip that comes back is forgotten either way, or
 * its return would read as a move of its own. It counts as a jump only if
 * the path moved less than JUMP_PATH_CENTS meanwhile.
 */
function startJump(
  state: GlideState,
  path: GlidePath,
  t: number,
  cents: number,
): void {
  if (state.arch < 0) return
  const index = jumpFrom(state, t, cents)
  if (index < 0) return
  state.pending = true
  state.pendingT = t
  state.pendingFrom = state.ringCents[index]
  state.pendingTo = cents
  state.pendingArch = state.arch
  state.pendingCounts =
    pathMove(path, state.ringT[index], t) < JUMP_PATH_CENTS - EPS
}

/**
 * A pending move: forgotten when the voice comes back to where it moved
 * from (a tracker slip), settled once it has stayed away long enough, and
 * a jump then if the path held still.
 */
function settleJump(
  state: GlideState,
  path: GlidePath,
  t: number,
  cents: number,
): void {
  if (Math.abs(cents - state.pendingFrom) < JUMP_CENTS / 2) {
    state.pending = false
    forgetFrom(state, state.pendingT)
    return
  }
  if (t - state.pendingT < JUMP_CONFIRM_SEC - EPS) return
  state.pending = false
  if (!state.pendingCounts) return
  const jump: GlideJump = {
    arch: state.pendingArch,
    t: state.pendingT,
    midi: targetAt(path, state.pendingT) ?? 0,
    fromMidi: state.pendingFrom / 100,
    toMidi: state.pendingTo / 100,
  }
  state.jumps.push(jump)
  state.events.push({ type: 'jump', ...jump })
}

function checkJump(
  state: GlideState,
  path: GlidePath,
  t: number,
  cents: number,
): void {
  if (state.pending) settleJump(state, path, t, cents)
  else startJump(state, path, t, cents)
  remember(state, t, cents)
}

// ---- The top --------------------------------------------------------------

/**
 * The top: the tendency reads the voice against the top note over the top
 * segment; the Pro check over the top with the lag allowance either side,
 * since a voice the level lets trail reaches the top that much later.
 */
function checkTop(
  state: GlideState,
  path: GlidePath,
  t: number,
  dt: number,
  voiceCents: number | null,
  preset: GlidePreset,
): void {
  const index = state.nextArch
  const arch = path.arches[index]
  if (arch === undefined) return
  const offTop = voiceCents === null ? null : voiceCents - arch.topMidi * 100
  if (offTop !== null && t >= arch.topStart - EPS && t <= arch.topEnd + EPS) {
    state.topSum[index] += heldCents(offTop)
    state.topCount[index] += 1
  }
  const from = arch.topStart - preset.leadMs / 1000
  const to = arch.topEnd + preset.lagMs / 1000
  if (t < from - EPS || t > to + EPS) {
    state.topCentre = null
    state.topRunSec = 0
    return
  }
  if (preset.top === null || state.topReached[index] === 1) return
  holdTop(state, index, t, dt, offTop, preset)
}

function holdTop(
  state: GlideState,
  arch: number,
  t: number,
  dt: number,
  offTop: number | null,
  preset: GlidePreset,
): void {
  const rule = preset.top
  if (rule === null) return
  if (offTop === null) {
    if (bridged(state, t, preset)) return
    state.topCentre = null
    state.topRunSec = 0
    return
  }
  const held = heldCents(offTop)
  state.topCentre =
    state.topCentre === null ? held : smooth(state.topCentre, held, dt)
  if (Math.abs(state.topCentre) > rule.tolCents + EPS) {
    state.topRunSec = 0
    return
  }
  state.topRunSec += dt
  if (state.topRunSec < rule.holdMs / 1000 - EPS) return
  state.topReached[arch] = 1
  state.events.push({ type: 'top', arch, t })
}

// ---- Coverage and the arches' ends ---------------------------------------

/**
 * Credits (previous, t] to the arches it overlaps, on the path or not as
 * this frame read the voice, and closes every arch whose end it reached.
 */
function creditArches(
  state: GlideState,
  path: GlidePath,
  previous: number,
  t: number,
  preset: GlidePreset,
): void {
  while (state.nextArch < path.arches.length) {
    const arch = path.arches[state.nextArch]
    const from = Math.max(previous, arch.start)
    const to = Math.min(t, arch.end)
    if (state.following && to > from) {
      state.litSeconds[arch.index] += Math.min(to - from, MAX_CREDIT_SEC)
    }
    if (t < arch.end - EPS) return
    closeArch(state, path, arch.index, preset)
  }
}

function closeArch(
  state: GlideState,
  path: GlidePath,
  arch: number,
  preset: GlidePreset,
): void {
  state.nextArch = arch + 1
  state.archDone[arch] = 1
  if (state.pending && state.pendingArch === arch) state.pending = false
  const coverage = archCoverage(state, path, arch)
  state.events.push({
    type: 'archEnd',
    arch,
    coverage,
    lit: coverage >= preset.litShare - EPS,
  })
}

/** onPath and offPath fire on a change, inside an arch's sung part only. */
function updateOnPath(state: GlideState): void {
  const now = state.arch >= 0 && state.following
  if (now && !state.onPath) state.events.push(ON_PATH)
  else if (!now && state.onPath && state.arch >= 0) state.events.push(OFF_PATH)
  state.onPath = now
}

// ---- The tick -------------------------------------------------------------

/** The voice's absolute cents, or null when unvoiced (offTarget's rule). */
function voiceCentsOf(frame: PitchFrame): number | null {
  return offTarget(frame, 0)
}

/**
 * One captured frame, its time on the path's clock (frames before 0, the
 * count-in, are heard but never judged). Frames must come in time order;
 * `path` and `preset` must be the same on every tick of one state. Updates
 * `state` in place and returns it.
 */
export function tickGlide(
  state: GlideState,
  frame: PitchFrame,
  path: GlidePath,
  preset: GlidePreset,
): GlideState {
  state.events.length = 0
  if (state.ended) return state
  const t = frame.t
  const previous = state.previousT ?? t
  const dt = Math.max(0, t - previous)
  const cents = voiceCentsOf(frame)

  state.segment = segmentIndexAt(path, t)
  state.arch = judgedArchAt(path, t)
  state.targetMidi = targetAt(path, t)
  state.voiceMidi = cents === null ? null : cents / 100

  if (cents === null) {
    readUnvoiced(state, t, preset)
    checkBreak(state, path, t, preset)
  } else {
    readVoiced(state, path, t, dt, cents, preset)
    if (state.arch >= 0) state.archVoiced[state.arch] = 1
    checkJump(state, path, t, cents)
  }
  updateOnPath(state)
  checkTop(state, path, t, dt, cents, preset)
  creditArches(state, path, previous, t, preset)

  if (cents !== null) {
    state.lastVoicedAt = t
    state.gapBroken = false
  }
  state.previousT = t
  if (t >= path.duration - EPS) endRun(state, path, preset)
  return state
}

/** Every arch left closes, then the run ends. */
function endRun(state: GlideState, path: GlidePath, preset: GlidePreset) {
  while (state.nextArch < path.arches.length) {
    closeArch(state, path, state.nextArch, preset)
  }
  state.ended = true
  state.onPath = false
  state.events.push(END)
}

/** Replay a whole take through the engine; the final state. */
export function runGlide(
  frames: readonly PitchFrame[],
  path: GlidePath,
  preset: GlidePreset,
): GlideState {
  const state = createGlideState(path)
  for (const frame of frames) tickGlide(state, frame, path, preset)
  return state
}
