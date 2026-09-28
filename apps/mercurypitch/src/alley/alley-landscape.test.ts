// The alley on its side, in its own picture. The portrait plate turned on its
// side was sized by the door band and left the alley's ground colour on both
// sides of a portrait strip (TestFlight 420); a screen on its side now draws
// the landscape plate, cover-fit, and its six doors have to stay whole, clear
// of the headline's column and above the dock on every screen it meets.

import { describe, expect, it } from 'vitest'
import type { AlleyFrame, DoorLayout } from './alley-geometry'
import { alleyFit, inQuad, layoutDoors, placePanelInColumn, tapBand, } from './alley-geometry'
import type { Point, Quad } from './alley-plate'
import { ALLEY_PLATE, ALLEY_PLATE_LANDSCAPE, alleyScene, DOORS, DOORS_LANDSCAPE, plateSourceFor, } from './alley-plate'

interface Screen {
  readonly w: number
  readonly h: number
  /** The safe area on its side: the status bar, the notch or island at each
   * end, the home indicator. */
  readonly safeTop: number
  readonly safeSide: number
  readonly safeBottom: number
}

const screen = (
  w: number,
  h: number,
  safeTop: number,
  safeSide: number,
  safeBottom: number,
): Screen => ({ w, h, safeTop, safeSide, safeBottom })

/**
 * Every size iOS 16 and later can give the app on its side, with the insets
 * it reports there: a notched iPhone keeps the notch's width at both ends and
 * the home indicator, and hides the status bar; an iPad keeps its status bar.
 */
const ALL_SCREENS: Record<string, Screen> = {
  'iPhone SE 2/3 and 8, 667 x 375': screen(667, 375, 0, 0, 0),
  'iPhone 8 Plus, 736 x 414': screen(736, 414, 0, 0, 0),
  'iPhone 12/13 mini, 812 x 375': screen(812, 375, 0, 50, 21),
  'iPhone 12-14, 844 x 390': screen(844, 390, 0, 47, 21),
  'iPhone 14 Pro-16, 852 x 393': screen(852, 393, 0, 59, 21),
  'iPhone 16 Pro, 874 x 402': screen(874, 402, 0, 62, 21),
  'iPhone 11 and XR, 896 x 414': screen(896, 414, 0, 48, 21),
  'iPhone 12-14 Pro Max, 926 x 428': screen(926, 428, 0, 47, 21),
  'iPhone 14 Pro Max-16 Plus, 932 x 430': screen(932, 430, 0, 59, 21),
  'iPhone 16 Pro Max, 956 x 440': screen(956, 440, 0, 62, 21),
  'iPad 9.7-inch, 1024 x 768': screen(1024, 768, 20, 0, 0),
  'iPad 10.2-inch, 1080 x 810': screen(1080, 810, 20, 0, 0),
  'iPad Air 3, 1112 x 834': screen(1112, 834, 20, 0, 0),
  'iPad mini 6, 1133 x 744': screen(1133, 744, 24, 0, 20),
  'iPad Air 4/5, 1180 x 820': screen(1180, 820, 24, 0, 20),
  'iPad Pro 11-inch, 1194 x 834': screen(1194, 834, 24, 0, 20),
  'iPad Pro 12.9-inch, 1366 x 1024': screen(1366, 1024, 24, 0, 20),
  'iPad Pro 13-inch M4, 1376 x 1032': screen(1376, 1032, 24, 0, 20),
}

/** The four screens the plate was composed for (the probe's own insets). */
const SCREENS: Record<string, Screen> = {
  '852 x 393': ALL_SCREENS['iPhone 14 Pro-16, 852 x 393'],
  '844 x 390': ALL_SCREENS['iPhone 12-14, 844 x 390'],
  '1180 x 820': ALL_SCREENS['iPad Air 4/5, 1180 x 820'],
  '1366 x 1024': ALL_SCREENS['iPad Pro 12.9-inch, 1366 x 1024'],
}

const SE = ALL_SCREENS['iPhone SE 2/3 and 8, 667 x 375']
const MINI = ALL_SCREENS['iPhone 12/13 mini, 812 x 375']

/** The rail's top: the home indicator and 8 under a 64 px band (shell.css). */
const railTop = (s: Screen): number => s.h - (s.safeBottom + 8) - 64

/**
 * The frame RoomsAlley measures on its side: the headline block's top padding
 * (the safe top and 8), its right edge (alley.css: the safe left, the card's
 * 236 and 16), the dock's top (the rail, and with a run parked the 44 px pill
 * and the dock's 8 px gap between the two), and the right safe-area inset.
 */
