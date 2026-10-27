// Studio arrangement plan — one immutable lane schedule for later live playback and offline rendering.
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import type { MixMacros } from '@/lib/studio-fx/mix-macros'
import { applyMixMacros, trackMacros } from '@/lib/studio-fx/mix-macros'
import { estimateTailSeconds } from '@/lib/studio-fx/render'
import type { StudioAsset, StudioClip, StudioProject, StudioTrack, } from './types'
import { validateStudioProject } from './validation'
import { frameValue, numberValue, requireValue } from './validation-values'

export interface StudioPlannedSegment {
  readonly clipIds: readonly string[]
  readonly assetId: string
  readonly startFrame: number
  /** Full coalesced group edges survive seek/range clipping. */
  readonly groupStartFrame: number
  readonly groupEndFrame: number
  readonly sourceInFrame: number
  readonly sourceOutFrame: number
  readonly gainDb: number
  readonly preparationGainDb: number
  readonly fades: StudioClip['fades']
}

export interface StudioPlannedLane {
  readonly track: StudioTrack
  readonly audible: boolean
  readonly spec: ChainSpec
  readonly segments: readonly StudioPlannedSegment[]
  /** Null means measurement is still required, never an assumed zero latency. */
  readonly chainLatencySeconds: number | null
  readonly compensationSeconds: number | null
}

export interface StudioArrangementPlan {
  readonly projectId: string
  readonly revision: number
  readonly sampleRate: 48000
  readonly startFrame: number
  readonly endFrame: number
  readonly tailFrames: number
  readonly monoMapping: 'dual-mono'
  readonly lanes: readonly StudioPlannedLane[]
  readonly master: StudioProject['master']
  readonly macros: StudioProject['mix']['macros']
}

export interface StudioPlanOptions {
  readonly startFrame?: number
  readonly endFrame?: number
  /**
   * Already measured at this context's actual rate, which need not be 48 kHz.
   * Every audible track needs one. A silent track with one is aligned with
   * the rest, so playback can bring it in without moving the others.
   */
  readonly latencies?: {
    readonly sampleRate: number
    readonly framesByTrack: Readonly<Record<string, number>>
  }
}

function sameFades(a: StudioClip['fades'], b: StudioClip['fades']): boolean {
  return (
    a.in?.fromSourceFrame === b.in?.fromSourceFrame &&
    a.in?.toSourceFrame === b.in?.toSourceFrame &&
    a.out?.fromSourceFrame === b.out?.fromSourceFrame &&
    a.out?.toSourceFrame === b.out?.toSourceFrame
  )
}

function coalesce(
  segments: readonly StudioPlannedSegment[],
): StudioPlannedSegment[] {
  const result: StudioPlannedSegment[] = []
  for (const segment of segments) {
    const previous = result.at(-1)
    if (
      previous &&
      previous.assetId === segment.assetId &&
      previous.gainDb === segment.gainDb &&
      previous.preparationGainDb === segment.preparationGainDb &&
      previous.sourceOutFrame === segment.sourceInFrame &&
      previous.startFrame + previous.sourceOutFrame - previous.sourceInFrame ===
        segment.startFrame &&
      sameFades(previous.fades, segment.fades)
    ) {
      result[result.length - 1] = {
        ...previous,
        sourceOutFrame: segment.sourceOutFrame,
        groupEndFrame: segment.groupEndFrame,
        clipIds: [...previous.clipIds, ...segment.clipIds],
      }
    } else result.push(segment)
  }
  return result
}

function laneSegments(
  project: StudioProject,
  trackId: string,
  assets: ReadonlyMap<string, StudioAsset>,
  start: number,
  end: number,
): StudioPlannedSegment[] {
  const segments: StudioPlannedSegment[] = []
  for (const clip of project.clips
    .filter((item) => item.trackId === trackId)
    .sort((a, b) => a.startFrame - b.startFrame)) {
    const asset = assets.get(clip.assetId)
    requireValue(
      asset !== undefined,
      `clip.${clip.id}`,
      'Owned audio is missing',
    )
    segments.push({
      clipIds: [clip.id],
      assetId: clip.assetId,
      startFrame: clip.startFrame,
      groupStartFrame: clip.startFrame,
      groupEndFrame: clip.startFrame + clip.sourceOutFrame - clip.sourceInFrame,
      sourceInFrame: clip.sourceInFrame,
      sourceOutFrame: clip.sourceOutFrame,
      gainDb: clip.gainDb,
      preparationGainDb: asset.preparation.gainDb,
      fades: clip.fades,
    })
  }
  return coalesce(segments).flatMap((segment) => {
    const from = Math.max(start, segment.startFrame)
    const to = Math.min(end, segment.groupEndFrame)
    if (to <= from) return []
    return [
      {
        ...segment,
        startFrame: from,
        sourceInFrame: segment.sourceInFrame + from - segment.startFrame,
        sourceOutFrame: segment.sourceInFrame + to - segment.startFrame,
      },
    ]
  })
}

