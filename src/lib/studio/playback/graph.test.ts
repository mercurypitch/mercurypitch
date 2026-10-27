// Studio graph tests prove shared lane topology, actual-rate compensation and source ownership.
import { describe, expect, it } from 'vitest'
import { compileStudioArrangement } from '../model/arrangement-plan'
import { studioFixture } from '../model/model.test-fixtures'
import { buildStudioGraph } from './graph'
import type { PlaybackSource } from './playback.test-fixtures'
import { PlaybackContext } from './playback.test-fixtures'

describe('shared Studio graph', () => {
  it('schedules coalesced sources through one chain per lane and preserves seek boundaries', () => {
    const { project, asset, clip } = studioFixture()
    const track = {
      ...project.tracks[0],
      fx: {
        ...project.tracks[0].fx,
        baseSpec: { version: 1 as const, effects: [] },
      },
    }
    const split = {
      ...project,
      tracks: [track, { ...track, id: 'fast', order: 1 }],
      clips: [
        { ...clip, sourceOutFrame: 500 },
        { ...clip, id: 'right', sourceInFrame: 500, startFrame: 600 },
        { ...clip, id: 'other', trackId: 'fast' },
      ],
    }
    const plan = compileStudioArrangement(split, [asset], {
      startFrame: 300,
      latencies: {
        sampleRate: 44100,
        framesByTrack: { 'track-1': 441, fast: 0 },
      },
    })
    const ctx = new PlaybackContext(44100)
    ctx.state = 'suspended'
    const buffer = ctx.createBuffer(1, 1000, 48000) as unknown as AudioBuffer
    const graph = buildStudioGraph(
      ctx.asContext,
      plan,
      new Map([[asset.id, buffer]]),
      0.5,
      false,
    )
    graph.scheduleUntil(0.6)
    const sources = ctx.ofType<PlaybackSource>('source')
    expect(sources).toHaveLength(2)
    expect(sources[0].starts).toEqual([[0.5, 200 / 48000, 800 / 48000]])
    expect(sources[1].starts[0][0]).toBe(0.51)
    const gain = sources[0].connections[0].node as ReturnType<
      PlaybackContext['createGain']
    >
    expect(gain.channelCountMode).toBe('explicit')
    expect(gain.channelCount).toBe(2)
    expect(gain.gain.events[0].value).toBeGreaterThan(0)
    graph.dispose()
    graph.dispose()
    expect(
      sources.every(
        (source) => source.stops === 1 && source.connections.length === 0,
      ),
    ).toBe(true)
  })

  it('glides a playing lane to new volume and pan, and to silence on Mute', () => {
    const { project, asset } = studioFixture()
    const dry = {
      ...project,
      tracks: project.tracks.map((track) => ({
        ...track,
        balanceGainDb: 0,
        fx: { ...track.fx, baseSpec: { version: 1 as const, effects: [] } },
      })),
    }
    const plan = compileStudioArrangement(dry, [asset], {
      latencies: { sampleRate: 48000, framesByTrack: { 'track-1': 0 } },
    })
    const ctx = new PlaybackContext()
    ctx.state = 'suspended'
    ctx.currentTime = 2
    const graph = buildStudioGraph(ctx.asContext, plan, new Map(), 0.5, false)
    expect(graph.hasLane('track-1')).toBe(true)
    expect(graph.hasLane('missing')).toBe(false)
    const lane = ctx
      .ofType<ReturnType<PlaybackContext['createGain']>>('gain')
      .filter((gain) => gain.gain.events.length === 0)
    const before = lane.map((gain) => gain.gain.value)
    graph.setLaneMix({ ...dry.tracks[0], gainDb: -6, pan: 1 }, true)
    const targets = (gain: (typeof lane)[number]) =>
      gain.gain.events.filter((event) => event.kind === 'target')
    const moved = lane.filter((gain) => targets(gain).length === 1)
    expect(moved).toHaveLength(2)
    const [left, right] = moved.map((gain) => targets(gain)[0])
    expect(left).toMatchObject({ time: 2, timeConstant: 0.012 })
    expect(left.value).toBeCloseTo(0, 6)
    expect(right.value).toBeCloseTo(Math.pow(10, -6 / 20), 6)
    expect(before.length).toBeGreaterThanOrEqual(2)
    graph.setLaneMix(dry.tracks[0], false)
    expect(moved.map((gain) => targets(gain)[1].value)).toEqual([0, 0])
    graph.dispose()
  })

  it('rejects scheduler underrun rather than starting late material as if it were aligned', () => {
    const { project, asset } = studioFixture()
    const dry = {
      ...project,
      tracks: project.tracks.map((track) => ({
        ...track,
        fx: { ...track.fx, baseSpec: { version: 1 as const, effects: [] } },
      })),
    }
    const plan = compileStudioArrangement(dry, [asset], {
      latencies: { sampleRate: 48000, framesByTrack: { 'track-1': 0 } },
    })
    const ctx = new PlaybackContext()
    ctx.state = 'suspended'
    const graph = buildStudioGraph(ctx.asContext, plan, new Map(), 0.5, false)
    ctx.currentTime = 1
    expect(() => graph.scheduleUntil(2)).toThrow(/keep up/)
    graph.dispose()
  })
  it('repeats on the audio clock without rebuilding lanes or replaying the pre-seek section', () => {
    const { project, asset, clip } = studioFixture()
    const longAsset = {
      ...asset,
      normalizedFrameCount: 96000,
      canonicalPcmByteLength: 384032,
    }
    const song = {
      ...project,
      clips: [{ ...clip, startFrame: 0, sourceOutFrame: 96000 }],
      tracks: project.tracks.map((track) => ({
        ...track,
        fx: { ...track.fx, baseSpec: { version: 1 as const, effects: [] } },
      })),
    }
    const plan = compileStudioArrangement(song, [longAsset], {
      latencies: { sampleRate: 48000, framesByTrack: { 'track-1': 0 } },
    })
    const ctx = new PlaybackContext()
    ctx.state = 'suspended'
    const buffer = ctx.createBuffer(1, 96000, 48000) as unknown as AudioBuffer
    const graph = buildStudioGraph(
      ctx.asContext,
      plan,
      new Map([[asset.id, buffer]]),
      0.5,
      false,
      48000,
    )
    graph.scheduleUntil(3.6)
    const sources = ctx.ofType<PlaybackSource>('source')
    expect(sources.map((source) => source.starts[0])).toEqual([
      [0.5, 1, 1],
      [1.5, 0, 2],
      [3.5, 0, 2],
    ])
    const inputs = sources.map(
      (source) => source.connections[0].node.connections[0].node,
    )
    expect(new Set(inputs).size).toBe(1)
    graph.dispose()
  })
})
