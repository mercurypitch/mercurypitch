import { createRoot, createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LANTERN_VIEW_H, LANTERN_VIEW_W } from './lantern-geometry'
import type { StageLayout } from './stage-layout'
import { BESIDE_X, createLayoutGlide, GLIDE_MS, layoutStage, MERC_UNITS, } from './stage-layout'

// The stages of three phones in the hold: 360 x 640, 390 x 844, 430 x 932.
const PHONES = [
  [360, 253],
  [390, 373],
  [430, 461],
] as const

const middle = (layout: StageLayout): number =>
  layout.left + (LANTERN_VIEW_W / 2) * layout.k
/** Where Merc's canvas beside the lantern ends, px from the stage's left. */
const mercRight = (layout: StageLayout): number =>
  layout.left + (BESIDE_X + MERC_UNITS / 2) * layout.k

describe('layoutStage', () => {
  it('stands the lantern in the middle while Merc is in the glass', () => {
    for (const [w, h] of PHONES) {
      expect(middle(layoutStage(w, h, 0))).toBeCloseTo(w / 2, 6)
    }
  })

  it('moves it over beside Merc only as far as his canvas needs', () => {
    for (const [w, h] of PHONES) {
      const inside = layoutStage(w, h, 0)
      const beside = layoutStage(w, h, 1)
      // One size in both places: only the lantern's place changes.
      expect(beside.k).toBe(inside.k)
      expect(beside.top).toBe(inside.top)
      expect(mercRight(beside)).toBeLessThanOrEqual(w - 2 + 1e-9)
      // Either centred already, or his canvas ends right at the edge.
      const centred = Math.abs(middle(beside) - w / 2) < 1e-9
      const atEdge = Math.abs(mercRight(beside) - (w - 2)) < 1e-9
      expect(centred || atEdge).toBe(true)
    }
    // A 360 phone has the room to keep it in the middle.
    expect(middle(layoutStage(360, 253, 1))).toBeCloseTo(180, 6)
  })

  it('makes the lantern as tall as the stage allows, 430 phones included', () => {
    // Review of pass 3: at 430 x 932 the lantern had shrunk by 11% to make
    // room for Merc. The height decides again; the painted lantern (10
    // units in from its box) keeps 8 px from the left edge.
    for (const [w, h] of PHONES) {
      const layout = layoutStage(w, h, 1)
      expect(layout.k).toBeCloseTo((h * 0.96) / LANTERN_VIEW_H, 6)
      expect(layout.left + 10 * layout.k).toBeGreaterThanOrEqual(8)
      expect(layout.top).toBeCloseTo(h - LANTERN_VIEW_H * layout.k, 6)
    }
  })
})

describe('createLayoutGlide', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  /** A glide over a target the test moves, with frames run by hand. */
  function glide(): {
    shown: () => StageLayout
    place: (aside: number) => void
    frame: () => void
    dispose: () => void
  } {
    vi.useFakeTimers({ toFake: ['performance'] })
    const queue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      queue.push(cb)
      return queue.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
    return createRoot((dispose) => {
      const [aside, setAside] = createSignal(1)
      const shown = createLayoutGlide(() => layoutStage(430, 461, aside()))
      return {
        shown,
        place: setAside,
        frame: () => {
          vi.advanceTimersByTime(1000 / 60)
          for (const cb of queue.splice(0)) cb(performance.now())
        },
        dispose,
      }
    })
  }

  it('glides the lantern to the middle as Merc hops in, never jumping', () => {
    // Arrange
    const room = glide()
    const from = room.shown().left
    const to = layoutStage(430, 461, 0).left

    // Act: he hops into the glass; the frames run for a hop and a half.
    room.place(0)
    const lefts = [room.shown().left]
    for (let i = 0; i < Math.ceil((GLIDE_MS * 1.5 * 60) / 1000); i++) {
      room.frame()
      lefts.push(room.shown().left)
    }

    // Assert: it starts where it stood, ends in the middle, and no frame
    // moves it more than a smoothstep's steepest step (1.5 x the even one).
    expect(to - from).toBeGreaterThan(40)
    expect(lefts[0]).toBe(from)
    expect(lefts[lefts.length - 1]).toBe(to)
    const most = (1.5 * (to - from) * (1000 / 60)) / GLIDE_MS
    for (let i = 1; i < lefts.length; i++) {
      expect(lefts[i] - lefts[i - 1]).toBeGreaterThanOrEqual(0)
      expect(lefts[i] - lefts[i - 1]).toBeLessThanOrEqual(most + 1e-9)
    }
    room.dispose()
  })

  it('lands at once under reduced motion, as his hop does', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduce'),
    }))
    const room = glide()
    room.place(0)
    expect(room.shown().left).toBe(layoutStage(430, 461, 0).left)
    room.dispose()
  })
})
