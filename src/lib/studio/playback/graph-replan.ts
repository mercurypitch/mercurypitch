// ============================================================
// Studio graph re-plan — an edit to clips moves only the lanes it changes, on the graph that plays
// ============================================================
//
// A clip edit used to hand the whole song to a newly built graph: every
// lane's sources started again, every chain was built again, and the lanes
// the edit never touched dipped 0.4 to 0.7 dB through the handover in
// headless Chromium. Each lane now keeps its own timeline, so a new plan
// changes only the lanes whose segments differ. Each of those crossfades
// from what it plays to sources started on the first whole frame it can
// reach: linear over 30 ms when both sides are the same audio on the same
// frames (a clip's gain or fade), equal power over 10 ms when they are not
// (a clip moved under the playhead). Every other lane plays on untouched,
// its chain's tail and its meter with it; a split, which plays the same
// segments, starts nothing.
//
// A plan that ends elsewhere changes the loop's length. The pass playing
// keeps its start, so passes are counted again from it, and a lane that has
// queued the next pass takes it back and queues it on the new length. Close
// to the loop point that next pass may already be rendering: then, as for
// anything else a re-plan cannot express, the caller hands over to a new
// run instead (handoff.ts).
import type { StudioArrangementPlan, StudioPlannedSegment, } from '../model/arrangement-plan'
import { STUDIO_SAMPLE_RATE } from '../model/types'
import type { StudioGraphLane } from './graph-lanes'
import { crossLane, dropPassesAfter, rebaseLane } from './graph-lanes'
import type { StudioGraphState } from './graph-passes'
import { BEGUN_MARGIN_SECONDS, furthestPass, MIN_LOOP_SECONDS, passStart, swapping, } from './graph-passes'
import { laneTimeline, plannedSegments, sameAudioAt, sameSegments, } from './lane-timeline'
import { EQUAL_POWER_FADE, LINEAR_FADE } from './seek-crossfade'

/** What a re-plan did, and the graph's anchor after it. */
export interface StudioReplan {
  /** When the lanes it changed cross to their new sources; null when it changed none. */
  readonly at: number | null
  /** Frame `fromFrame` enters a lane with no compensation at `epoch`: the run's place on the clock. */
  readonly fromFrame: number
  readonly epoch: number
}

/** Where a re-plan or a swap crosses: the time, the pass it falls in and the plan frame there. */
export interface ReplanPlace {
  readonly at: number
  readonly pass: number
  readonly frame: number
}

/**
 * The lanes `plan` plays differently and their new segments. Null when it
 * cannot play on this graph: a lane heard now that the graph has no chain
 * for, or audio the graph was not given.
 */
function laneChanges(
  state: StudioGraphState,
  plan: StudioArrangementPlan,
): Map<StudioGraphLane, readonly StudioPlannedSegment[]> | null {
  const built = new Set(state.lanes.map((lane) => lane.trackId))
  const planned = new Map(plan.lanes.map((lane) => [lane.track.id, lane]))
  for (const lane of plan.lanes)
    if (lane.audible && lane.segments.length > 0 && !built.has(lane.track.id))
      return null
  const changes = new Map<StudioGraphLane, readonly StudioPlannedSegment[]>()
  for (const lane of state.lanes) {
    const segments = planned.get(lane.trackId)?.segments ?? []
    if (sameSegments(lane.segments, segments)) continue
    if (segments.some((segment) => !state.buffers.has(segment.assetId)))
      return null
    changes.set(lane, segments)
  }
  return changes
}

/**
 * The first whole frame after the anchor no sooner than `earliest`, nor
 * than a change not heard yet. Null once a song that plays once has played
 * its last pass out.
 */
export function replanPlace(
  state: StudioGraphState,
  earliest: number,
): ReplanPlace | null {
  const cycle = state.endFrame - state.planStart
  if (cycle <= 0) return null
  const from = Math.max(earliest, state.epoch, state.pendingAt)
  // A hair under a whole frame rounds down, so float noise never costs one.
  const frames = Math.max(
    0,
    Math.ceil((from - state.epoch) * STUDIO_SAMPLE_RATE - 1e-6),
  )
  const into = state.fromFrame - state.planStart + frames
  const pass = Math.floor(into / cycle)
  if (!state.looping && pass > furthestPass(state)) return null
  return {
    at: state.epoch + frames / STUDIO_SAMPLE_RATE,
    pass,
    frame: state.planStart + into - pass * cycle,
  }
}

