// ============================================================
// TV stage renderer tests — the lyrics, legible from the sofa
// ============================================================
//
// REQ-TV-022: no lyric under 32 px at 1080 lines. A long sung line wraps
// onto two rows rather than shrink; the fill runs on across the break; two
// rows stay clear of the lane and of the next line; a line too long even
// for two rows at the floor shows two at a time. Drawn on the recording
// canvas (recording-context.fixture.ts), which measures text as a font
// would: at 1080 lines the lyrics are 1728 px wide, 48 characters at the
// sung line's 72 px and 108 at the 32 px floor.

import { describe, expect, it } from 'vitest'
import type { LyricWindowSegment } from '@/lib/lyric-window-script'
import type { TvStageState } from '@/lib/tv-stage/model'
import type { Written } from '@/lib/tv-stage/recording-context.fixture'
import { recordingContext, widthOf, } from '@/lib/tv-stage/recording-context.fixture'
import { drawTvStage, LYRIC_FLOOR_PX, lyricSpots, SUNG_LINE_PX, TV_STAGE_COLORS, tvStageLayout, } from '@/lib/tv-stage/renderer'

const LAYOUT = tvStageLayout(1920, 1080)

/** A sung segment from `at`, each word given `perWord` seconds to fill. */
function sungSegment(
  at: number,
  text: string,
  next: string | null,
  perWord = 0.4,
): LyricWindowSegment {
  const current = text.split(' ')
  return {
    at,
    current,
    next,
    words: current.map(
      (_, index) => [at + index * perWord, at + (index + 1) * perWord] as const,
    ),
  }
}

/** A song of these segments, paused at `position`. */
function lyricState(
  lyrics: readonly LyricWindowSegment[],
  position: number,
): TvStageState {
  return {
    song: {
      v: 1,
      kind: 'song',
      title: 'River Road',
      duration: 120,
      notes: [],
      lyrics,
    },
    clock: { at: 0, position, playing: false, rate: 1 },
    trail: [],
    score: null,
  }
}

const SCREENS = [
  { width: 1920, height: 1080 },
  { width: 3840, height: 2160 },
]

/** 73 characters: eight words on the first row at 72 px, six on the second. */
const LONG =
  'Every light along the river road was singing back the words we never said'
const NEXT = 'and the water carried every one of them away'

/** 339 characters of distinct words: four rows even at the floor. */
const RUN_ON = Array.from(
  { length: 70 },
  (_, index) => `la${String(index)}`,
).join(' ')

/** What the renderer wrote of these words, in the order it wrote them. */
const writtenOf = (texts: readonly Written[], words: readonly string[]) =>
  texts.filter((written) => words.includes(written.text))

/** The distinct heights rows were written at, top first. */
const rowsOf = (written: readonly Written[]): number[] =>
  [...new Set(written.map((piece) => piece.y))].sort((a, b) => a - b)

