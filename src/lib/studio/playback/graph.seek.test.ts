// Studio graph seek tests — a playing graph moves its read position: lanes crossfade to new sources, chains stay.
import { describe, expect, it } from 'vitest'
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
  options: { startFrame?: number; repeat?: boolean; fromFrame?: number } = {},
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
    { repeat: options.repeat, fromFrame: options.fromFrame },
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
