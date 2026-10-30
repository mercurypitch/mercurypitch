// ============================================================
// Studio graph passes — where a playing graph's lanes read, pass by pass, on one anchor they all share
// ============================================================
//
// Every lane keeps its own timeline, but all of them are timed from one
// anchor: frame `fromFrame` enters a lane with no compensation at `epoch`.
// That keeps the lanes on the same frames through seeks, loops and re-plans.
// A loop is the plan from its start to its end; pass 0 is the one the anchor
// falls in, so a seek, a resume or a re-plan that moves the loop's length
// counts passes again from the one playing.
import type { StudioFxProfile } from '@/lib/studio-fx/fx-profile'
import { STUDIO_SAMPLE_RATE } from '../model/types'
import type { StudioGraphLane, StudioLaneRun } from './graph-lanes'
import { crossLane, dropPassesAfter, openLane } from './graph-lanes'
import type { StudioReverbBuses } from './graph-reverb-bus'
import { laneTimeline } from './lane-timeline'
import { EQUAL_POWER_FADE } from './seek-crossfade'

/**
 * A pass this close to its start counts as begun: the audio thread renders
 * ahead of the clock the page reads, so its first sources may already play.
 */
export const BEGUN_MARGIN_SECONDS = 0.05

/** The shortest song that can loop. */
export const MIN_LOOP_SECONDS = 0.25

export interface StudioGraphState {
  readonly ctx: BaseAudioContext
  readonly lanes: readonly StudioGraphLane[]
  readonly buffers: ReadonlyMap<string, AudioBuffer>
  /** The plan's first frame: where every pass starts but the first. */
  readonly planStart: number
  /** The slowest lane chain's latency in seconds, which every lane is aligned to. */
  readonly slowest: number
  endFrame: number
  looping: boolean
  /** Every source stopped, nothing scheduled, until resume. */
  parked: boolean
  disposed: boolean
  /** Frame `fromFrame` enters a lane with no compensation at `epoch`. */
  epoch: number
  fromFrame: number
  /** When the newest seek or re-plan crosses its lanes; -Infinity for Play's. */
  pendingAt: number
  /** How much work its lane chains do (fx-profile.ts); a swap builds with it. */
  profile: StudioFxProfile
  /** The shared reverb spaces its lanes send to, when the profile has them (graph-reverb-bus.ts). */
  readonly buses: StudioReverbBuses | null
}

/** How long one pass of the plan lasts. */
export function cycleSeconds(state: StudioGraphState): number {
  return (state.endFrame - state.planStart) / STUDIO_SAMPLE_RATE
}

/** When pass `pass`'s first frame enters a lane with no compensation, part-way passes included. */
export function passStart(state: StudioGraphState, pass = 0): number {
  return (
    state.epoch -
    (state.fromFrame - state.planStart) / STUDIO_SAMPLE_RATE +
    pass * cycleSeconds(state)
  )
}

/** Whether pass `pass` has begun, or is about to, on the context clock. */
export function begun(state: StudioGraphState, pass: number): boolean {
  const start = pass === 0 ? state.epoch : passStart(state, pass)
  return start <= state.ctx.currentTime + BEGUN_MARGIN_SECONDS
}

/** The furthest pass any lane has queued. */
export function furthestPass(state: StudioGraphState): number {
  return Math.max(0, ...state.lanes.map((lane) => lane.timeline.pass))
}

/** What every lane's schedule runs on. */
export function laneRun(state: StudioGraphState): StudioLaneRun {
  return {
    looping: state.looping,
    cycleSeconds: cycleSeconds(state),
    buffers: state.buffers,
  }
}

/**
 * When a change asked for no sooner than `earliest` crosses: then, or at
 * the newest change's own time while that one is not heard yet, since the
 * newer one takes its place there.
 */
export function seekTime(state: StudioGraphState, earliest: number): number {
  return state.pendingAt > state.ctx.currentTime
    ? Math.max(earliest, state.pendingAt)
    : earliest
}

/**
 * Every lane from `fromFrame`, which enters a lane with no compensation at
 * `epoch`: crossfading to it there (a seek), or from silence (resume), as
 * the run's envelope opens over it.
 */
export function restartLanes(
  state: StudioGraphState,
  fromFrame: number,
  epoch: number,
  cross: boolean,
): void {
  state.epoch = epoch
  state.fromFrame = fromFrame
  const start = passStart(state)
  for (const lane of state.lanes) {
    if (cross) crossLane(state.ctx, lane, epoch, EQUAL_POWER_FADE)
    else openLane(state.ctx, lane)
    lane.timeline = laneTimeline(lane.planned, start, fromFrame)
  }
  state.pendingAt = cross ? epoch : -Infinity
}

/**
 * Whether a lane is still crossing to a new chain (graph-swap.ts). Until
 * it is done, the graph seeks, re-plans and swaps nothing.
 */
export function swapping(state: StudioGraphState): boolean {
  const now = state.ctx.currentTime
  return state.lanes.some(
    (lane) => lane.retiring !== null && now < lane.retiring.silentAt,
  )
}

/** Whether the plan can loop: long enough, with something to play. */
export function canLoop(state: StudioGraphState): boolean {
  return (
    cycleSeconds(state) >= MIN_LOOP_SECONDS &&
    state.lanes.some((lane) => lane.planned.length > 0)
  )
}

/** Loop when the pass playing ends. False when that loop point has gone by, or the song is too short. */
export function repeatLanes(state: StudioGraphState): boolean {
  if (state.disposed || !canLoop(state)) return false
  if (!state.looping && begun(state, furthestPass(state) + 1)) return false
  state.looping = true
  return true
}

/** Stop looping: the pass that has begun is the last, and one queued ahead never plays. */
export function stopRepeatingLanes(state: StudioGraphState): number {
  state.looping = false
  const furthest = furthestPass(state)
  let last = furthest
  while (last > 0 && !begun(state, last)) last--
  if (last === furthest) return last
  for (const lane of state.lanes)
    if (lane.timeline.pass > last) dropPassesAfter(lane, last)
  return last
}