describe('the line being sung', () => {
  it.each(SCREENS)(
    'wraps onto two rows at its full size, rather than shrink, at $height lines',
    (screen) => {
      const { ctx, texts } = recordingContext()
      const layout = tvStageLayout(screen.width, screen.height)
      const segment = sungSegment(10, LONG, NEXT)

      drawTvStage(ctx, lyricState([segment], 10), 0, screen)

      const written = writtenOf(texts, segment.current)
      expect(written.map((piece) => piece.text)).toEqual(segment.current)
      expect(rowsOf(written)).toHaveLength(2)
      for (const piece of written) {
        expect(piece.px).toBe(SUNG_LINE_PX * layout.unit)
        expect(piece.x).toBeGreaterThanOrEqual(layout.lyrics.x)
        expect(piece.x + widthOf(piece)).toBeLessThanOrEqual(
          layout.lyrics.x + layout.lyrics.w,
        )
      }
    },
  )

  it.each(SCREENS)(
    'never goes under 32 px per 1080 lines, however long, at $height lines',
    (screen) => {
      const { ctx, texts } = recordingContext()
      const layout = tvStageLayout(screen.width, screen.height)
      const segment = sungSegment(10, RUN_ON, NEXT)

      drawTvStage(ctx, lyricState([segment], 10), 0, screen)

      const written = writtenOf(texts, segment.current)
      expect(written.length).toBeGreaterThan(0)
      for (const piece of written) {
        expect(piece.px).toBe(LYRIC_FLOOR_PX * layout.unit)
      }
    },
  )

  it('shows two rows of a line too long for two at the floor, and an ellipsis while more follows', () => {
    const { ctx, texts } = recordingContext()
    const segment = sungSegment(10, RUN_ON, NEXT)

    drawTvStage(ctx, lyricState([segment], 10), 0, LAYOUT)

    const written = writtenOf(texts, segment.current)
    const rows = rowsOf(written)
    const ellipsis = texts.find((piece) => piece.text === '…')
    const lastRow = written.filter((piece) => piece.y === rows[1])
    expect(rows).toHaveLength(2)
    expect(written[0]?.text).toBe('la0')
    expect(written.length).toBeLessThan(segment.current.length)
    expect(ellipsis?.y).toBe(rows[1])
    expect(ellipsis?.x).toBeGreaterThan(
      Math.max(...lastRow.map((piece) => piece.x + widthOf(piece))),
    )
  })

  it('moves the two rows down when the singer starts the next row', () => {
    const before = recordingContext()
    const segment = sungSegment(10, RUN_ON, NEXT)
    drawTvStage(before.ctx, lyricState([segment], 10), 0, LAYOUT)
    const shown = writtenOf(before.texts, segment.current)
    const second = shown.find((piece) => piece.y === rowsOf(shown)[1])
    const reached = segment.current.indexOf(second?.text ?? '')
    const after = recordingContext()

    drawTvStage(
      after.ctx,
      lyricState([segment], 10.1 + reached * 0.4),
      0,
      LAYOUT,
    )

    const moved = writtenOf(after.texts, segment.current)
    expect(reached).toBeGreaterThan(0)
    expect(moved[0]?.text).toBe(second?.text)
    expect(rowsOf(moved)).toHaveLength(2)
  })

  it('opens a line with no timing, too long for two rows, on its first two', () => {
    const { ctx, texts } = recordingContext()
    // Every word lit from the line's first moment, as lyric-window-script
    // hands over a line with no timing.
    const timed = sungSegment(10, RUN_ON, NEXT)
    const untimed = {
      ...timed,
      words: timed.current.map(() => [10, 10] as const),
    }

    drawTvStage(ctx, lyricState([untimed], 12), 0, LAYOUT)

    const written = writtenOf(texts, untimed.current)
    expect(written[0]?.text).toBe('la0')
    expect(written[0]?.color).toBe(TV_STAGE_COLORS.sung)
    expect(texts.some((piece) => piece.text === '…')).toBe(true)
  })

  it('carries the fill from the first row into the second', () => {
    const { ctx, texts, clips } = recordingContext()
    const segment = sungSegment(10, LONG, NEXT)

    // Eight words lit on the first row, and 'back', the first on the second,
    // half way: it fills from 13.2 s to 13.6 s.
    drawTvStage(ctx, lyricState([segment], 13.4), 0, LAYOUT)

    const written = writtenOf(texts, segment.current)
    const rows = rowsOf(written)
    const back = written.filter((piece) => piece.text === 'back')
    const rest = written.filter(
      (piece) => piece.y === rows[1] && piece.text !== 'back',
    )
    expect(
      written
        .filter((piece) => piece.y === rows[0])
        .map((piece) => piece.color),
    ).toEqual(Array(8).fill(TV_STAGE_COLORS.sung))
    expect(back.map((piece) => piece.y)).toEqual([rows[1], rows[1]])
    expect(back.map((piece) => piece.color)).toEqual([
      TV_STAGE_COLORS.unsung,
      TV_STAGE_COLORS.sung,
    ])
    const lyricClips = clips.filter(
      (clip) => clip.y > LAYOUT.lane.y + LAYOUT.lane.h,
    )
    expect(lyricClips).toHaveLength(1)
    expect(lyricClips[0]?.x).toBe(back[0]?.x)
    expect(lyricClips[0]?.w).toBeCloseTo(widthOf(back[0] as Written) / 2)
    expect(rest.map((piece) => piece.color)).toEqual(
      Array(5).fill(TV_STAGE_COLORS.unsung),
    )
  })

  it.each(SCREENS)(
    'keeps two rows clear of the lane above and the next line below, at $height lines',
    (screen) => {
      const { ctx, texts } = recordingContext()
      const layout = tvStageLayout(screen.width, screen.height)
      const segment = sungSegment(10, LONG, NEXT)

      drawTvStage(ctx, lyricState([segment], 10), 0, screen)

      const written = writtenOf(texts, segment.current)
      const [first, second] = rowsOf(written)
      const px = written[0]?.px ?? 0
      const next = texts.find((piece) => piece.text === NEXT)
      expect(next?.y).toBe(lyricSpots(layout).next)
      expect(first - px / 2).toBeGreaterThan(layout.lane.y + layout.lane.h)
      expect(second - first).toBeGreaterThanOrEqual(px)
      expect(second + px / 2).toBeLessThan((next?.y ?? 0) - (next?.px ?? 0) / 2)
      expect((next?.y ?? 0) + (next?.px ?? 0) / 2).toBeLessThanOrEqual(
        layout.safe.y + layout.safe.h,
      )
    },
  )

  it('measures its words once, not on every frame', () => {
    const { ctx, measured } = recordingContext()
    const state = lyricState([sungSegment(10, LONG, NEXT)], 11)

    drawTvStage(ctx, state, 0, LAYOUT)
    const first = measured()
    drawTvStage(ctx, state, 0, LAYOUT)
    const second = measured() - first

    expect(first - second).toBeGreaterThanOrEqual(LONG.split(' ').length)
  })
})

