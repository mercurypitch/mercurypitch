// ============================================================
// Band chart tests — Lessons 3 and 5's charts, mark for mark
// ============================================================
//
// A chart paints its scene while it is on screen, in each frame where what
// it shows has changed since the frame it last drew. These tests mount
// charts as Lessons 3 and 5 mount them
// (band-chart-lessons.test-fixtures.ts), on canvases that keep every call
// they hear (band-chart.test-fixtures.ts), set a scene, run one frame of the
// page's loop, and read the calls back as the marks they draw. Each lesson's
// chart is written out here mark by mark, as the chart painted it before it
// took rungs, so a change that moves any line of them fails here. The same
// charts with their band as one rung at 0 across the plot, and where rungs
// land beyond that, are band-chart-rungs.test.ts's (Lesson 9 WEB-SPEC,
// Tests 5).

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type { Call } from './band-chart.test-fixtures'
import { marksOf, mountCharts, paintCharts, picture, } from './band-chart.test-fixtures'
import { HOLD_5, OCTAVES_3, PUSH_5, SING_3, } from './band-chart-lessons.test-fixtures'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

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

/** How many frames the calls painted: each starts by setting its transform. */
const paintsIn = (calls: readonly Call[]): number =>
  calls.filter(([name]) => name === 'setTransform').length

/** Lesson 3's Sing it chart, drawn once and at rest: its loop, chart and canvas's calls. */
async function restingChart() {
  const { hand, painted } = await mountCharts([SING_3])
  const first = hand.settle()
  return { hand, first, ...painted[0] }
}

describe('the band chart at rest', () => {
  afterEach(() => {
    vi.stubGlobal('devicePixelRatio', 1)
  })

  it('asks for no frame once it has drawn a scene that has not changed', async () => {
    // Arrange
    const { hand, painted } = await mountCharts([SING_3])

    // Act
    const frames = hand.settle()

    // Assert: the one frame that drew it, and none asked for since
    expect(frames).toBe(1)
    expect(paintsIn(painted[0].calls)).toBe(1)
    expect(hand.asked).toHaveLength(0)
  })

  it('draws nothing in a frame a wake asks for while its scene is unchanged', async () => {
    // Arrange
    const { hand, calls } = await restingChart()

    // Act
    hand.loop.wake()
    const frames = hand.settle()

    // Assert
    expect(frames).toBe(1)
    expect(paintsIn(calls)).toBe(1)
  })

  it('draws a changed scene in the frame a wake asks for, and then rests', async () => {
    // Arrange
    const { hand, chart, calls } = await restingChart()

    // Act: Merc's note stops sounding
    chart.scene.glow = 0
    hand.loop.wake()
    const frames = hand.settle()

    // Assert
    expect(frames).toBe(1)
    expect(paintsIn(calls)).toBe(2)
    expect(hand.asked).toHaveLength(0)
  })

  it('draws a line grown in place, with no wake, in the frame the next input asks for', async () => {
    // Arrange: the line grows by a point, and time passes with no input
    const { hand, chart, calls } = await restingChart()
    chart.scene.line.push({ t: 3, c: 20 })
    vi.advanceTimersByTime(5000)
    const unasked = hand.asked.length

    // Act
    document.body.dispatchEvent(new Event('pointerdown'))
    const frames = hand.settle()

    // Assert: the new frame's line reaches the new point
    const reaches = chart.pointOf(3, 20)
    const lines = marksOf(calls).filter((m) =>
      m.line.startsWith('stroke #a78bfa w2.6'),
    )
    expect(unasked).toBe(0)
    expect(frames).toBe(1)
    expect(lines).toHaveLength(2)
    expect(lines[1].xs.at(-1)).toBeCloseTo(reaches.x)
    expect(lines[1].ys.at(-1)).toBeCloseTo(reaches.y)
  })

  it.each<[string, (r: Awaited<ReturnType<typeof restingChart>>) => void]>([
    [
      'a new size',
      ({ hand, chart }) => {
        Object.defineProperty(chart.canvas, 'clientWidth', {
          value: 320,
          configurable: true,
        })
        hand.resize(chart.canvas)
      },
    ],
    [
      'a new pixel ratio',
      ({ hand }) => {
        vi.stubGlobal('devicePixelRatio', 2)
        hand.zoom()
      },
    ],
    ['a font that loads late', ({ hand }) => hand.fontsLoad()],
    ["Merc's next note", ({ chart }) => chart.setTarget(60)],
    ['a new window', ({ chart }) => chart.setWindow(10)],
    ['a cleared scene', ({ chart }) => chart.clear()],
  ])(
    'draws once more for %s, with no other input, and then rests',
    async (_what, change) => {
      // Arrange
      const resting = await restingChart()

      // Act
      change(resting)
      const frames = resting.hand.settle()

      // Assert
      expect(resting.first).toBe(1)
      expect(frames).toBe(1)
      expect(paintsIn(resting.calls)).toBe(2)
    },
  )
})
