// ============================================================
// TV stage paused screen tests — when it shows, what it says, where it goes
// ============================================================
//
// It shows while the song stands still, as "Ready to sing" at the start and
// "Paused" past it, and fades in and out over a quarter of a second from
// the moment the song stopped or started; it is gone while the song plays.
// The times count whole seconds and add up to the song's length; the knob
// sits at the place along the bar; and everything lies inside the 5% inset
// at the lyrics' 32 px floor or above. The mark beside the time is a play
// mark while the song stands ready, since play is what comes next, and a
// pause mark once it is paused part way. Drawn on the recording canvas
// (recording-context.fixture.ts) for the words, the bar, the mark and no
// blur.

import { describe, expect, it } from 'vitest'
import type { LyricWindowSegment } from '@/lib/lyric-window-script'
import { tvStageLayout } from '@/lib/tv-stage/layout'
import type { TvStageState, TvStageTurn } from '@/lib/tv-stage/model'
import { LONG_AGO } from '@/lib/tv-stage/model'
import { drawPauseScreen, PAUSE_WORDS, playMarkPoints, } from '@/lib/tv-stage/pause-paint'
import { formatClock, knobX, lineToSing, PAUSE_FADE_MS, pauseLayout, pauseScreenOf, pauseTimes, } from '@/lib/tv-stage/pause-screen'
import { recordingContext, recordingSprites, } from '@/lib/tv-stage/recording-context.fixture'
import { createSpriteCache } from '@/lib/tv-stage/sprites'

const LYRICS: LyricWindowSegment[] = [
  { at: 0, current: [], next: 'Hold the light', words: [] },
  {
    at: 4,
    current: ['Hold', 'the', 'light'],
    next: 'a little longer',
    words: [
      [4, 4.5],
      [4.5, 5],
      [5, 5.5],
    ],
  },
  { at: 6, current: [], next: 'a little longer', words: [] },
  {
    at: 8,
    current: ['a', 'little', 'longer'],
    next: null,
    words: [
      [8, 8.5],
      [8.5, 9],
      [9, 9.5],
    ],
  },
]

const NOW = 1_000_000

function state(
  clock: { readonly position: number; readonly playing: boolean } | null,
  turn: TvStageTurn = LONG_AGO,
  duration = 245,
): TvStageState {
  return {
    song: {
      v: 1,
      kind: 'song',
      title: 'River Road',
      duration,
      notes: [],
      lyrics: LYRICS,
    },
    clock: clock === null ? null : { at: NOW, rate: 1, ...clock },
    trail: [],
    score: null,
    turn,
  }
}

describe('when it shows', () => {
  it('shows, paused, while the song stands still part way', () => {
    const screen = pauseScreenOf(state({ position: 69, playing: false }), NOW)

    expect(screen).toMatchObject({ kind: 'paused', shown: 1, elapsed: 69 })
  })

  it('says the song is ready while it stands at its start, before any frame too', () => {
    expect(
      pauseScreenOf(state({ position: 0, playing: false }), NOW)?.kind,
    ).toBe('ready')
    expect(pauseScreenOf(state(null), NOW)).toMatchObject({
      kind: 'ready',
      shown: 1,
    })
  })

  it('is gone while the song plays', () => {
    expect(pauseScreenOf(state({ position: 69, playing: true }), NOW)).toBe(
      null,
    )
  })

  it('fades in over a quarter of a second from the moment the song stopped', () => {
    const stopped = state(
      { position: 69, playing: false },
      { at: NOW - 125, position: 69 },
    )

    expect(PAUSE_FADE_MS).toBe(250)
    expect(pauseScreenOf(stopped, NOW)?.shown).toBeCloseTo(0.5, 9)
    expect(pauseScreenOf(stopped, NOW - 125)).toBeNull()
    expect(pauseScreenOf(stopped, NOW + 125)?.shown).toBe(1)
  })

  it('fades out from where the song started, as the song runs on', () => {
    const started = state(
      { position: 0.2, playing: true },
      { at: NOW - 60, position: 0 },
    )

    const screen = pauseScreenOf(started, NOW)

    expect(screen?.kind).toBe('ready')
    expect(screen?.elapsed).toBe(0)
    expect(screen?.shown).toBeGreaterThan(0.5)
    expect(pauseScreenOf(started, NOW - 60 + PAUSE_FADE_MS)).toBeNull()
  })

  it('is not there with no song', () => {
    expect(pauseScreenOf({ ...state(null), song: null }, NOW)).toBeNull()
  })
})

