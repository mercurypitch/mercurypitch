// Studio transport test fixture — a real transport over a fake clock, buffer cache and graph builder.
import { vi } from 'vitest'
import type { StudioArrangementPlan } from '../model/arrangement-plan'
import { studioFixture } from '../model/model.test-fixtures'
import type { StudioBufferCache } from './buffer-cache'
import type { StudioReplan } from './graph'
import { PlaybackContext } from './playback.test-fixtures'
import type { StudioTransportOptions } from './transport'
import { createStudioTransport } from './transport'

/** A built graph that records what the transport asks of it. */
export function fakeStudioGraph(ctx: PlaybackContext) {
  return {
    output: ctx.createGain() as unknown as GainNode,
    scheduleUntil: vi.fn(),
    seekTime: vi.fn((earliest: number) => earliest),
    seek: vi.fn((_frame: number, at: number): number | null => at),
    // Unless a test says so, it cannot move its lanes: an edit hands over.
    replan: vi.fn(
      (_plan: StudioArrangementPlan, _earliest: number): StudioReplan | null =>
        null,
    ),
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
