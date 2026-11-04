// ============================================================
// Studio comp plan — a comped clip as playback reads it: a source per stretch, each crossed into the next at equal power
// ============================================================
//
// Each stretch of a comp (clip-comp.ts) is planned as a segment of its own:
// the clip's source frames moved by whole passes to the pass the stretch
// names, its fades moved with them, so a fade lands where the clip's does
// whichever pass plays there. A clip's stretches share its edges for the
// safety ramp (edge-envelope.ts), so that ramp never dips at a join. Live
// Play, a lane render, Compare, auto-balance and Export all read this plan
// (arrangement-plan.ts), so they all play the same comp the same way.
//
// Where two stretches meet, the passes cross over: each side plays on half
// a crossfade past the join and a frame more, and their gains follow a
// cosine and a sine of the same frames, so the powers sum to one on every
// frame. Two passes are two performances of a phrase, not one signal at two
// levels: a linear pair would sag 3 dB at the join. 10 ms, the length the
// seek crossfade settled on for unrelated material (seek-crossfade.ts),
// centred on the join, and never longer than half the shorter stretch. A
// join a few frames from the edge of what plays, with no room to cross, is
// cut.
//
// Joins are crossed once the plan has coalesced a lane, on the stretches as
// they play, so a split inside a stretch crosses its joins as before. A song
// with no comp gets no crossfades and plans exactly as it did before comping
// (uncomped-schedule.test.ts).
import { studioPassAt } from './clip-passes'
import type { FadeRamp, StudioClip } from './types'

/** A comp join's crossfade at its longest: 10 ms at 48 kHz, centred on the join. */
export const STUDIO_COMP_CROSSFADE_FRAMES = 480

/** Equal-power crossfades at a planned segment's comp joins, in its source frames. */
export interface StudioPlannedCrossfades {
  /** Rises from silence along a sine, across the join before it. */
  readonly in?: FadeRamp
  /** Falls to silence along a cosine, across the join after it. */
  readonly out?: FadeRamp
}

/** What the comp step reads and writes of a planned segment (arrangement-plan.ts). */
interface CompSpan {
  readonly startFrame: number
  readonly groupStartFrame: number
  readonly groupEndFrame: number
  readonly sourceInFrame: number
  readonly sourceOutFrame: number
  readonly fades: StudioClip['fades']
  readonly crossfades?: StudioPlannedCrossfades
}

/** A join not yet crossed: no frames long, at the join (crossStudioCompJoins). */
const joinAt = (sourceFrame: number): FadeRamp => ({
  fromSourceFrame: sourceFrame,
  toSourceFrame: sourceFrame,
})

/**
 * A clip's segments before its lane coalesces: `whole`, the clip as one
 * segment, for a clip with no comp; else one per stretch, each on its
 * pass, the joins between them marked to be crossed.
 */
export function studioCompSegments<T extends CompSpan>(
  clip: StudioClip,
  whole: T,
): T[] {
  const { comp, passes } = clip
  if (!comp || !passes) return [whole]
  const own = studioPassAt(passes, clip.sourceInFrame)
  const { curve, in: rise, out: fall } = whole.fades
  return comp.map((part, index) => {
    const shift = (part.pass - own) * passes.frames
    const move = (ramp: FadeRamp) => ({
      fromSourceFrame: ramp.fromSourceFrame + shift,
      toSourceFrame: ramp.toSourceFrame + shift,
    })
    return {
      ...whole,
      startFrame: whole.startFrame + part.fromSourceFrame - clip.sourceInFrame,
      sourceInFrame: part.fromSourceFrame + shift,
      sourceOutFrame: part.toSourceFrame + shift,
      fades: {
        curve,
        ...(rise && { in: move(rise) }),
        ...(fall && { out: move(fall) }),
      },
      crossfades: {
        ...(index > 0 && { in: joinAt(part.fromSourceFrame + shift) }),
        ...(index < comp.length - 1 && {
          out: joinAt(part.toSourceFrame + shift),
        }),
      },
    }
  })
}

/** The crossfade across a join at source frame `join`, `half` frames either side. */
const around = (join: number, half: number): FadeRamp => ({
  fromSourceFrame: join - half,
  toSourceFrame: join + half,
})

/**
 * A coalesced lane with its comp joins crossed (see the header): each side
 * reaching half a crossfade and a frame past its join, ramps on the frames
 * around it, and the segments a run of joins links given the run's edges.
 * A lane with no comp comes back as it was.
 */
export function crossStudioCompJoins<T extends CompSpan>(
  segments: readonly T[],
): T[] {
  if (!segments.some((segment) => segment.crossfades)) return [...segments]
  const joined = (index: number) =>
    segments[index].crossfades?.out !== undefined &&
    segments[index + 1]?.crossfades?.in !== undefined
  const own = (segment: T) => segment.sourceOutFrame - segment.sourceInFrame
  // Half the crossfade at the join after segment `index`.
  const half = (index: number) =>
    Math.min(
      STUDIO_COMP_CROSSFADE_FRAMES / 2,
      Math.floor(Math.min(own(segments[index]), own(segments[index + 1])) / 4),
    )
  // A side plays a frame past its crossfade, as frozen chunks do (lane-freeze.ts).
  const reach = (frames: number) => (frames > 0 ? frames + 1 : 0)
  const result: T[] = []
  for (let first = 0; first < segments.length; ) {
    let last = first
    while (joined(last)) last++
    for (let index = first; index <= last; index++) {
      const { crossfades: _joins, ...segment } = segments[index]
      const before = index > first ? half(index - 1) : 0
      const after = index < last ? half(index) : 0
      const crossfades: StudioPlannedCrossfades = {
        ...(before > 0 && { in: around(segment.sourceInFrame, before) }),
        ...(after > 0 && { out: around(segment.sourceOutFrame, after) }),
      }
      result.push({
        ...segment,
        startFrame: segment.startFrame - reach(before),
        groupStartFrame: segments[first].groupStartFrame,
        groupEndFrame: segments[last].groupEndFrame,
        sourceInFrame: segment.sourceInFrame - reach(before),
        sourceOutFrame: segment.sourceOutFrame + reach(after),
        ...((crossfades.in || crossfades.out) && { crossfades }),
      } as T)
    }
    first = last + 1
  }
  return result
}

/** The gain a segment's comp crossfades give one of its source frames: a sine rising in, a cosine falling out. */
export function studioCrossfadeGain(
  crossfades: StudioPlannedCrossfades | undefined,
  sourceFrame: number,
): number {
  if (!crossfades) return 1
  const along = ({ fromSourceFrame: from, toSourceFrame: to }: FadeRamp) =>
    to > from
      ? Math.max(0, Math.min(1, (sourceFrame - from) / (to - from)))
      : sourceFrame >= from
        ? 1
        : 0
  let gain = 1
  if (crossfades.in) gain *= Math.sin((Math.PI / 2) * along(crossfades.in))
  if (crossfades.out) gain *= Math.cos((Math.PI / 2) * along(crossfades.out))
  return gain
}
