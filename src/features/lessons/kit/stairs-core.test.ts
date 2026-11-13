// ============================================================
// Staircase core tests — new starts, and a still staircase that asks for no frames
// ============================================================
//
// The core under every staircase (Lesson 4's, and Lesson 21's on G2 or G4):
// a page hands it new starts when its octave changes, and it draws only
// while something it shows moves or has changed (frame-loop.ts, `wants`).
// Lesson 25's: a stair that slides a semitone without stopping a play, its
// name kept until it lands; an outlined riser; do gliding over a time of
// its own; a stair lit by a note's own `stair`; and a chord column drawn
// over the stairs, on the same canvas.
// The frame loop's drawer is caught here, so a test draws a frame itself;
// the browser doubles turn reduced motion on, so every move lands at once
// and the context draws nothing, unless a test lets things move.

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import { HARMONIC_MINOR_DEGREES, MELODIC_MINOR_UP_DEGREES, NATURAL_MINOR_DEGREES, } from './chords'
import type * as FrameLoop from './frame-loop'
import type { Drawer } from './frame-loop'
import { MAJOR_DEGREES } from './major-scale'
import type * as MotionSwitch from './motion-switch'
import type { StairsCore, StairsCoreOptions, StairsOverlay, } from './stairs-core'
import { mountStairs } from './stairs-core'
import type * as StairsDraw from './stairs-draw'
import type { StairsScene } from './stairs-draw'
import { MAJOR_FIVE, MINOR_FIVE } from './stairs-scales'

const drawers: Drawer[] = []

vi.mock('./frame-loop', async (actual) => ({
  ...(await actual<typeof FrameLoop>()),
  addDrawer: (d: Drawer) => {
    drawers.push(d)
  },
}))

// reduced motion, as the doubles set it, unless a test lets things move
let still = true
vi.mock('./motion-switch', async (actual) => ({
  ...(await actual<typeof MotionSwitch>()),
  reducedMotion: () => still,
}))

// the scene each frame paints, for the tests that read what it shows
const painted = vi.hoisted(() => ({ scene: null as StairsScene | null }))

vi.mock('./stairs-draw', async (actual) => {
  const real = await actual<typeof StairsDraw>()
  return {
    ...real,
    paintStairs: (...args: Parameters<typeof real.paintStairs>) => {
      painted.scene = args[2]
      real.paintStairs(...args)
    },
  }
})

let core: StairsCore | null = null

function mount(lo: number, hi: number): { core: StairsCore; drawer: Drawer } {
  const canvas = document.createElement('canvas')
  document.body.replaceChildren(canvas)
  core = mountStairs({
    canvas,
    compact: false,
    active: () => true,
    range: { lo, hi },
  })
  const drawer = drawers[drawers.length - 1]
  return { core, drawer }
}

afterEach(() => {
  core?.stop()
  core = null
  still = true
  vi.useRealTimers()
})

describe('setRange', () => {
  it('stands on the new lowest start at once and keeps a slide within the new starts', () => {
    // Arrange: Lesson 21's lower voice, G2
    const { core: c } = mount(43, 43)

    // Act: the higher voice's G4
    c.setRange({ lo: 67, hi: 67 })
    c.setTonic(60)

    // Assert
    expect(c.tonic).toBe(67)
  })

  it("stands at once on the start it is given, with no slide up from the lowest (Lesson 20's Step 2, opening on C)", () => {
    // Arrange: motion on, Step 1's starts
    still = false
    const { core: c, drawer } = mount(48, 59)
    drawer.draw(0, 0.016)

    // Act: Step 2's starts, A2 to C3, standing on C3
    c.setRange({ lo: 45, hi: 48 }, 48)
    drawer.draw(0, 0.016)

    // Assert: on C3, and nothing left to travel
    expect(c.tonic).toBe(48)
    expect(drawer.wants?.()).toBe(false)
  })

  it('refuses starts that run past one octave from C', () => {
    // Arrange
    const { core: c } = mount(60, 71)

    // Act and assert
    expect(() => c.setRange({ lo: 67, hi: 74 })).toThrow(/one octave from C/)
  })
})