describe('the line to sing next', () => {
  it('is the line being sung while part of it is still to come', () => {
    expect(lineToSing(LYRICS, 4.7)).toBe('Hold the light')
  })

  it('is the line after it once the line is sung through, and in a rest', () => {
    expect(lineToSing(LYRICS, 5.8)).toBe('a little longer')
    expect(lineToSing(LYRICS, 7)).toBe('a little longer')
  })

  it('is the first line before the song starts, and none after the last', () => {
    expect(lineToSing(LYRICS, 0)).toBe('Hold the light')
    expect(lineToSing(LYRICS, 9.8)).toBeNull()
  })
})

describe('the times', () => {
  it('writes a clock in minutes and seconds, and hours past an hour', () => {
    expect(
      [0, 9, 69, 1190, 3725, -3, Number.NaN].map((s) => formatClock(s)),
    ).toEqual(['0:00', '0:09', '1:09', '19:50', '1:02:05', '0:00', '0:00'])
  })

  it('counts the time left so the two always add up to the song’s length', () => {
    expect(pauseTimes(69.9, 1259.4)).toEqual({
      sung: '1:09',
      left: '−19:50',
    })
    expect(pauseTimes(245, 245)).toEqual({ sung: '4:05', left: '−0:00' })
  })

  it('leaves out the time left while the length is not known', () => {
    expect(pauseTimes(12, 0)).toEqual({ sung: '0:12', left: null })
  })
})

describe('where it goes', () => {
  const SCREENS = [
    { width: 1920, height: 1080 },
    { width: 3840, height: 2160 },
  ]

  it('puts the knob at the place along the bar, and keeps it on the bar', () => {
    const { bar } = pauseLayout(tvStageLayout(1920, 1080))

    expect(knobX(bar, 0)).toBe(bar.x0)
    expect(knobX(bar, 1)).toBe(bar.x1)
    expect(knobX(bar, 0.25)).toBeCloseTo(bar.x0 + (bar.x1 - bar.x0) / 4, 9)
    expect(knobX(bar, 1.4)).toBe(bar.x1)
    expect(knobX(bar, Number.NaN)).toBe(bar.x0)
  })

  it.each(SCREENS)(
    'keeps every part inside the 5% inset, the knob’s glow too, at $height lines',
    (screen) => {
      const layout = tvStageLayout(screen.width, screen.height)
      const { safe } = layout
      const place = pauseLayout(layout)
      const inside = (x: number, y: number) => {
        expect(x).toBeGreaterThanOrEqual(safe.x - 1e-9)
        expect(x).toBeLessThanOrEqual(safe.x + safe.w + 1e-9)
        expect(y).toBeGreaterThanOrEqual(safe.y - 1e-9)
        expect(y).toBeLessThanOrEqual(safe.y + safe.h + 1e-9)
      }

      inside(place.bar.x0 - place.knob.reach, place.bar.y - place.knob.reach)
      inside(place.bar.x1 + place.knob.reach, place.bar.y + place.knob.reach)
      inside(place.mark.x - place.mark.radius, place.mark.y + place.mark.radius)
      inside(place.title.x + place.title.width, place.label.y - place.label.px)
      inside(
        place.line.x + place.line.width,
        place.times.y + place.times.px / 2,
      )
    },
  )

  it.each(SCREENS)(
    'writes nothing under the lyrics’ 32 px floor, at $height lines',
    (screen) => {
      const layout = tvStageLayout(screen.width, screen.height)
      const { texts } = drawn(state({ position: 4.7, playing: false }), screen)

      expect(texts).toHaveLength(6)
      for (const text of texts) {
        expect(text.px).toBeGreaterThanOrEqual(32 * layout.unit)
      }
    },
  )
})

