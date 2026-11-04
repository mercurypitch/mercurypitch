// Studio comp plan tests — a comped clip plays each stretch from its own pass, crossing at every join over 10 ms of equal power centred on it.
import { describe, expect, it } from 'vitest'
import { scheduleStudioSegmentGain, studioSegmentGain, } from '../playback/edge-envelope'
import { laneFreezeKeys } from '../playback/lane-freeze'
import type { StudioPlannedSegment } from './arrangement-plan'
import { compileStudioArrangement } from './arrangement-plan'
import { applyStudioCommand } from './commands'
import { STUDIO_COMP_CROSSFADE_FRAMES, studioCrossfadeGain } from './comp-plan'
import { studioFixture, TEST_NOW } from './model.test-fixtures'
import type { StudioAsset, StudioClip, StudioCompSegment, StudioProject, } from './types'

const PASS = 4800

/** A loop take of three 4800-frame passes from frame 1000, its clip on pass 1 at 2000, comped as given. */
function comped(comp?: readonly StudioCompSegment[], clipFades = false) {
  const { project, asset, clip } = studioFixture()
  const take: StudioAsset = {
    ...asset,
    id: 'take-1',
    normalizedFrameCount: 1000 + 3 * PASS,
    canonicalPcmByteLength: 32 + (1000 + 3 * PASS) * 4,
    preparation: { ...asset.preparation, gainDb: 0 },
  }
  const loop: StudioClip = {
    ...clip,
    assetId: take.id,
    startFrame: 2000,
    sourceInFrame: 1000 + PASS,
    sourceOutFrame: 1000 + 2 * PASS,
    gainDb: 0,
    fades: clipFades
      ? {
          curve: 'linear-amplitude',
          in: { fromSourceFrame: 5800, toSourceFrame: 6200 },
          out: { fromSourceFrame: 10_000, toSourceFrame: 10_600 },
        }
      : { curve: 'linear-amplitude' },
    passes: { firstFrame: 1000, frames: PASS, count: 3 },
    ...(comp && { comp }),
  }
  return { project: { ...project, clips: [loop] }, assets: [take], clip: loop }
}

/** Pass 0 to 1000 frames in, pass 2 to 3000, pass 1 to the end: joins at 3000 and 5000 on the timeline. */
const THREE = [
  { fromSourceFrame: 5800, toSourceFrame: 6800, pass: 0 },
  { fromSourceFrame: 6800, toSourceFrame: 8800, pass: 2 },
  { fromSourceFrame: 8800, toSourceFrame: 10_600, pass: 1 },
]

const segmentsOf = (
  project: StudioProject,
  assets: readonly StudioAsset[],
  range: { startFrame?: number; endFrame?: number } = {},
) => compileStudioArrangement(project, assets, range).lanes[0].segments

const end = (segment: StudioPlannedSegment) =>
  segment.startFrame + segment.sourceOutFrame - segment.sourceInFrame