describe("another scale's stairs (Lesson 20)", () => {
  it('draws the stairs it is given, and others at once when they change, asking for a frame', () => {
    // Arrange: the major scale on C3
    const { core: c, drawer } = mount(48, 59)
    drawer.draw(0, 0.016)
    const eight = c.layout?.stairs.length

    // Act: fa and ti left out
    c.setDegrees(MAJOR_FIVE)
    const asked = drawer.wants?.()
    drawer.draw(0, 0.016)

    // Assert
    expect([eight, asked, c.layout?.stairs.length]).toEqual([8, true, 6])
    expect(c.degrees).toEqual(MAJOR_FIVE)
  })

  it("takes Step 2's starts, A2 and C3 over C2, and stands the minor five on A2", () => {
    // Arrange: Step 1's starts
    const { core: c, drawer } = mount(48, 59)

    // Act
    c.setRange({ lo: 45, hi: 48 })
    c.setDegrees(MINOR_FIVE)
    c.setTonic(45)
    drawer.draw(0, 0.016)

    // Assert: the top do, A3, on its own row
    const L = c.layout
    expect(c.tonic).toBe(45)
    expect(L?.stairs[5].top).toBeCloseTo(
      (L?.yOfRow(57) ?? 0) - (L?.rowH ?? 0) / 2,
      9,
    )
  })

  it('stops what plays when its stairs change', async () => {
    // Arrange
    const { core: c } = mount(48, 59)
    const played = c.play([{ midi: 48, at: 0, dur: 5 }], false)

    // Act
    c.setDegrees(MAJOR_FIVE)

    // Assert: the run resolves at once, and the staircase is free
    await played
    expect(c.busy).toBe(false)
  })
})

describe('a still staircase', () => {
  it('asks for a frame at first, and none once drawn with nothing moving', () => {
    // Arrange
    const { drawer } = mount(60, 71)
    const first = drawer.wants?.()

    // Act
    drawer.draw(0, 0.016)

    // Assert
    expect(first).toBe(true)
    expect(drawer.wants?.()).toBe(false)
  })

  it('asks again for each change: a switch, a slide or new starts', () => {
    // Arrange
    const { core: c, drawer } = mount(60, 71)
    drawer.draw(0, 0.016)

    // Act and assert
    c.set({ group: true })
    expect(drawer.wants?.()).toBe(true)
    drawer.draw(0, 0.016)
    expect(drawer.wants?.()).toBe(false)
    c.setTonic(62)
    expect(drawer.wants?.()).toBe(true)
    drawer.draw(0, 0.016)
    c.setRange({ lo: 48, hi: 59 })
    expect(drawer.wants?.()).toBe(true)
  })

  it('keeps asking while a switch eases in, and rests once it has', () => {
    // Arrange: motion on, so Group's brackets fade in over a quarter second
    still = false
    const { core: c, drawer } = mount(60, 71)
    drawer.draw(0, 0.016)

    // Act
    c.set({ group: true })
    drawer.draw(0, 0.05)
    const easing = drawer.wants?.()
    for (let i = 0; i < 10; i++) drawer.draw(0, 0.05)

    // Assert
    expect(easing).toBe(true)
    expect(drawer.wants?.()).toBe(false)
  })

  it('draws one more frame after a key has faded, so the last frame shows it at rest', () => {
    // Arrange: a note's key pulses for 0.7 s after it starts
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
    const { core: c, drawer } = mount(60, 71)
    void c.play([{ midi: 60, at: 0, dur: 0.35 }], false)
    vi.advanceTimersByTime(690)

    // Act: a frame as the pulse all but ends, and the next asked just after it has
    drawer.draw(0, 0.016)
    vi.advanceTimersByTime(20)

    // Assert
    expect(drawer.wants?.()).toBe(true)
  })

  it('keeps asking while a run lights its stairs, and rests once the last light fades', () => {
    // Arrange: the lights are timed on the page's clock
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
    const { core: c, drawer } = mount(60, 71)
    drawer.draw(0, 0.016)

    // Act: a frame drawn as the run starts leaves its light still to come
    void c.play([{ midi: 60, at: 0, dur: 0.35 }], false)
    drawer.draw(0, 0.016)
    const during = drawer.wants?.()
    vi.advanceTimersByTime(1500)
    drawer.draw(0, 0.016)

    // Assert
    expect(during).toBe(true)
    expect(drawer.wants?.()).toBe(false)
  })
})

