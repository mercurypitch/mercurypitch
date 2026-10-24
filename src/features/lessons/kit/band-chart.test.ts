// ============================================================
// Band chart tests — Lessons 3 and 5's charts, mark for mark
// ============================================================
//
// A chart paints its scene in every frame it is on screen. These tests
// mount charts as Lessons 3 and 5 mount them, on canvases that keep every
// call they hear (band-chart.test-fixtures.ts), set a scene, run one frame
// of the page's loop, and read the calls back as the marks they draw. Each
// lesson's chart is written out here mark by mark, as the chart painted it
// before it took rungs, so a change that moves any line of them fails here;
// and its band painted as one rung at 0 across the plot makes the very same
// calls (Lesson 9 WEB-SPEC, Tests 5). Where rungs land beyond that is
// band-chart-rungs.test.ts's.

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type { Call, Figure } from './band-chart.test-fixtures'
import { paintCharts, picture } from './band-chart.test-fixtures'
import { paintRungs } from './band-chart-rungs'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

/**
 * Lesson 3's Sing it chart, mounted as lesson-03/sing-view.ts mounts it,
 * during a take: Merc's note glowing, the line climbing into the band and
 * past the top of the chart, and everything else a scene can hold.
 */
const SING_3: Figure = {
  opts: { target: 57 },
  scene: (s) => {
    s.line = [
      { t: 0.2, c: -90 },
      { t: 0.8, c: -30 },
      { t: 1.2, c: null },
      { t: 1.6, c: 10 },
      { t: 2.4, c: 180 },
    ]
    s.head = { t: 2.4, c: 180 }
    s.playhead = 2.4
    s.glow = 1
    s.lit = true
    s.marks = [
      { t: 0, label: 'try' },
      { t: 3.8, label: 'compare' },
    ]
    s.label = { t: 1.6, c: 10, text: '10 cents' }
    s.handle = true
  },
}

/**
 * Lesson 3's octave toy, mounted as lesson-03/toy-octaves.ts mounts it, as
 * Tavi's reply lands: the notes axis from F3 to C5 with A3 and A4 named,
 * the echo an octave up glowing, and the bracket between the two.
 */
const OCTAVES_3: Figure = {
  opts: {
    target: 57,
    axis: { notes: [53, 72], named: [57, 69] },
    echo: 1200,
  },
  scene: (s) => {
    s.line = [
      { t: 1.4, c: 1140 },
      { t: 1.8, c: 1192 },
      { t: 2.6, c: 1200 },
    ]
    s.head = { t: 2.6, c: 1200 }
    s.echoGlow = 1
    s.bracket = 'same note, an octave apart'
  },
}

/**
 * Lesson 5's hold, mounted as lesson-05/sing-view.ts mounts it: a fixed
 * frame of 10 seconds named under the plot, a hold settled in the band.
 */
const HOLD_5: Figure = {
  opts: { target: 57, window: 10, timeTicks: true },
  scene: (s) => {
    s.line = [
      { t: 0.4, c: -70 },
      { t: 1.5, c: -25 },
      { t: 6, c: -8 },
    ]
    s.head = { t: 6, c: -8 }
    s.lit = true
    s.marks = [{ t: 1.5, label: 'settled' }]
  },
}

/**
 * Lesson 5's push, mounted as lesson-05/toy-push.ts mounts it: the level
 * strip under the plot, the line climbing above the band as the push grows.
 */
const PUSH_5: Figure = {
  opts: { target: 57, strip: true },
  scene: (s) => {
    s.line = [
      { t: 0, c: 0 },
      { t: 2, c: 30 },
      { t: 4, c: 95 },
    ]
    s.head = { t: 4, c: 95 }
    s.level = [
      { t: 0, level: 0.3 },
      { t: 2, level: 0.6 },
      { t: 4, level: 0.9 },
    ]
  },
}