/** The paused screen drawn on a recording canvas. */
function drawn(
  at: TvStageState,
  screen = { width: 1920, height: 1080 },
  nowMs = NOW,
) {
  const recording = recordingContext()
  drawPauseScreen(
    recording.ctx,
    tvStageLayout(screen.width, screen.height),
    at,
    {
      nowMs,
      sprites: createSpriteCache(recordingSprites().factory),
    },
  )
  return recording
}

describe('what it says', () => {
  it('says paused, the title, the next line, and the times', () => {
    const { texts } = drawn(state({ position: 4.7, playing: false }))

    expect(texts.map((t) => t.text)).toEqual([
      PAUSE_WORDS.paused,
      'River Road',
      PAUSE_WORDS.next,
      'Hold the light',
      '0:04',
      '−4:01',
    ])
  })

  it('says the song is ready and to press play on the phone, at the start', () => {
    const { texts } = drawn(state({ position: 0, playing: false }))

    expect(texts.map((t) => t.text)).toEqual([
      PAUSE_WORDS.ready,
      'River Road',
      'Press play on your phone to start',
      '0:00',
      '−4:05',
    ])
  })

  it('draws the bar with its knob at the place, and leaves it out while the length is not known', () => {
    const knobs = (at: TvStageState) =>
      drawn(at).images.filter((image) => image.key.startsWith('pause-knob'))
    const { bar } = pauseLayout(tvStageLayout(1920, 1080))

    const [knob] = knobs(state({ position: 61.25, playing: false }))

    expect(knob.box.x + knob.box.w / 2).toBeCloseTo(knobX(bar, 61.25 / 245), 0)
    expect(
      knobs(state({ position: 61.25, playing: false }, LONG_AGO, 0)),
    ).toEqual([])
  })

  it('draws nothing while the song plays, and asks for no blur', () => {
    const playing = drawn(state({ position: 69, playing: true }))
    const paused = drawn(state({ position: 4.7, playing: false }))

    expect(playing.texts).toEqual([])
    expect(playing.images).toEqual([])
    expect(paused.blurs.filter((blur) => blur > 0)).toEqual([])
  })
})

describe('the mark beside the time', () => {
  /** The marks a screen stamps, by kind, and where the first went. */
  const marks = (at: TvStageState) => {
    const stamped = drawn(at).images.filter((image) =>
      /^(?:play|pause)-mark:/u.test(image.key),
    )
    return {
      kinds: stamped.map((image) => image.key.split(':')[0]),
      first: stamped.at(0),
    }
  }

  it('is a play mark at the start, where pressing play comes next', () => {
    const { mark } = pauseLayout(tvStageLayout(1920, 1080))

    const { kinds, first } = marks(state({ position: 0, playing: false }))

    expect(kinds).toEqual(['play-mark'])
    const centre = (first?.box.x ?? 0) + (first?.box.w ?? 0) / 2
    expect(Math.abs(centre - mark.x)).toBeLessThanOrEqual(1)
  })

  it('is a pause mark once the song is paused part way', () => {
    expect(marks(state({ position: 4.7, playing: false })).kinds).toEqual([
      'pause-mark',
    ])
  })

  it('keeps the play mark while the ready screen fades out as the song starts', () => {
    const fadingOut = state(
      { position: 0.2, playing: true },
      { at: NOW - 60, position: 0 },
    )

    expect(marks(fadingOut).kinds).toEqual(['play-mark'])
  })

  it('points the play triangle right, as tall as the bars, its centroid on the ring', () => {
    const c = 25
    const r = 24

    const points = playMarkPoints(c, r)
    const [top, tip, bottom] = points

    expect(points).toHaveLength(3)
    expect(top[0]).toBe(bottom[0])
    expect(tip[0]).toBeGreaterThan(top[0])
    expect(tip[1]).toBeCloseTo(c, 9)
    expect(bottom[1] - top[1]).toBeCloseTo(r * 0.72, 9)
    expect((top[0] + tip[0] + bottom[0]) / 3).toBeCloseTo(c, 9)
    expect((top[1] + tip[1] + bottom[1]) / 3).toBeCloseTo(c, 9)
    for (const [x, y] of points) {
      expect(Math.hypot(x - c, y - c)).toBeLessThan(r * 0.5)
    }
  })
})
