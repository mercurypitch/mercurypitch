// ============================================================
// Lesson 10 chord layout tests — 44 px targets, none overlapping, at every width
// ============================================================
//
// WEB-SPEC, Tests 6 (FACTS 82): at every width every bead target and gap
// button is at least 44 px each way and none overlaps another; the full
// figure is 340 px tall; the compact layout fits 150 px with the same
// targets and is the one drawn below 340 px; the gap buttons' centres sit
// 52.5 px apart. FACTS 82's figure is 310 px wide on a 344 px page and 651
// px on a 1440 px one, and a phone's spans its card up to 960 px, so every
// figure width from 310 to 1440 px holds every page from 344 to 1440 px:
// each test walks all of them, in every state, on every root, in both
// qualities and in both layouts.

import { describe, expect, it } from 'vitest'
import type { Rect } from '@/features/lessons/kit/tune-line-layout'
import { MIN_TARGET, overlaps } from '@/features/lessons/kit/tune-line-layout'
import type { BeadState, ChordLayout } from './chord-layout'
import { chordLayout, FULL_H, modeFor, targetsOf } from './chord-layout'
import type { Quality } from './chords'
import { QUALITIES, ROOTS, scaleOf, thirdOf, triad, WINDOW } from './chords'

/** Every figure width from the 344 px page's 310 px to 1440 px. */
const WIDTHS = Array.from({ length: 1440 - 310 + 1 }, (_, i) => 310 + i)
/** The compact layout's heights: the kit's floor, 844 x 390's figure, the last below 340 (FACTS 82). */
const COMPACT_HEIGHTS = [150, 162, 339]
const HEIGHTS = [...COMPACT_HEIGHTS, FULL_H]

type Shown = 'third' | 'chord' | 'scale'

/** What each state can show (WEB-SPEC, Toys 1): Step 2 opens on Step 1's two beads; Step 5 and free play spread. */
const SHOWS: Readonly<Record<BeadState, readonly Shown[]>> = {
  thirds: ['third'],
  stack: ['third', 'chord'],
  slide: ['chord'],
  pattern: ['chord'],
  scale: ['chord', 'scale'],
  free: ['chord', 'scale'],
}
const STATES = Object.keys(SHOWS) as BeadState[]

const notesOf = (shown: Shown, root: number, q: Quality): number[] =>
  (shown === 'third'
    ? thirdOf(root, q)
    : shown === 'chord'
      ? triad(root, q)
      : scaleOf(root, q)
  ).map((n) => n.midi)

interface Case {
  readonly label: string
  readonly notes: readonly number[]
}

/** Every chord a state shows, on every white-key root and in both qualities. */
function casesOf(state: BeadState): Case[] {
  return SHOWS[state].flatMap((shown) =>
    ROOTS.flatMap((root) =>
      QUALITIES.map((q) => ({
        label: `${shown} ${root} ${q}`,
        notes: notesOf(shown, root, q),
      })),
    ),
  )
}

/** Each layout of a state at every width and height, with a label for a failure. */
function* every(
  state: BeadState,
  heights: readonly number[] = HEIGHTS,
): Generator<{ at: string; L: ChordLayout }> {
  for (const c of casesOf(state))
    for (const height of heights)
      for (const width of WIDTHS)
        yield {
          at: `${c.label} at ${width} x ${height}`,
          L: chordLayout({ width, height, state, notes: c.notes }),
        }
}

const inside = (r: Rect, W: number, H: number): boolean =>
  r.x >= -0.001 &&
  r.y >= -0.001 &&
  r.x + r.w <= W + 0.001 &&
  r.y + r.h <= H + 0.001

const clash = (rs: readonly Rect[]): boolean =>
  rs.some((a, i) => rs.some((b, j) => j > i && overlaps(a, b)))

const centreY = (r: Rect): number => r.y + r.h / 2

