// ============================================================
// TV stage model tests — the state the messages build
// ============================================================

import { describe, expect, it } from 'vitest'
import type { TvStageState } from '@/lib/tv-stage/model'
import { applyTvStageMessage, EMPTY_TV_STAGE, LONG_AGO, TRAIL_LIMIT, TRAIL_SECONDS, tvStagePosition, } from '@/lib/tv-stage/model'
import type { TvStageFrame, TvStageReading, TvStageSong, } from '@/lib/tv-stage/protocol'
import { TV_STAGE_IDLE } from '@/lib/tv-stage/protocol'

const song = (title: string): TvStageSong => ({
  v: 1,
  kind: 'song',
  title,
  duration: 120,
  notes: [{ t0: 1, t1: 2, midi: 60 }],
  lyrics: [],
})

const frame = (
  position: number,
  singer: readonly TvStageReading[] = [],
  overrides: Partial<TvStageFrame> = {},
): TvStageFrame => ({
  v: 1,
  kind: 'frame',
  at: 10_000,
  position,
  playing: true,
  rate: 1,
  singer,
  score: null,
  ...overrides,
})

const fold = (...messages: Parameters<typeof applyTvStageMessage>[1][]) =>
  messages.reduce<TvStageState>(applyTvStageMessage, EMPTY_TV_STAGE)

describe('the song', () => {
  it('starts afresh with a new song', () => {
    const state = fold(
      song('First'),
      frame(10, [[9.9, 60]], { score: { pct: 70, grade: 'B' } }),
      song('Second'),
    )

    expect(state.song?.title).toBe('Second')
    expect(state.trail).toEqual([])
    expect(state.score).toBeNull()
    expect(state.clock).toBeNull()
  })

  it('keeps the trail and the score when the same song comes again', () => {
    const state = fold(
      song('First'),
      frame(10, [[9.9, 60]], { score: { pct: 70, grade: 'B' } }),
      { ...song('First'), notes: [] },
    )

    expect(state.song?.notes).toEqual([])
    expect(state.trail).toEqual([[9.9, 60]])
    expect(state.score).toEqual({ pct: 70, grade: 'B' })
  })

  it('forgets everything on idle', () => {
    expect(fold(song('First'), frame(10), TV_STAGE_IDLE)).toEqual(
      EMPTY_TV_STAGE,
    )
  })
})

describe('the clock', () => {
  it('runs on from the last reading while the song plays', () => {
    const state = fold(song('S'), frame(10, [], { at: 5_000, rate: 1.5 }))

    expect(tvStagePosition(state, 7_000)).toBeCloseTo(13)
  })

  it('stands still while the song is paused', () => {
    const state = fold(song('S'), frame(10, [], { playing: false }))

    expect(tvStagePosition(state, 99_000)).toBe(10)
  })

  it('never runs backwards from a reading stamped after now', () => {
    const state = fold(song('S'), frame(10, [], { at: 20_000 }))

    expect(tvStagePosition(state, 19_000)).toBe(10)
  })

  it('is at the start before any frame', () => {
    expect(tvStagePosition(fold(song('S')), 1_000)).toBe(0)
  })

  it('runs on through a stall of several seconds while the song plays', () => {
    const state = fold(song('S'), frame(10, [], { at: 5_000 }))

    expect(tvStagePosition(state, 13_000)).toBeCloseTo(18)
  })

  it('stands at the song’s end once the frames stop coming, however long after', () => {
    // The song is 120 s long, and its last frame came a second before the end.
    const state = fold(song('S'), frame(119, [], { at: 5_000 }))

    expect(tvStagePosition(state, 7_000)).toBe(120)
    expect(tvStagePosition(state, 7_000 + 600_000)).toBe(120)
  })

  it('leaves a reading already past the end where it is', () => {
    // The Developer screen's offset can put the room's reading past the end.
    const state = fold(song('S'), frame(120.4, [], { at: 5_000 }))

    expect(tvStagePosition(state, 5_000)).toBeCloseTo(120.4)
    expect(tvStagePosition(state, 6_000)).toBeCloseTo(120.4)
  })

  it('runs on with no end while the song’s length is not known', () => {
    const state = fold(
      { ...song('S'), duration: 0 },
      frame(119, [], { at: 5_000 }),
    )

    expect(tvStagePosition(state, 7_000)).toBeCloseTo(121)
  })
})

describe('the turn', () => {
  it('keeps when the song stopped and where, and when it started again', () => {
    const stopped = fold(
      song('S'),
      frame(10, [], { at: 1_000 }),
      frame(10.05, [], { at: 1_050, playing: false }),
      frame(10.05, [], { at: 1_100, playing: false }),
    )
    const started = applyTvStageMessage(
      stopped,
      frame(10.05, [], { at: 4_000 }),
    )

    expect(stopped.turn).toEqual({ at: 1_050, position: 10.05 })
    expect(started.turn).toEqual({ at: 4_000, position: 10.05 })
  })

  it('takes a song’s first frame for no turn, standing still or playing', () => {
    const standing = fold(
      song('S'),
      frame(0, [], { at: 1_000, playing: false }),
    )
    // A TV that starts showing the stage in the middle of a song.
    const playing = fold(song('S'), frame(61, [], { at: 1_000 }))

    expect(standing.turn).toBe(LONG_AGO)
    expect(playing.turn).toBe(LONG_AGO)
  })

  it('starts a new song with no turn to fade from', () => {
    const state = fold(
      song('First'),
      frame(10, [], { at: 1_000 }),
      song('Second'),
    )

    expect(state.turn).toBe(LONG_AGO)
  })
})

describe('the singer’s trail', () => {
  it('gathers the readings of every frame, in order', () => {
    const state = fold(
      song('S'),
      frame(1, [[0.9, 60]]),
      frame(1.05, [
        [0.95, 61],
        [1, 62],
      ]),
    )

    expect(state.trail).toEqual([
      [0.9, 60],
      [0.95, 61],
      [1, 62],
    ])
  })

  it('keeps only the last few seconds behind the position', () => {
    const state = fold(
      song('S'),
      frame(1, [[0.5, 60]]),
      frame(1 + TRAIL_SECONDS, [[TRAIL_SECONDS, 62]]),
    )

    expect(state.trail).toEqual([[TRAIL_SECONDS, 62]])
  })

  it('drops what was sung after the new position when the song jumps back', () => {
    const state = fold(
      song('S'),
      frame(10, [
        [5, 60],
        [9.9, 61],
      ]),
      frame(6),
    )

    expect(state.trail).toEqual([[5, 60]])
  })

  it('holds no more than its limit', () => {
    const many: TvStageReading[] = Array.from(
      { length: TRAIL_LIMIT + 10 },
      (_, index) => [index / 1000, 60],
    )

    expect(fold(song('S'), frame(2, many)).trail).toHaveLength(TRAIL_LIMIT)
  })
})