function frameOf(s: Screen, pill = false): Required<AlleyFrame> {
  return {
    top: s.safeTop + 8,
    bottom: railTop(s) - (pill ? 52 : 0),
    left: Math.max(16, s.safeSide) + 236 + 16,
    right: s.w - s.safeSide,
  }
}

/**
 * The pill with a run parked, as wide as it gets: "Retro Analog Studio ·
 * paused", the longest room name, measures 287 px in the bundled Inter; 300
 * leaves room for a face that sets it a little wider. 44 tall with round ends, centred in
 * the dock's row, 8 px over the rail. As its spine and radius: every point
 * within 22 px of the segment between its two end centres is the pill.
 */
const PILL_WIDTH = 300

function pillOf(s: Screen): { a: Point; b: Point; r: number } {
  const mid = railTop(s) - 8 - 22
  const half = PILL_WIDTH / 2 - 22
  return { a: [s.w / 2 - half, mid], b: [s.w / 2 + half, mid], r: 22 }
}

function toSegment(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy),
    ),
  )
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
}

const side = (o: Point, p: Point, q: Point): number =>
  (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0])

/** How far a door's quad stays from a segment: 0 where they touch. */
function quadToSegment(q: Quad, a: Point, b: Point): number {
  if (inQuad(a, q) || inQuad(b, q)) return 0
  const edges = q.map((p, i) => [p, q[(i + 1) % 4]] as const)
  for (const [c, d] of edges) {
    if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0)
      return 0
  }
  return Math.min(
    ...q.map((p) => toSegment(p, a, b)),
    ...edges.flatMap(([c, d]) => [toSegment(a, c, d), toSegment(b, c, d)]),
  )
}

const extent = (doors: DoorLayout[]) => ({
  x0: Math.min(...doors.map((d) => d.x0)),
  x1: Math.max(...doors.map((d) => d.x1)),
  y0: Math.min(...doors.map((d) => d.y0)),
  y1: Math.max(...doors.map((d) => d.y1)),
})

const sideways = (s: Screen, frame: AlleyFrame = frameOf(s)) => {
  const scene = alleyScene(s.w, s.h)
  return {
    fit: alleyFit(scene.plate, scene.doors, s.w, s.h, frame),
    doors: layoutDoors(scene.plate, scene.doors, s.w, s.h, frame),
  }
}

describe('the picture a screen gets', () => {
  it('is the landscape plate on its side, and the portrait plate upright', () => {
    expect(alleyScene(852, 393).plate).toBe(ALLEY_PLATE_LANDSCAPE)
    expect(alleyScene(852, 393).doors).toBe(DOORS_LANDSCAPE)
    expect(alleyScene(393, 852).plate).toBe(ALLEY_PLATE)
    expect(alleyScene(393, 852).doors).toBe(DOORS)
    // Square is not on its side, as `landscape()` and the CSS say.
    expect(alleyScene(800, 800).plate).toBe(ALLEY_PLATE)
    // The same object each time: a memo sees no change until a turn.
    expect(alleyScene(1366, 1024)).toBe(alleyScene(852, 393))
  })

  it('has its own pair of files, at the same 16:9 as its master', () => {
    expect(ALLEY_PLATE_LANDSCAPE.src).not.toBe(ALLEY_PLATE.src)
    expect(ALLEY_PLATE_LANDSCAPE.hi).not.toBe(ALLEY_PLATE.hi)
    expect(
      ALLEY_PLATE_LANDSCAPE.width / ALLEY_PLATE_LANDSCAPE.height,
    ).toBeCloseTo(16 / 9, 2)
  })

  it('holds the same six rooms in the same order, only measured again', () => {
    expect(DOORS_LANDSCAPE.map((d) => d.key)).toEqual(DOORS.map((d) => d.key))
    DOORS_LANDSCAPE.forEach((door, i) => {
      const { quad, ...rest } = door
      const { quad: upright, ...same } = DOORS[i]
      expect(rest).toEqual(same)
      expect(quad).not.toEqual(upright)
      // Inside the landscape master, clockwise from the top left.
      for (const [x, y] of quad) {
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(ALLEY_PLATE_LANDSCAPE.width)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThanOrEqual(ALLEY_PLATE_LANDSCAPE.height)
      }
      expect(quad[1][0]).toBeGreaterThan(quad[0][0])
      expect(quad[2][1]).toBeGreaterThan(quad[1][1])
      expect(quad[3][0]).toBeLessThan(quad[2][0])
    })
  })
})

const coverOf = (s: Screen): number =>
  Math.max(
    s.w / ALLEY_PLATE_LANDSCAPE.width,
    s.h / ALLEY_PLATE_LANDSCAPE.height,
  )

