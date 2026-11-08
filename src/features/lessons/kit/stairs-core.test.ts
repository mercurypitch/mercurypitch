// ============================================================
// Staircase core tests — new starts, and a still staircase that asks for no frames
// ============================================================
//
// The core under every staircase (Lesson 4's, and Lesson 21's on G2 or G4):
// a page hands it new starts when its octave changes, and it draws only
// while something it shows moves or has changed (frame-loop.ts, `wants`).
// The frame loop's drawer is caught here, so a test draws a frame itself;
// the browser doubles turn reduced motion on, so every move lands at once
// and the context draws nothing, unless a test lets things move.

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type * as FrameLoop from './frame-loop'
import type { Drawer } from './frame-loop'
import type * as MotionSwitch from './motion-switch'
import type { StairsCore } from './stairs-core'
import { mountStairs } from './stairs-core'

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

  it('refuses starts that run past one octave from C', () => {
    // Arrange
    const { core: c } = mount(60, 71)

    // Act and assert
    expect(() => c.setRange({ lo: 67, hi: 74 })).toThrow(/one octave from C/)
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
