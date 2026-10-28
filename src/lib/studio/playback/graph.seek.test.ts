// Studio graph seek tests — a playing graph moves its read position: lanes crossfade to new sources, chains stay.
import { describe, expect, it } from 'vitest'
import type { FakeNode } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import { compileStudioArrangement } from '../model/arrangement-plan'
import { studioFixture } from '../model/model.test-fixtures'
import { buildStudioGraph } from './graph'
import type { PlaybackSource } from './playback.test-fixtures'
import { PlaybackContext } from './playback.test-fixtures'
import { SEEK_CROSSFADE_SECONDS } from './seek-crossfade'

type Gain = ReturnType<PlaybackContext['createGain']>

/**
 * Two seconds on two dry lanes: the first lane's chain is 10 ms slower, so
 * the second lane's sources start 10 ms later to stay in step with it.
 */
function twoLaneGraph(
  options: {
    startFrame?: number
    repeat?: boolean
    fromFrame?: number
    metering?: boolean
  } = {},
) {
  const { project, asset, clip } = studioFixture()
  const long = {
    ...asset,
    normalizedFrameCount: 96000,
    canonicalPcmByteLength: 384032,
  }
  const dry = {
    ...project.tracks[0],
    balanceGainDb: 0,
    fx: {
      ...project.tracks[0].fx,
      baseSpec: { version: 1 as const, effects: [] },
    },
  }
  const whole = { ...clip, startFrame: 0, sourceOutFrame: 96000 }
  const song = {
    ...project,
    tracks: [dry, { ...dry, id: 'late', order: 1 }],
    clips: [whole, { ...whole, id: 'late-clip', trackId: 'late' }],
  }
  const plan = compileStudioArrangement(song, [long], {
    startFrame: options.startFrame,
    latencies: {
      sampleRate: 48000,
      framesByTrack: { 'track-1': 480, late: 0 },
    },
  })
  const ctx = new PlaybackContext()
  ctx.state = 'suspended'
  const buffer = ctx.createBuffer(1, 96000, 48000) as unknown as AudioBuffer
  const graph = buildStudioGraph(
    ctx.asContext,
    plan,
    new Map([[asset.id, buffer]]),
    0.5,
    {
      repeat: options.repeat,
      fromFrame: options.fromFrame,
      metering: options.metering,
    },
  )
  const sources = () => ctx.ofType<PlaybackSource>('source')
  /** The gains a source plays through: its clip edges, then its set's fade-out and fade-in. */
  const fadesOf = (source: PlaybackSource) => {
    const edge = source.connections[0].node
    const fadeOut = edge.connections[0].node as Gain
    const fadeIn = fadeOut.connections[0].node as Gain
    return { fadeOut, fadeIn }
  }
  return { ctx, graph, sources, fadesOf }
}

