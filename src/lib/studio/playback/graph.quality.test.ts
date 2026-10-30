// Studio graph quality tests — lanes built at the profile the graph is given, and reverbs sharing the reverb bus.
import { describe, expect, it, vi } from 'vitest'
import { normalizeChainSpec } from '@/lib/studio-fx/chain-spec'
import type { FakeNode } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import { reaches } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import type { StudioFxProfile } from '@/lib/studio-fx/fx-profile'
import { FULL_FX_PROFILE } from '@/lib/studio-fx/fx-profile'
import { compileStudioArrangement } from '../model/arrangement-plan'
import { studioFixture } from '../model/model.test-fixtures'
import { buildStudioGraph } from './graph'
import { changedChains } from './live-edit'
import type { PlaybackParam, PlaybackSource } from './playback.test-fixtures'
import { PlaybackContext } from './playback.test-fixtures'

type FakeConvolverNode = FakeNode

const LIGHT: StudioFxProfile = {
  id: 'light',
  oversample: { saturation: '2x', exciter: 'none', limiter: 'none' },
  reverbBus: false,
  lite: [],
}

/** One lane with a saturation, built at LIGHT, playing. */
function playingGraph() {
  const fixture = studioFixture()
  const frames = 48000 * 30
  const asset = {
    ...fixture.asset,
    normalizedFrameCount: frames,
    canonicalPcmByteLength: frames * 4 + 32,
    byteLength: frames * 2 + 44,
  }
  const clip = { ...fixture.clip, sourceOutFrame: frames }
  const track = {
    ...fixture.project.tracks[0],
    fx: {
      ...fixture.project.tracks[0].fx,
      baseSpec: {
        version: 1 as const,
        effects: [
          {
            id: 'sat',
            kind: 'saturation' as const,
            enabled: true,
            params: { driveDb: 6, toneHz: 5000, outputDb: 0, mix: 35 },
          },
        ],
      },
    },
  }
  const song = { ...fixture.project, tracks: [track], clips: [clip] }
  const plan = compileStudioArrangement(song, [asset], {
    latencies: { sampleRate: 48000, framesByTrack: { 'track-1': 0 } },
  })
  const ctx = new PlaybackContext()
  ctx.currentTime = 1
  const buffer = ctx.createBuffer(1, frames, 48000) as unknown as AudioBuffer
  const tick = vi.fn()
  const graph = buildStudioGraph(
    ctx.asContext,
    plan,
    new Map([[asset.id, buffer]]),
    1.5,
    {
      profile: LIGHT,
      quality: { tick },
    },
  )
  graph.scheduleUntil(3)
  return { ctx, graph, tick }
}

describe('Studio graph playback quality', () => {
  it('builds its lanes at the profile it is given, and tells live quality of each tick', () => {
    const f = playingGraph()
    expect(f.graph.profile()).toBe(LIGHT)
    expect(f.tick).toHaveBeenCalledWith(f.ctx.asContext)
    f.graph.dispose()
  })
})

/** Two lanes with a reverb each, in one space, at a profile with the bus. */
function busGraph(
  decays: readonly [number, number],
  duck = 0,
  reverbBus = true,
) {
  const fixture = studioFixture()
  const frames = 48000 * 30
  const asset = {
    ...fixture.asset,
    normalizedFrameCount: frames,
    canonicalPcmByteLength: frames * 4 + 32,
    byteLength: frames * 2 + 44,
  }
  const clip = { ...fixture.clip, sourceOutFrame: frames }
  const lane = (id: string, order: number, decayS: number) => ({
    ...fixture.project.tracks[0],
    id,
    order,
    fx: {
      ...fixture.project.tracks[0].fx,
      baseSpec: normalizeChainSpec({
        effects: [
          { id: 'verb', kind: 'reverb', params: { decayS, duck } },
          { id: 'trim', kind: 'gain', params: { gainDb: -6 } },
        ],
      }),
    },
  })
  const song = {
    ...fixture.project,
    tracks: [lane('track-1', 0, decays[0]), lane('two', 1, decays[1])],
    clips: [clip, { ...clip, id: 'clip-two', trackId: 'two' }],
  }
  const plan = compileStudioArrangement(song, [asset], {
    latencies: { sampleRate: 48000, framesByTrack: { 'track-1': 0, two: 0 } },
  })
  const ctx = new PlaybackContext()
  ctx.currentTime = 1
  const buffer = ctx.createBuffer(1, frames, 48000) as unknown as AudioBuffer
  const graph = buildStudioGraph(
    ctx.asContext,
    plan,
    new Map([[asset.id, buffer]]),
    1.5,
    { profile: { ...FULL_FX_PROFILE, id: 'bus', reverbBus } },
  )
  graph.scheduleUntil(3)
  return { ctx, graph, song }
}

