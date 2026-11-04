// ============================================================
// Uncomped schedule tests — a song with no comp plans and schedules exactly as it did before comping
// ============================================================
//
// Comping added a step to every lane's plan (comp-plan.ts) and a factor to
// every source's envelope (edge-envelope.ts). Neither may move a frame or a
// gain value of a song with no comp. The digests below were taken from the
// code before comping existed (origin/main 2868c2cc5), over the paths those
// changes run through: a clip with fades and gain, a split that coalesces,
// a loop take on another pass, split halves on different passes, a seek
// and a range end, and a frozen lane's chunk crossovers. A digest that
// moves means an uncomped song no longer renders bit-identically.
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { StudioPlannedSegment } from '../model/arrangement-plan'
import { compileStudioArrangement } from '../model/arrangement-plan'
import { studioFixture } from '../model/model.test-fixtures'
import type { StudioAsset, StudioClip, StudioProject } from '../model/types'
import { scheduleStudioSegmentGain } from './edge-envelope'
import type { StudioFrozenLane } from './lane-freeze'
import { frozenSegments } from './lane-freeze'

type Event = ['set', number, number] | ['curve', number[], number, number]

/** Every automation call one segment's envelope makes, in order. */
function schedule(segment: StudioPlannedSegment, when: number): Event[] {
  const events: Event[] = []
  const param = {
    setValueAtTime(value: number, time: number) {
      events.push(['set', value, time])
      return this
    },
    setValueCurveAtTime(values: Float32Array, time: number, duration: number) {
      events.push(['curve', [...values], time, duration])
      return this
    },
  }
  scheduleStudioSegmentGain(param as unknown as AudioParam, segment, when)
  return events
}

const digest = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex')

/** The plan's segments and every envelope call they make, as one digest. */
function planDigest(
  project: StudioProject,
  assets: readonly StudioAsset[],
  range: { startFrame?: number; endFrame?: number } = {},
): string {
  const plan = compileStudioArrangement(project, assets, range)
  const segments = plan.lanes.flatMap((lane) => lane.segments)
  return digest({
    segments,
    // A fractional start, as a Play lands between quanta.
    events: segments.map((segment) => schedule(segment, 1.234_567)),
  })
}

function loopTake() {
  const { project, asset, clip } = studioFixture()
  const take: StudioAsset = {
    ...asset,
    id: 'take-1',
    normalizedFrameCount: 3500,
    canonicalPcmByteLength: 32 + 3500 * 4,
  }
  const looped: StudioClip = {
    ...clip,
    assetId: take.id,
    sourceInFrame: 1200,
    sourceOutFrame: 2200,
    fades: {
      curve: 'linear-amplitude',
      in: { fromSourceFrame: 1200, toSourceFrame: 1400 },
      out: { fromSourceFrame: 2000, toSourceFrame: 2200 },
    },
    passes: { firstFrame: 200, frames: 1000, count: 3 },
  }
  return { project: { ...project, clips: [looped] }, take, looped }
}

describe('a song with no comp', () => {
  it('plans and schedules a clip with fades and gain as before', () => {
    const { project, asset } = studioFixture()
    expect({ clip: planDigest(project, [asset]) }).toEqual({
      clip: DIGESTS.clip,
    })
  })

  it('plans a split clip as one coalesced source, as before', () => {
    const { project, asset, clip } = studioFixture()
    const left = { ...clip, sourceOutFrame: 430 }
    const right = {
      ...clip,
      id: 'clip-2',
      startFrame: clip.startFrame + 430,
      sourceInFrame: 430,
    }
    expect({
      split: planDigest({ ...project, clips: [left, right] }, [asset]),
    }).toEqual({ split: DIGESTS.split })
  })

  it('plans a loop take on its middle pass as before', () => {
    const { project, take } = loopTake()
    expect({ loopTake: planDigest(project, [take]) }).toEqual({
      loopTake: DIGESTS.loopTake,
    })
  })

  it('plans split halves of a loop take on different passes as before', () => {
    const { project, take, looped } = loopTake()
    const left = { ...looped, sourceOutFrame: 1600 }
    const right = {
      ...looped,
      id: 'clip-2',
      startFrame: looped.startFrame + 400,
      sourceInFrame: 2600,
      sourceOutFrame: 3200,
      fades: {
        curve: 'linear-amplitude' as const,
        in: { fromSourceFrame: 2200, toSourceFrame: 2400 },
        out: { fromSourceFrame: 3000, toSourceFrame: 3200 },
      },
    }
    expect({
      splitPasses: planDigest({ ...project, clips: [left, right] }, [take]),
    }).toEqual({ splitPasses: DIGESTS.splitPasses })
  })

  it('plans a seek and a range end as before', () => {
    const { project, asset } = studioFixture()
    expect({
      range: planDigest(project, [asset], { startFrame: 333, endFrame: 901 }),
    }).toEqual({ range: DIGESTS.range })
  })

  it('schedules a frozen lane chunk by chunk as before', () => {
    const chunk = (startFrame: number) => ({
      id: `freeze:lane:${startFrame}`,
      startFrame,
      frames: 4 * 48000,
      scales: [1, 1] as const,
      data: [new Int16Array(0), new Int16Array(0)] as const,
    })
    const lane: StudioFrozenLane = {
      trackId: 'lane',
      key: 'key',
      spec: '{}',
      chunks: [chunk(48000), chunk(48000 + 4 * 48000)],
      bytes: 0,
    }
    const segments = frozenSegments(lane, 0)
    expect({
      frozen: digest({
        segments,
        events: segments.map((segment) => schedule(segment, 0.5)),
      }),
    }).toEqual({ frozen: DIGESTS.frozen })
  })
})

/** Taken from origin/main 2868c2cc5, before comping. */
const DIGESTS = {
  clip: '0de70effd0dee93c776577c7c0e1813d06ea2cd4c0acf76b4f91071852a03262',
  split: '57461b7913f3ce385ecc0ccb63e21473cff72dec65c150e29d3352d91924638b',
  loopTake: '8c6d9170f5671326ccb3d0de454aa4554e01d72ae818012c10af4ab84b6b8a02',
  splitPasses:
    'b20cf6c0bbd39ca61ae38d21fd3ea998af9f6c06a19cb3149ecc5568d7d518bd',
  range: '80358c299c1392e9275085966917411c93112b5f695a404ff47a4c999c2e8e19',
  frozen: '5b41ea2305903ebd634724676da2e996afdb44e94ce24dcb2afc1d41bc97432e',
}
