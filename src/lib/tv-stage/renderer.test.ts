// ============================================================
// TV stage renderer tests — where things go, and what gets drawn
// ============================================================
//
// The geometry is checked as numbers. The drawing is checked against a
// context that records what it was asked to draw, since jsdom has no canvas
// (recording-context.fixture.ts): enough to say the idle screen names the
// app, a song's title and words are written, a note in view is drawn while
// one long gone is not, and the lane is cut at its ends. The lyrics' sizes
// and rows are in renderer.lyrics.test.ts.

import { describe, expect, it } from 'vitest'
import type { TvStageState } from '@/lib/tv-stage/model'
import { EMPTY_TV_STAGE } from '@/lib/tv-stage/model'
import { recordingContext } from '@/lib/tv-stage/recording-context.fixture'
import { drawTvStage, LANE_AFTER_SEC, LANE_BEFORE_SEC, laneX, laneY, pitchClass, segmentAt, tvStageLayout, wordFill, } from '@/lib/tv-stage/renderer'

const LAYOUT = tvStageLayout(1920, 1080)

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
  clock: { at: 0, position: 10, playing: false, rate: 1 },
  trail: [[9.9, 64.1]],
  score: { pct: 82, grade: 'B' },
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

describe('the lane', () => {
  it('puts the moment being sung on the playhead, and its edges at the window’s ends', () => {
    expect(laneX(LAYOUT, 10, 10)).toBe(LAYOUT.playheadX)
    expect(laneX(LAYOUT, 10 - LANE_BEFORE_SEC, 10)).toBeCloseTo(LAYOUT.lane.x)
    expect(laneX(LAYOUT, 10 + LANE_AFTER_SEC, 10)).toBeCloseTo(
      LAYOUT.lane.x + LAYOUT.lane.w,
    )
  })

  it('folds a note to its pitch class, an octave on the same row', () => {
    expect(pitchClass(60)).toBe(0)
    expect(pitchClass(71)).toBe(11)
    expect(pitchClass(-1)).toBe(11)
    expect(laneY(LAYOUT, 72)).toBe(laneY(LAYOUT, 60))
  })

  it('draws a higher pitch class higher up, and C on the bottom row', () => {
    const rowHeight = LAYOUT.lane.h / 12
    expect(laneY(LAYOUT, 60)).toBeCloseTo(
      LAYOUT.lane.y + LAYOUT.lane.h - rowHeight / 2,
    )
    expect(laneY(LAYOUT, 67)).toBeLessThan(laneY(LAYOUT, 64))
  })

  it('moves a sharp reading up within its row, and a flat one down', () => {
    expect(laneY(LAYOUT, 64.2)).toBeLessThan(laneY(LAYOUT, 64))
    expect(laneY(LAYOUT, 63.8)).toBeGreaterThan(laneY(LAYOUT, 64))
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

    drawTvStage(ctx, EMPTY_TV_STAGE, 0, { width: 1920, height: 1080 })

    expect(texts.map((written) => written.text)).toContain('Mercury Pitch')
  })

  it('writes the title, the score, the words being sung and the next line', () => {
    const { ctx, texts } = recordingContext()

    drawTvStage(ctx, SONG_STATE, 0, { width: 1920, height: 1080 })

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

  it('draws a note in view, and not one long gone', () => {
    const { ctx, notes } = recordingContext()

    drawTvStage(ctx, SONG_STATE, 0, { width: 1920, height: 1080 })

    expect(notes).toHaveLength(1)
    expect(notes[0]?.x).toBeCloseTo(laneX(LAYOUT, 9, 10))
  })

  it('cuts the lane’s notes and trail at its ends, the 5% margin’s edges', () => {
    const { ctx, clips } = recordingContext()

    drawTvStage(ctx, SONG_STATE, 0, { width: 1920, height: 1080 })

    expect(clips[0]).toEqual({
      x: LAYOUT.safe.x,
      y: LAYOUT.safe.y,
      w: LAYOUT.safe.w,
      h: LAYOUT.safe.h,
    })
    expect(LAYOUT.lane.x).toBe(LAYOUT.safe.x)
    expect(LAYOUT.lane.w).toBe(LAYOUT.safe.w)
  })

  it('invites singing until there is a score', () => {
    const { ctx, texts } = recordingContext()

    drawTvStage(ctx, { ...SONG_STATE, score: null }, 0, {
      width: 1920,
      height: 1080,
    })

    expect(texts.map((written) => written.text)).toContain(
      'Sing along to score',
    )
  })
})