describe('a staircase of fewer stairs', () => {
  it('lays out and draws five stairs, do to so, and lights them as a run plays', () => {
    // Arrange: Lesson 16's, on G4, with things allowed to move so every part draws
    still = false
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
    const canvas = document.createElement('canvas')
    document.body.replaceChildren(canvas)
    core = mountStairs({
      canvas,
      compact: false,
      active: () => true,
      range: { lo: 67, hi: 67 },
      names: () => 'solfege',
      count: 5,
    })
    const drawer = drawers[drawers.length - 1]
    core.set({ steps: true, home: true })

    // Act: do to so, each stair lit as it sounds
    void core.play(
      [67, 69, 71, 72, 74].map((midi, i) => ({ midi, at: i * 0.6, dur: 0.5 })),
      false,
    )
    const frames = (): void => {
      for (let i = 0; i < 4; i++) drawer.draw(0, 0.05)
    }
    frames()
    vi.advanceTimersByTime(1300)

    // Assert
    expect(frames).not.toThrow()
    expect(core.layout?.stairs).toHaveLength(5)
    expect(core.layout?.brackets).toEqual([])
  })
})

describe("a stair that slides (Lesson 25's Raise te and Raise le)", () => {
  /** Lesson 25's steps' staircase for the lower voice: A minor on A2, rows A2 to C4, at 420 x 280. */
  function mountMinor(more: Partial<StairsCoreOptions> = {}): {
    core: StairsCore
    drawer: Drawer
  } {
    const canvas = document.createElement('canvas')
    canvas.getBoundingClientRect = () =>
      ({ x: 0, y: 0, top: 0, left: 0, width: 420, height: 280 }) as DOMRect
    document.body.replaceChildren(canvas)
    core = mountStairs({
      canvas,
      compact: true,
      active: () => true,
      range: { lo: 45, hi: 48 },
      degrees: NATURAL_MINOR_DEGREES,
      room: { right: 104, rows: { lo: 45, hi: 60 } },
      ...more,
    })
    return { core, drawer: drawers[drawers.length - 1] }
  }

  /** The te stair's tread, px. */
  const teTop = (c: StairsCore): number => c.layout?.stairs[6].top ?? NaN

  it('slides te up to ti without stopping what plays', () => {
    // Arrange
    const { core: c } = mountMinor()
    void c.play([{ midi: 45, at: 0, dur: 5 }], false)

    // Act
    c.slideDegrees(HARMONIC_MINOR_DEGREES)

    // Assert
    expect(c.busy).toBe(true)
    expect(c.degrees).toEqual(HARMONIC_MINOR_DEGREES)
  })

  it('moves the stair partway, keeping its name, then lands it a row higher named ti, asking for frames until it has', () => {
    // Arrange: motion on, the staircase drawn
    still = false
    const { core: c, drawer } = mountMinor()
    drawer.draw(0, 0.016)
    const from = teTop(c)

    // Act: a fifth of a second into the 0.4 s slide, then past its end
    c.slideDegrees(HARMONIC_MINOR_DEGREES)
    drawer.draw(0, 0.2)
    const mid = teTop(c)
    const midNames = painted.scene?.named
    const asking = drawer.wants?.()
    for (let i = 0; i < 3; i++) drawer.draw(0, 0.1)

    // Assert
    const rise = from - teTop(c)
    expect(rise).toBeCloseTo(c.layout?.rowH ?? NaN, 9)
    expect((from - mid) / rise).toBeGreaterThan(0)
    expect((from - mid) / rise).toBeLessThan(1)
    expect(midNames).toEqual(NATURAL_MINOR_DEGREES)
    expect(asking).toBe(true)
    expect(painted.scene?.named).toEqual(HARMONIC_MINOR_DEGREES)
    expect(drawer.wants?.()).toBe(false)
  })

  it('lands at once under reduced motion', () => {
    // Arrange
    const { core: c, drawer } = mountMinor()
    drawer.draw(0, 0.016)

    // Act: Raise le, melodic minor going up
    c.slideDegrees(MELODIC_MINOR_UP_DEGREES)
    drawer.draw(0, 0.016)

    // Assert
    expect(painted.scene?.degrees).toEqual(MELODIC_MINOR_UP_DEGREES)
    expect(painted.scene?.named).toEqual(MELODIC_MINOR_UP_DEGREES)
    expect(drawer.wants?.()).toBe(false)
  })

  it('refuses stairs of another count: a slide keeps the staircase', () => {
    // Arrange
    const { core: c } = mountMinor()

    // Act and assert
    expect(() => c.slideDegrees(MAJOR_FIVE)).toThrow(/keeps the stairs/)
  })

  it('outlines a riser and takes it away, asking for a frame each time', () => {
    // Arrange
    const { core: c, drawer } = mountMinor({ degrees: HARMONIC_MINOR_DEGREES })
    drawer.draw(0, 0.016)

    // Act
    c.setOutline({ riser: 5, label: '3' })
    const askedOn = drawer.wants?.()
    drawer.draw(0, 0.016)
    const shown = painted.scene?.outline
    c.setOutline(null)
    const askedOff = drawer.wants?.()
    drawer.draw(0, 0.016)

    // Assert
    expect([askedOn, askedOff]).toEqual([true, true])
    expect(shown).toEqual({ riser: 5, label: '3' })
    expect(painted.scene?.outline).toBeNull()
  })

  it("glides do over the time it is given: Step 4's house, C3 down to A2 in 0.6 s", () => {
    // Arrange: C major on C3, landed
    still = false
    const { core: c, drawer } = mountMinor({ degrees: MAJOR_DEGREES })
    c.setTonic(48)
    for (let i = 0; i < 5; i++) drawer.draw(0, 0.1)

    // Act: 0.4 s into the glide, past Lesson 4's 0.32 s, then past 0.6 s
    c.setTonic(45, 0.6)
    drawer.draw(0, 0.4)
    const gliding = drawer.wants?.()
    drawer.draw(0, 0.25)

    // Assert
    expect(gliding).toBe(true)
    expect(c.tonic).toBe(45)
    expect(drawer.wants?.()).toBe(false)
  })

  it("lights the stair a note names though its note is off the stairs: melodic minor's G on the way down", () => {
    // Arrange: melodic minor going up, its te stair on G sharp 3
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
    const { core: c, drawer } = mountMinor({
      degrees: MELODIC_MINOR_UP_DEGREES,
    })
    drawer.draw(0, 0.016)

    // Act: G3 alone, then G3 naming te's stair
    void c.play([{ midi: 55, at: 0, dur: 0.5 }], false)
    drawer.draw(0, 0.016)
    const alone = painted.scene?.light(6)
    void c.play([{ midi: 55, at: 0, dur: 0.5, stair: 6 }], false)
    drawer.draw(0, 0.016)

    // Assert
    expect(alone).toBeNull()
    expect(painted.scene?.light(6)?.amount).toBe(1)
  })

  it('paints an overlay over the stairs on the same frame, and draws on while it moves', () => {
    // Arrange: an overlay that keeps where the stairs end
    let moving = true
    const ends: number[] = []
    const overlay: StairsOverlay = {
      paint: (_ctx, layout) => {
        ends.push(layout.x1)
      },
      moving: () => moving,
    }
    const { core: c, drawer } = mountMinor({ overlay })

    // Act
    drawer.draw(0, 0.016)
    const asking = drawer.wants?.()
    moving = false
    drawer.draw(0, 0.016)

    // Assert: in the room the staircase leaves, 104 px and its margin from the right
    expect(ends).toEqual([420 - 6 - 104, 420 - 6 - 104])
    expect(c.layout?.x1).toBe(310)
    expect(asking).toBe(true)
    expect(drawer.wants?.()).toBe(false)
  })
})
