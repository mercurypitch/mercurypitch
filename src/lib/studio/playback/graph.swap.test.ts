// Studio graph swap tests — a new effect list builds only its lane's new chain, beside the old one, and the lane crosses to it while every other lane plays on.
import { describe, expect, it, vi } from 'vitest'
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import { CHAIN_SPEC_VERSION, createEffectSpec, } from '@/lib/studio-fx/chain-spec'
import type { FakeNode } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import { compileStudioArrangement } from '../model/arrangement-plan'
import { studioFixture } from '../model/model.test-fixtures'
import type { StudioClip, StudioProject } from '../model/types'
import { buildStudioGraph } from './graph'
import { laneGains } from './graph-lanes'
import { CHAIN_SETTLE_SECONDS } from './graph-swap'
import type { PlaybackSource } from './playback.test-fixtures'
import { PlaybackContext } from './playback.test-fixtures'

type Gain = ReturnType<PlaybackContext['createGain']>

const TAKE = 96000
const CROSSFADE = 0.03

const chainOf = (...kinds: ('compressor' | 'reverb')[]): ChainSpec => ({
  version: CHAIN_SPEC_VERSION,
  effects: kinds.map((kind) => createEffectSpec(kind)),
})
const COMPRESSED = chainOf('compressor')

/**
 * A two-second take on two dry lanes, playing from 0.5 s. The first lane's
 * chain is 10 ms slower, the slowest, so the second lane's sources start
 * 10 ms later. `lateClips` gives the second lane other clips.
 */
function swappingGraph(
  options: {
    repeat?: boolean
    lateClips?: (whole: StudioClip) => StudioClip[]
  } = {},
) {
  const { project, asset, clip } = studioFixture()
  const long = {
    ...asset,
    normalizedFrameCount: TAKE,
    canonicalPcmByteLength: TAKE * 4 + 32,
  }
  const dry = {
    ...project.tracks[0],
    balanceGainDb: 0,
    fx: {
      ...project.tracks[0].fx,
      baseSpec: { version: 1 as const, effects: [] },
    },
  }
  const late = { ...dry, id: 'late', order: 1, balanceGainDb: -6 }
  const whole: StudioClip = {
    ...clip,
    startFrame: 0,
    sourceInFrame: 0,
    sourceOutFrame: TAKE,
    fades: { curve: 'linear-amplitude' },
  }
  const lateWhole = { ...whole, id: 'late-clip', trackId: 'late' }
  const song: StudioProject = {
    ...project,
    tracks: [dry, late],
    clips: [whole, ...(options.lateClips?.(lateWhole) ?? [lateWhole])],
  }
  const plan = compileStudioArrangement(song, [long], {
    latencies: {
      sampleRate: 48000,
      framesByTrack: { 'track-1': 480, late: 0 },
    },
  })
  const ctx = new PlaybackContext()
  ctx.state = 'suspended'
  const buffer = ctx.createBuffer(1, TAKE, 48000) as unknown as AudioBuffer
  const graph = buildStudioGraph(
    ctx.asContext,
    plan,
    new Map([[asset.id, buffer]]),
    0.5,
    { repeat: options.repeat },
  )
  const sources = () => ctx.ofType<PlaybackSource>('source')
  /** The chain input a source's lane feeds: after its edge gain and its set's two fades. */
  const inputOf = (source: PlaybackSource): FakeNode =>
    source.connections[0].node.connections[0].node.connections[0].node
      .connections[0].node
  const [firstSplit, lateSplit] = ctx.ofType<FakeNode>('splitter')
  /** The gains after the chains into a lane's faders: one, or two while it crosses. */
  const fadesInto = (split: FakeNode) =>
    ctx.ofType<Gain>('gain').filter((gain) => gain.targets.includes(split))
  const mixesOf = (split: FakeNode) => split.targets as Gain[]
  const songWith = (clips: readonly StudioClip[]) =>
    compileStudioArrangement({ ...song, clips: [...clips] }, [long])
  return {
    ctx,
    graph,
    sources,
    inputOf,
    firstSplit,
    lateSplit,
    fadesInto,
    mixesOf,
    songWith,
    late,
    clips: song.clips,
  }
}

