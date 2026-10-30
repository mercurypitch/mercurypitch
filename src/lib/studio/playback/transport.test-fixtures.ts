// Studio transport test fixture — a real transport over a fake clock, buffer cache and graph builder.
import { vi } from 'vitest'
import type { StudioArrangementPlan } from '../model/arrangement-plan'
import { studioFixture } from '../model/model.test-fixtures'
import type { StudioBufferCache } from './buffer-cache'
import type { StudioChainSwap, StudioReplan } from './graph'
import { PlaybackContext } from './playback.test-fixtures'
import { livePlaybackProfile } from './playback-quality'
import { RUN_OPEN_SECONDS, RUN_SETTLE_SECONDS } from './run'
import type { StudioTransportOptions } from './transport'
import { createStudioTransport } from './transport'

/**
 * When the fixture's first run from silence is heard: built at 0 on the
 * fake clock, it starts RUN_SETTLE_SECONDS later, and is heard after its
 * 20 ms of lane and master latency.
 */
export const FIRST_HEARD = RUN_SETTLE_SECONDS + 0.02

/** A built graph that records what the transport asks of it. */
export function fakeStudioGraph(ctx: PlaybackContext) {
  return {
    output: ctx.createGain() as unknown as GainNode,
    scheduleUntil: vi.fn(),
    seekTime: vi.fn((earliest: number) => earliest),
    seek: vi.fn((_frame: number, at: number): number | null => at),
    // Unless a test says so, it cannot move its lanes or swap a chain: an
    // edit hands over.
    replan: vi.fn(
      (_plan: StudioArrangementPlan, _earliest: number): StudioReplan | null =>
        null,
    ),
    swapChains: vi.fn(
      (_swaps: readonly StudioChainSwap[], _earliest: number): number | null =>
        null,
    ),
    swapping: vi.fn(() => false),
    readPeaks: () => [0.2, 0.4] as const,
    hasLane: vi.fn((id: string) => id === 'track-1'),
    setLaneMix: vi.fn(),
    setLaneSpec: vi.fn(),
    setMasterSpec: vi.fn(),
    laneOutputs: vi.fn(() => new Map<string, AudioNode>()),
    readLaneReduction: vi.fn((_trackId: string): number | null => null),
    repeat: vi.fn(() => true),
    stopRepeating: vi.fn(() => 0),
    park: vi.fn(),
    settle: vi.fn(),
    retime: vi.fn(),
    // Built at the playback quality live playback wants.
    profile: vi.fn(() => livePlaybackProfile()),
    resume: vi.fn(
      (_fromFrame: number, _epoch: number, _repeat: boolean) => true,
    ),
    dispose: vi.fn(),
  }
}

export function transportFixture(
  overrides: Partial<StudioTransportOptions> = {},
) {
  const song = studioFixture()
  // Two seconds: long enough for an edit to hand over before the song ends.
  const asset = {
    ...song.asset,
    normalizedFrameCount: 96000,
    canonicalPcmByteLength: 384032,
  }
  const [clip] = song.project.clips
  const project = {
    ...song.project,
    clips: [
      {
        ...clip,
        sourceOutFrame: 96000,
        fades: {
          ...clip.fades,
          out: { fromSourceFrame: 95800, toSourceFrame: 96000 },
        },
      },
    ],
  }
  const ctx = new PlaybackContext(44100)
  const release = vi.fn()
  const cache = {
    acquire: vi.fn().mockResolvedValue({ buffers: new Map(), release }),
    clear: vi.fn(),
    dispose: vi.fn(),
  } as unknown as StudioBufferCache
  const graph = fakeStudioGraph(ctx)
  const buildGraph = vi.fn().mockReturnValue(graph)
  const unlock = vi.fn().mockResolvedValue(true)
  const changed = vi.fn()
  const measureLatencies = vi.fn().mockResolvedValue([441])
  const transport = createStudioTransport({
    lease: { ensure: () => ctx.liveContext, unlock },
    readCanonicalAsset: vi.fn(),
    changed,
    cache,
    buildGraph,
    measureLatencies,
    ...overrides,
  })
  return {
    measureLatencies,
    project,
    asset,
    ctx,
    cache,
    graph,
    buildGraph,
    unlock,
    changed,
    release,
    transport,
  }
}

/**
 * The fixture's song with a second, muted lane playing its own take. The
 * fake graph then reports the lanes its options build, as the real one does.
 */
export function withQuietLane(f: ReturnType<typeof transportFixture>) {
  const [track] = f.project.tracks
  const [clip] = f.project.clips
  f.buildGraph.mockImplementation(
    (
      _ctx: unknown,
      plan: StudioArrangementPlan,
      _buffers: unknown,
      _epoch: number,
      options?: { silentLanes?: boolean },
    ) => {
      const built = plan.lanes
        .filter(
          (lane) =>
            lane.segments.length > 0 &&
            (lane.audible || options?.silentLanes === true),
        )
        .map((lane) => lane.track.id)
      f.graph.hasLane.mockImplementation((id: string) => built.includes(id))
      return f.graph
    },
  )
  return {
    ...f.project,
    tracks: [track, { ...track, id: 'quiet', order: 1, mute: true }],
    clips: [
      clip,
      { ...clip, id: 'quiet-clip', trackId: 'quiet', assetId: 'quiet-asset' },
    ],
  }
}

/** Each build returns a graph of its own, so a test can tell the runs apart. */
export function freshGraphs(f: ReturnType<typeof transportFixture>) {
  const graphs: ReturnType<typeof fakeStudioGraph>[] = []
  f.buildGraph.mockImplementation(() => {
    const graph = fakeStudioGraph(f.ctx)
    graphs.push(graph)
    return graph
  })
  return graphs
}

/** The envelope a run plays through: the gain its graph's output feeds. */
export function envelopeOf(graph: ReturnType<typeof fakeStudioGraph>) {
  const output = graph.output as unknown as ReturnType<
    PlaybackContext['createGain']
  >
  return output.targets[0] as ReturnType<PlaybackContext['createGain']>
}

/**
 * When each of an envelope's openings from silence reached full level: the
 * last of the opening's closely spaced linear segments, not a crossfade's.
 */
export function openingEnds(param: {
  linearRamps: { value: number; time: number }[]
}): number[] {
  const step = RUN_OPEN_SECONDS / 64
  return param.linearRamps
    .filter(
      (ramp, i, all) =>
        ramp.value === 1 &&
        i > 0 &&
        Math.abs(ramp.time - all[i - 1].time - step) < 1e-9,
    )
    .map((ramp) => ramp.time)
}

/** An envelope's linear ramps without the segments of its openings from silence: its crossfades. */
export function crossfadeRamps(param: {
  linearRamps: { value: number; time: number }[]
}): { value: number; time: number }[] {
  const ends = new Set(openingEnds(param))
  const opening = new Set<number>()
  param.linearRamps.forEach((ramp, i) => {
    if (isOpeningEnd(ramp, ends))
      for (let k = 0; k < 64; k++) opening.add(i - k)
  })
  return param.linearRamps.filter((_, i) => !opening.has(i))
}

function isOpeningEnd(
  ramp: { value: number; time: number },
  ends: Set<number>,
): boolean {
  return ramp.value === 1 && ends.has(ramp.time)
}