/** The first jamb and the last in the landscape master: the row's extent. */
const ROW = {
  x0: Math.min(...DOORS_LANDSCAPE.flatMap((d) => d.quad.map((p) => p[0]))),
  x1: Math.max(...DOORS_LANDSCAPE.flatMap((d) => d.quad.map((p) => p[0]))),
}

describe('the landscape plate, cover-fit', () => {
  it.each(Object.entries({ ...SCREENS, '812 x 375': MINI }))(
    'covers %s edge to edge at the cover scale',
    (_, s) => {
      const { fit } = sideways(s)
      expect(fit.scale).toBeCloseTo(coverOf(s), 9)
      // Never any ground colour: the offsets stay inside the cover's range.
      expect(fit.ox).toBeGreaterThanOrEqual(0)
      expect(fit.oy).toBeGreaterThanOrEqual(0)
      expect(fit.width - fit.ox).toBeGreaterThanOrEqual(s.w - 1e-9)
      expect(fit.height - fit.oy).toBeGreaterThanOrEqual(s.h - 1e-9)
    },
  )

  it('moves the picture only as far as the column needs, where it can', () => {
    // An iPad has width to spare: a wider column pushes the doors right of it.
    const s = SCREENS['1366 x 1024']
    const frame = { ...frameOf(s), left: frameOf(s).left + 120 }
    const { doors, fit } = sideways(s, frame)
    expect(extent(doors).x0).toBeGreaterThanOrEqual(frame.left)
    expect(fit.ox).toBeLessThan(sideways(s).fit.ox)
  })

  it('gives way to the column first, and never past the cover', () => {
    // A column this wide leaves less room than the doors need, at any size:
    // the picture keeps the cover and moves right as far as it still covers
    // the screen, and no further.
    const s = SCREENS['1180 x 820']
    const { doors, fit } = sideways(s, { ...frameOf(s), left: 700 })
    expect(fit.scale).toBeCloseTo(coverOf(s), 9)
    expect(fit.ox).toBe(0)
    expect(extent(doors).x0).toBeGreaterThan(extent(sideways(s).doors).x0)
  })

  it('draws the 1x file where a phone would not upscale it', () => {
    const file = (s: Screen, dpr: number): string =>
      plateSourceFor(sideways(s).fit.scale, dpr, ALLEY_PLATE_LANDSCAPE)
    // 852 / 1672 x 3 = 1.529: just under the 1x file's 1.531.
    expect(file(SCREENS['852 x 393'], 3)).toBe(ALLEY_PLATE_LANDSCAPE.src)
    expect(file(SCREENS['844 x 390'], 3)).toBe(ALLEY_PLATE_LANDSCAPE.src)
    // The SE's zoom, at its DPR 2: 0.419 x 2 = 0.84.
    expect(file(SE, 2)).toBe(ALLEY_PLATE_LANDSCAPE.src)
    const max = ALL_SCREENS['iPhone 14 Pro Max-16 Plus, 932 x 430']
    expect(file(max, 3)).toBe(ALLEY_PLATE_LANDSCAPE.hi)
    expect(file(SCREENS['1180 x 820'], 2)).toBe(ALLEY_PLATE_LANDSCAPE.hi)
    expect(file(SCREENS['1366 x 1024'], 2)).toBe(ALLEY_PLATE_LANDSCAPE.hi)
  })
})

describe('past cover, only where the row needs it', () => {
  it('draws 667 x 375 just large enough to put the Ear Lab right of the column', () => {
    // At cover the picture's left edge on the screen's still leaves the
    // Ear Lab's jamb 7 px under the column: the SE and the 8 zoom instead.
    const frame = frameOf(SE)
    const { fit, doors } = sideways(SE, frame)
    const zoom = (frame.left + 6) / ROW.x0
    expect(ROW.x0 * coverOf(SE)).toBeLessThan(frame.left)
    expect(fit.scale).toBeCloseTo(zoom, 12)
    // About 5% past cover, and only that.
    expect(fit.scale / coverOf(SE)).toBeGreaterThan(1.04)
    expect(fit.scale / coverOf(SE)).toBeLessThan(1.06)
    // From the picture's left edge, the first jamb on the band's slack.
    expect(fit.ox).toBe(0)
    expect(doors[0].x0).toBeCloseTo(frame.left + 6, 9)
    // The last door still clears the edge, and nothing is uncovered.
    expect(extent(doors).x1).toBeLessThanOrEqual(frame.right - 6)
    expect(fit.width - fit.ox).toBeGreaterThanOrEqual(SE.w)
    expect(fit.height - fit.oy).toBeGreaterThanOrEqual(SE.h)
  })

  it.each(Object.entries({ '812 x 375, the 12/13 mini': MINI, ...SCREENS }))(
    'leaves %s at cover: its row already clears the column',
    (_, s) => {
      const frame = frameOf(s)
      expect(ROW.x0 * coverOf(s)).toBeGreaterThan(frame.left + 6)
      expect(sideways(s, frame).fit.scale).toBe(coverOf(s))
    },
  )

  it('keeps the cover when the zoomed row would pass the right edge', () => {
    // The SE with 60 px less room on the right: the size that clears the
    // column would push the Guitar door past the edge, so no zoom at all.
    const frame = { ...frameOf(SE), right: SE.w - 60 }
    const zoom = (frame.left + 6) / ROW.x0
    expect(ROW.x1 * zoom).toBeGreaterThan(frame.right - 6)
    expect(sideways(SE, frame).fit.scale).toBe(coverOf(SE))
  })
})