describe('the line waited for in a rest', () => {
  it('wraps as the sung line does, quiet, clear of the lane', () => {
    const { ctx, texts } = recordingContext()
    const rest = { at: 0, current: [], next: LONG, words: [] }

    drawTvStage(ctx, lyricState([rest], 1), 0, LAYOUT)

    const written = writtenOf(texts, LONG.split(' '))
    const rows = rowsOf(written)
    expect(written.map((piece) => piece.text)).toEqual(LONG.split(' '))
    expect(rows).toHaveLength(2)
    for (const piece of written) {
      expect(piece.px).toBe(60)
      expect(piece.color).toBe(TV_STAGE_COLORS.quiet)
      expect(piece.y - piece.px / 2).toBeGreaterThan(
        LAYOUT.lane.y + LAYOUT.lane.h,
      )
    }
  })
})

describe('the next line', () => {
  /** 95 characters: 2185 px wide at 46 px, too wide; 1710 px at 36, whole. */
  const SOMEWHAT_LONG = `${NEXT} and the water carried every one of them away again`

  it('shrinks to fit when it is a little too wide', () => {
    const { ctx, texts } = recordingContext()
    const segment = sungSegment(10, 'Sing it slow', SOMEWHAT_LONG)

    drawTvStage(ctx, lyricState([segment], 10), 0, LAYOUT)

    const next = texts.find((piece) => piece.text === SOMEWHAT_LONG)
    expect(next?.px).toBe(36)
  })

  it('is never bigger than the line being sung', () => {
    const { ctx, texts } = recordingContext()
    const segment = sungSegment(10, RUN_ON, 'Sing it slow')

    drawTvStage(ctx, lyricState([segment], 10), 0, LAYOUT)

    const next = texts.find((piece) => piece.text === 'Sing it slow')
    expect(next?.px).toBe(LYRIC_FLOOR_PX)
  })

  it.each(SCREENS)(
    'stops at 32 px per 1080 lines and is cut short past that, at $height lines',
    (screen) => {
      const { ctx, texts } = recordingContext()
      const layout = tvStageLayout(screen.width, screen.height)
      const segment = sungSegment(10, 'Sing it slow', RUN_ON)

      drawTvStage(ctx, lyricState([segment], 10), 0, screen)

      const next = texts.find((piece) => piece.color === TV_STAGE_COLORS.next)
      expect(next?.px).toBe(LYRIC_FLOOR_PX * layout.unit)
      expect(next?.text.endsWith('…')).toBe(true)
      expect(RUN_ON.startsWith(next?.text.slice(0, -1).trimEnd() ?? '-')).toBe(
        true,
      )
    },
  )
})
