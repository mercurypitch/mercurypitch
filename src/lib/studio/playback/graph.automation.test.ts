// Studio graph automation tests — a lane's stage follows its lines from Play, across seeks, loops, edits and resumes, never in a step.
import { describe, expect, it } from 'vitest'
import { normalizeChainSpec } from '@/lib/studio-fx/chain-spec'
import { dbToGain } from '@/lib/studio-fx/dsp'
import type { FakeNode } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import { FULL_FX_PROFILE } from '@/lib/studio-fx/fx-profile'
import { compileStudioArrangement } from '../model/arrangement-plan'
import { studioAutomationValueAt, withStudioAutomation, } from '../model/automation'
import { studioFixture } from '../model/model.test-fixtures'
import type { StudioAutomationPoint, StudioTrack } from '../model/types'
import { AutomationContext } from './automation.test-fixtures'
import { buildStudioGraph } from './graph'

const SR = 48000
/** Four seconds of song; the first lane's chain is 10 ms slower than the second's. */
const SONG_FRAMES = 4 * SR
const SLOWEST = 0.01
const EPOCH = 0.5

/** The first lane's volume line: -24 dB, up to 0 dB at 2 s, down to -12 dB at 3 s. */
const LINE: StudioAutomationPoint[] = [
  { frame: 0, value: -24 },
  { frame: 2 * SR, value: 0 },
  { frame: 3 * SR, value: -12 },
]

/** The stage gain the line asks for at `frame`, over a fader at 0 dB. */
const wanted = (frame: number) =>
  dbToGain(studioAutomationValueAt(LINE, frame)!)

/** When frame `frame` of pass `pass` reaches the faders of a graph built at EPOCH from frame 0, its song SONG_FRAMES long. */
const arrives = (frame: number, pass = 0) =>
  EPOCH + (pass * SONG_FRAMES + frame) / SR + SLOWEST

/** Two dry lanes, the first with `track-1` changes; its stages, and the second lane's. */
function lineGraph(
  options: { repeat?: boolean; line?: boolean; now?: number } = {},
) {
  const { project, asset, clip } = studioFixture()
  const long = {
    ...asset,
    normalizedFrameCount: SONG_FRAMES,
    canonicalPcmByteLength: SONG_FRAMES * 4 + 32,
  }
  const dry: StudioTrack = {
    ...project.tracks[0],
    gainDb: 0,
    balanceGainDb: 0,
    fx: { ...project.tracks[0].fx, baseSpec: { version: 1, effects: [] } },
  }
  const lined = withStudioAutomation(dry, 'volume', LINE)
  const whole = { ...clip, startFrame: 0, sourceOutFrame: SONG_FRAMES }
  const song = {
    ...project,
    tracks: [
      options.line === false ? dry : lined,
      { ...dry, id: 'late', order: 1 },
    ],
    clips: [whole, { ...whole, id: 'late-clip', trackId: 'late' }],
  }
  const plan = compileStudioArrangement(song, [long], {
    latencies: { sampleRate: SR, framesByTrack: { 'track-1': 480, late: 0 } },
  })
  expect([plan.startFrame, plan.endFrame]).toEqual([0, SONG_FRAMES])
  const ctx = new AutomationContext()
  ctx.currentTime = options.now ?? 0
  const buffer = ctx.createBuffer(1, SONG_FRAMES, SR) as unknown as AudioBuffer
  const graph = buildStudioGraph(
    ctx.asContext,
    plan,
    new Map([[asset.id, buffer]]),
    EPOCH,
    { repeat: options.repeat },
  )
  const stagesOf = (trackId: string) =>
    ctx.stagesInto(graph.laneOutputs().get(trackId) as unknown as FakeNode)
  return { ctx, graph, dry, lined, stages: stagesOf('track-1'), stagesOf }
}

/** How far apart two gains are, in decibels. */
const gapDb = (a: number, b: number) => Math.abs(20 * Math.log10(a / b))