describe('the band chart as Lessons 3 and 5 mount it', () => {
  it("paints Lesson 3's Sing it chart mid-take, mark for mark as recorded", async () => {
    // Arrange: the cents axis, Merc's band glowing and lit, the line pinned
    // over the top with its arrow, the marks, the label and the handle
    const recorded = [
      'transform 1 0 0 1 0 0',
      'clear 0,0 300x190',
      'font 500 12px "JetBrains Mono", monospace',
      'stroke rgba(195,204,214,0.16) w1 dash 3 5 M12,41 L288,41',
      'text #8d97a3 left bottom 16,39 100: a semitone',
      'stroke rgba(195,204,214,0.16) w1 dash 3 5 M12,68 L288,68',
      'text #8d97a3 left bottom 16,66 50: halfway to the next note',
      'stroke rgba(195,204,214,0.16) w1 dash 3 5 M12,76.1 L288,76.1',
      'text #8d97a3 left top 16,79.1 35',
      'stroke rgba(195,204,214,0.1) w1 dash 3 5 M12,86.9 L288,86.9',
      'stroke rgba(195,204,214,0.1) w1 dash 3 5 M12,103.1 L288,103.1',
      'stroke rgba(195,204,214,0.16) w1 dash 3 5 M12,113.9 L288,113.9',
      'text #8d97a3 left bottom 16,111.9 35',
      'stroke rgba(195,204,214,0.16) w1 dash 3 5 M12,122 L288,122',
      'text #8d97a3 left top 16,125 50',
      'stroke rgba(195,204,214,0.16) w1 dash 3 5 M12,149 L288,149',
      'text #8d97a3 left top 16,152 100',
      'rect rgba(245,158,11,0.2) 12,76.1 276x37.8',
      'stroke rgba(245,158,11,0.6) w1 M12,76.1 L288,76.1',
      'stroke rgba(245,158,11,0.6) w1 M12,113.9 L288,113.9',
      'stroke #f59e0b w3 M12,95 L288,95',
      'stroke #f59e0b w12 alpha 0.18 M12,95 L288,95',
      'stroke #80ffca w2 M12,76.1 L288,76.1',
      'stroke #80ffca w2 M12,113.9 L288,113.9',
      'text #80ffca right bottom 284,73.1 IN THE BAND',
      'stroke rgba(195,204,214,0.32) w1 dash 2 4 M12,30 L12,176',
      'text #a8b3bf center top 12,16 TRY',
      'stroke rgba(195,204,214,0.32) w1 dash 2 4 M274.2,30 L274.2,176',
      'text #a8b3bf right top 274.2,16 COMPARE',
      'stroke rgba(195,204,214,0.28) w1 M177.6,14 L177.6,176',
      'lineJoin round',
      'lineCap round',
      'stroke #a78bfa w9 alpha 0.14 M25.8,143.6 L67.2,111.2 M122.4,89.6 L177.6,14',
      'stroke #a78bfa w2.6 M25.8,143.6 L67.2,111.2 M122.4,89.6 L177.6,14',
      'fill #a78bfa O177.6,14 r4.5',
      'fill #a78bfa M177.6,3 L171.6,11 L183.6,11 Z',
      'stroke #a78bfa w2 O177.6,14 r11',
      'fill rgba(167,139,250,0.22) O177.6,14 r11',
      'text #a78bfa left bottom 122.4,81.6 10 CENTS',
    ]

    // Act
    const [{ calls }] = await paintCharts(SING_3)

    // Assert
    expect(picture(calls)).toEqual(recorded)
  })

  it("paints Lesson 3's octave toy as the reply lands, mark for mark as recorded", async () => {
    // Arrange: the notes axis, Merc's band at A3 and the dashed echo at A4
    // glowing, the reply landing in it, the bracket
    const recorded = [
      'transform 1 0 0 1 0 0',
      'clear 0,0 300x190',
      'font 500 12px "JetBrains Mono", monospace',
      'stroke rgba(195,204,214,0.12) w1 M40,176 L288,176',
      'text #8d97a3 right middle 32,176 F',
      'stroke rgba(195,204,214,0.06) w1 M40,167.47 L288,167.47',
      'stroke rgba(195,204,214,0.12) w1 M40,158.95 L288,158.95',
      'text #8d97a3 right middle 32,158.95 G',
      'stroke rgba(195,204,214,0.06) w1 M40,150.42 L288,150.42',
      'stroke rgba(195,204,214,0.12) w1 M40,141.89 L288,141.89',
      'text #e6edf3 right middle 32,141.89 A3',
      'stroke rgba(195,204,214,0.06) w1 M40,133.37 L288,133.37',
      'stroke rgba(195,204,214,0.12) w1 M40,124.84 L288,124.84',
      'text #8d97a3 right middle 32,124.84 B',
      'stroke rgba(195,204,214,0.12) w1 M40,116.32 L288,116.32',
      'text #8d97a3 right middle 32,116.32 C',
      'stroke rgba(195,204,214,0.06) w1 M40,107.79 L288,107.79',
      'stroke rgba(195,204,214,0.12) w1 M40,99.26 L288,99.26',
      'text #8d97a3 right middle 32,99.26 D',
      'stroke rgba(195,204,214,0.06) w1 M40,90.74 L288,90.74',
      'stroke rgba(195,204,214,0.12) w1 M40,82.21 L288,82.21',
      'text #8d97a3 right middle 32,82.21 E',
      'stroke rgba(195,204,214,0.12) w1 M40,73.68 L288,73.68',
      'text #8d97a3 right middle 32,73.68 F',
      'stroke rgba(195,204,214,0.06) w1 M40,65.16 L288,65.16',
      'stroke rgba(195,204,214,0.12) w1 M40,56.63 L288,56.63',
      'text #8d97a3 right middle 32,56.63 G',
      'stroke rgba(195,204,214,0.06) w1 M40,48.11 L288,48.11',
      'stroke rgba(195,204,214,0.12) w1 M40,39.58 L288,39.58',
      'text #e6edf3 right middle 32,39.58 A4',
      'stroke rgba(195,204,214,0.06) w1 M40,31.05 L288,31.05',
      'stroke rgba(195,204,214,0.12) w1 M40,22.53 L288,22.53',
      'text #8d97a3 right middle 32,22.53 B',
      'stroke rgba(195,204,214,0.12) w1 M40,14 L288,14',
      'text #8d97a3 right middle 32,14 C',
      'rect rgba(245,158,11,0.13) 40,138.91 248x5.97',
      'stroke rgba(245,158,11,0.6) w1 M40,138.91 L288,138.91',
      'stroke rgba(245,158,11,0.6) w1 M40,144.88 L288,144.88',
      'stroke #f59e0b w2 alpha 0.75 M40,141.89 L288,141.89',
      'rect rgba(245,158,11,0.07) 40,36.59 248x5.97',
      'stroke rgba(245,158,11,0.5) w1 dash 5 4 M40,36.59 L288,36.59',
      'stroke rgba(245,158,11,0.5) w1 dash 5 4 M40,42.56 L288,42.56',
      'stroke #f59e0b w3 alpha 0.55 dash 5 4 M40,39.58 L288,39.58',
      'stroke #f59e0b w12 alpha 0.18 dash 5 4 M40,39.58 L288,39.58',
      'lineJoin round',
      'lineCap round',
      'stroke #a78bfa w9 alpha 0.14 M126.8,44.69 L151.6,40.26 L201.2,39.58',
      'stroke #a78bfa w2.6 M126.8,44.69 L151.6,40.26 L201.2,39.58',
      'fill #a78bfa O201.2,39.58 r4.5',
      'stroke #ffd84d w1.6 M266,141.89 L274,141.89 L274,39.58 L266,39.58',
      'text #ffd84d right middle 262,90.74 SAME NOTE, AN OCTAVE APART',
    ]

    // Act
    const [{ calls }] = await paintCharts(OCTAVES_3)

    // Assert
    expect(picture(calls)).toEqual(recorded)
  })

  it("paints Lesson 5's hold with its seconds named, mark for mark as recorded", async () => {
    // Arrange: a 10 s frame, the hold settled in the lit band, the seconds
    // under the plot
    const recorded = [
      'transform 1 0 0 1 0 0',
      'clear 0,0 300x190',
      'font 500 12px "JetBrains Mono", monospace',
      'stroke rgba(195,204,214,0.16) w1 dash 3 5 M12,38 L288,38',
      'text #8d97a3 left bottom 16,36 100: a semitone',
      'stroke rgba(195,204,214,0.16) w1 dash 3 5 M12,62 L288,62',
      'text #8d97a3 left bottom 16,60 50: halfway to the next note',
      'stroke rgba(195,204,214,0.16) w1 dash 3 5 M12,69.2 L288,69.2',
      'text #8d97a3 left top 16,72.2 35',
      'stroke rgba(195,204,214,0.1) w1 dash 3 5 M12,78.8 L288,78.8',
      'stroke rgba(195,204,214,0.1) w1 dash 3 5 M12,93.2 L288,93.2',
      'stroke rgba(195,204,214,0.16) w1 dash 3 5 M12,102.8 L288,102.8',
      'text #8d97a3 left bottom 16,100.8 35',
      'stroke rgba(195,204,214,0.16) w1 dash 3 5 M12,110 L288,110',
      'text #8d97a3 left top 16,113 50',
      'stroke rgba(195,204,214,0.16) w1 dash 3 5 M12,134 L288,134',
      'text #8d97a3 left top 16,137 100',
      'rect rgba(245,158,11,0.13) 12,69.2 276x33.6',
      'stroke rgba(245,158,11,0.6) w1 M12,69.2 L288,69.2',
      'stroke rgba(245,158,11,0.6) w1 M12,102.8 L288,102.8',
      'stroke #f59e0b w2 alpha 0.75 M12,86 L288,86',
      'stroke #80ffca w2 M12,69.2 L288,69.2',
      'stroke #80ffca w2 M12,102.8 L288,102.8',
      'text #80ffca right bottom 284,66.2 IN THE BAND',
      'stroke rgba(195,204,214,0.32) w1 dash 2 4 M53.4,30 L53.4,158',
      'text #a8b3bf center top 53.4,16 SETTLED',
      'lineJoin round',
      'lineCap round',
      'stroke #a78bfa w9 alpha 0.14 M23.04,119.6 L53.4,98 L177.6,89.84',
      'stroke #a78bfa w2.6 M23.04,119.6 L53.4,98 L177.6,89.84',
      'fill #a78bfa O177.6,89.84 r4.5',
      'stroke rgba(195,204,214,0.3) w1 M12,162 L12,167',
      'text #8d97a3 left top 12,168 0',
      'stroke rgba(195,204,214,0.3) w1 M39.6,162 L39.6,165',
      'stroke rgba(195,204,214,0.3) w1 M67.2,162 L67.2,165',
      'stroke rgba(195,204,214,0.3) w1 M94.8,162 L94.8,165',
      'stroke rgba(195,204,214,0.3) w1 M122.4,162 L122.4,165',
      'stroke rgba(195,204,214,0.3) w1 M150,162 L150,167',
      'text #8d97a3 center top 150,168 5',
      'stroke rgba(195,204,214,0.3) w1 M177.6,162 L177.6,165',
      'stroke rgba(195,204,214,0.3) w1 M205.2,162 L205.2,165',
      'stroke rgba(195,204,214,0.3) w1 M232.8,162 L232.8,165',
      'stroke rgba(195,204,214,0.3) w1 M260.4,162 L260.4,165',
      'stroke rgba(195,204,214,0.3) w1 M288,162 L288,167',
      'text #8d97a3 right top 288,168 10 s',
    ]

    // Act
    const [{ calls }] = await paintCharts(HOLD_5)

    // Assert
    expect(picture(calls)).toEqual(recorded)
  })

  it("paints Lesson 5's push with its level strip, mark for mark as recorded", async () => {
    // Arrange: the line climbing above the band, the level strip under it
    const recorded = [
      'transform 1 0 0 1 0 0',
      'clear 0,0 300x190',
      'font 500 12px "JetBrains Mono", monospace',
      'stroke rgba(195,204,214,0.16) w1 dash 3 5 M12,34.67 L288,34.67',
      'text #8d97a3 left bottom 16,32.67 100: a semitone',
      'stroke rgba(195,204,214,0.16) w1 dash 3 5 M12,55.33 L288,55.33',
      'text #8d97a3 left bottom 16,53.33 50: halfway to the next note',
      'stroke rgba(195,204,214,0.16) w1 dash 3 5 M12,61.53 L288,61.53',
      'text #8d97a3 left top 16,64.53 35',
      'stroke rgba(195,204,214,0.1) w1 dash 3 5 M12,69.8 L288,69.8',
      'stroke rgba(195,204,214,0.1) w1 dash 3 5 M12,82.2 L288,82.2',
      'stroke rgba(195,204,214,0.16) w1 dash 3 5 M12,90.47 L288,90.47',
      'text #8d97a3 left bottom 16,88.47 35',
      'stroke rgba(195,204,214,0.16) w1 dash 3 5 M12,96.67 L288,96.67',
      'text #8d97a3 left top 16,99.67 50',
      'stroke rgba(195,204,214,0.16) w1 dash 3 5 M12,117.33 L288,117.33',
      'text #8d97a3 left top 16,120.33 100',
      'rect rgba(245,158,11,0.13) 12,61.53 276x28.93',
      'stroke rgba(245,158,11,0.6) w1 M12,61.53 L288,61.53',
      'stroke rgba(245,158,11,0.6) w1 M12,90.47 L288,90.47',
      'stroke #f59e0b w2 alpha 0.75 M12,76 L288,76',
      'lineJoin round',
      'lineCap round',
      'stroke #a78bfa w9 alpha 0.14 M12,76 L150,63.6 L288,36.73',
      'stroke #a78bfa w2.6 M12,76 L150,63.6 L288,36.73',
      'fill #a78bfa O288,36.73 r4.5',
      'rect rgba(195,204,214,0.035) 12,146 276x30',
      'stroke rgba(195,204,214,0.16) w1 M12,161 L288,161',
      'fill rgba(195,204,214,0.24) M12,157.1 L150,153.2 L288,149.3 L288,172.7 L150,168.8 L12,164.9 Z',
      'stroke rgba(195,204,214,0.62) w1 M12,157.1 L150,153.2 L288,149.3 L288,172.7 L150,168.8 L12,164.9 Z',
      'rect rgba(7,10,16,.82) 13,147 65.6x16',
      'text #8d97a3 left top 16,149 LOUDNESS',
    ]

    // Act
    const [{ calls }] = await paintCharts(PUSH_5)

    // Assert
    expect(picture(calls)).toEqual(recorded)
  })
})

