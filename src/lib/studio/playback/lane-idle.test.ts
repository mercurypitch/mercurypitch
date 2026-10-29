// Studio lane idling: a lane no one hears leaves the mix once its tails ring out, and comes back at once.
import { describe, expect, it } from 'vitest'
import { normalizeChainSpec } from '@/lib/studio-fx/chain-spec'
import type { FakeNode } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import { reaches } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import { compileStudioArrangement } from '../model/arrangement-plan'
import { studioFixture } from '../model/model.test-fixtures'
import { buildStudioGraph } from './graph'
import type { PlaybackParam, PlaybackSource } from './playback.test-fixtures'
import { PlaybackContext } from './playback.test-fixtures'

type Gain = ReturnType<PlaybackContext['createGain']>

/** Two lanes with an empty chain each: `track-1` audible, `quiet` muted. */
function twoLanes(quietMuted: boolean) {
  const fixture = studioFixture()
  const frames = 48000 * 30
  const asset = {
    ...fixture.asset,
    normalizedFrameCount: frames,
    canonicalPcmByteLength: frames * 4 + 32,
    byteLength: frames * 2 + 44,
  }
  const clip = {
    ...fixture.clip,
    sourceOutFrame: frames,
    fades: {
      ...fixture.clip.fades,
      out: { fromSourceFrame: frames - 200, toSourceFrame: frames },
    },
  }
  const project = fixture.project
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
    tracks: [dry, { ...dry, id: 'quiet', order: 1, mute: quietMuted }],
    clips: [clip, { ...clip, id: 'quiet-clip', trackId: 'quiet' }],
  }
  const plan = compileStudioArrangement(song, [asset], {
    latencies: { sampleRate: 48000, framesByTrack: { 'track-1': 0, quiet: 0 } },
  })
  const ctx = new PlaybackContext()
  ctx.state = 'suspended'
  ctx.currentTime = 1
  const buffer = ctx.createBuffer(1, frames, 48000) as unknown as AudioBuffer
  const graph = buildStudioGraph(
    ctx.asContext,
    plan,
    new Map([[asset.id, buffer]]),
    1.5,
    { silentLanes: true },
  )
  graph.scheduleUntil(3)
  const merge = (id: string) =>
    graph.laneOutputs().get(id) as unknown as FakeNode
  return { ctx, graph, song, merge }
}

/** The quiet lane's sources: every source that does not reach the audible lane's merge. */
function quietSources(f: ReturnType<typeof twoLanes>) {
  return f.ctx
    .ofType<PlaybackSource>('source')
    .filter((source) => !reaches(source, f.merge('track-1')))
}

/** What a source's set feeds: source, its gain, the set's fade-out and fade-in, then the lane's inlet. */
function inletOf(source: PlaybackSource): Gain {
  let node: FakeNode = source
  for (let step = 0; step < 4; step++) node = node.targets[0]
  return node as Gain
}