/** Source start times, rounded so float noise does not hide a frame. */
const startsOf = (sources: readonly PlaybackSource[]) =>
  sources.map((source) =>
    source.starts[0].map((value) => Math.round(value * 1e9) / 1e9),
  )

const rounded = (value: number | undefined) =>
  value === undefined ? undefined : Math.round(value * 1e9) / 1e9

describe('Studio graph swap', () => {
  it('builds the new chain beside the old one, feeds it from the first whole frame, and crosses the chain outputs once it has settled; the other lane plays on untouched', () => {
    const f = swappingGraph()
    f.graph.scheduleUntil(1)
    const [first, late] = f.sources()
    expect(f.graph.readLaneReduction('late')).toBeNull()
    f.ctx.currentTime = 1
    const release = vi.fn()

    const at = f.graph.swapChains(
      [{ trackId: 'late', spec: COMPRESSED, latency: 0.004, release }],
      1.02,
    )
    f.graph.scheduleUntil(3)

    // Heard once its compressor has settled, not as soon as it reads.
    expect(at).toBeCloseTo(1 + CHAIN_SETTLE_SECONDS, 9)
    const started = f.sources().slice(2)
    // From frame 24960, 6 ms after the slowest lane: 10 ms less its own 4.
    expect(startsOf(started)).toEqual([[1.026, 0.52, 1.48]])
    expect(f.inputOf(started[0])).not.toBe(f.inputOf(late))
    // The old chain is fed until its output has faded, then its source stops.
    expect(late.stopTimes.map(rounded)).toEqual([1.34])
    const [old, next] = f.fadesInto(f.lateSplit)
    expect(old.gain.events).toEqual([{ kind: 'set', time: at, value: 1 }])
    expect(old.gain.linearRamps).toEqual([{ value: 0, time: at! + CROSSFADE }])
    expect(next.gain.value).toBe(0)
    expect(next.gain.linearRamps).toEqual([{ value: 1, time: at! + CROSSFADE }])
    // The other lane: no new source, no stop, no fade.
    expect(first.stops).toBe(0)
    const [untouched] = f.fadesInto(f.firstSplit)
    expect(untouched.gain.events).toEqual([])
    expect(untouched.gain.linearRamps).toEqual([])
    // The lane's meters read the new chain.
    expect(f.graph.readLaneReduction('late')).toBe(-3)
    expect(release).not.toHaveBeenCalled()
    f.graph.dispose()
    expect(release).toHaveBeenCalledOnce()
  })

  it("takes the new sources' frame once the chain is built, as far ahead of the clock as asked, so a slow build cannot start them late", () => {
    const f = swappingGraph()
    f.graph.scheduleUntil(1)
    f.ctx.currentTime = 1
    // Building the chain holds the main thread while the clock runs on 30
    // ms, past the 20 ms ahead the caller asked for: a source started at a
    // time gone by starts late, and plays its lane out of line.
    const build = f.ctx.createDynamicsCompressor.bind(f.ctx)
    let slow = true
    f.ctx.createDynamicsCompressor = () => {
      if (slow) f.ctx.currentTime += 0.03
      slow = false
      return build()
    }

    const at = f.graph.swapChains(
      [{ trackId: 'late', spec: COMPRESSED, latency: 0.004, release: vi.fn() }],
      1.02,
    )
    f.graph.scheduleUntil(3)

    const started = f.sources().slice(2)
    // Still 20 ms ahead once built: frame 26400, 6 ms after the slowest lane.
    expect(startsOf(started)).toEqual([[1.056, 0.55, 1.45]])
    expect(at).toBeCloseTo(1.03 + CHAIN_SETTLE_SECONDS, 9)
    f.graph.dispose()
  })

  it('takes down a chain it built when the song has played out by the time it is built, and changes nothing', () => {
    const f = swappingGraph()
    f.graph.scheduleUntil(2.5)
    // Frame 95520 of 96000 is 20 ms ahead; 30 ms on, the song has ended.
    f.ctx.currentTime = 2.47
    const build = f.ctx.createDynamicsCompressor.bind(f.ctx)
    let slow = true
    f.ctx.createDynamicsCompressor = () => {
      if (slow) f.ctx.currentTime += 0.03
      slow = false
      return build()
    }
    const before = f.sources().length

    const at = f.graph.swapChains(
      [{ trackId: 'late', spec: COMPRESSED, latency: 0.004, release: vi.fn() }],
      2.49,
    )

    expect(at).toBeNull()
    expect(f.fadesInto(f.lateSplit)).toHaveLength(1)
    f.graph.scheduleUntil(3)
    expect(f.sources()).toHaveLength(before)
    expect(f.graph.swapping()).toBe(false)
    f.graph.dispose()
  })

  it('feeds the old chain until its output has faded out, then takes it down and frees what a swapped-in chain held', () => {
    // The lane's second clip starts after the swap but before the crossfade ends.
    const f = swappingGraph({
      lateClips: (whole) => [
        { ...whole, sourceOutFrame: 28800 },
        {
          ...whole,
          id: 'late-b',
          startFrame: 33600,
          sourceInFrame: 33600,
        },
      ],
    })
    f.graph.scheduleUntil(1)
    const [, lateA] = f.sources()
    f.ctx.currentTime = 1
    const firstRelease = vi.fn()
    f.graph.swapChains(
      [
        {
          trackId: 'late',
          spec: COMPRESSED,
          latency: 0.004,
          release: firstRelease,
        },
      ],
      1.02,
    )
    const [lateB] = f.sources().slice(2)
    expect(f.inputOf(lateB)).toBe(f.inputOf(lateA))
    expect(startsOf([lateB])).toEqual([[1.21, 0.7, 1.3]])
    expect(lateB.stopTimes.map(rounded)).toEqual([1.34])
    f.graph.scheduleUntil(3)
    const onNew = f.sources().slice(3)
    expect(startsOf(onNew)).toEqual([
      [1.026, 0.52, 0.08],
      [1.206, 0.7, 1.3],
    ])
    expect(
      onNew.every((source) => f.inputOf(source) !== f.inputOf(lateA)),
    ).toBe(true)

    const [old] = f.fadesInto(f.lateSplit)
    const oldInput = f.inputOf(lateA)
    // Still crossing at 1.339; gone at 1.34, once its sources have faded too.
    f.ctx.currentTime = 1.339
    f.graph.scheduleUntil(3.339)
    expect(f.fadesInto(f.lateSplit)).toHaveLength(2)
    f.ctx.currentTime = 1.34
    f.graph.scheduleUntil(3.34)
    expect(f.fadesInto(f.lateSplit)).toHaveLength(1)
    expect(old.connections).toEqual([])
    expect(oldInput.connections).toEqual([])
    // The chain the graph was built with held no memory of its own.
    expect(firstRelease).not.toHaveBeenCalled()

    // A second swap retires the first one's chain, which frees its memory.
    f.ctx.currentTime = 2
    const secondRelease = vi.fn()
    f.graph.swapChains(
      [
        {
          trackId: 'late',
          spec: chainOf('compressor', 'compressor'),
          latency: 0.002,
          release: secondRelease,
        },
      ],
      2.02,
    )
    f.graph.scheduleUntil(4)
    f.ctx.currentTime = 2.4
    f.graph.scheduleUntil(4.4)
    expect(firstRelease).toHaveBeenCalledOnce()
    expect(secondRelease).not.toHaveBeenCalled()
    f.graph.dispose()
    expect(secondRelease).toHaveBeenCalledOnce()
  })

  it('swaps a lane as slow as the slowest to a chain as slow, with no compensation, and refuses a slower one', () => {
    const f = swappingGraph()
    f.graph.scheduleUntil(1)
    f.ctx.currentTime = 1
    const created = f.ctx.created.length
    const slower = f.graph.swapChains(
      [
        {
          trackId: 'late',
          spec: COMPRESSED,
          latency: 0.0102,
          release: vi.fn(),
        },
      ],
      1.02,
    )
    // Every other lane would have to wait for it: a new run must take it.
    expect(slower).toBeNull()
    expect(f.ctx.created).toHaveLength(created)
    expect(f.sources().every((source) => source.stops === 0)).toBe(true)

    expect(
      f.graph.swapChains(
        [
          {
            trackId: 'track-1',
            spec: COMPRESSED,
            latency: 0.01,
            release: vi.fn(),
          },
        ],
        1.02,
      ),
    ).not.toBeNull()
    f.graph.scheduleUntil(3)
    expect(startsOf(f.sources().slice(2))).toEqual([[1.02, 0.52, 1.48]])
    f.graph.dispose()
  })

  it('refuses a lane it did not build, a song played out, a chain it cannot build, and a parked or disposed graph, and changes nothing', () => {
    const f = swappingGraph()
    f.graph.scheduleUntil(1)
    f.ctx.currentTime = 1
    const swap = (trackId: string, spec = COMPRESSED) => [
      { trackId, spec, latency: 0, release: vi.fn() },
    ]
    const created = f.ctx.created.length
    expect(f.graph.swapChains(swap('nobody'), 1.02)).toBeNull()
    // A reverb needs a convolver, which this context cannot make.
    const ctx = f.ctx as unknown as { createConvolver: () => never }
    const createConvolver = ctx.createConvolver
    ctx.createConvolver = () => {
      throw new Error('No convolver.')
    }
    expect(f.graph.swapChains(swap('late', chainOf('reverb')), 1.02)).toBeNull()
    ctx.createConvolver = createConvolver
    const [old] = f.fadesInto(f.lateSplit)
    expect(f.fadesInto(f.lateSplit)).toHaveLength(1)
    expect(old.gain.events).toEqual([])
    expect(f.sources().every((source) => source.stops === 0)).toBe(true)
    expect(f.sources()).toHaveLength(2)
    // The song plays once and ends at 2.51 s: there is nothing to cross.
    f.ctx.currentTime = 2.6
    expect(f.graph.swapChains(swap('late'), 2.62)).toBeNull()
    f.ctx.currentTime = 1
    f.graph.park()
    expect(f.graph.swapChains(swap('late'), 1.02)).toBeNull()
    f.graph.dispose()
    expect(f.graph.swapChains(swap('late'), 1.02)).toBeNull()
    // The failed reverb chain left nothing connected behind it.
    expect(
      f.ctx
        .ofType<Gain>('gain')
        .slice(created)
        .some((gain) => gain.targets.includes(f.lateSplit)),
    ).toBe(false)
  })

  it('refuses to seek, re-plan or swap again while a lane crosses, and does all three once it is done', () => {
    const f = swappingGraph()
    f.graph.scheduleUntil(1)
    f.ctx.currentTime = 1
    const swap = () => [
      { trackId: 'late', spec: COMPRESSED, latency: 0, release: vi.fn() },
    ]
    const at = f.graph.swapChains(swap(), 1.02)!
    f.graph.scheduleUntil(3)
    const [whole, lateWhole] = f.clips
    const moved = f.songWith([whole, { ...lateWhole, gainDb: -6 }])
    f.ctx.currentTime = at - 0.1
    expect(f.graph.swapping()).toBe(true)
    expect(f.graph.seek(0, at - 0.08)).toBeNull()
    expect(f.graph.replan(moved, at - 0.08)).toBeNull()
    expect(f.graph.swapChains(swap(), at - 0.08)).toBeNull()

    // Done once the old chain's output and its sources have faded out.
    f.ctx.currentTime = at + CROSSFADE + 0.01
    expect(f.graph.swapping()).toBe(false)
    expect(f.graph.replan(moved, f.ctx.currentTime + 0.02)).not.toBeNull()
    expect(f.graph.seek(0, f.ctx.currentTime + 0.05)).not.toBeNull()
    expect(f.graph.swapChains(swap(), f.ctx.currentTime + 0.1)).not.toBeNull()
    f.graph.dispose()
  })

  it('holds the old balance on a crossing lane until its new chain is heard, which brings its own', () => {
    const f = swappingGraph()
    f.graph.scheduleUntil(1)
    f.ctx.currentTime = 1
    const at = f.graph.swapChains(
      [{ trackId: 'late', spec: COMPRESSED, latency: 0, release: vi.fn() }],
      1.02,
    )!
    const role = { ...f.late, balanceGainDb: 0 }
    const [left] = f.mixesOf(f.lateSplit)
    f.ctx.currentTime = 1.1
    f.graph.setLaneMix(role, true)
    expect(left.gain.events.slice(-3)).toEqual([
      { kind: 'cancel', time: 1.1 },
      {
        kind: 'target',
        time: 1.1,
        value: laneGains(f.late)[0],
        timeConstant: 0.012,
      },
      {
        kind: 'target',
        time: at,
        value: laneGains(role)[0],
        timeConstant: 0.012,
      },
    ])
    // Once the new chain is heard, the lane's own balance is all there is.
    f.ctx.currentTime = at + 0.001
    f.graph.setLaneMix(role, true)
    expect(left.gain.events.slice(-2)).toEqual([
      { kind: 'cancel', time: at + 0.001 },
      {
        kind: 'target',
        time: at + 0.001,
        value: laneGains(role)[0],
        timeConstant: 0.012,
      },
    ])
    f.graph.dispose()
  })

  it('ends a swap at once when the graph parks: the old chain goes, and the new one plays alone at unity from resume', () => {
    const f = swappingGraph()
    f.graph.scheduleUntil(1)
    const [, late] = f.sources()
    f.ctx.currentTime = 1
    const release = vi.fn()
    f.graph.swapChains(
      [{ trackId: 'late', spec: COMPRESSED, latency: 0.004, release }],
      1.02,
    )
    f.graph.scheduleUntil(3)
    const [old, next] = f.fadesInto(f.lateSplit)
    const oldInput = f.inputOf(late)
    f.ctx.currentTime = 1.1
    f.graph.park()
    expect(old.connections).toEqual([])
    expect(oldInput.connections).toEqual([])
    expect(f.fadesInto(f.lateSplit)).toEqual([next])
    expect(next.gain.events.at(-1)).toEqual({ kind: 'cancel', time: 0 })
    expect(next.gain.value).toBe(1)
    expect(release).not.toHaveBeenCalled()

    const before = f.sources().length
    f.ctx.currentTime = 2
    expect(f.graph.resume(0, 2.1, false)).toBe(true)
    f.graph.scheduleUntil(4)
    const resumed = f.sources().slice(before)
    expect(resumed).toHaveLength(2)
    expect(f.inputOf(resumed[1])).not.toBe(oldInput)
    expect(startsOf([resumed[1]])).toEqual([[2.106, 0, 2]])
    f.graph.dispose()
    expect(release).toHaveBeenCalledOnce()
  })

  it('swaps in a later pass of a repeating song, counting passes from the one playing, and loops on the new chain', () => {
    const f = swappingGraph({ repeat: true })
    for (const now of [0, 1, 2]) {
      f.ctx.currentTime = now
      f.graph.scheduleUntil(now + 1)
    }
    // Pass 1 began at 2.5 s.
    f.ctx.currentTime = 3
    const before = f.sources().length
    const firstLane = f.inputOf(f.sources()[0])
    f.graph.swapChains(
      [{ trackId: 'late', spec: COMPRESSED, latency: 0.004, release: vi.fn() }],
      3.02,
    )
    f.graph.scheduleUntil(5)
    const onNew = f
      .sources()
      .slice(before)
      .filter((source) => f.inputOf(source) !== firstLane)
    expect(startsOf(onNew)).toEqual([
      [3.026, 0.52, 1.48],
      [4.506, 0, 2],
    ])
    expect(new Set(onNew.map(f.inputOf)).size).toBe(1)
    f.graph.dispose()
  })
})
