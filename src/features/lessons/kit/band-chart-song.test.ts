// ============================================================
// Band chart song tests — where a song's bands, words and breaths land
// ============================================================
//
// Lesson 14's WEB-SPEC, Tests 7: a chart given the song's painters but no
// song paints exactly as the kit's band chart does, so Lessons 3, 5 and 9's
// figures see no change; each band lands over its note's time; the words sit
// under the plot, the chord strip under them; a breath mark sits at its
// time over the higher band beside it, its word kept inside the plot, and
// marks given no word carry none; a band's light follows the level curve it
// is given, as far as it has sounded, and stays; a planned swell is faint
// light; the level strip takes the words' place. Each chart is mounted on a
// canvas that keeps every call (band-chart.test-fixtures.ts) and read back
// through the chart's own `pointOf`.

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type { BandScene } from './band-chart'
import type { Figure, Mark } from './band-chart.test-fixtures'
import { channels, marksOf, paintCharts, picture, } from './band-chart.test-fixtures'
import { BAND_COLOR } from './band-chart-draw'
import { HOLD_5, PUSH_5, SING_3 } from './band-chart-lessons.test-fixtures'
import { levelAt, paintSong, songRoom, songUnder, STRIP_ROW, } from './band-chart-song'
import type { SongScene } from './band-chart-song-scene'
import { HIT_TOLERANCE_CENTS } from './band-words'
import { BREATHE } from './breath-mark'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

const DO = 50
const AMBER = channels(BAND_COLOR.target).rgb

/** A song scene with nothing in it but what a test gives. */
const songOf = (s: Partial<SongScene>): SongScene => ({
  bands: [],
  words: [],
  chords: [],
  breaths: [],
  labels: [],
  name: null,
  level: null,
  ...s,
})

/** A song line on the phrase's window, do − 1 to la + 1, 6 s across, showing `song`. */
function songLine(song: SongScene | undefined): Figure {
  let scene: BandScene | null = null
  return {
    opts: {
      target: DO,
      axis: { notes: [DO - 1, DO + 10] },
      window: 6,
      paintRungs: paintSong,
      under: songUnder(() => scene?.song),
    },
    scene: (s) => {
      scene = s
      if (song !== undefined) s.song = song
    },
  }
}

/** Phrase 1's first two bands, do for the first two crotchets and so for the next two. */
const TWO: SongScene['bands'] = [
  { c: 0, from: 0, to: 1.5 },
  { c: 700, from: 1.5, to: 3 },
]

const wordsOf = (marks: readonly Mark[], text: string): Mark[] =>
  marks.filter((m) => m.line.endsWith(` ${text}`))

describe('a chart with the song painters and no song', () => {
  it.each([
    ["Lesson 3's Sing it", SING_3],
    ["Lesson 5's hold", HOLD_5],
    ["Lesson 5's push", PUSH_5],
  ])('paints %s exactly as the band chart does', async (_name, figure) => {
    // Arrange
    const withSong: Figure = {
      ...figure,
      opts: {
        ...figure.opts,
        paintRungs: paintSong,
        // a chart with its own strip or seconds under the plot takes no song's
        under:
          figure.opts.strip === true || figure.opts.timeTicks === true
            ? undefined
            : songUnder(() => undefined),
      },
    }

    // Act
    const [plain, song] = await paintCharts(figure, withSong)

    // Assert
    expect(picture(song.calls)).toEqual(picture(plain.calls))
  })
})

