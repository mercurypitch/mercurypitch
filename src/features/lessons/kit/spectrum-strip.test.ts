// The spectrum strip under a band chart's plot (Lesson 13 WEB-SPEC, Look,
// Toys 1, Tests 4 and 5; FACTS 41, 44 and 68): its layout at the figure's
// heights and the phone's widths, the bars it numbers, and what it paints.

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type { BandScene, CentsTick } from './band-chart'
import { channels, marksOf, paintCharts } from './band-chart.test-fixtures'
import type { SpectrumScene } from './spectrum-strip'
import { numberedBars, numberWidth, plotHeight, segmentColor, spectrumUnder, stripHeight, stripLayout, } from './spectrum-strip'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

/** A3, F3 and A4, Hz. */
const A3 = 220
const F3 = 174.614
const A4 = 440

describe('the strip laid out (WEB-SPEC, Toys 1, Heights)', () => {
  it('gives the plot 30 % of the figure and the strip the rest, at 380, 340, 310 and 240 px', () => {
    // Act
    const rows = [380, 340, 310, 240].map((h) => [
      plotHeight(h),
      stripHeight(h),
      Math.round((stripHeight(h) / 12) * 10) / 10,
    ])

    // Assert
    expect(rows).toEqual([
      [114, 220, 18.3],
      [102, 192, 16],
      [93, 171, 14.3],
      [72, 122, 10.2],
    ])
  })

  it("stands A3's columns 17.9 px apart and 12.6 px wide on a phone, and F3's 12.2 and 8.6 at 344 px", () => {
    // Act: the canvas is the stage card less 4 px, the card the viewport less two 16 px gutters
    const phone = stripLayout(354, 340, A3, 18)
    const narrow = stripLayout(308, 340, F3, 22)

    // Assert
    expect(phone.x1 - phone.x0).toBe(326)
    expect(phone.spacing).toBeCloseTo(17.93, 2)
    expect(phone.width).toBeCloseTo(12.55, 2)
    expect(narrow.x1 - narrow.x0).toBe(280)
    expect(narrow.spacing).toBeCloseTo(12.22, 2)
    expect(narrow.width).toBeCloseTo(8.56, 2)
    expect(phone.centres[17]).toBeCloseTo(phone.x0 + (326 * 3960) / 4000, 6)
  })

  it('numbers every bar 16 px apart or more, else the peaks, the 1st and every 5th, and never two that touch', () => {
    // Act
    const all = numberedBars(17.93, 18, [1, 10], 'all')
    const close = numberedBars(12.22, 22, [4, 6], 'all')
    const compact = numberedBars(17.93, 18, [3, 5], 'peaks')

    // Assert
    expect(all).toEqual(Array.from({ length: 18 }, (_, i) => i + 1))
    expect(close).toEqual([1, 4, 5, 6, 10, 15, 20])
    expect(compact).toEqual([3, 5])
    for (const [list, spacing] of [
      [all, 17.93],
      [close, 12.22],
    ] as const)
      list.slice(1).forEach((n, i) => {
        const m = list[i]
        expect((n - m) * spacing).toBeGreaterThan(
          (numberWidth(n) + numberWidth(m)) / 2,
        )
      })
  })

  it('ramps its lit segments from aqua at the foot to amber at the top', () => {
    // Act / Assert
    expect(segmentColor(0)).toBe('rgb(45,212,191)')
    expect(segmentColor(11)).toBe('rgb(245,158,11)')
  })
})

/** Lesson 13's cents axis: ±100, only the band's edges named. */
const TICKS: readonly CentsTick[] = [
  { c: 100, label: '' },
  { c: 35, label: '35', place: 'below' },
  { c: -35, label: '35' },
  { c: -100, label: '' },
]

/** A strip scene with nothing in it but the note. */
const emptyStrip = (f0: number): SpectrumScene => ({
  f0,
  columns: [],
  peaks: [],
  numbers: 'peaks',
  curves: [],
  caption: '',
})