describe('Studio graph reverb bus', () => {
  it('runs one convolver for lanes whose reverbs share a space, fed after each lane fader', () => {
    const f = busGraph([1.5, 2.2])
    const convolvers = f.ctx.ofType<FakeConvolverNode>('convolver')
    expect(convolvers).toHaveLength(1)
    for (const source of f.ctx.ofType<PlaybackSource>('source'))
      expect(reaches(source, convolvers[0])).toBe(true)
    f.graph.dispose()
    expect(convolvers[0].targets).toEqual([])
  })

  it('builds a space for each decay range, and none at full quality', () => {
    const f = busGraph([0.8, 2.8])
    expect(f.ctx.ofType('convolver')).toHaveLength(2)
    f.graph.dispose()
  })

  it("moves a lane's sends with its fader, trimmed by the gains after the reverb", () => {
    const f = busGraph([1.5, 1.5])
    const sendGains = f.ctx
      .ofType<ReturnType<PlaybackContext['createGain']>>('gain')
      .filter((gain) => Math.abs(gain.gain.value - 10 ** (-6 / 20)) < 1e-9)
    expect(sendGains.length).toBeGreaterThanOrEqual(2)
    f.ctx.currentTime = 2
    f.graph.setLaneMix({ ...f.song.tracks[1], volumeDb: -12 } as never, true)
    const moved = f.ctx
      .ofType<ReturnType<PlaybackContext['createGain']>>('gain')
      .filter((gain) =>
        (gain.gain as PlaybackParam).events.some(
          (event) => event.kind === 'target' && event.time === 2,
        ),
      )
    // The lane's own fader pair and its send's pair.
    expect(moved).toHaveLength(4)
    f.graph.dispose()
  })

  it('swaps a lane on the bus to a new chain, crossing its sends with it', () => {
    const f = busGraph([1.5, 1.5])
    type Gain = ReturnType<PlaybackContext['createGain']>
    const built = new Set(f.ctx.ofType<Gain>('gain'))
    const spec = (gainDb: number) =>
      normalizeChainSpec({
        effects: [
          { id: 'verb', kind: 'reverb', params: { decayS: 2.8, duck: 0 } },
          { id: 'trim', kind: 'gain', params: { gainDb } },
        ],
      })
    const at = f.graph.swapChains(
      [{ trackId: 'two', spec: spec(-12), latency: 0, release: () => {} }],
      1.05,
    )
    expect(at).not.toBeNull()
    // As a lane swap does next: the new chain's sources start.
    f.graph.scheduleUntil(3)
    const end = at! + 0.03
    const near = (a: number, b: number) => Math.abs(a - b) < 1e-9
    const lastRamp = (gain: Gain) =>
      (gain.gain as PlaybackParam).linearRamps.at(-1)
    const crossing = (from: number, to: number) =>
      f.ctx.ofType<Gain>('gain').filter((gain) => {
        const ramp = lastRamp(gain)
        return (
          (gain.gain as PlaybackParam).events.some(
            (event) =>
              event.kind === 'set' &&
              near(event.time, at!) &&
              near(event.value!, from),
          ) &&
          ramp !== undefined &&
          near(ramp.value, to) &&
          near(ramp.time, end)
        )
      })
    // The old chain's send leaves from its trim as the new chain's comes in
    // to its own, on the frames the chains cross on.
    const out = crossing(10 ** (-6 / 20), 0)
    const into = crossing(0, 10 ** (-12 / 20))
    expect(out).toHaveLength(1)
    expect(into).toHaveLength(1)
    expect(built.has(out[0])).toBe(true)
    expect(built.has(into[0])).toBe(false)
    // The new chain's decay sends it to a space of its own.
    const convolvers = f.ctx.ofType<FakeConvolverNode>('convolver')
    expect(convolvers).toHaveLength(2)
    expect(reaches(into[0], convolvers[1])).toBe(true)
    // Changed in place while crossing, its sends still come in with it.
    f.graph.setLaneSpec('two', spec(-18))
    expect(lastRamp(into[0])!.value).toBeCloseTo(10 ** (-18 / 20), 12)
    expect(lastRamp(into[0])!.time).toBeCloseTo(end, 12)
    // Once the old chain has faded out, its send goes with it.
    f.ctx.currentTime = end + 1
    f.graph.scheduleUntil(end + 2)
    expect(out[0].targets).toEqual([])
    f.graph.dispose()
  })

  it('builds a lane a new chain when its reverb moves to another space or to ducking', () => {
    const edit = (reverbBus: boolean, params: Record<string, number>) => {
      const f = busGraph([1.5, 1.5], 0, reverbBus)
      const after = {
        ...f.song,
        tracks: f.song.tracks.map((track) =>
          track.id !== 'two'
            ? track
            : {
                ...track,
                fx: {
                  ...track.fx,
                  baseSpec: normalizeChainSpec({
                    effects: [
                      {
                        id: 'verb',
                        kind: 'reverb',
                        params: { decayS: 1.5, duck: 0, ...params },
                      },
                      { id: 'trim', kind: 'gain', params: { gainDb: -6 } },
                    ],
                  }),
                },
              },
        ),
      }
      const changed = changedChains(f.graph, f.song, after)
      f.graph.dispose()
      return changed
    }
    // A decay within its space moves in place; the space itself cannot.
    expect(edit(true, { decayS: 2 })).toEqual([])
    expect(edit(true, { decayS: 2.8 })).toEqual(['two'])
    expect(edit(true, { duck: 40 })).toEqual(['two'])
    // Each lane's own reverb takes any decay in place.
    expect(edit(false, { decayS: 2.8 })).toEqual([])
  })

  it('keeps a ducked reverb on its lane', () => {
    const f = busGraph([1.5, 1.5], 60)
    // Each lane's reverb convolves on its own: two slots each, no shared space.
    expect(f.ctx.ofType('convolver')).toHaveLength(4)
    f.graph.dispose()
  })
})