describe('a song line', () => {
  it('lands each band over its own time, at its note', async () => {
    // Act
    const [{ chart, calls }] = await paintCharts(
      songLine(songOf({ bands: TWO })),
    )

    // Assert: each band's strip from its start to its end
    const strips = marksOf(calls).filter(
      (m) => m.rgb === AMBER && m.line.startsWith('rect '),
    )
    expect(strips.map((m) => m.xs)).toEqual([
      [chart.pointOf(0, 0).x, chart.pointOf(1.5, 0).x],
      [chart.pointOf(1.5, 700).x, chart.pointOf(3, 700).x],
    ])
    expect(strips[1].ys).toEqual([
      chart.pointOf(1.5, 700 + HIT_TOLERANCE_CENTS).y,
      chart.pointOf(1.5, 700 - HIT_TOLERANCE_CENTS).y,
    ])
  })

  it('sets its words under the plot, each centred under its time, the sounding one in ink', async () => {
    // Arrange
    const song = songOf({
      bands: TWO,
      words: [
        { t: 0.375, text: 'Twin-', on: true },
        { t: 1.125, text: 'kle,' },
      ],
    })

    // Act
    const [{ chart, calls }] = await paintCharts(songLine(song))

    // Assert: under the plot's foot, the room of one strip
    const marks = marksOf(calls)
    const [twin] = wordsOf(marks, 'Twin-')
    const [kle] = wordsOf(marks, 'kle,')
    const foot = chart.pointOf(0, chart.lo).y
    expect(twin.ys[0]).toBeCloseTo(foot + STRIP_ROW / 2)
    expect((twin.xs[0] + twin.xs[1]) / 2).toBeCloseTo(chart.pointOf(0.375, 0).x)
    expect(twin.rgb).not.toBe(kle.rgb)
    expect(190 - 14 - foot).toBe(STRIP_ROW)
  })

  it('lays a chord strip under the words, and takes its room from the plot', async () => {
    // Arrange
    const song = songOf({
      bands: TWO,
      words: [{ t: 0.375, text: 'How' }],
      chords: [{ t: 0.75, text: 'IV' }],
    })

    // Act
    const [{ chart, calls }] = await paintCharts(songLine(song))

    // Assert
    const foot = chart.pointOf(0, chart.lo).y
    const [iv] = wordsOf(marksOf(calls), 'IV')
    expect(190 - 14 - foot).toBe(2 * STRIP_ROW)
    expect(iv.ys[0]).toBeCloseTo(foot + STRIP_ROW * 1.5)
    expect(songRoom(song, 190)).toBe(36)
  })

  it('stands a breath mark at its time over the higher band beside it, its word inside the plot', async () => {
    // Arrange: a breath at the very end of the window, after "star"
    const song = songOf({
      bands: [
        { c: 900, from: 3, to: 4.5 },
        { c: 700, from: 4.5, to: 5.7 },
      ],
      breaths: [{ t: 5.7, lit: true, word: true }],
    })

    // Act
    const [{ chart, calls }] = await paintCharts(songLine(song))

    // Assert: the tick's foot over so's band, the word ending inside the plot
    const marks = marksOf(calls)
    const tick = marks.find(
      (m) => m.line.startsWith('stroke') && m.rgb === AMBER && m.width === 2.2,
    )
    const [word] = wordsOf(marks, BREATHE)
    expect(tick?.xs[0]).toBeCloseTo(chart.pointOf(5.7, 0).x - 1.5)
    expect(tick?.ys[0]).toBeCloseTo(
      chart.pointOf(5.7, 700 + HIT_TOLERANCE_CENTS).y - 4,
    )
    expect(Math.max(...word.xs)).toBeLessThanOrEqual(
      chart.pointOf(6, 0).x + 1e-9,
    )
  })

  it('draws a breath mark given no word as its tick alone', async () => {
    // Arrange
    const song = songOf({
      bands: TWO,
      breaths: [{ t: 1.5, lit: false, word: false }],
    })

    // Act
    const [{ calls }] = await paintCharts(songLine(song))

    // Assert
    expect(wordsOf(marksOf(calls), BREATHE)).toEqual([])
  })

  it('lights a band by its level along its length, only as far as it has sounded', async () => {
    // Arrange: "star" swelling from 0.5 to 1 and back, sounded to half way
    const light = [
      { t: 4.5, level: 0.5 },
      { t: 5.1, level: 1 },
      { t: 5.7, level: 0.5 },
    ]
    const half = songOf({
      bands: [{ c: 700, from: 4.5, to: 5.7, light, upTo: 5.1 }],
    })

    // Act
    const [{ chart, calls }] = await paintCharts(songLine(half))

    // Assert: the light's slices end at 5.1 s, brighter towards it
    const centre = marksOf(calls).filter(
      (m) =>
        m.rgb === AMBER &&
        m.line.startsWith('rect ') &&
        Math.abs((m.ys[1] ?? 0) - (m.ys[0] ?? 0) - 3) < 1e-6,
    )
    expect(centre.length).toBeGreaterThan(4)
    expect(Math.max(...centre.flatMap((m) => m.xs))).toBeLessThanOrEqual(
      chart.pointOf(5.1, 700).x + 1e-9,
    )
    expect(centre[0].opacity).toBeLessThan(centre.at(-1)?.opacity ?? 0)
  })

  it('keeps the light once sounded, and draws a planned swell as faint light', async () => {
    // Arrange
    const light = [
      { t: 0, level: 1 },
      { t: 1.5, level: 1 },
    ]
    const sung = songOf({ bands: [{ c: 0, from: 0, to: 1.5, light, upTo: 6 }] })
    const planned = songOf({ bands: [{ c: 0, from: 0, to: 1.5, plan: light }] })

    // Act
    const [a, b] = await paintCharts(songLine(sung), songLine(planned))

    // Assert: the same slices, the plan's at 0.4 of the sung light
    const slices = (calls: Painted['calls']): Mark[] =>
      marksOf(calls).filter(
        (m) =>
          m.rgb === AMBER &&
          m.line.startsWith('rect ') &&
          Math.abs((m.ys[1] ?? 0) - (m.ys[0] ?? 0) - 3) < 1e-6,
      )
    const full = slices(a.calls)
    const faint = slices(b.calls)
    expect(faint).toHaveLength(full.length)
    expect(faint[0].opacity / full[0].opacity).toBeCloseTo(0.4)
    expect(full.at(-1)?.xs[1]).toBeCloseTo(a.chart.pointOf(1.5, 0).x)
  })

  it('draws the level strip in place of the words, and names its windows over the plot', async () => {
    // Arrange: Step 3's two windows over so's band
    const song = songOf({
      bands: [
        { c: 700, from: 0, to: 4 },
        { c: 700, from: 4.6, to: 6 },
      ],
      labels: [
        { t: 2, text: 'the swell' },
        { t: 5.3, text: "Lesson 5's push" },
      ],
      level: [
        { t: 0, level: 0.5 },
        { t: 2.5, level: 1 },
      ],
    })

    // Act
    const [{ calls }] = await paintCharts(songLine(song))

    // Assert
    const marks = marksOf(calls)
    expect(wordsOf(marks, 'LOUDNESS')).toHaveLength(1)
    expect(wordsOf(marks, 'the swell')).toHaveLength(1)
    expect(wordsOf(marks, "Lesson 5's push")).toHaveLength(1)
  })

  it("names what it shows in the plot's top left corner", async () => {
    // Act
    const [{ chart, calls }] = await paintCharts(
      songLine(songOf({ bands: TWO, name: 'take 1' })),
    )

    // Assert
    const [name] = wordsOf(marksOf(calls), 'take 1')
    expect(name.xs[0]).toBeCloseTo(chart.pointOf(0, 0).x + 4)
  })
})

describe('levelAt', () => {
  it('reads a level curve linearly between its points, held past its ends', () => {
    // Arrange
    const curve = [
      { t: 1, level: 0.5 },
      { t: 2, level: 1 },
    ]

    // Assert
    expect([0, 1, 1.5, 2, 3].map((t) => levelAt(curve, t))).toEqual([
      0.5, 0.5, 0.75, 1, 1,
    ])
    expect(levelAt([], 1)).toBe(0)
  })
})

type Painted = Awaited<ReturnType<typeof paintCharts>>[number]