/** The marks a band chart with the strip paints in one frame, below the plot. */
async function stripMarks(
  spectrum: SpectrumScene,
): Promise<ReturnType<typeof marksOf>> {
  const [painted] = await paintCharts({
    opts: {
      target: 57,
      axis: { range: 100 },
      ticks: TICKS,
      under: spectrumUnder(),
    },
    scene: (s: BandScene) => {
      s.spectrum = spectrum
    },
  })
  // the fixture's canvas is 190 px tall: the plot ends at 12 + 57
  return marksOf(painted.calls).filter((m) =>
    m.ys.some((y) => y > 12 + plotHeight(190)),
  )
}

describe('the strip painted under a band chart (WEB-SPEC, Tests 5)', () => {
  it('lays the plot out as the strip asks: 12 px from the top, 30 % of the figure tall', async () => {
    // Act
    const [painted] = await paintCharts({
      opts: { target: 57, axis: { range: 100 }, under: spectrumUnder() },
    })

    // Assert: Merc's band, ±35 cents of ±100, centred in a 57 px plot from 12
    const ys = marksOf(painted.calls)
      .filter((m) => m.line.startsWith('stroke #f59e0b'))
      .flatMap((m) => m.ys)
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(12)
    expect(Math.max(...ys)).toBeLessThanOrEqual(12 + 57)
  })

  it('paints unlit columns only for an empty scene: 18 on A3, 12 segments each', async () => {
    // Act
    const marks = await stripMarks(emptyStrip(A3))

    // Assert
    expect(marks).toHaveLength(18 * 12)
    for (const m of marks) {
      expect(m.line.startsWith('rect ')).toBe(true)
      expect(m.rgb).toBe('195,204,214')
      expect(m.opacity).toBeCloseTo(0.08, 6)
    }
  })

  it('caps a labelled peak in ink with a chevron, numbers it in bold ink, and lights its segments from aqua', async () => {
    // Act
    const marks = await stripMarks({
      ...emptyStrip(A4),
      columns: [12, 6, 3],
      peaks: [1],
      caption: "Merc's model",
    })

    // Assert
    const lit = marks.filter(
      (m) => m.line.startsWith('rect rgb(') && !m.line.includes('0.08'),
    )
    expect(lit).toHaveLength(12 + 6 + 3)
    const ink = marks.filter((m) => m.rgb === channels('#e6edf3').rgb)
    expect(ink.map((m) => m.line.split(' ')[0])).toEqual([
      'rect',
      'stroke',
      'text',
    ])
    expect(marks.some((m) => m.line.endsWith(" Merc's model"))).toBe(true)
  })

  it('draws nothing violet, mint or gold, whatever it shows', async () => {
    // Act
    const marks = await stripMarks({
      f0: A3,
      columns: Array.from({ length: 18 }, () => 12),
      peaks: [1, 10],
      numbers: 'all',
      curves: [
        [
          { hz: 0, db: -36 },
          { hz: 280, db: 0 },
          { hz: 4000, db: -36 },
        ],
      ],
      caption: "Merc's model",
      curveCaption: "Merc's model too",
    })

    // Assert
    const banned = ['#a78bfa', '#bc8cff', '#80ffca', '#ffd84d'].map(
      (c) => channels(c).rgb,
    )
    for (const m of marks) expect(banned).not.toContain(m.rgb)
    expect(marks.some((m) => m.line.endsWith(" Merc's model too"))).toBe(true)
  })

  it("gives a hold's seconds the plot's last 18 px, so the strip stays put", () => {
    // Act
    const plain = spectrumUnder()
    const ticks = spectrumUnder({ ticks: true })

    // Assert
    expect(plain.bottom(340) - ticks.bottom(340)).toBe(18)
    expect(ticks.top(340)).toBe(plain.top(340))
  })
})