/**
 * A chart on a notes axis with no echo, as Lesson 9's will be: Merc's band
 * half lit as his note fades, the singer's line inside it.
 */
const NOTES: Figure = {
  opts: { target: 57, axis: { notes: [53, 72], named: [57, 69] } },
  scene: (s) => {
    s.line = [
      { t: 0.5, c: -60 },
      { t: 1.5, c: -10 },
    ]
    s.head = { t: 1.5, c: -10 }
    s.glow = 0.5
    s.lit = true
  },
}

/**
 * The same figure with its band as one rung at 0 across the plot, which
 * carries the scene's glow and lit edge: the scene's own are put out, so
 * only the rung can paint them.
 */
function asOneRung(figure: Figure): Figure {
  return {
    opts: { ...figure.opts, paintRungs },
    scene: (s) => {
      figure.scene?.(s)
      s.rungs = [{ c: 0, glow: s.glow, lit: s.lit }]
      s.glow = 0
      s.lit = false
    },
  }
}

/**
 * The calls without the rung painter's own setting of a line's caps and
 * joins back to the canvas's (butt, miter), which a first frame draws the
 * same without: the rest must be the band's, call for call.
 */
const drawn = (calls: readonly Call[]): Call[] =>
  calls.filter(
    ([name, value]) =>
      !(name === 'lineCap=' && value === 'butt') &&
      !(name === 'lineJoin=' && value === 'miter'),
  )