describe('a comped clip in the plan', () => {
  it('plays each stretch from its own pass, crossing 5 ms either side of each join', () => {
    // Arrange
    const { project, assets } = comped(THREE)

    // Act
    const segments = segmentsOf(project, assets)

    // Assert
    expect(STUDIO_COMP_CROSSFADE_FRAMES).toBe(480)
    expect(
      segments.map((segment) => ({
        startFrame: segment.startFrame,
        end: end(segment),
        sourceInFrame: segment.sourceInFrame,
        crossfades: segment.crossfades,
      })),
    ).toEqual([
      {
        // Pass 0: the clip's own frames moved back a pass, on past the join.
        startFrame: 2000,
        end: 3000 + 241,
        sourceInFrame: 1000,
        crossfades: { out: { fromSourceFrame: 1760, toSourceFrame: 2240 } },
      },
      {
        startFrame: 3000 - 241,
        end: 5000 + 241,
        sourceInFrame: 6800 + PASS - 241,
        crossfades: {
          in: { fromSourceFrame: 11_360, toSourceFrame: 11_840 },
          out: { fromSourceFrame: 13_360, toSourceFrame: 13_840 },
        },
      },
      {
        startFrame: 5000 - 241,
        end: 6800,
        sourceInFrame: 8800 - 241,
        crossfades: { in: { fromSourceFrame: 8560, toSourceFrame: 9040 } },
      },
    ])
    // The safety edges stay the clip's: no dip at a join.
    for (const segment of segments)
      expect([segment.groupStartFrame, segment.groupEndFrame]).toEqual([
        2000, 6800,
      ])
  })

  it('crosses no longer than half the shorter neighbour', () => {
    const { project, assets } = comped([
      { fromSourceFrame: 5800, toSourceFrame: 6400, pass: 0 },
      { fromSourceFrame: 6400, toSourceFrame: 10_600, pass: 1 },
    ])

    const [first, second] = segmentsOf(project, assets)

    // 600 frames before the join: a 300-frame crossfade, 150 either side.
    expect(first.crossfades?.out).toEqual({
      fromSourceFrame: 1600 - 150,
      toSourceFrame: 1600 + 150,
    })
    expect(second.startFrame).toBe(2600 - 151)
  })

  it('holds the power steady across a join: the two sides square to one on every frame', () => {
    const { project, assets } = comped(THREE)
    const [first, second] = segmentsOf(project, assets)

    const powers = Array.from({ length: 501 }, (_, index) => {
      const frame = 3000 - 250 + index
      return (
        studioSegmentGain(first, frame) ** 2 +
        studioSegmentGain(second, frame) ** 2
      )
    })

    for (const power of powers) expect(power).toBeCloseTo(1, 12)
    expect(studioSegmentGain(first, 3000 - 241)).toBe(1)
    expect(studioSegmentGain(second, 3000 - 241)).toBe(0)
    expect(studioSegmentGain(first, 3000)).toBeCloseTo(Math.SQRT1_2, 12)
    expect(studioSegmentGain(second, 3000 + 240)).toBe(1)
    expect(studioSegmentGain(first, 3000 + 240)).toBeLessThan(1e-15)
  })

  it('schedules complementary curves on the same frames either side of a join', () => {
    const { project, assets } = comped(THREE)
    const [first, second] = segmentsOf(project, assets)
    const curves = (segment: StudioPlannedSegment) => {
      const found: { time: number; values: number[] }[] = []
      const param = {
        setValueAtTime: () => param,
        setValueCurveAtTime(values: Float32Array, time: number) {
          found.push({ time, values: [...values] })
          return param
        },
      }
      // Both on one clock: each source starts at its own first frame.
      scheduleStudioSegmentGain(
        param as unknown as AudioParam,
        segment,
        segment.startFrame / 48000,
      )
      return found
    }

    const out = curves(first).at(-1)!
    const into = curves(second)[0]

    expect(out.time).toBeCloseTo(into.time, 12)
    expect(out.time).toBeCloseTo((3000 - 240) / 48000, 12)
    out.values.forEach((value, index) =>
      expect(value ** 2 + into.values[index] ** 2).toBeCloseTo(1, 6),
    )
  })

  it('fades a comped clip in and out where the clip does, whichever pass plays there', () => {
    const plain = comped(undefined, true)
    const comp = comped(THREE, true)
    const plainSegments = segmentsOf(plain.project, plain.assets)
    const compSegments = segmentsOf(comp.project, comp.assets)

    const gainAt = (segments: readonly StudioPlannedSegment[], frame: number) =>
      segments
        .filter(
          (segment) => segment.startFrame <= frame && frame < end(segment),
        )
        .reduce((sum, segment) => sum + studioSegmentGain(segment, frame), 0)

    for (const frame of [2100, 2200, 2399, 6300, 6500, 6700])
      expect(gainAt(compSegments, frame)).toBeCloseTo(
        gainAt(plainSegments, frame),
        12,
      )
  })

  it('starts both sides part-way through a join a seek lands in', () => {
    const { project, assets } = comped(THREE)

    const segments = segmentsOf(project, assets, { startFrame: 3100 })

    expect(segments.map((segment) => segment.startFrame)).toEqual([
      3100,
      3100,
      5000 - 241,
    ])
    expect(
      studioCrossfadeGain(segments[0].crossfades, segments[0].sourceInFrame),
    ).toBeCloseTo(Math.cos((Math.PI / 2) * ((100 + 240) / 480)), 12)
  })

  it('gives the lane another freeze key for another comp, and the same for the same', () => {
    const plain = comped()
    const one = comped(THREE)
    const other = comped([THREE[0], { ...THREE[1], toSourceFrame: 10_600 }])
    const key = (made: ReturnType<typeof comped>) =>
      laneFreezeKeys(made.project, made.assets).get('track-1')

    expect(key(one)).not.toBe(key(plain))
    expect(key(one)).not.toBe(key(other))
    expect(key(comped(THREE))).toBe(key(one))
  })

  it('plans a swipe as soon as it is made', () => {
    const { project, assets } = comped()

    const next = applyStudioCommand(
      project,
      {
        type: 'comp-pass',
        clipId: 'clip-1',
        fromSourceFrame: 6800,
        toSourceFrame: 8800,
        pass: 2,
      },
      { assets, now: TEST_NOW },
    )

    expect(
      segmentsOf(next, assets).map((segment) => segment.sourceInFrame),
    ).toEqual([5800, 6800 + PASS - 241, 8800 - 241])
  })
})
