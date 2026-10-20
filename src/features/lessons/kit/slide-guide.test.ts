// ============================================================
// Lesson slide guide tests — the path's pitch, the rows, and the two runs
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type { GuidePoint, GuideRow } from './slide-guide'
import { breathAt, guideFrame, inGap, mountGuide, pathLength, pathPieces, pitchAt, } from './slide-guide'

/** Lesson 2's slide on A3 (FACTS 50): hold, up a semitone, hold, back, hold. */
const SLIDE: readonly GuidePoint[] = [
  { t: 0, midi: 57 },
  { t: 1.2, midi: 57 },
  { t: 1.7, midi: 58 },
  { t: 2.7, midi: 58 },
  { t: 3.2, midi: 57 },
  { t: 4.2, midi: 57 },
]

const LANES: readonly GuideRow[] = [
  { midi: 56, label: 'G♯3' },
  { midi: 57, label: 'A3' },
  { midi: 58, label: 'A♯3' },
  { midi: 59, label: 'B3' },
]

function guideRoot(): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = '<canvas></canvas><div data-guide-rows></div>'
  document.body.appendChild(root)
  return root
}

const labels = (root: HTMLElement): string[] =>
  Array.from(root.querySelectorAll('.guide-row')).map(
    (el) => el.textContent ?? '',
  )

afterEach(() => {
  vi.useRealTimers()
  document.body.textContent = ''
})

describe('pitchAt', () => {
  it("follows Merc's slide: halfway up mid-glide, on the higher lane while it holds, home at the end", () => {
    expect(pitchAt(SLIDE, 1.45)).toBeCloseTo(57.5, 6)
    expect(pitchAt(SLIDE, 2.2)).toBe(58)
    expect(pitchAt(SLIDE, 2.95)).toBeCloseTo(57.5, 6)
    expect(pitchAt(SLIDE, 4.2)).toBe(57)
    expect(pathLength(SLIDE)).toBe(4.2)
  })
})

/** Two phrases with a silence between: do held, a 2 s rest, then up a tone. */
const PHRASES: readonly GuidePoint[] = [
  { t: 0, midi: 50 },
  { t: 1, midi: 50 },
  { t: 3, midi: 52, gap: true },
  { t: 4, midi: 52 },
]

describe('pathPieces', () => {
  it("draws a path with no silence as one line through its points, as Lesson 2's slide always was", () => {
    // Act
    const whole = pathPieces(SLIDE, 0, pathLength(SLIDE))
    const part = pathPieces(SLIDE, 1.45, 2.2)

    // Assert
    expect(whole).toEqual([SLIDE.map((p) => ({ t: p.t, midi: p.midi }))])
    expect(part).toEqual([
      [
        { t: 1.45, midi: 57.5 },
        { t: 1.7, midi: 58 },
        { t: 2.2, midi: 58 },
      ],
    ])
  })

  it('lifts the pen over a silence, so each phrase is a line of its own', () => {
    // Act
    const pieces = pathPieces(PHRASES, 0, 4)

    // Assert
    expect(pieces).toEqual([
      [
        { t: 0, midi: 50 },
        { t: 1, midi: 50 },
      ],
      [
        { t: 3, midi: 52 },
        { t: 4, midi: 52 },
      ],
    ])
  })

  it('draws a stretch that ends in a silence only as far as its phrase, and nothing of one inside a silence', () => {
    // Act
    const upToRest = pathPieces(PHRASES, 0, 2)
    const insideRest = pathPieces(PHRASES, 1.5, 2.5)

    // Assert
    expect(upToRest).toEqual([
      [
        { t: 0, midi: 50 },
        { t: 1, midi: 50 },
      ],
    ])
    expect(insideRest).toEqual([])
  })
})

describe('inGap', () => {
  it('is true only strictly inside a silence', () => {
    expect([0.5, 1, 2, 3, 3.5].map((t) => inGap(PHRASES, t))).toEqual([
      false,
      false,
      true,
      false,
      false,
    ])
    expect(SLIDE.some((p) => inGap(SLIDE, p.t + 0.01))).toBe(false)
  })
})

describe('guideFrame', () => {
  it('puts the highest row at the top, a semitone a step, and the path end at the right edge', () => {
    // Arrange: a 300 by 190 guide
    const f = guideFrame(300, 190, LANES, SLIDE)

    // Act
    const ys = LANES.map((r) => f.yOf(r.midi))

    // Assert: B3 at the top, G♯3 at the bottom, equal gaps between lanes
    expect(ys[3]).toBe(18)
    expect(ys[0]).toBe(172)
    expect(ys[0] - ys[1]).toBeCloseTo(ys[1] - ys[2], 9)
    expect(f.xOf(4.2)).toBe(f.x1)
    expect(f.xOf(9)).toBe(f.x1)
  })
})

describe('breathAt', () => {
  it('sets a breath mark at its moment, over the higher of the notes either side', () => {
    // Arrange: a breath where the slide comes back down, at 3.2 s
    const f = guideFrame(300, 190, LANES, SLIDE)

    // Act
    const mark = breathAt(f, SLIDE, 3.2)

    // Assert: at 3.2 s across, and above A♯3, the higher side, not A3
    expect(mark.x).toBe(f.xOf(3.2))
    expect(mark.y).toBeLessThan(f.yOf(pitchAt(SLIDE, 3.15)))
    expect(mark.y).toBeLessThan(f.yOf(57))
  })
})

describe('mountGuide', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it("writes every row's label, the highest row first down the page", () => {
    // Arrange
    const root = guideRoot()

    // Act
    mountGuide(root, { rows: LANES, path: SLIDE })

    // Assert: the box holds the labels, each placed by its depth
    expect(labels(root)).toEqual(['G♯3', 'A3', 'A♯3', 'B3'])
    const tops = Array.from(
      root.querySelectorAll<HTMLElement>('.guide-row'),
    ).map((el) => el.style.top)
    expect(tops[3]).toBe('calc(18px + 0 * (100% - 36px))')
    expect(tops[1]).toBe('calc(18px + 0.6667 * (100% - 36px))')
    expect(tops[0]).toBe('calc(18px + 1 * (100% - 36px))')
  })

  it("is busy for exactly the model's length, then rests", async () => {
    // Arrange
    const guide = mountGuide(guideRoot(), { rows: LANES, path: SLIDE })

    // Act
    const done = guide.model()
    const during = guide.busy
    vi.advanceTimersByTime(4199)
    const late = guide.busy
    vi.advanceTimersByTime(1)
    await done

    // Assert
    expect([during, late, guide.busy]).toEqual([true, true, false])
  })

  it('counts in, then sweeps the whole path, and only then rests', async () => {
    // Arrange
    const guide = mountGuide(guideRoot(), { rows: LANES, path: SLIDE })

    // Act: a one-second count-in, then the 4.2 s sweep
    const done = guide.sweep(1)
    vi.advanceTimersByTime(5199)
    const late = guide.busy
    vi.advanceTimersByTime(1)
    await done

    // Assert
    expect([late, guide.busy]).toEqual([true, false])
  })

  it('relabels the rows for a new path, as a slide an octave up does', () => {
    // Arrange
    const root = guideRoot()
    const guide = mountGuide(root, { rows: LANES, path: SLIDE })
    const up = LANES.map((r) => ({
      midi: r.midi + 12,
      label: r.label.replace('3', '4'),
    }))

    // Act
    guide.set(
      up,
      SLIDE.map((p) => ({ t: p.t, midi: p.midi + 12 })),
    )

    // Assert
    expect(labels(root)).toEqual(['G♯4', 'A4', 'A♯4', 'B4'])
  })
})
