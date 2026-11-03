// ============================================================
// Studio graph automation — each lane's volume and pan lines on its stage, timed from the anchor every lane shares
// ============================================================
//
// Frame F of pass p reaches a lane's faders at passStart(p), plus F's place
// in the pass, plus the slowest lane chain's latency: every lane's sources
// start that much sooner than the slowest lane's and come through their
// own chain (graph-passes.ts). So a line's knot at F lands there on every
// lane, live and in a render alike, and a lane played from its render
// (lane-freeze.ts), through the same faders, follows the same line.
//
// The line is written a little past wherever the graph is scheduled to,
// and cut (automation-line.ts) wherever the graph changes what it plays:
// - Play, a resume and a retime start it afresh at the run's first frame,
//   before the run's envelope opens over it;
// - a seek crosses it to the new place over the 10 ms its audio crosses;
// - a loop point crosses it back to the song's start over the same 10 ms;
// - a line drawn, moved or cleared while the song plays glides in over
//   12 ms, as a fader does;
// - Repeat, a re-plan and a chain swap cut it where the clock is about to
//   be and write it on as the graph now plays, which changes nothing heard
//   until the loop point the change moves.
// Past the song's end, with no pass to come, the line plays on: a tail
// rings out at the line's values, on Play as in an export.
import type { StudioTrack } from '../model/types'
import { STUDIO_SAMPLE_RATE } from '../model/types'
import type { StudioStageGains, StudioStageParams } from './automation-line'
import { adoptLine, cutLine, lineEnd, pruneLine, rampLine, restartLine, UNITY_GAINS, } from './automation-line'
import type { StudioGraphLane } from './graph-lanes'
import type { StudioGraphState } from './graph-passes'
import { cycleSeconds, furthestPass, passStart } from './graph-passes'
import type { StudioLaneKnot } from './lane-automation'
import { studioKnotGainsAt, studioLaneAutomationKey, studioLaneKnots, } from './lane-automation'
import { SEEK_CROSSFADE_SECONDS } from './seek-crossfade'
import { wholeFrameAtOrAfter } from './whole-frame'

const SR = STUDIO_SAMPLE_RATE

/** A seek and a loop point cross the line over the 10 ms their audio crosses (seek-crossfade.ts). */
export const PASS_GLIDE_SECONDS = SEEK_CROSSFADE_SECONDS

/** A line drawn, moved or cleared while the song plays glides in as a fader does (graph-lanes.ts). */
export const EDIT_GLIDE_SECONDS = 0.012

/** Room for this thread to finish writing before the audio thread can reach the cut. */
const SCHEDULING_SECONDS = 0.005

/**
 * The soonest a cut may land: past the device callback the audio thread
 * may be rendering now, and past the writing itself, on a whole frame
 * (run.ts seekEarliest, which only a live context can ask).
 */
function soonest(ctx: BaseAudioContext): number {
  const reported = (ctx as Partial<Pick<AudioContext, 'baseLatency'>>)
    .baseLatency
  const callback =
    reported !== undefined && Number.isFinite(reported) && reported > 0
      ? reported
      : 0.01
  return wholeFrameAtOrAfter(
    ctx.currentTime +
      Math.max(callback, 256 / ctx.sampleRate) +
      SCHEDULING_SECONDS,
    ctx.sampleRate,
  )
}

/** Every gain pair a lane's line drives: its own, its sends' and a retiring chain's sends'. */
function stageParams(lane: StudioGraphLane): StudioStageParams {
  return [
    lane.stages,
    ...lane.sends.map((send) => send.stages),
    ...(lane.retiring?.sends ?? []).map((send) => send.stages),
  ].map((pair) => pair.map((gain) => gain.gain))
}

/** When frame `frame` of pass `pass` reaches the lanes' faders. */
function faderTime(
  state: StudioGraphState,
  pass: number,
  frame: number,
): number {
  return passStart(state, pass) + (frame - state.planStart) / SR + state.slowest
}

interface Place {
  readonly pass: number
  readonly frame: number
  /** When the place reaches the faders: `time`, or the run's start for a time before it. */
  readonly time: number
}

/**
 * What the faders hear at `time`: the run's first frame until it arrives,
 * then the pass and frame playing. A time on a loop point counts as the
 * end of the pass before it; past the last pass, that pass plays on.
 */
function placeAt(state: StudioGraphState, time: number): Place {
  const start = state.epoch + state.slowest
  if (time <= start) return { pass: 0, frame: state.fromFrame, time: start }
  const cycle = cycleSeconds(state)
  const since = time - state.slowest - passStart(state, 0)
  const last = state.looping ? Infinity : furthestPass(state)
  const pass =
    cycle > 0 ? Math.min(last, Math.max(0, Math.ceil(since / cycle) - 1)) : 0
  return { pass, frame: state.planStart + (since - pass * cycle) * SR, time }
}

/** The first knot after `frame`, or the knot count when none is. */
function firstKnotAfter(
  knots: readonly StudioLaneKnot[],
  frame: number,
): number {
  let low = 0
  let high = knots.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (knots[middle].frame <= frame) low = middle + 1
    else high = middle
  }
  return low
}

/**
 * Cut a lane's line at `at` and go on, gliding over `glide` seconds to
 * where the graph then plays, or holding to the run's start when that is
 * later; with no glide, the line goes straight on from the cut.
 */