describe('one rung at 0 across the plot', () => {
  it.each<[string, Figure]>([
    ["Lesson 3's Sing it chart", SING_3],
    ["Lesson 5's hold", HOLD_5],
    ["Lesson 5's push", PUSH_5],
    ['a notes axis with no echo', NOTES],
  ])('paints %s call for call as its band does', async (_name, figure) => {
    // Arrange
    const rung = asOneRung(figure)

    // Act
    const [band, rungs] = await paintCharts(figure, rung)

    // Assert
    expect(drawn(rungs.calls)).toEqual(band.calls)
  })

  it('leaves a chart given the painter on its band while its scene holds no rungs', async () => {
    // Arrange
    const given: Figure = { ...SING_3, opts: { ...SING_3.opts, paintRungs } }

    // Act
    const [band, painter] = await paintCharts(SING_3, given)

    // Assert
    expect(painter.calls).toEqual(band.calls)
  })

  it("paints neither the scene's glow nor its lit edge once a rung takes the band's place", async () => {
    // Arrange: one rung at rest under a scene that glows and is lit
    const rung: Figure = {
      opts: { target: 57, paintRungs },
      scene: (s) => {
        s.rungs = [{ c: 0 }]
        s.glow = 1
        s.lit = true
      },
    }
    const atRest: Figure = { opts: { target: 57 } }

    // Act
    const [rungs, band] = await paintCharts(rung, atRest)

    // Assert
    expect(drawn(rungs.calls)).toEqual(band.calls)
  })
})
