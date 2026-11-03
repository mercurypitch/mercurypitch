// ============================================================
// TV stage renderer tests — where things go, and what gets drawn
// ============================================================
//
// The geometry is checked as numbers. The drawing is checked against a
// context that records what it was asked to draw, since jsdom has no canvas
// (recording-context.fixture.ts): enough to say the idle screen names the
// app, a song's title and words are written, a note in view is drawn while
// one long gone is not, and the lane is cut to its panel inside the margin.
// The lyrics' sizes and rows are in renderer.lyrics.test.ts, the lane's in
// lane.test.ts.

import { describe, expect, it } from 'vitest'
import { laneGeometry, timeX } from '@/lib/tv-stage/lane'
import { tvStageLayout } from '@/lib/tv-stage/layout'
import type { TvStageState } from '@/lib/tv-stage/model'
import { EMPTY_TV_STAGE, LONG_AGO } from '@/lib/tv-stage/model'
import { recordingContext, recordingSprites, } from '@/lib/tv-stage/recording-context.fixture'
import { createTvStageView, drawTvStage, segmentAt, wordFill, } from '@/lib/tv-stage/renderer'

const LAYOUT = tvStageLayout(1920, 1080)

/** The stage's sprites, on canvases that record. */
const VIEW = createTvStageView(recordingSprites().factory)

const SONG_STATE: TvStageState = {
  song: {
    v: 1,
    kind: 'song',
    title: 'Goodbye to Spring',
    duration: 120,
    notes: [
      { t0: 9, t1: 11, midi: 64 },
      { t0: 1, t1: 2, midi: 60 },
    ],
    lyrics: [
      { at: 0, current: [], next: 'Sing it slow', words: [] },
      {
        at: 9.5,
        current: ['Sing', 'it', 'slow'],
        next: 'and then again',
        words: [
          [9.5, 9.8],
          [9.8, 10.2],
          [10.2, 11],
        ],
      },
    ],
  },
  clock: { at: 0, position: 10, playing: true, rate: 1 },
  trail: [[9.9, 64.1]],
  score: { pct: 82, grade: 'B' },
  turn: LONG_AGO,
}

describe('the layout', () => {
  it('keeps everything inside a 5% margin on every side', () => {
    expect(LAYOUT.safe).toEqual({ x: 96, y: 54, w: 1728, h: 972 })
    for (const box of [LAYOUT.header, LAYOUT.lane, LAYOUT.lyrics]) {
      expect(box.x).toBeGreaterThanOrEqual(LAYOUT.safe.x)
      expect(box.y).toBeGreaterThanOrEqual(LAYOUT.safe.y)
      expect(box.y + box.h).toBeLessThanOrEqual(
        LAYOUT.safe.y + LAYOUT.safe.h + 0.001,
      )
    }
  })

  it('sizes type from the screen’s height', () => {
    expect(tvStageLayout(3840, 2160).unit).toBe(2)
    expect(LAYOUT.unit).toBe(1)
  })
})

describe('the lyrics', () => {
  const lyrics = SONG_STATE.song?.lyrics ?? []

  it('finds the segment being sung, and none before the first', () => {
    expect(segmentAt(lyrics, -1)).toBe(-1)
    expect(segmentAt(lyrics, 3)).toBe(0)
    expect(segmentAt(lyrics, 9.5)).toBe(1)
    expect(segmentAt(lyrics, 60)).toBe(1)
  })

  it('fills a word from its start to the moment it is lit', () => {
    expect(wordFill([1, 2], 0.5)).toBe(0)
    expect(wordFill([1, 2], 1.5)).toBe(0.5)
    expect(wordFill([1, 2], 2.5)).toBe(1)
    expect(wordFill([1, 1], 1.2)).toBe(1)
  })
})

describe('a frame', () => {
  it('names the app while the room has no song', () => {
    const { ctx, texts } = recordingContext()

    drawTvStage(ctx, EMPTY_TV_STAGE, 0, { width: 1920, height: 1080 }, VIEW)

    expect(texts.map((written) => written.text)).toContain('Mercury Pitch')
  })

  it('writes the title, the score, the words being sung and the next line', () => {
    const { ctx, texts } = recordingContext()

    drawTvStage(ctx, SONG_STATE, 0, { width: 1920, height: 1080 }, VIEW)

    expect(texts.map((written) => written.text)).toEqual(
      expect.arrayContaining([
        'Goodbye to Spring',
        '82%  B',
        'Sing',
        'it',
        'slow',
        'and then again',
      ]),
    )
  })

  it('leaves the title to the paused screen while the song stands, one title on screen', () => {
    const titleSizes = (at: TvStageState): number[] => {
      const { ctx, texts } = recordingContext()
      drawTvStage(ctx, at, 0, { width: 1920, height: 1080 }, VIEW)
      return texts
        .filter((written) => written.text === 'Goodbye to Spring')
        .map((written) => written.px)
    }
    const standing: TvStageState = {
      ...SONG_STATE,
      clock: { at: 0, position: 10, playing: false, rate: 1 },
    }

    // Playing: the header's title, at 44 px a 1080-line screen.
    expect(titleSizes(SONG_STATE)).toEqual([44])
    // Standing: the paused screen's title alone, larger than the header's.
    const paused = titleSizes(standing)
    expect(paused).toHaveLength(1)
    expect(paused[0]).toBeGreaterThan(44)
  })

  it('draws a note in view, and not one long gone', () => {
    const { ctx, images } = recordingContext()

    drawTvStage(ctx, SONG_STATE, 0, { width: 1920, height: 1080 }, VIEW)

    // A note is stamped in three slices: its left end, its middle, its right,
    // as yellow glass ahead of the marker or an empty tube once gone by.
    const notes = images.filter((image) =>
      /^note:(glass|past):/u.test(image.key),
    )
    expect(notes).toHaveLength(3)
    const lane = laneGeometry(LAYOUT)
    expect(notes[1]?.box.x).toBeCloseTo(timeX(lane, 9, 10) + 15, 0)
  })

  it('cuts the lane to its panel, inside the 5% margin', () => {
    const { ctx, clips } = recordingContext()

    drawTvStage(ctx, SONG_STATE, 0, { width: 1920, height: 1080 }, VIEW)

    const panel = clips.find((clip) => clip.y < LAYOUT.lane.y + 10)
    expect(panel).toBeDefined()
    expect(panel!.x).toBeGreaterThanOrEqual(LAYOUT.safe.x)
    expect(panel!.x + panel!.w).toBeLessThanOrEqual(
      LAYOUT.safe.x + LAYOUT.safe.w,
    )
    expect(panel!.y).toBeGreaterThanOrEqual(LAYOUT.lane.y)
    expect(panel!.y + panel!.h).toBeLessThanOrEqual(
      LAYOUT.lane.y + LAYOUT.lane.h,
    )
  })

  it('invites singing until there is a score', () => {
    const { ctx, texts } = recordingContext()

    drawTvStage(
      ctx,
      { ...SONG_STATE, score: null },
      0,
      { width: 1920, height: 1080 },
      VIEW,
    )

    expect(texts.map((written) => written.text)).toContain(
      'Sing along to score',
    )
  })
})
