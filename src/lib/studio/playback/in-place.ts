// Studio in-place edits — a playing run follows the mix, the sound, Repeat and a measured master gain without a restart.
import type { MacroKey } from '@/lib/studio-fx/mix-macros'
import type { StudioMasterGain } from '../export/sound-graph'
import { resolveStudioSoundGraph } from '../export/sound-graph'
import { studioLaneSpec } from '../model/arrangement-plan'
import type { StudioAsset, StudioProject, StudioTrack } from '../model/types'
import { freezesOutdated, frozenSoundChanged } from './lane-freeze'
import type { StudioFreezeLookup } from './lane-freezer'
import { keepsChains, replanLanes } from './lane-replan'
import type { StudioKnownLatency } from './lane-swap'
import { swapLanes } from './lane-swap'
import { audibility, graphShape, laneTailFrames, soundKey } from './live-edit'
import type { StudioRun } from './run'
import { RUN_LOOKAHEAD_SECONDS } from './run'

/** A lane's volume or pan while its control is still moving. */
export type StudioLaneDraft = Partial<Pick<StudioTrack, 'gainDb' | 'pan'>>

/** Controls still moving: heard at once, saved only when the gesture ends. */
export interface StudioDrafts {
  readonly lanes: Map<string, StudioLaneDraft>
  readonly macros: Map<MacroKey, number>
}

/** What a playing run follows besides the project. */
export interface StudioLiveSettings {
  readonly drafts: StudioDrafts
  readonly repeat: boolean
  /** The newest measured master gain, or null to keep the run's own. */
  readonly masterGain: StudioMasterGain | null
  /** What a new chain's latency was measured as: a lane swaps to one only once it is known. */
  readonly chainLatency: StudioKnownLatency
  /** Lanes rendered ahead, as the controls still moving sound (draftedFreezes). */
  readonly freezes?: StudioFreezeLookup
}

/** The freezer as the song sounds now: renders for the drafts' sound, not only the saved one. */
export function draftedFreezes(
  lookup: StudioFreezeLookup | undefined,
  drafts: StudioDrafts,
): StudioFreezeLookup | undefined {
  if (!lookup) return undefined
  return {
    hold: (project, assets) => lookup.hold(withDrafts(project, drafts), assets),
    differs: (project, assets, frozen) =>
      lookup.differs(withDrafts(project, drafts), assets, frozen),
  }
}

/** The project as it sounds now: saved values under the controls still moving. */
export function withDrafts(
  project: StudioProject,
  drafts: StudioDrafts,
): StudioProject {
  if (!drafts.lanes.size && !drafts.macros.size) return project
  return {
    ...project,
    mix: {
      ...project.mix,
      macros: { ...project.mix.macros, ...Object.fromEntries(drafts.macros) },
    },
    tracks: project.tracks.map((track) => {
      const draft = drafts.lanes.get(track.id)
      return draft ? { ...track, ...draft } : track
    }),
  }
}

/**
 * The mix for a run that plays on while a newer one is built or takes over:
 * the new Mute, Solo, volume and pan, but each lane's balance from its own
 * project. A balance comes with a lane's sound (a new role brings both),
 * and this run still plays the old sound: the new balance on the old chain
 * would jump the level, and the master's dynamics with it, before the new
 * run brings both in together.
 */
export function heldMix(run: StudioRun, project: StudioProject): StudioProject {
  const balances = new Map(
    run.project.tracks.map((track) => [track.id, track.balanceGainDb]),
  )
  return {
    ...project,
    tracks: project.tracks.map((track) => {
      const balanceGainDb = balances.get(track.id) ?? track.balanceGainDb
      return balanceGainDb === track.balanceGainDb
        ? track
        : { ...track, balanceGainDb }
    }),
  }
}

/** Glide each lane to its volume and pan, or to silence; the lanes heard set the end. */
export function applyMix(run: StudioRun, project: StudioProject): void {
  const audible = audibility(project)
  for (const track of project.tracks)
    run.graph.setLaneMix(track, audible(track))
  run.tailFrames = laneTailFrames(run.graph, project)
}

/** Move the running chains to the project's sound; their tails set the end. */
export function applySound(run: StudioRun, project: StudioProject): void {
  for (const track of project.tracks) {
    if (run.graph.hasLane(track.id))
      run.graph.setLaneSpec(track.id, studioLaneSpec(track, project.mix.macros))
  }
  run.graph.setMasterSpec(resolveStudioSoundGraph(project, run.measured).full)
  run.tailFrames = laneTailFrames(run.graph, project)
}

/**
 * Take up a newly measured master gain, which the running master then glides
 * to. Null leaves the run's own, so an edit that makes the measurement stale
 * does not change the level of the song playing.
 */
export function followMaster(
  run: StudioRun,
  gain: StudioMasterGain | null,
): boolean {
  if (
    !gain ||
    (gain.gainDb === run.measured.gainDb &&
      gain.safetyGainDb === run.measured.safetyGainDb)
  )
    return false
  run.measured = { gainDb: gain.gainDb, safetyGainDb: gain.safetyGainDb }
  return true
}

/**
 * Make the running graph follow the Repeat switch: on, it loops at the
 * song's end; off, the pass that has begun is the last. False when the
 * loop point has already gone by, so only a restart can loop.
 */
