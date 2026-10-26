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
})