/** Count passes from `pass`, which keeps its start: the anchor moves to its first frame. */
export function rebase(state: StudioGraphState, pass: number): void {
  if (pass === 0) return
  const start = passStart(state, pass)
  state.epoch = start
  state.fromFrame = state.planStart
  for (const lane of state.lanes) rebaseLane(lane, pass, start)
}

function setSegments(
  state: StudioGraphState,
  lane: StudioGraphLane,
  segments: readonly StudioPlannedSegment[],
): void {
  lane.segments = segments
  lane.planned = plannedSegments(
    segments,
    state.planStart,
    lane.feed.compensation,
  )
}

/** Cross a lane to its new segments at `place`, read from there in the pass playing. */
function crossTo(
  state: StudioGraphState,
  lane: StudioGraphLane,
  segments: readonly StudioPlannedSegment[],
  place: ReplanPlace,
): void {
  const shape = sameAudioAt(lane.segments, segments, place.frame)
    ? LINEAR_FADE
    : EQUAL_POWER_FADE
  crossLane(state.ctx, lane, place.at, shape)
  setSegments(state, lane, segments)
  lane.timeline = laneTimeline(lane.planned, passStart(state), place.frame)
}

/** Whether a new loop length could catch a pass queued on the old one already rendering. */
function loopTooClose(state: StudioGraphState, pass: number): boolean {
  return (
    passStart(state, pass + 1) - state.ctx.currentTime < BEGUN_MARGIN_SECONDS
  )
}

const anchor = (state: StudioGraphState, at: number | null): StudioReplan => ({
  at,
  fromFrame: state.fromFrame,
  epoch: state.epoch,
})

/** Swap a parked graph's segments in: it plays nothing until resume times its lanes afresh. */
function replanParked(
  state: StudioGraphState,
  plan: StudioArrangementPlan,
  changes: ReadonlyMap<StudioGraphLane, readonly StudioPlannedSegment[]>,
): StudioReplan {
  for (const [lane, segments] of changes) setSegments(state, lane, segments)
  state.endFrame = plan.endFrame
  return anchor(state, null)
}

/**
 * Whether `plan` can play on this graph at all: from its first frame, long
 * enough to loop while it loops, and with no lane crossing to a new chain.
 */
function canTake(
  state: StudioGraphState,
  plan: StudioArrangementPlan,
): boolean {
  if (state.disposed || plan.startFrame !== state.planStart) return false
  if (swapping(state)) return false
  const loop = (plan.endFrame - plan.startFrame) / STUDIO_SAMPLE_RATE
  return !state.looping || loop >= MIN_LOOP_SECONDS
}

/** Take back every pass a lane queued on the old loop length. */
function dropQueuedPasses(state: StudioGraphState): void {
  for (const lane of state.lanes)
    if (lane.timeline.pass > 0) dropPassesAfter(lane, 0)
}

/**
 * Move the lanes whose segments `plan` changes to them, no sooner than
 * `earliest`; see the header. Null, with nothing changed, when the graph
 * cannot: a plan from another first frame, a lane or audio it lacks, a
 * place the new plan does not reach, a loop too short or too close to move,
 * or a lane still crossing to a new chain (graph-swap.ts).
 */
export function replanGraph(
  state: StudioGraphState,
  plan: StudioArrangementPlan,
  earliest: number,
): StudioReplan | null {
  if (!canTake(state, plan)) return null
  const changes = laneChanges(state, plan)
  if (!changes) return null
  if (state.parked) return replanParked(state, plan, changes)
  const place = replanPlace(state, earliest)
  if (!place || place.frame >= plan.endFrame) return null
  const moveLoop = state.looping && plan.endFrame !== state.endFrame
  if (moveLoop && loopTooClose(state, place.pass)) return null
  rebase(state, place.pass)
  if (moveLoop) dropQueuedPasses(state)
  state.endFrame = plan.endFrame
  for (const [lane, segments] of changes) crossTo(state, lane, segments, place)
  if (!changes.size) return anchor(state, null)
  state.pendingAt = Math.max(state.pendingAt, place.at)
  return anchor(state, place.at)
}