describe('Studio graph seek', () => {
  it('crossfades every lane to sources started at the new frame, each lane on its own compensation, with equal power', () => {
    const { ctx, graph, sources, fadesOf } = twoLaneGraph()
    graph.scheduleUntil(1)
    const playing = sources()
    expect(playing.map((source) => source.starts[0])).toEqual([
      [0.5, 0, 2],
      [0.51, 0, 2],
    ])

    ctx.currentTime = 1
    expect(graph.seekTime(1.02)).toBe(1.02)
    expect(graph.seek(72000, 1.02)).toBe(1.02)
    graph.scheduleUntil(3)

    // The new sources start 1.5 s into the take, the late lane 10 ms on.
    const started = sources().slice(2)
    expect(started.map((source) => source.starts[0])).toEqual([
      [1.02, 1.5, 0.5],
      [1.03, 1.5, 0.5],
    ])
    // The playing sources stop once each lane's fade is over, not before.
    expect(playing.map((source) => source.stopTimes)).toEqual([
      [1.02 + SEEK_CROSSFADE_SECONDS],
      [1.03 + SEEK_CROSSFADE_SECONDS],
    ])
    for (const [index, lane] of [1.02, 1.03].entries()) {
      const out = fadesOf(playing[index]).fadeOut.gain.curves
      const into = fadesOf(started[index]).fadeIn
      expect(out).toMatchObject([
        { time: lane, duration: SEEK_CROSSFADE_SECONDS },
      ])
      expect(into.gain.value).toBe(0)
      expect(into.gain.curves).toMatchObject([
        { time: lane, duration: SEEK_CROSSFADE_SECONDS },
      ])
      // Unrelated material on each side: the powers add up to one throughout.
      const [fadeOut] = out
      const [fadeIn] = into.gain.curves
      expect(fadeIn.values[0]).toBe(0)
      expect(fadeOut.values[0]).toBe(1)
      for (const [point, level] of fadeIn.values.entries())
        expect(level ** 2 + fadeOut.values[point] ** 2).toBeCloseTo(1, 6)
    }
    // Both lanes still reach the same chains: only the sources changed.
    const [first, second] = started.map((source) => fadesOf(source).fadeIn)
    expect(first.connections[0].node).toBe(
      fadesOf(playing[0]).fadeIn.connections[0].node,
    )
    expect(second.connections[0].node).toBe(
      fadesOf(playing[1]).fadeIn.connections[0].node,
    )
    graph.dispose()
  })

  it('lets a newer seek in the same render quantum take the place of one not heard yet, so only one fade is scheduled', () => {
    const { ctx, graph, sources, fadesOf } = twoLaneGraph()
    graph.scheduleUntil(1)
    const playing = sources()
    ctx.currentTime = 1
    graph.seek(72000, 1.02)
    graph.scheduleUntil(3)
    const replaced = sources().slice(2)
    const { fadeIn } = fadesOf(replaced[0])

    // The same clock reading asks for the same moment: the newer seek wins it.
    expect(graph.seekTime(1.02)).toBe(1.02)
    expect(graph.seek(24000, 1.02)).toBe(1.02)
    graph.scheduleUntil(3)

    expect(replaced.every((source) => source.stopTimes[0] === undefined)).toBe(
      true,
    )
    expect(replaced.every((source) => source.connections.length === 0)).toBe(
      true,
    )
    const started = sources().slice(4)
    expect(started.map((source) => source.starts[0])).toEqual([
      [1.02, 0.5, 1.5],
      [1.03, 0.5, 1.5],
    ])
    expect(fadesOf(playing[0]).fadeOut.gain.curves).toHaveLength(1)
    expect(fadesOf(started[0]).fadeIn).toBe(fadeIn)
    expect(fadeIn.gain.curves).toHaveLength(1)
    graph.dispose()
  })

  it('crossfades from a seek already heard to a later one, and frees every retired source once it ends', () => {
    const { ctx, graph, sources } = twoLaneGraph()
    graph.scheduleUntil(1)
    let now = 1
    for (let seek = 0; seek < 50; seek++) {
      ctx.currentTime = now
      const at = graph.seekTime(now + 0.02)
      expect(graph.seek(seek % 2 === 0 ? 24000 : 72000, at)).toBe(at)
      graph.scheduleUntil(now + 2)
      now += 0.033
    }
    // Every source asked to stop at a time ends there; the browser then calls onended.
    ctx.currentTime = now + 1
    for (const source of sources())
      if (source.stopTimes.some((time) => time !== undefined))
        source.onended?.()

    const connected = sources().filter(
      (source) => source.connections.length > 0,
    )
    // Only the newest seek's two sources play on.
    expect(connected).toHaveLength(2)
    expect(connected.every((source) => source.stops === 0)).toBe(true)
    // Its two lanes' fade gains, and no retired set's, stay in the graph.
    const fades = ctx
      .ofType<Gain>('gain')
      .filter((gain) => gain.gain.curves.length > 0)
    const live = fades.filter((gain) => gain.connections.length > 0)
    expect(live).toHaveLength(2)
    graph.dispose()
  })

  it('repeats from the song start after a seek, the first pass ending where the seek frame plays out', () => {
    const { ctx, graph, sources } = twoLaneGraph({ repeat: true })
    graph.scheduleUntil(1)
    ctx.currentTime = 1
    graph.seek(72000, 1.02)
    graph.scheduleUntil(4)
    const lane = sources()
      .slice(2)
      .filter((source) => source.starts[0][0] % 0.5 < 0.025)
      .map((source) => source.starts[0])
    expect(lane).toEqual([
      [1.02, 1.5, 0.5],
      [1.52, 0, 2],
      [3.52, 0, 2],
    ])
    // Turned off now, the pass from the seek is the last one heard.
    expect(graph.stopRepeating()).toBe(0)
    graph.dispose()
  })

  it('refuses a frame its plan does not reach, and leaves what plays alone', () => {
    const { ctx, graph, sources } = twoLaneGraph({
      startFrame: 48000,
      fromFrame: 48000,
    })
    graph.scheduleUntil(1)
    ctx.currentTime = 1
    expect(graph.seek(24000, 1.02)).toBeNull()
    expect(graph.seek(96000, 1.02)).toBeNull()
    expect(graph.seek(60000, 1.02)).toBe(1.02)
    graph.dispose()
    expect(sources().every((source) => source.connections.length === 0)).toBe(
      true,
    )
  })
})