export function cutLaneAutomation(
  state: StudioGraphState,
  lane: StudioGraphLane,
  at: number,
  glide: number,
): void {
  const automation = lane.automation
  const knots = automation.knots
  if (!knots) return
  const params = stageParams(lane)
  cutLine(params, automation.line, at)
  const place = placeAt(state, at + glide)
  if (place.time > at)
    rampLine(
      params,
      automation.line,
      place.time,
      studioKnotGainsAt(knots, place.frame),
    )
  automation.cursor = { pass: place.pass, frame: place.frame }
  writeAhead(state, lane, automation.horizon)
}

/**
 * Write a lane's line on from its cursor until it runs past `horizon`. A
 * knot the clock has already passed, when this thread fell behind, cuts
 * the line at the soonest time instead and glides it back on.
 */
function writeAhead(
  state: StudioGraphState,
  lane: StudioGraphLane,
  horizon: number,
): void {
  const automation = lane.automation
  const { knots, cursor, line } = automation
  if (!knots || !cursor) return
  const params = stageParams(lane)
  const floor = soonest(state.ctx)
  let { pass, frame } = cursor
  /** Ramp to `gains` at `time`; false, with the line cut to catch up, when the clock is past it. */
  const put = (time: number, gains: StudioStageGains): boolean => {
    if (time < floor) {
      cutLaneAutomation(state, lane, floor, EDIT_GLIDE_SECONDS)
      return false
    }
    if (time > lineEnd(line)) rampLine(params, line, time, gains)
    return true
  }
  while (lineEnd(line) <= horizon) {
    const next = firstKnotAfter(knots, frame)
    const another = state.looping || pass < furthestPass(state)
    if (another && (knots.at(next)?.frame ?? Infinity) >= state.endFrame) {
      // The pass ends here: cross back to the song's start for the next.
      const end = state.endFrame
      if (!put(faderTime(state, pass, end), studioKnotGainsAt(knots, end)))
        return
      pass += 1
      frame = state.planStart + PASS_GLIDE_SECONDS * SR
      if (!put(faderTime(state, pass, frame), studioKnotGainsAt(knots, frame)))
        return
      continue
    }
    const knot = knots.at(next)
    if (knot === undefined) break
    if (!put(faderTime(state, pass, knot.frame), knot.gains)) return
    frame = knot.frame
  }
  automation.cursor = { pass, frame }
}

/** Start a lane's line afresh at the run's first frame, while the run's envelope is still shut. */
function startLaneAutomation(
  state: StudioGraphState,
  lane: StudioGraphLane,
): void {
  const automation = lane.automation
  const params = stageParams(lane)
  const now = state.ctx.currentTime
  automation.cursor = null
  if (!automation.knots) {
    // A line cleared while parked: back to unity, which a new stage is at.
    if (automation.line.events.length > 0)
      restartLine(params, automation.line, now, UNITY_GAINS)
    return
  }
  const place = placeAt(state, -Infinity)
  const gains = studioKnotGainsAt(automation.knots, place.frame)
  restartLine(params, automation.line, now, gains)
  if (place.time > now) rampLine(params, automation.line, place.time, gains)
  automation.cursor = { pass: place.pass, frame: place.frame }
}

/** Every lane's line from the run's first frame: Play, a resume, a retime. */
export function startAutomation(state: StudioGraphState): void {
  for (const lane of state.lanes) startLaneAutomation(state, lane)
}

/** Write every lane's line on to `horizon`, letting go of what the clock has played. */
export function scheduleAutomation(
  state: StudioGraphState,
  horizon: number,
): void {
  const now = state.ctx.currentTime
  for (const lane of state.lanes) {
    lane.automation.horizon = horizon
    pruneLine(lane.automation.line, now)
    writeAhead(state, lane, horizon)
  }
}

/** Cross every lane's line to a seek's place: from `at`, when its audio reaches the faders, over `glide`. */
export function crossAutomation(
  state: StudioGraphState,
  at: number,
  glide: number,
): void {
  for (const lane of state.lanes) cutLaneAutomation(state, lane, at, glide)
}

/** Write every lane's line again as the graph now plays, from the soonest time: Repeat, a re-plan. */
export function followAutomation(state: StudioGraphState): void {
  const at = soonest(state.ctx)
  for (const lane of state.lanes) cutLaneAutomation(state, lane, at, 0)
}

/**
 * Follow `track`'s lines, when they or the controls under them changed:
 * the stage glides to the new line from the soonest time, or back to
 * unity when the last line went. A parked graph takes them on resume.
 */
export function setLaneAutomation(
  state: StudioGraphState,
  lane: StudioGraphLane,
  track: StudioTrack,
): void {
  const automation = lane.automation
  const key = studioLaneAutomationKey(track)
  if (key === automation.key) return
  automation.key = key
  automation.knots = studioLaneKnots(track)
  if (state.parked || state.disposed) return
  const at = soonest(state.ctx)
  if (automation.knots) {
    cutLaneAutomation(state, lane, at, EDIT_GLIDE_SECONDS)
    return
  }
  automation.cursor = null
  if (automation.line.events.length === 0) return
  const params = stageParams(lane)
  cutLine(params, automation.line, at)
  rampLine(params, automation.line, at + EDIT_GLIDE_SECONDS, UNITY_GAINS)
}

/** Put the sends a chain swap built for these lanes on their lanes' lines. */
export function adoptSwappedSends(
  state: StudioGraphState,
  trackIds: readonly string[],
): void {
  const now = state.ctx.currentTime
  for (const lane of state.lanes) {
    if (!trackIds.includes(lane.trackId)) continue
    const params = lane.sends.map((send) =>
      send.stages.map((gain) => gain.gain),
    )
    adoptLine(params, lane.automation.line, now)
  }
}