describe('Studio graph automation', () => {
  it("plays a lane's volume line on its stage as each frame reaches the faders, and leaves a lane without lines at unity", () => {
    // Arrange
    const f = lineGraph()

    // Act
    f.graph.scheduleUntil(EPOCH + 3.5)

    // Assert
    const [left, right] = f.stages
    for (const frame of [0, 0.5 * SR, SR, 2 * SR, 2.5 * SR, 3 * SR, 3.5 * SR]) {
      expect(gapDb(left.valueAt(arrives(frame)), wanted(frame))).toBeLessThan(
        0.02,
      )
      expect(right.valueAt(arrives(frame))).toBeCloseTo(
        left.valueAt(arrives(frame)),
        12,
      )
    }
    // Before the run's first frame arrives, the stage already holds it.
    expect(left.valueAt(EPOCH)).toBeCloseTo(wanted(0), 12)
    expect(
      f.stagesOf('late').every((stage) => stage.timeline.length === 0),
    ).toBe(true)
  })

  it('writes the line only a little past where the graph is scheduled', () => {
    // Arrange
    const f = lineGraph()

    // Act
    f.graph.scheduleUntil(EPOCH + 1)

    // Assert
    const last = f.stages[0].timeline.at(-1)!.time
    expect(last).toBeGreaterThan(EPOCH + 1)
    expect(last).toBeLessThan(EPOCH + 1.2)
  })

  it("crosses the line to a seek's place over 10 ms, from the value it had there, without a step", () => {
    // Arrange
    const f = lineGraph()
    f.graph.scheduleUntil(1.5)
    f.ctx.currentTime = 1

    // Act
    const at = f.graph.seek(3 * SR, 1.1)!
    f.graph.scheduleUntil(at + 2)

    // Assert
    const [left] = f.stages
    const cut = at + SLOWEST
    const before = (cut - EPOCH - SLOWEST) * SR
    expect(gapDb(left.valueAt(cut), wanted(before))).toBeLessThan(0.02)
    expect(gapDb(left.valueAt(cut + 0.01), wanted(3 * SR + 480))).toBeLessThan(
      0.02,
    )
    expect(gapDb(left.valueAt(cut + 0.5), wanted(3.5 * SR))).toBeLessThan(0.02)
    expect(left.largestStep(cut - 0.02, cut + 0.05)).toBeLessThan(0.002)
  })

  it("crosses back to the song's start over 10 ms at each loop point", () => {
    // Arrange
    const f = lineGraph({ repeat: true })

    // Act
    f.graph.scheduleUntil(EPOCH + 6)

    // Assert
    const [left] = f.stages
    const loop = arrives(0, 1)
    expect(gapDb(left.valueAt(loop), wanted(SONG_FRAMES))).toBeLessThan(0.02)
    expect(gapDb(left.valueAt(loop + 0.01), wanted(480))).toBeLessThan(0.02)
    expect(gapDb(left.valueAt(arrives(SR, 1)), wanted(SR))).toBeLessThan(0.02)
    expect(left.largestStep(loop - 0.02, loop + 0.05)).toBeLessThan(0.005)
  })

  it('keeps the song end value past a loop point once Repeat is turned off before it', () => {
    // Arrange: the line into the next pass is already written.
    const f = lineGraph({ repeat: true })
    f.graph.scheduleUntil(EPOCH + 3.9)
    f.ctx.currentTime = EPOCH + 3.5

    // Act
    f.graph.stopRepeating()
    f.graph.scheduleUntil(EPOCH + 5.5)

    // Assert
    const [left] = f.stages
    const loop = arrives(0, 1)
    expect(gapDb(left.valueAt(loop + 0.05), wanted(SONG_FRAMES))).toBeLessThan(
      0.02,
    )
    expect(left.late).toEqual([])
  })

  it('glides a line drawn while the song plays in over 12 ms, from unity', () => {
    // Arrange
    const f = lineGraph({ line: false })
    f.graph.scheduleUntil(1.5)
    f.ctx.currentTime = 1

    // Act
    f.graph.setLaneMix(f.lined, true)
    f.graph.scheduleUntil(3)

    // Assert
    const [left] = f.stages
    const cut = left.timeline[0].time
    expect(cut).toBeGreaterThan(1)
    expect(cut).toBeLessThan(1.03)
    expect(left.valueAt(cut)).toBe(1)
    const frame = (cut + 0.012 - EPOCH - SLOWEST) * SR
    expect(gapDb(left.valueAt(cut + 0.012), wanted(frame))).toBeLessThan(0.02)
    expect(
      gapDb(left.valueAt(2), wanted((2 - EPOCH - SLOWEST) * SR)),
    ).toBeLessThan(0.02)
    expect(left.largestStep(1, 1.1)).toBeLessThan(0.05)
  })

  it('glides the stage back to unity over 12 ms when the last line is cleared while the song plays', () => {
    // Arrange
    const f = lineGraph()
    f.graph.scheduleUntil(2)
    f.ctx.currentTime = 1.5

    // Act
    f.graph.setLaneMix(f.dry, true)
    f.graph.scheduleUntil(3)

    // Assert
    const [left] = f.stages
    expect(left.valueAt(1.6)).toBe(1)
    expect(left.valueAt(3)).toBe(1)
    expect(left.largestStep(1.5, 1.6)).toBeLessThan(0.05)
    expect(left.late).toEqual([])
  })

  it("starts a resumed run at the line's value for its first frame, held until that frame arrives", () => {
    // Arrange
    const f = lineGraph()
    f.graph.scheduleUntil(1.5)
    f.ctx.currentTime = 1.2
    f.graph.park()

    // Act
    f.graph.resume(2.5 * SR, 1.4, false)
    f.graph.scheduleUntil(3)

    // Assert
    const [left] = f.stages
    expect(left.valueAt(1.2)).toBeCloseTo(wanted(2.5 * SR), 12)
    expect(left.valueAt(1.4 + SLOWEST)).toBeCloseTo(wanted(2.5 * SR), 12)
    expect(
      gapDb(left.valueAt(1.4 + SLOWEST + 0.5), wanted(3 * SR)),
    ).toBeLessThan(0.02)
  })

  it('catches up on a line the clock passed while the page was busy, writing nothing behind the clock', () => {
    // Arrange
    const f = lineGraph()
    f.graph.scheduleUntil(EPOCH + 0.5)
    f.ctx.currentTime = EPOCH + 2

    // Act
    f.graph.scheduleUntil(EPOCH + 3)

    // Assert
    const [left] = f.stages
    expect(left.late).toEqual([])
    const later = EPOCH + 2.5
    expect(
      gapDb(left.valueAt(later), wanted((later - EPOCH - SLOWEST) * SR)),
    ).toBeLessThan(0.02)
  })

  it("keeps a lane's reverb send on the lane's line", () => {
    // Arrange
    const { project, asset, clip } = studioFixture()
    const long = {
      ...asset,
      normalizedFrameCount: SONG_FRAMES,
      canonicalPcmByteLength: SONG_FRAMES * 4 + 32,
    }
    const track = withStudioAutomation(
      {
        ...project.tracks[0],
        gainDb: 0,
        fx: {
          ...project.tracks[0].fx,
          baseSpec: normalizeChainSpec({
            effects: [
              { id: 'verb', kind: 'reverb', params: { decayS: 1.5, duck: 0 } },
            ],
          }),
        },
      },
      'pan',
      [
        { frame: 0, value: -1 },
        { frame: 2 * SR, value: 1 },
      ],
    )
    const song = {
      ...project,
      tracks: [track],
      clips: [{ ...clip, startFrame: 0, sourceOutFrame: SONG_FRAMES }],
    }
    const plan = compileStudioArrangement(song, [long], {
      latencies: { sampleRate: SR, framesByTrack: { 'track-1': 0 } },
    })
    const ctx = new AutomationContext()
    const buffer = ctx.createBuffer(
      1,
      SONG_FRAMES,
      SR,
    ) as unknown as AudioBuffer
    const graph = buildStudioGraph(
      ctx.asContext,
      plan,
      new Map([[asset.id, buffer]]),
      EPOCH,
      { profile: { ...FULL_FX_PROFILE, id: 'bus', reverbBus: true } },
    )

    // Act
    graph.scheduleUntil(EPOCH + 3)

    // Assert
    const lane = ctx.stagesInto(
      graph.laneOutputs().get('track-1') as unknown as FakeNode,
    )
    // The send's merge feeds the shared space's input, which feeds its convolver.
    const [convolver] = ctx.ofType<FakeNode>('convolver')
    const space = ctx
      .ofType<FakeNode>('gain')
      .find((gain) => gain.targets.includes(convolver))!
    const sendMerge = ctx
      .ofType<FakeNode>('merger')
      .find((merge) => merge.targets.includes(space))!
    const send = ctx.stagesInto(sendMerge)
    expect(send).toHaveLength(2)
    for (const time of [EPOCH, EPOCH + 0.7, EPOCH + 1.3, EPOCH + 2.4])
      for (const side of [0, 1])
        expect(send[side].valueAt(time)).toBeCloseTo(
          lane[side].valueAt(time),
          12,
        )
    expect(lane[1].valueAt(EPOCH)).toBeCloseTo(0, 9)
  })
})