/**
 * A lane's chain as it plays: the track's voiced chain under the song's
 * macros, with the lane's own space offset. Playback moves a running chain to
 * this when the sound changes, so it must stay the plan's only recipe.
 */
export function studioLaneSpec(
  track: Pick<StudioTrack, 'fx'>,
  macros: MixMacros,
): ChainSpec {
  return applyMixMacros(
    track.fx.baseSpec,
    trackMacros(macros, { space: track.fx.spaceOffset }),
  )
}

/** A plan is data only: it allocates no audio graph, starts no playback and owns no context. */
export function compileStudioArrangement(
  project: StudioProject,
  assets: readonly StudioAsset[],
  options: StudioPlanOptions = {},
): StudioArrangementPlan {
  const snapshot = validateStudioProject(project, assets)
  const owned = new Map(assets.map((asset) => [asset.id, asset]))
  const contentEnd = snapshot.clips.reduce(
    (end, clip) =>
      Math.max(end, clip.startFrame + clip.sourceOutFrame - clip.sourceInFrame),
    0,
  )
  const start = frameValue(options.startFrame ?? 0, 'plan.startFrame')
  const end = frameValue(options.endFrame ?? contentEnd, 'plan.endFrame')
  requireValue(end >= start, 'plan.range', 'End precedes start')
  const hasSolo = snapshot.tracks.some((track) => track.solo)
  const isAudible = (track: StudioTrack) =>
    !track.mute && (!hasSolo || track.solo)
  const rate = options.latencies
    ? numberValue(
        options.latencies.sampleRate,
        'plan.latencies.sampleRate',
        8000,
        384000,
      )
    : 0
  const seconds = new Map<string, number>()
  if (options.latencies) {
    const { framesByTrack } = options.latencies
    for (const track of snapshot.tracks) {
      if (!isAudible(track) && !Object.hasOwn(framesByTrack, track.id)) continue
      const frames = frameValue(
        framesByTrack[track.id],
        `plan.latencies.${track.id}`,
      )
      seconds.set(track.id, frames / rate)
    }
  }
  const slowest = Math.max(0, ...seconds.values())
  const lanes = [...snapshot.tracks]
    .sort((a, b) => a.order - b.order)
    .map((track): StudioPlannedLane => {
      const audible = isAudible(track)
      const latency = seconds.get(track.id) ?? null
      return {
        track,
        audible,
        spec: studioLaneSpec(track, snapshot.mix.macros),
        segments: laneSegments(snapshot, track.id, owned, start, end),
        chainLatencySeconds: latency,
        compensationSeconds: latency === null ? null : slowest - latency,
      }
    })
  const tailSeconds = Math.max(
    0,
    ...lanes
      .filter((lane) => lane.audible && lane.segments.length > 0)
      .map((lane) => estimateTailSeconds(lane.spec)),
  )
  return {
    projectId: snapshot.id,
    revision: snapshot.revision,
    sampleRate: 48000,
    startFrame: start,
    endFrame: end,
    tailFrames: Math.ceil(tailSeconds * 48000),
    monoMapping: 'dual-mono',
    lanes,
    master: snapshot.master,
    macros: snapshot.mix.macros,
  }
}

/** Evaluate a retained source envelope, including the partial ramps visible after a split. */
export function studioClipGainAtSourceFrame(
  clip: Pick<StudioClip, 'gainDb' | 'fades'>,
  sourceFrame: number,
): number {
  let envelope = 1
  const fadeIn = clip.fades.in
  const fadeOut = clip.fades.out
  if (fadeIn)
    envelope *= Math.max(
      0,
      Math.min(
        1,
        (sourceFrame - fadeIn.fromSourceFrame) /
          (fadeIn.toSourceFrame - fadeIn.fromSourceFrame),
      ),
    )
  if (fadeOut)
    envelope *= Math.max(
      0,
      Math.min(
        1,
        (fadeOut.toSourceFrame - sourceFrame) /
          (fadeOut.toSourceFrame - fadeOut.fromSourceFrame),
      ),
    )
  return Math.pow(10, clip.gainDb / 20) * envelope
}

/** Stereo balance: unity in the centre and attenuation only on the opposite side. */
export function studioPanGains(pan: number): readonly [number, number] {
  numberValue(pan, 'pan', -1, 1)
  if (pan === -1) return [1, 0]
  if (pan === 1) return [0, 1]
  return pan < 0
    ? [1, Math.cos((-pan * Math.PI) / 2)]
    : [Math.cos((pan * Math.PI) / 2), 1]
}