describe('chordLayout: Tests 6', () => {
  it.each(STATES)(
    '%s: every target is at least 44 px each way and on the figure, at every width',
    (state) => {
      // Arrange
      const bad: string[] = []

      // Act
      for (const { at, L } of every(state))
        for (const r of targetsOf(L)) {
          if (r.w < MIN_TARGET - 0.001 || r.h < MIN_TARGET - 0.001)
            bad.push(`${at}: ${r.w} x ${r.h}`)
          if (!inside(r, L.width, L.height)) bad.push(`${at}: off the figure`)
        }

      // Assert
      expect(bad).toEqual([])
    },
  )

  it.each(STATES)('%s: no two targets overlap, at every width', (state) => {
    // Arrange
    const bad: string[] = []

    // Act
    for (const { at, L } of every(state)) if (clash(targetsOf(L))) bad.push(at)

    // Assert
    expect(bad).toEqual([])
  })

  it('draws the full figure 340 px tall: C4 to F♯5 at 15 px a semitone, 22 px above and below, and the 26 px strip', () => {
    // Arrange
    const bad: string[] = []

    // Act
    for (const { at, L } of every('slide', [FULL_H])) {
      const rows = [L.yOf(WINDOW.hi) - L.top, L.yOf(WINDOW.lo) - L.top]
      const strip = L.strip === null ? null : [L.strip.y, L.strip.h]
      if (L.mode !== 'full' || L.used !== 340) bad.push(`${at}: ${L.used}`)
      if (rows.join() !== '22,292') bad.push(`${at}: rows ${rows.join()}`)
      if (strip?.join() !== '314,26') bad.push(`${at}: strip ${strip?.join()}`)
    }

    // Assert
    expect(FULL_H).toBe(340)
    expect(bad).toEqual([])
  })

  it.each(STATES)(
    '%s: the compact layout fits 150 px, its rows and targets at full size, everything inside it',
    (state) => {
      // Arrange
      const bad: string[] = []

      // Act
      for (const { at, L } of every(state, COMPACT_HEIGHTS)) {
        const scale = L.stairs.length > 0
        const want = scale ? [148, 9] : [149, 15]
        if (L.mode !== 'compact' || [L.used, L.row].join() !== want.join())
          bad.push(`${at}: ${L.mode} ${L.used} px, rows ${L.row} px`)
        const drawn = [
          ...targetsOf(L),
          ...L.names,
          ...L.stairs,
          ...(L.bracket === null ? [] : [L.bracket]),
          ...(L.strip === null ? [] : [L.strip]),
        ]
        const box = (r: Rect): boolean =>
          r.y >= L.top - 0.001 && r.y + r.h <= L.top + L.used + 0.001
        if (L.used > 150 || !drawn.every(box)) bad.push(`${at}: outside`)
      }

      // Assert
      expect(bad).toEqual([])
    },
  )

  it('chooses the compact layout below 340 px and the full one from 340 px, at every height and width', () => {
    // Arrange
    const notes = notesOf('chord', 60, 'major')
    const bad: string[] = []

    // Act
    for (let height = 150; height <= 900; height++) {
      const want = height < 340 ? 'compact' : 'full'
      const L = chordLayout({ width: 356, height, state: 'slide', notes })
      if (L.mode !== want || modeFor(height) !== want) bad.push(`h ${height}`)
    }
    for (const width of WIDTHS) {
      const below = chordLayout({ width, height: 339, state: 'slide', notes })
      const at = chordLayout({ width, height: 340, state: 'slide', notes })
      if (below.mode !== 'compact' || at.mode !== 'full') bad.push(`w ${width}`)
    }

    // Assert
    expect(bad).toEqual([])
  })

  it("sits the gap buttons' centres 52.5 px apart in either quality, at every width, in both layouts", () => {
    // Arrange
    const bad: string[] = []

    // Act
    for (const state of ['stack', 'slide', 'free'] as const)
      for (const { at, L } of every(state)) {
        if (L.gaps.length !== 2) continue
        const apart = centreY(L.gaps[0]) - centreY(L.gaps[1])
        if (Math.abs(apart - 52.5) > 1e-9) bad.push(`${at}: ${apart}`)
      }

    // Assert
    expect(bad).toEqual([])
  })
})

describe('chordLayout: the scale', () => {
  it('makes no stair a target: the eight stairs share the width, 38.75 px each on the 310 px figure', () => {
    // Arrange
    const bad: string[] = []

    // Act
    for (const state of ['scale', 'free'] as const)
      for (const { at, L } of every(state)) {
        if (L.stairs.length === 0) continue
        if (targetsOf(L).length > 0) bad.push(`${at}: a stair is a target`)
        const w = L.width / 8
        const columns = L.stairs.every(
          (s, i) => Math.abs(s.w - w) < 1e-9 && Math.abs(s.x - i * w) < 1e-9,
        )
        if (!columns) bad.push(`${at}: the stairs do not share the width`)
      }
    const narrowest = chordLayout({
      width: 310,
      height: FULL_H,
      state: 'scale',
      notes: notesOf('scale', 60, 'major'),
    })

    // Assert
    expect(bad).toEqual([])
    expect(narrowest.stairs[0].w).toBeCloseTo(38.8, 1)
  })

  it('puts the octave on the lowest 12 rows, 180 px, root on the lowest whatever the root; compact rows close to 9 px', () => {
    // Arrange
    const bad: string[] = []

    // Act
    for (const { at, L } of every('free')) {
      if (L.stairs.length === 0) continue
      const root = L.stairs[0]
      const span = root.y - L.stairs[7].y
      const want =
        L.mode === 'full'
          ? { root: 292, span: 180, foot: 314 }
          : { root: 128, span: 108, foot: 148 }
      const got = {
        root: root.y - L.top,
        span,
        foot: root.y + root.h - L.top,
      }
      if (JSON.stringify(got) !== JSON.stringify(want))
        bad.push(`${at}: ${JSON.stringify(got)}`)
    }

    // Assert
    expect(bad).toEqual([])
  })
})