describe('Studio lane idling', () => {
  it('stops feeding a lane muted while playing once its faders are silent, then takes its chain out of the mix', () => {
    const f = twoLanes(false)
    const [source] = quietSources(f)
    expect(reaches(source, f.merge('quiet'))).toBe(true)
    f.ctx.currentTime = 2
    f.graph.setLaneMix({ ...f.song.tracks[1], mute: true }, false)
    // The faders glide to silence first; the chain's input closes after them.
    const inlet = inletOf(source)
    const closes = (inlet.gain as PlaybackParam).events.filter(
      (e) => e.kind === 'set' && e.value === 0,
    )
    expect(closes).toHaveLength(1)
    expect(closes[0].time).toBeGreaterThan(2.1)
    expect(closes[0].time).toBeLessThan(2.2)
    // Still in the mix while its tail rings out on silence.
    f.ctx.currentTime = 2.3
    f.graph.scheduleUntil(4)
    expect(reaches(source, f.merge('quiet'))).toBe(true)
    // Then out of it, while its sources keep playing into a muted keep-alive.
    f.ctx.currentTime = 3
    f.graph.scheduleUntil(5)
    expect(reaches(source, f.merge('quiet'))).toBe(false)
    expect(reaches(source, f.ctx.destination)).toBe(true)
    // The audible lane never leaves.
    for (const audible of f.ctx
      .ofType<PlaybackSource>('source')
      .filter((s) => !quietSources(f).includes(s)))
      expect(reaches(audible, f.merge('track-1'))).toBe(true)
    f.graph.dispose()
  })

  it('brings an idle lane back into the mix at once on unmute, opening its input over 10 ms', () => {
    const f = twoLanes(false)
    const [source] = quietSources(f)
    f.ctx.currentTime = 2
    f.graph.setLaneMix({ ...f.song.tracks[1], mute: true }, false)
    const inlet = inletOf(source)
    f.ctx.currentTime = 3
    f.graph.scheduleUntil(5)
    expect(reaches(source, f.merge('quiet'))).toBe(false)
    f.ctx.currentTime = 4
    f.graph.setLaneMix(f.song.tracks[1], true)
    expect(reaches(source, f.merge('quiet'))).toBe(true)
    const opening = (inlet.gain as PlaybackParam).linearRamps
    expect(opening.length).toBeGreaterThanOrEqual(64)
    expect(opening[0].time).toBeGreaterThan(4)
    expect(opening.at(-1)!.value).toBe(1)
    expect(opening.at(-1)!.time - opening[0].time).toBeLessThan(0.0101)
    f.graph.dispose()
  })

  it('keeps an unmute within the fader glide on the chain it never stopped feeding', () => {
    const f = twoLanes(false)
    const [source] = quietSources(f)
    f.ctx.currentTime = 2
    f.graph.setLaneMix({ ...f.song.tracks[1], mute: true }, false)
    const inlet = inletOf(source)
    f.ctx.currentTime = 2.05
    f.graph.setLaneMix(f.song.tracks[1], true)
    const gain = inlet.gain as PlaybackParam
    // The close that was coming is cancelled: no opening is needed.
    expect(
      gain.events.some((e) => e.kind === 'cancel' && e.time <= 2.05 + 1e-9),
    ).toBe(true)
    expect(gain.linearRamps).toEqual([])
    f.ctx.currentTime = 4
    f.graph.scheduleUntil(6)
    expect(reaches(source, f.merge('quiet'))).toBe(true)
    f.graph.dispose()
  })

  it('gates a lane built silent from the start, lets its chain settle, then takes it out of the mix', () => {
    const f = twoLanes(true)
    const [source] = quietSources(f)
    const inlet = inletOf(source)
    expect(
      (inlet.gain as PlaybackParam).events.find((e) => e.kind === 'set'),
    ).toMatchObject({ value: 0 })
    f.ctx.currentTime = 1.2
    f.graph.scheduleUntil(3)
    expect(reaches(source, f.merge('quiet'))).toBe(true)
    f.ctx.currentTime = 1.6
    f.graph.scheduleUntil(3.5)
    expect(reaches(source, f.merge('quiet'))).toBe(false)
    expect(reaches(source, f.ctx.destination)).toBe(true)
    f.graph.dispose()
  })

  it('closes the new chain of a lane no one hears as a swap builds it, and takes it out of the mix again', () => {
    const f = twoLanes(false)
    f.ctx.currentTime = 2
    f.graph.setLaneMix({ ...f.song.tracks[1], mute: true }, false)
    f.ctx.currentTime = 3
    f.graph.scheduleUntil(5)
    const before = f.ctx.created.length
    const at = f.graph.swapChains(
      [
        {
          trackId: 'quiet',
          spec: normalizeChainSpec({ effects: [] }),
          latency: 0,
          release: () => {},
        },
      ],
      3.05,
    )
    expect(at).not.toBeNull()
    f.graph.scheduleUntil(at! + 2.5)
    const inlets = f.ctx.created
      .slice(before)
      .filter(
        (node): node is Gain =>
          node.nodeType === 'gain' &&
          node.targets.length === 1 &&
          node.targets[0].nodeType === 'gain' &&
          (node as Gain).gain.events.length > 0,
      )
    expect(
      inlets.some((inlet) =>
        (inlet.gain as PlaybackParam).events.some(
          (e) => e.kind === 'set' && e.value === 0 && e.time === 3,
        ),
      ),
    ).toBe(true)
    // After the crossing and the settle, the new chain is out of the mix too.
    f.ctx.currentTime = at! + 1
    f.graph.scheduleUntil(at! + 3)
    const fresh = f.ctx
      .ofType<PlaybackSource>('source')
      .filter((source) => f.ctx.created.indexOf(source) > before)
    expect(fresh.length).toBeGreaterThan(0)
    for (const source of fresh) {
      if (reaches(source, f.merge('track-1'))) continue
      expect(reaches(source, f.merge('quiet'))).toBe(false)
      expect(reaches(source, f.ctx.destination)).toBe(true)
    }
    f.graph.dispose()
  })

  it('lets nothing reach the speakers from an idle lane once the graph is gone', () => {
    const f = twoLanes(true)
    f.ctx.currentTime = 2
    f.graph.scheduleUntil(4)
    f.graph.dispose()
    for (const source of f.ctx.ofType<PlaybackSource>('source'))
      expect(reaches(source, f.ctx.destination)).toBe(false)
  })
})
