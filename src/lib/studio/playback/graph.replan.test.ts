// Studio graph re-plan tests — a clip edit crosses only the lane it changes; the others play on untouched.
import { describe, expect, it } from 'vitest'
import type { FakeNode } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import { compileStudioArrangement } from '../model/arrangement-plan'
import { studioFixture } from '../model/model.test-fixtures'
import type { StudioClip, StudioProject } from '../model/types'
import { buildStudioGraph } from './graph'
import type { PlaybackSource } from './playback.test-fixtures'
import { PlaybackContext } from './playback.test-fixtures'
import { SAME_AUDIO_CROSSFADE_SECONDS, SEEK_CROSSFADE_SECONDS, } from './seek-crossfade'

type Gain = ReturnType<PlaybackContext['createGain']>

const TAKE = 96000

/**
 * A two-second take on two dry lanes, playing from 0.5 s. The first lane's
 * chain is 10 ms slower, so the second lane's sources start 10 ms later.
 * `planOf` compiles the song with other clips as a playing run re-plans it:
 * from the same first frame, its latencies not read.
 */
function playingGraph(options: { repeat?: boolean } = {}) {
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
  const whole: StudioClip = {
    ...clip,
    startFrame: 0,
    sourceInFrame: 0,
    sourceOutFrame: TAKE,
    fades: { curve: 'linear-amplitude' },
  }
  const song: StudioProject = {
    ...project,
    tracks: [dry, { ...dry, id: 'late', order: 1 }],
    clips: [whole, { ...whole, id: 'late-clip', trackId: 'late' }],
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
  /** The gains a source plays through: its clip edges, then its set's fade-out and fade-in. */
  const fadesOf = (source: PlaybackSource) => {
    const edge = source.connections[0].node
    const fadeOut = edge.connections[0].node as Gain
    const fadeIn = fadeOut.connections[0].node as Gain
    return { fadeOut, fadeIn }
  }
  /** The chain input a source's lane feeds. */
  const chainOf = (source: PlaybackSource): FakeNode =>
    fadesOf(source).fadeIn.connections[0].node
  const songWith = (
    clips: readonly StudioClip[],
    tracks = song.tracks,
  ): StudioProject => ({ ...song, tracks, clips: [...clips] })
  const planOf = (
    clips: readonly StudioClip[],
    tracks = song.tracks,
    assets = [long],
  ) => compileStudioArrangement(songWith(clips, tracks), assets)
  const [first, second] = song.clips
  return {
    ctx,
    graph,
    sources,
    fadesOf,
    chainOf,
    songWith,
    planOf,
    first,
    second,
    long,
    tracks: song.tracks,
  }
}

/** Source start times, rounded so float noise does not hide a frame. */
const startsOf = (sources: readonly PlaybackSource[]) =>
  sources.map((source) =>
    source.starts[0].map((value) => Math.round(value * 1e9) / 1e9),
  )

describe('Studio graph re-plan', () => {
  it('crosses only the lane a clip edit changes, linearly for the same audio, and leaves the other lane playing', () => {
    const { ctx, graph, sources, fadesOf, chainOf, planOf, first, second } =
      playingGraph()
    graph.scheduleUntil(1)
    const [edited, untouched] = sources()

    ctx.currentTime = 1
    const moved = graph.replan(
      planOf([{ ...first, gainDb: first.gainDb - 6 }, second]),
      1.02,
    )
    graph.scheduleUntil(3)

    // The anchor stays: the edit is on the frames the graph already plays.
    expect(moved).toEqual({ at: 1.02, fromFrame: 0, epoch: 0.5 })
    const started = sources().slice(2)
    expect(startsOf(started)).toEqual([[1.02, 0.52, 1.48]])
    expect(chainOf(started[0])).toBe(chainOf(edited))
    // The edited lane crossfades over 30 ms; the other lane is not touched.
    expect(edited.stopTimes).toEqual([1.02 + SAME_AUDIO_CROSSFADE_SECONDS])
    expect(untouched.stops).toBe(0)
    expect(untouched.connections).toHaveLength(1)
    const out = fadesOf(edited).fadeOut.gain.curves
    const into = fadesOf(started[0]).fadeIn.gain
    expect(out).toMatchObject([
      { time: 1.02, duration: SAME_AUDIO_CROSSFADE_SECONDS },
    ])
    expect(into.value).toBe(0)
    expect(into.curves).toMatchObject([
      { time: 1.02, duration: SAME_AUDIO_CROSSFADE_SECONDS },
    ])
    // The same audio on both sides: the gains sum to one throughout.
    expect([...out[0].values]).toEqual([1, 0])
    expect([...into.curves[0].values]).toEqual([0, 1])
    expect(fadesOf(untouched).fadeOut.gain.curves).toEqual([])
    graph.dispose()
  })

  it('crosses at equal power when the clip under the playhead moved, on that lane alone', () => {
    const { ctx, graph, sources, fadesOf, planOf, first, second } =
      playingGraph()
    graph.scheduleUntil(1)
    const [edited, untouched] = sources()
    ctx.currentTime = 1
    // One millisecond later: the lane plays other frames from here.
    expect(
      graph.replan(planOf([{ ...first, startFrame: 48 }, second]), 1.02),
    ).toEqual({ at: 1.02, fromFrame: 0, epoch: 0.5 })
    graph.scheduleUntil(3)
    const started = sources().slice(2)
    expect(startsOf(started)).toEqual([[1.02, 0.519, 1.481]])
    expect(edited.stopTimes).toEqual([1.02 + SEEK_CROSSFADE_SECONDS])
    expect(untouched.stops).toBe(0)
    const [fadeOut] = fadesOf(edited).fadeOut.gain.curves
    const [fadeIn] = fadesOf(started[0]).fadeIn.gain.curves
    expect(fadeIn.duration).toBe(SEEK_CROSSFADE_SECONDS)
    for (const [point, level] of fadeIn.values.entries())
      expect(level ** 2 + fadeOut.values[point] ** 2).toBeCloseTo(1, 6)
    graph.dispose()
  })

  it('starts nothing for a split, which plays the same segments', () => {
    const { ctx, graph, sources, planOf, first, second } = playingGraph()
    graph.scheduleUntil(1)
    ctx.currentTime = 1
    const halves = [
      { ...first, sourceOutFrame: 48000 },
      { ...first, id: 'right', startFrame: 48000, sourceInFrame: 48000 },
      second,
    ]
    expect(graph.replan(planOf(halves), 1.02)).toEqual({
      at: null,
      fromFrame: 0,
      epoch: 0.5,
    })
    graph.scheduleUntil(3)
    expect(sources()).toHaveLength(2)
    expect(sources().every((source) => source.stops === 0)).toBe(true)
    graph.dispose()
  })

  it('refuses audio it was not given, a lane heard now that it has no chain for, and another first frame, and changes nothing', () => {
    const {
      ctx,
      graph,
      sources,
      songWith,
      planOf,
      first,
      second,
      long,
      tracks,
    } = playingGraph()
    graph.scheduleUntil(1)
    ctx.currentTime = 1
    const other = { ...long, id: 'asset-2', sha256: 'c'.repeat(64) }
    const unleased = planOf([{ ...first, assetId: other.id }, second], tracks, [
      long,
      other,
    ])
    expect(graph.replan(unleased, 1.02)).toBeNull()
    const added = { ...tracks[0], id: 'new', order: 2 }
    const newClip = { ...first, id: 'new-clip', trackId: 'new' }
    expect(
      graph.replan(planOf([first, second, newClip], [...tracks, added]), 1.02),
    ).toBeNull()
    const later = compileStudioArrangement(
      songWith([{ ...first, gainDb: 0 }, second]),
      [long],
      { startFrame: 24000 },
    )
    expect(graph.replan(later, 1.02)).toBeNull()
    graph.scheduleUntil(3)
    expect(sources()).toHaveLength(2)
    expect(sources().every((source) => source.stops === 0)).toBe(true)

    // A new lane that is muted plays nothing, so the graph can do without it.
    const muted = graph.replan(
      planOf(
        [{ ...first, gainDb: first.gainDb - 6 }, second, newClip],
        [...tracks, { ...added, mute: true }],
      ),
      1.02,
    )
    expect(muted?.at).toBe(1.02)
    graph.dispose()
  })

  it('lets a newer edit before the last one is heard take its place, so a burst schedules one fade', () => {
    const { ctx, graph, sources, fadesOf, planOf, first, second } =
      playingGraph()
    graph.scheduleUntil(1)
    const [edited] = sources()
    ctx.currentTime = 1
    graph.replan(planOf([{ ...first, gainDb: -12 }, second]), 1.02)
    graph.scheduleUntil(3)
    const replaced = sources()[2]
    const { fadeIn } = fadesOf(replaced)

    expect(
      graph.replan(planOf([{ ...first, gainDb: -18 }, second]), 1.015)?.at,
    ).toBe(1.02)
    graph.scheduleUntil(3)
    expect(replaced.stopTimes).toEqual([undefined])
    expect(replaced.connections).toHaveLength(0)
    const [newest] = sources().slice(3)
    expect(fadesOf(newest).fadeIn).toBe(fadeIn)
    expect(fadeIn.gain.curves).toHaveLength(1)
    expect(fadesOf(edited).fadeOut.gain.curves).toHaveLength(1)
    // A seek that comes before either is heard lands on the same moment.
    expect(graph.seekTime(1.015)).toBe(1.02)
    graph.dispose()
  })

  it('moves the loop length: lanes that queued the next pass on the old one queue it again on the new one', () => {
    const { ctx, graph, sources, chainOf, planOf, first, second } =
      playingGraph({ repeat: true })
    graph.scheduleUntil(1)
    const [edited, untouched] = sources()
    ctx.currentTime = 2
    graph.scheduleUntil(4)
    const queued = sources().slice(2)
    expect(startsOf(queued)).toEqual([
      [2.5, 0, 2],
      [2.51, 0, 2],
    ])
    // Half a second more on the first lane: the song now loops at 2.5 s.
    const tail = {
      ...first,
      id: 'tail',
      startFrame: TAKE,
      sourceOutFrame: 24000,
    }
    const moved = graph.replan(planOf([first, tail, second]), 2.02)
    expect(moved).toEqual({ at: 2.02, fromFrame: 0, epoch: 0.5 })
    expect(queued.every((source) => source.stopTimes[0] === undefined)).toBe(
      true,
    )
    expect(untouched.stops).toBe(0)
    graph.scheduleUntil(4.1)
    const lane = (source: PlaybackSource) => chainOf(source) === chainOf(edited)
    const after = sources().slice(4)
    expect(startsOf(after.filter(lane))).toEqual([
      [2.02, 1.52, 0.48],
      [2.5, 0, 0.5],
      [3, 0, 2],
    ])
    expect(startsOf(after.filter((source) => !lane(source)))).toEqual([
      [3.01, 0, 2],
    ])
    graph.dispose()
  })

  it('counts passes again from the one playing when it moves in a later pass, so Repeat off ends that pass', () => {
    const { ctx, graph, sources, planOf, first, second } = playingGraph({
      repeat: true,
    })
    for (const now of [0, 1, 3]) {
      ctx.currentTime = now
      graph.scheduleUntil(now + 2)
    }
    // Pass 1 began at 2.5 s and pass 2 is queued at 4.5 s.
    expect(startsOf(sources()).map(([when]) => when)).toEqual([
      0.5, 0.51, 2.5, 2.51, 4.5, 4.51,
    ])
    const moved = graph.replan(
      planOf([{ ...first, gainDb: -12 }, second]),
      3.02,
    )
    expect(moved).toEqual({ at: 3.02, fromFrame: 0, epoch: 2.5 })
    graph.scheduleUntil(5)
    expect(startsOf(sources().slice(6))).toEqual([
      [3.02, 0.52, 1.48],
      [4.5, 0, 2],
    ])
    // The pass playing is pass 0 now: off, it is the last.
    expect(graph.stopRepeating()).toBe(0)
    expect(sources().at(-1)?.stopTimes).toEqual([undefined])
    graph.dispose()
  })

  it('refuses to move the loop length while the next pass may already be rendering', () => {
    const { ctx, graph, sources, planOf, first, second } = playingGraph({
      repeat: true,
    })
    graph.scheduleUntil(1)
    ctx.currentTime = 1
    graph.scheduleUntil(3)
    ctx.currentTime = 2.46
    const tail = {
      ...first,
      id: 'tail',
      startFrame: TAKE,
      sourceOutFrame: 24000,
    }
    expect(graph.replan(planOf([first, tail, second]), 2.48)).toBeNull()
    expect(sources().every((source) => source.stops === 0)).toBe(true)
    // An edit that keeps the length can still go in.
    expect(
      graph.replan(planOf([{ ...first, gainDb: -12 }, second]), 2.48)?.at,
    ).toBe(2.48)
    graph.dispose()
  })

  it('refuses a place the new plan does not reach, and a song that has played out', () => {
    const { ctx, graph, planOf, first, second } = playingGraph()
    graph.scheduleUntil(1)
    ctx.currentTime = 2
    const shorter = [
      { ...first, sourceOutFrame: 48000 },
      { ...second, sourceOutFrame: 48000 },
    ]
    expect(graph.replan(planOf(shorter), 2.02)).toBeNull()
    ctx.currentTime = 2.6
    expect(
      graph.replan(planOf([{ ...first, gainDb: -12 }, second]), 2.62),
    ).toBeNull()
    graph.dispose()
  })

  it('gives a parked graph the new segments, which it plays from when it resumes', () => {
    const { ctx, graph, sources, planOf, first, second } = playingGraph()
    graph.scheduleUntil(1)
    ctx.currentTime = 1.3
    graph.park()
    // Nothing plays, so nothing crosses: no fade, no node at all.
    const nodes = ctx.created.length
    expect(
      graph.replan(planOf([{ ...first, startFrame: 24000 }, second]), 1.4),
    ).toEqual({ at: null, fromFrame: 0, epoch: 0.5 })
    expect(ctx.created).toHaveLength(nodes)
    ctx.currentTime = 5
    expect(graph.resume(0, 5.02, false)).toBe(true)
    graph.scheduleUntil(7)
    expect(startsOf(sources().slice(2))).toEqual([
      [5.52, 0, 2],
      [5.03, 0, 2],
    ])
    graph.dispose()
  })
})
