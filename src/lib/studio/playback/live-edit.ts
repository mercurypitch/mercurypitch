// Studio live edits — which lanes a playing graph builds, who is heard, and what an edit changes.
import { estimateTailSeconds } from '@/lib/studio-fx/render'
import { StudioMemoryError } from '../memory-budget'
import { studioLaneSpec } from '../model/arrangement-plan'
import type { StudioProject, StudioTrack } from '../model/types'
import type { StudioGraph } from './graph'

/** How a run is built: which lanes, and where its plan starts. */
export interface StudioRunLayout {
  /** The lanes silent now too, at zero gain: Mute and Solo bring them in while the song plays. */
  readonly silentLanes: boolean
  /** The plan's first frame: 0 lets a run loop to the song's start when Repeat comes on. */
  readonly start: number
}

/**
 * The ways to build a run from `from`, the most capable first; each next
 * one needs less memory. Without silent lanes, bringing a lane in restarts
 * the song. A plan from `from`, for a song too long to hold whole, plays
 * on but restarts to loop.
 */
export function studioRunLayouts(
  from: number,
  repeat: boolean,
): StudioRunLayout[] {
  const layouts = [
    { silentLanes: true, start: 0 },
    { silentLanes: false, start: 0 },
  ]
  return repeat || from === 0
    ? layouts
    : [...layouts, { silentLanes: false, start: from }]
}

/** The first option whose attempt fits in memory; any other failure ends the search. */
export async function firstThatFits<O, T>(
  options: readonly O[],
  attempt: (option: O) => Promise<T>,
): Promise<T> {
  let failure: unknown = new StudioMemoryError('Nothing to try.')
  for (const option of options) {
    try {
      return await attempt(option)
    } catch (error) {
      if (!(error instanceof StudioMemoryError)) throw error
      failure = error
    }
  }
  throw failure
}

/** The longest chain tail among the built lanes heard now, in frames. */
export function laneTailFrames(
  graph: StudioGraph,
  project: StudioProject,
): number {
  const audible = audibility(project)
  const seconds = project.tracks
    .filter((track) => audible(track) && graph.hasLane(track.id))
    .map((track) =>
      estimateTailSeconds(studioLaneSpec(track, project.mix.macros)),
    )
  return Math.ceil(Math.max(0, ...seconds) * 48000)
}

/** Who is heard: lanes not muted, and only soloed ones while any is soloed. */
export function audibility(
  project: StudioProject,
): (track: StudioTrack) => boolean {
  const hasSolo = project.tracks.some((track) => track.solo)
  return (track) => !track.mute && (!hasSolo || track.solo)
}

/**
 * What a running graph is built from: the clips, and the effect list of each
 * lane that has any. Two projects with the same shape play through the same
 * graph; mix and sound settings move it in place.
 */
export function graphShape(project: StudioProject): string {
  const used = new Set(project.clips.map((clip) => clip.trackId))
  const byId = <T extends { id: string }>(a: T, b: T) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  return JSON.stringify({
    clips: [...project.clips].sort(byId),
    lanes: project.tracks
      .filter((track) => used.has(track.id))
      .sort(byId)
      .map((track) => [
        track.id,
        track.fx.baseSpec.effects.map(
          (effect) => `${effect.id}:${effect.kind}`,
        ),
      ]),
  })
}

/** Everything the running chains play with. */
export function soundKey(project: StudioProject): string {
  return JSON.stringify([
    project.mix.macros,
    project.master.masterEq,
    project.master.ceilingDbtp,
    project.tracks.map((track) => [track.id, track.fx]),
  ])
}
