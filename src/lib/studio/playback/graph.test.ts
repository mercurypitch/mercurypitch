// Studio graph tests prove shared lane topology, actual-rate compensation and source ownership.
import { describe, expect, it } from 'vitest'
import { normalizeChainSpec } from '@/lib/studio-fx/chain-spec'
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
    const graph = buildStudioGraph(ctx.asContext, plan, new Map(), 0.5)
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

  it('moves a playing lane chain and the master chain to new settings without new nodes', () => {
    const { project, asset } = studioFixture()
    const trim = (gainDb: number) => ({
      version: 1 as const,
      effects: [
        {
          id: 'balance',
          kind: 'gain' as const,
          enabled: true,
          params: { gainDb },
        },
      ],
    })
    const song = {
      ...project,
      tracks: project.tracks.map((track) => ({
        ...track,
        fx: { ...track.fx, baseSpec: trim(0) },
      })),
    }
    const plan = compileStudioArrangement(song, [asset], {
      latencies: { sampleRate: 48000, framesByTrack: { 'track-1': 0 } },
    })
    const ctx = new PlaybackContext()
    ctx.state = 'suspended'
    const graph = buildStudioGraph(ctx.asContext, plan, new Map(), 0.5, {
      master: { spec: trim(0) },
    })
    const nodes = ctx.created.length
    const at = (gain: number) =>
      ctx
        .ofType<ReturnType<PlaybackContext['createGain']>>('gain')
        .filter((node) => Math.abs(node.gain.destination - gain) < 1e-6)
    expect(at(Math.pow(10, -7.5 / 20))).toHaveLength(0)
    graph.setLaneSpec('track-1', trim(-7.5))
    expect(at(Math.pow(10, -7.5 / 20))).toHaveLength(1)
    graph.setMasterSpec(trim(-13.5))
    expect(at(Math.pow(10, -13.5 / 20))).toHaveLength(1)
    // A lane the graph never built has no chain to move.
    graph.setLaneSpec('missing', trim(-4.5))
    expect(at(Math.pow(10, -4.5 / 20))).toHaveLength(0)
    expect(ctx.created.length).toBe(nodes)
    graph.dispose()
  })

  it("hands out each lane's output after its fader and pan, and the summed reduction of its compressors and limiters", () => {
    const { project, asset, clip } = studioFixture()
    const dynamics = normalizeChainSpec({
      effects: [{ kind: 'eq' }, { kind: 'compressor' }, { kind: 'limiter' }],
    })
    const [track] = project.tracks
    const song = {
      ...project,
      tracks: [
        { ...track, fx: { ...track.fx, baseSpec: dynamics } },
        {
          ...track,
          id: 'plain',
          order: 1,
          fx: { ...track.fx, baseSpec: { version: 1 as const, effects: [] } },
        },
      ],
      clips: [clip, { ...clip, id: 'plain-clip', trackId: 'plain' }],
    }
    const plan = compileStudioArrangement(song, [asset], {
      latencies: {
        sampleRate: 48000,
        framesByTrack: { 'track-1': 0, plain: 0 },
      },
    })
    const ctx = new PlaybackContext()
    ctx.state = 'suspended'
    const graph = buildStudioGraph(ctx.asContext, plan, new Map(), 0.5)
    expect([...graph.laneOutputs().keys()].sort()).toEqual(['plain', 'track-1'])
    // Each fake DynamicsCompressorNode reads 3 dB of reduction.
    expect(graph.readLaneReduction('track-1')).toBe(-6)
    expect(graph.readLaneReduction('plain')).toBeNull()
    expect(graph.readLaneReduction('missing')).toBeNull()
    graph.setLaneSpec('track-1', {
      ...dynamics,
      effects: dynamics.effects.map((effect) =>
        effect.kind === 'limiter' ? { ...effect, enabled: false } : effect,
      ),
    })
    expect(graph.readLaneReduction('track-1')).toBe(-3)
    graph.dispose()
    expect(graph.readLaneReduction('track-1')).toBeNull()
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
    const graph = buildStudioGraph(ctx.asContext, plan, new Map(), 0.5)
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
      { fromFrame: 48000, repeat: true },
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

  it('builds a lane that is silent now at zero gain, so Mute and Solo bring it in while it plays, and a render leaves it out', () => {
    const { project, asset, clip } = studioFixture()
    const dry = {
      ...project.tracks[0],
      balanceGainDb: 0,
      fx: {
        ...project.tracks[0].fx,
        baseSpec: { version: 1 as const, effects: [] },
      },
    }
    const song = {
      ...project,
      tracks: [dry, { ...dry, id: 'quiet', order: 1, mute: true }],
      clips: [clip, { ...clip, id: 'quiet-clip', trackId: 'quiet' }],
    }
    const plan = compileStudioArrangement(song, [asset], {
      latencies: {
        sampleRate: 48000,
        framesByTrack: { 'track-1': 0, quiet: 480 },
      },
    })
    // The silent lane's chain is the slowest, so the audible lane waits for it.
    expect(plan.lanes[0].compensationSeconds).toBe(0.01)
    expect(plan.lanes[1].compensationSeconds).toBe(0)
    const ctx = new PlaybackContext()
    ctx.state = 'suspended'
    const buffer = ctx.createBuffer(1, 1000, 48000) as unknown as AudioBuffer
    const buffers = new Map([[asset.id, buffer]])
    const graph = buildStudioGraph(ctx.asContext, plan, buffers, 0.5, {
      silentLanes: true,
    })
    expect(graph.hasLane('quiet')).toBe(true)
    graph.scheduleUntil(1)
    expect(ctx.ofType<PlaybackSource>('source')).toHaveLength(2)
    // Its left and right mix gains are the only lane gains at zero.
    const silent = ctx
      .ofType<ReturnType<PlaybackContext['createGain']>>('gain')
      .filter((gain) => gain.gain.events.length === 0 && gain.gain.value === 0)
    expect(silent).toHaveLength(2)
    ctx.currentTime = 0.8
    graph.setLaneMix({ ...song.tracks[1], mute: false }, true)
    expect(silent.map((gain) => gain.gain.lastWrite)).toEqual([
      { kind: 'target', time: 0.8, value: 1, timeConstant: 0.012 },
      { kind: 'target', time: 0.8, value: 1, timeConstant: 0.012 },
    ])
    expect(ctx.ofType<PlaybackSource>('source')).toHaveLength(2)
    graph.dispose()

    // A render builds only what it hears.
    const render = new PlaybackContext()
    render.state = 'suspended'
    const offline = buildStudioGraph(render.asContext, plan, buffers, 0.5)
    expect(offline.hasLane('quiet')).toBe(false)
    offline.scheduleUntil(1)
    expect(render.ofType<PlaybackSource>('source')).toHaveLength(1)
    offline.dispose()
  })

  it('loops a song that started without Repeat once it is turned on, and ends after the pass that has begun once it is turned off', () => {
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
    // A 2 s song played from 1 s: its first pass ends at 1.5 s.
    const graph = buildStudioGraph(
      ctx.asContext,
      plan,
      new Map([[asset.id, buffer]]),
      0.5,
      { fromFrame: 48000 },
    )
    const starts = () =>
      ctx.ofType<PlaybackSource>('source').map((source) => source.starts[0])
    graph.scheduleUntil(3.6)
    expect(starts()).toEqual([[0.5, 1, 1]])

    ctx.currentTime = 1.4
    expect(graph.repeat()).toBe(true)
    graph.scheduleUntil(3.6)
    expect(starts()).toEqual([
      [0.5, 1, 1],
      [1.5, 0, 2],
      [3.5, 0, 2],
    ])

    // Off during the second pass: the third, queued ahead, never plays.
    ctx.currentTime = 2
    expect(graph.stopRepeating()).toBe(1)
    const third = ctx.ofType<PlaybackSource>('source')[2]
    expect(third.stops).toBe(1)
    expect(third.connections).toHaveLength(0)
    graph.scheduleUntil(8)
    expect(starts()).toHaveLength(3)

    // On again before the second pass ends: the third pass is back.
    ctx.currentTime = 3
    expect(graph.repeat()).toBe(true)
    graph.scheduleUntil(4)
    expect(starts().at(-1)).toEqual([3.5, 0, 2])
    expect(graph.stopRepeating()).toBe(1)

    // Once the loop point has gone by, it is too late to loop in place.
    ctx.currentTime = 3.6
    expect(graph.repeat()).toBe(false)
    graph.dispose()
  })
})
