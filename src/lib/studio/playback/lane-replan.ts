// ============================================================
// Studio lane re-plan — a playing or kept run follows a clip edit on its own graph, lane by lane
// ============================================================
//
// A clip edit used to need a new run: a whole graph built beside the one
// playing, then a 30 ms handover (handoff.ts) that every lane went through,
// the ones the edit never touched included. A run whose chains the edit
// leaves alone now moves its own graph instead (graph-replan.ts): only the
// lanes whose clips changed cross to new sources, about a callback after
// the edit, and the run's place on the clock, its end and the lanes it
// sounds follow the new plan. A run Pause kept takes the edit the same way,
// so the next Play still starts it without a build.
//
// Another effect list on a lane the graph built is a chain swap's instead
// (lane-swap.ts). What a re-plan cannot express goes to a new run as before,
// each for its own reason: audio the run does not hold, a lane heard now
// that the graph has no chain for, a place the new plan does not reach, a
// loop length that changes while the next pass may already be rendering,
// and a lane still crossing to a new chain.
import { compileStudioArrangement } from '../model/arrangement-plan'
import type { StudioAsset, StudioProject } from '../model/types'
import { changedChains } from './live-edit'
import type { StudioRun } from './run'
import { RUN_LOOKAHEAD_SECONDS } from './run'
import { seekEarliest } from './seek'

/** Whether `project` keeps every chain the run's graph built. */
export function keepsChains(run: StudioRun, project: StudioProject): boolean {
  return changedChains(run.graph, run.project, project).length === 0
}

/**
 * Move a run's graph to `project`'s clips, lane by lane, and the run's
 * clock, end and sounding lanes with it. The mix, the sound and Repeat are
 * the caller's. False, with the run as it was, when the graph cannot.
 */
export function replanLanes(
  run: StudioRun,
  project: StudioProject,
  assets: readonly StudioAsset[],
): boolean {
  if (!keepsChains(run, project)) return false
  let plan
  try {
    plan = compileStudioArrangement(project, assets, {
      startFrame: run.firstFrame,
    })
  } catch {
    // An edit the plan cannot take; the new run reports it.
    return false
  }
  const moved = run.graph.replan(plan, seekEarliest(run.ctx))
  if (!moved) return false
  run.startFrame = moved.fromFrame
  run.audibleEpoch = moved.epoch + run.latency
  run.endFrame = plan.endFrame
  // A song that plays once ends with the pass playing, on its new length.
  if (run.untilFrame !== Infinity) run.untilFrame = plan.endFrame
  run.sounding = new Set(
    plan.lanes
      .filter((lane) => lane.segments.length > 0)
      .map((lane) => lane.track.id),
  )
  run.graph.scheduleUntil(run.ctx.currentTime + RUN_LOOKAHEAD_SECONDS)
  return true
}