describe('Studio graph park', () => {
  it('stops every source, playing or waiting, and schedules nothing more until it resumes', () => {
    const { ctx, graph, sources } = twoLaneGraph()
    graph.scheduleUntil(1)
    const playing = sources()
    expect(playing).toHaveLength(2)
    ctx.currentTime = 1.3
    graph.park()
    expect(playing.every((source) => source.stops === 1)).toBe(true)
    expect(playing.every((source) => source.connections.length === 0)).toBe(
      true,
    )
    graph.scheduleUntil(4)
    expect(sources()).toHaveLength(2)
    // A parked graph has nothing playing to seek from.
    expect(graph.seek(48000, 1.4)).toBeNull()
    graph.dispose()
  })

  it('resumes from a frame at a new epoch through the same chains, open from its first frame', () => {
    const { ctx, graph, sources, fadesOf } = twoLaneGraph()
    graph.scheduleUntil(1)
    const before = sources().map((source) => fadesOf(source).fadeIn)
    const chains = before.map((fadeIn) => fadeIn.connections[0].node)
    ctx.currentTime = 1.3
    graph.park()
    ctx.currentTime = 5
    expect(graph.resume(24000, 5.02, false)).toBe(true)
    graph.scheduleUntil(7)
    const resumed = sources().slice(2)
    // Half a second into the take; the late lane 10 ms on, as at Play.
    const round = (values: number[]) =>
      values.map((value) => Math.round(value * 1e9) / 1e9)
    expect(resumed.map((source) => round(source.starts[0]))).toEqual([
      [5.02, 0.5, 1.5],
      [5.03, 0.5, 1.5],
    ])
    for (const [index, source] of resumed.entries()) {
      const { fadeOut, fadeIn } = fadesOf(source)
      // The run's envelope opens over them: no seek fade of their own.
      expect(fadeIn.gain.curves).toEqual([])
      expect(fadeOut.gain.curves).toEqual([])
      expect(fadeIn.gain.value).toBe(1)
      expect(fadeIn.connections[0].node).toBe(chains[index])
    }
    // Played once, the song ends with that pass.
    graph.scheduleUntil(20)
    expect(sources()).toHaveLength(4)
    graph.dispose()
  })

  it('loops after it resumes with Repeat, from the song start once the frame plays out', () => {
    const { ctx, graph, sources } = twoLaneGraph()
    graph.scheduleUntil(1)
    ctx.currentTime = 1.3
    graph.park()
    ctx.currentTime = 5
    expect(graph.resume(72000, 5, true)).toBe(true)
    graph.scheduleUntil(8)
    const lane = sources()
      .slice(2)
      .filter((source) => source.starts[0][0] % 0.5 < 0.005)
      .map((source) => source.starts[0])
    expect(lane).toEqual([
      [5, 1.5, 0.5],
      [5.5, 0, 2],
      [7.5, 0, 2],
    ])
    graph.dispose()
  })

  it('lets go of its peak analysers while parked, so nothing pulls the chains through silence', () => {
    const { ctx, graph } = twoLaneGraph({ metering: true })
    const output = graph.output as unknown as FakeNode
    const playing = output.targets.map((node) => node.nodeType)
    expect(playing).toContain('splitter')
    graph.scheduleUntil(1)
    ctx.currentTime = 1.3
    graph.park()
    expect(output.targets.map((node) => node.nodeType)).toEqual(
      playing.filter((type) => type !== 'splitter'),
    )
    expect(graph.resume(0, 5, false)).toBe(true)
    expect(output.targets.map((node) => node.nodeType).sort()).toEqual(
      [...playing].sort(),
    )
    graph.dispose()
  })

  it('refuses a frame its plan does not reach, and stays parked', () => {
    const { ctx, graph, sources } = twoLaneGraph({
      startFrame: 48000,
      fromFrame: 48000,
    })
    graph.scheduleUntil(1)
    ctx.currentTime = 1.3
    graph.park()
    expect(graph.resume(24000, 2, false)).toBe(false)
    expect(graph.resume(96000, 2, false)).toBe(false)
    graph.scheduleUntil(4)
    expect(sources()).toHaveLength(2)
    expect(graph.resume(60000, 2, false)).toBe(true)
    graph.scheduleUntil(4)
    expect(sources()).toHaveLength(4)
    graph.dispose()
  })
})