describe('chordLayout: the parts', () => {
  it('fits the bracket, names, beads and gap buttons left to right on the narrowest figure, 310 px', () => {
    // Arrange
    const notes = notesOf('chord', 71, 'minor')

    // Act
    const L = chordLayout({ width: 310, height: FULL_H, state: 'free', notes })

    // Assert
    const bracket = L.bracket as Rect
    const [name] = L.names
    const [bead] = L.beads
    const [gap] = L.gaps
    expect([bracket.w, name.w, bead.w, gap.w]).toEqual([60, 56, 44, 120])
    expect(bracket.x).toBeGreaterThanOrEqual(0)
    expect(name.x).toBeGreaterThan(bracket.x + bracket.w)
    expect(bead.x).toBeGreaterThan(name.x + name.w)
    expect(gap.x).toBeGreaterThan(bead.x + bead.w)
    expect(gap.x + gap.w - bracket.x).toBeCloseTo(300, 9)
    expect(gap.x + gap.w).toBeLessThanOrEqual(310)
  })

  it('shows each part only where the spec draws it: gaps in Steps 1 to 3 and free play, the bracket in Steps 2 to 4 and free play, the strip in Steps 1 to 4', () => {
    // Arrange
    const triadOn = notesOf('chord', 60, 'major')
    const parts = (state: BeadState): string => {
      const L = chordLayout({ width: 356, height: 340, state, notes: triadOn })
      return [
        `beads ${L.beads.length}`,
        `gaps ${L.gaps.length}`,
        L.bracket === null ? 'no bracket' : 'bracket',
        L.strip === null ? 'no strip' : 'strip',
      ].join(', ')
    }

    // Act
    const shown = Object.fromEntries(
      (['stack', 'slide', 'pattern', 'scale', 'free'] as const).map((s) => [
        s,
        parts(s),
      ]),
    )
    const third = chordLayout({
      width: 356,
      height: 340,
      state: 'thirds',
      notes: notesOf('third', 60, 'minor'),
    })

    // Assert
    expect(shown).toEqual({
      stack: 'beads 3, gaps 2, bracket, strip',
      slide: 'beads 3, gaps 2, bracket, strip',
      pattern: 'beads 3, gaps 0, bracket, strip',
      scale: 'beads 3, gaps 0, no bracket, no strip',
      free: 'beads 3, gaps 2, bracket, no strip',
    })
    expect([third.beads.length, third.gaps.length, third.bracket]).toEqual([
      2,
      1,
      null,
    ])
    expect(third.strip).not.toBeNull()
  })

  it.each(STATES)(
    '%s: no name, bracket or strip overlaps another or a target, at every width',
    (state) => {
      // Arrange
      const bad: string[] = []

      // Act
      for (const { at, L } of every(state)) {
        const marks = [
          ...L.names,
          ...(L.bracket === null ? [] : [L.bracket]),
          ...(L.strip === null ? [] : [L.strip]),
        ]
        const hitsTarget = marks.some((m) =>
          targetsOf(L).some((t) => overlaps(m, t)),
        )
        if (clash(marks) || hitsTarget) bad.push(at)
        if (!marks.every((m) => inside(m, L.width, L.height)))
          bad.push(`${at}: off the figure`)
      }

      // Assert
      expect(bad).toEqual([])
    },
  )

  it('keeps the compact window on the chord: a slide renames the rows and leaves every bead in place', () => {
    // Arrange
    const at = (root: number): string => {
      const L = chordLayout({
        width: 778,
        height: 162,
        state: 'slide',
        notes: notesOf('chord', root, 'minor'),
      })
      return JSON.stringify({ beads: L.beads, gaps: L.gaps, top: L.yOf(L.hi) })
    }

    // Act
    const drawn = ROOTS.map(at)

    // Assert
    expect(new Set(drawn).size).toBe(1)
  })

  it('moves the chord up the full window as the root slides, from C4 to B4, whose fifth is the top row', () => {
    // Arrange
    const L = (root: number): ChordLayout =>
      chordLayout({
        width: 356,
        height: 340,
        state: 'slide',
        notes: notesOf('chord', root, 'major'),
      })

    // Act
    const c = L(60)
    const b = L(71)

    // Assert
    expect(c.beads[0].y + 22 - c.top).toBe(292)
    expect(b.beads[2].y + 22 - b.top).toBe(22)
  })

  it('refuses a scale outside Step 5 and free play, and two notes after Step 2', () => {
    // Arrange
    const scale = notesOf('scale', 60, 'major')
    const pair = notesOf('third', 60, 'major')

    // Act
    const spread = (): ChordLayout =>
      chordLayout({ width: 356, height: 340, state: 'slide', notes: scale })
    const two = (): ChordLayout =>
      chordLayout({ width: 356, height: 340, state: 'pattern', notes: pair })

    // Assert
    expect(spread).toThrow(/8 notes/)
    expect(two).toThrow(/2 notes/)
  })
})