export function followRepeat(run: StudioRun, repeat: boolean): boolean {
  if (repeat === (run.untilFrame === Infinity)) return true
  if (!repeat) {
    run.untilFrame = (run.graph.stopRepeating() + 1) * run.endFrame
    return true
  }
  if (!run.canLoop || !run.graph.repeat()) return false
  run.untilFrame = Infinity
  run.graph.scheduleUntil(run.ctx.currentTime + RUN_LOOKAHEAD_SECONDS)
  return true
}

/**
 * Hear a lane's volume or pan on each run while its control moves, without
 * saving. Null ends the preview and returns the lane to its saved values.
 */
export function previewLaneDraft(
  runs: readonly StudioRun[],
  drafts: StudioDrafts,
  trackId: string,
  draft: StudioLaneDraft | null,
): void {
  if (draft === null) drafts.lanes.delete(trackId)
  else drafts.lanes.set(trackId, { ...draft })
  for (const run of runs) {
    const live = withDrafts(run.project, drafts)
    const track = live.tracks.find((item) => item.id === trackId)
    if (track) run.graph.setLaneMix(track, audibility(live)(track))
  }
}

/**
 * The same for a sound macro: each run's chains follow a moving dial. False
 * when a run plays a lane from a render the dial changes: only a new run,
 * with that lane live, can follow it.
 */
export function previewMacroDraft(
  runs: readonly StudioRun[],
  drafts: StudioDrafts,
  name: MacroKey,
  value: number | null,
): boolean {
  if (value === null) drafts.macros.delete(name)
  else drafts.macros.set(name, value)
  let followed = true
  for (const run of runs) {
    const live = withDrafts(run.project, drafts)
    if (frozenSoundChanged(run.frozen, live)) followed = false
    applySound(run, live)
  }
  return followed
}

/** A control moved while the song was getting ready: start as it sounds. */
export function applyDrafts(run: StudioRun, drafts: StudioDrafts): void {
  if (!drafts.lanes.size && !drafts.macros.size) return
  const live = withDrafts(run.project, drafts)
  applyMix(run, live)
  applySound(run, live)
}

/**
 * Apply an edit to the running graph, so the song keeps playing. Lane
 * volume, balance, pan, Mute and Solo glide, silent lanes included, and
 * Repeat moves the loop; the macros, a flavour's master EQ, the ceiling and
 * a newly measured master gain move the running chains, which send only the
 * values that changed. An edit to nothing the graph plays, such as an empty
 * new lane or a name, changes nothing. False when it needs a new run: other
 * clips or chain shapes, Repeat turned on after the loop point, or a lane
 * brought in that Play left out because memory was short.
 */
export function playInPlace(
  run: StudioRun,
  project: StudioProject,
  settings: StudioLiveSettings,
): boolean {
  const profile = run.graph.profile()
  if (graphShape(run.project, profile) !== graphShape(project, profile))
    return false
  if (!followRepeat(run, settings.repeat)) return false
  if (missingLane(run, project, settings.drafts)) return false
  followInPlace(run, project, settings)
  return true
}

/**
 * Follow an edit on the running graph, so the song keeps playing: in place
 * (playInPlace); for other clips through the same chains, by moving only
 * the lanes they change (lane-replan.ts); for another effect list, by
 * crossing only its lane to a new chain (lane-swap.ts). False when it needs
 * a new run: anything a re-plan or a swap cannot express.
 */
export function followEdit(
  run: StudioRun,
  project: StudioProject,
  assets: readonly StudioAsset[],
  settings: StudioLiveSettings,
): boolean {
  // A lane played from a render follows no edit to its clips or its sound.
  if (freezesOutdated(run.frozen, withDrafts(project, settings.drafts), assets))
    return false
  if (playInPlace(run, project, settings)) return true
  if (!followRepeat(run, settings.repeat)) return false
  const followed = keepsChains(run, project)
    ? replanLanes(run, project, assets)
    : swapLanes(run, project, settings.chainLatency)
  if (!followed) return false
  followInPlace(run, project, settings)
  return true
}

/** A lane heard now, with material, that the run left out because memory was short. */
function missingLane(
  run: StudioRun,
  project: StudioProject,
  drafts: StudioDrafts,
): boolean {
  const live = withDrafts(project, drafts)
  const audible = audibility(live)
  return live.tracks.some(
    (track) =>
      audible(track) &&
      run.sounding.has(track.id) &&
      !run.graph.hasLane(track.id),
  )
}

/**
 * Whether a run's graph can play `project` as it is: the same clips and
 * lane effect lists, and every lane heard now built. Mix and sound it moves
 * with followInPlace; Repeat is the caller's.
 */
export function fitsInPlace(
  run: StudioRun,
  project: StudioProject,
  drafts: StudioDrafts,
): boolean {
  return (
    graphShape(run.project, run.graph.profile()) ===
      graphShape(project, run.graph.profile()) &&
    !missingLane(run, project, drafts)
  )
}

/** Move a run that fits `project` to its mix and sound, and to a newly measured master gain. */
export function followInPlace(
  run: StudioRun,
  project: StudioProject,
  settings: StudioLiveSettings,
): void {
  const live = withDrafts(project, settings.drafts)
  applyMix(run, live)
  const master = followMaster(run, settings.masterGain)
  if (
    master ||
    settings.drafts.macros.size > 0 ||
    soundKey(run.project) !== soundKey(project)
  )
    applySound(run, live)
  run.project = project
}