describe('every opening whole, on every screen on its side', () => {
  const cases = Object.entries(ALL_SCREENS).flatMap(([name, s]) => [
    [`${name}`, s, false] as const,
    [`${name}, a run parked`, s, true] as const,
  ])

  it.each(cases)('%s', (_, s, pill) => {
    const frame = frameOf(s, pill)
    const { doors } = sideways(s, frame)
    const all = extent(doors)
    // Right of the headline's column, inside the right inset, under the
    // status bar and above the rail.
    expect(all.x0).toBeGreaterThanOrEqual(frame.left)
    expect(all.x1).toBeLessThanOrEqual(s.w - s.safeSide)
    expect(all.y0).toBeGreaterThanOrEqual(s.safeTop)
    expect(all.y1).toBeLessThanOrEqual(railTop(s))
    // Clear of the pill, round ends and all.
    if (pill) {
      const { a, b, r } = pillOf(s)
      for (const door of doors) {
        expect(quadToSegment(door.quad, a, b)).toBeGreaterThan(r)
      }
    }
    // Left to right, none over the next.
    for (let i = 1; i < doors.length; i++) {
      expect(doors[i].x0).toBeGreaterThan(doors[i - 1].x1)
    }
    // The tap band spans them, inside the screen and the right inset.
    const band = tapBand(doors, s.w, s.h, 0, frame.right)
    expect(band.x).toBeGreaterThanOrEqual(0)
    expect(band.x + band.w).toBeLessThanOrEqual(frame.right)
  })
})

describe('the card on a screen on its side', () => {
  it("takes the headline's place in the column, under the mark", () => {
    // 852 x 393: the column starts at the island's 59, the mark ends at 36.
    expect(placePanelInColumn(59, 52, 300, 140)).toEqual({ x: 59, y: 52 })
  })

  it('never sits on the dock', () => {
    // A tall card on a short screen with a run parked: lifted clear of it.
    expect(placePanelInColumn(16, 52, 180, 140)).toEqual({ x: 16, y: 28 })
    // And never above the top margin, whatever the floor.
    expect(placePanelInColumn(16, 52, 100, 140).y).toBe(16)
  })

  it.each(Object.entries(ALL_SCREENS))(
    'at %s, stays clear of every door',
    (_, s) => {
      const frame = frameOf(s, true)
      const { doors } = sideways(s, frame)
      const left = Math.max(16, s.safeSide)
      const card = placePanelInColumn(
        left,
        s.safeTop + 8 + 28 + 16,
        frame.bottom,
        140,
      )
      expect(card.x + 236).toBeLessThanOrEqual(extent(doors).x0)
      expect(card.y + 140).toBeLessThanOrEqual(frame.bottom - 12)
    },
  )
})

describe('upright, exactly as on main', () => {
  // alleyFit's portrait answers on main (b9ec9f21b), to the last bit: the
  // landscape plate and its zoom never reach a screen standing up.
  const MAIN: readonly (readonly [number, number, number, number, number])[] = [
    [375, 667, 0.4342447916666667, 50.16000000000001, 0],
    [393, 852, 0.5546875, 126, 0],
    [412, 915, 0.595703125, 135.8203125, 0],
    [430, 932, 0.6067708333333334, 137.76000000000002, 0],
    [820, 1180, 0.80078125, 0, 25],
    [1024, 1366, 1, 0, 85],
  ]

  it.each(MAIN)('fits %i x %i as it did', (w, h, scale, ox, oy) => {
    const scene = alleyScene(w, h)
    expect(scene.plate).toBe(ALLEY_PLATE)
    expect(scene.doors).toBe(DOORS)
    const fit = alleyFit(scene.plate, scene.doors, w, h)
    expect([fit.scale, fit.ox, fit.oy]).toEqual([scale, ox, oy])
  })
})
