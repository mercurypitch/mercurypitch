// ============================================================
// Lesson spiral frames — the spiral asks the frame loop only for what moves
// ============================================================
//
// The spiral on the page's frame loop, run by hand (`handLoop`): it paints
// its first frame, then asks for none until something it shows changes or
// moves. A tap's flash and its bead's name, the camera's move over the axis
// and the drift ask for every frame they move in, and no more; a change at
// rest paints once; a change no wake told it of paints at the next input; a
// canvas with no room asks for nothing. A page's overlay asks for frames
// through `overlayWants`, and an overlay or keys layer that says nothing of
// its frames keeps them coming, as Lesson 2's copies always have.

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type { HandLoop } from './frame-loop.test-fixtures'
import { handLoop } from './frame-loop.test-fixtures'
import type { Spiral, SpiralOptions } from './spiral'
import type { BeadHit, KeysLayer } from './spiral-draw'

/** The lowest bead, A2: a bead's `s` counts semitones from it. */
const A2 = 45
const A3 = 57
const A4 = 69
const C_SHARP_4 = 61
const B_FLAT_4 = 70

/** The screen's pixel ratio as jsdom has it, put back after a test changes it. */
const RATIO = window.devicePixelRatio

interface OnLoop extends HandLoop {
  readonly spiral: Spiral
  readonly root: HTMLElement
  readonly canvas: HTMLCanvasElement
  /** How many frames the spiral has painted since it mounted. */
  readonly painted: () => number
}

/**
 * A spiral on screen on the page's frame loop, run by hand, under reduced
 * motion as `reduce` says (default on): its canvas, readout and a key for
 * A4, loaded afresh over the loop, its paints counted from before its first
 * frame. It has not drawn yet.
 */
async function onLoop(
  opts: SpiralOptions = {},
  reduce = true,
): Promise<OnLoop> {
  const hand = await handLoop(reduce)
  const { mountSpiral } = await import('./spiral')
  const root = document.createElement('div')
  root.innerHTML = `<canvas></canvas><b data-spiral-readout></b><button type="button" data-key="${A4}">A4</button>`
  document.body.appendChild(root)
  const canvas = root.querySelector('canvas')
  if (canvas === null) throw new Error('no canvas')
  const painted = hand.paints(canvas)
  const spiral = mountSpiral(root, opts)
  hand.see(root)
  return { ...hand, spiral, root, canvas, painted }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.stubGlobal('devicePixelRatio', RATIO)
  document.body.textContent = ''
})

describe("the spiral on the page's frame loop", () => {
  it('paints its first frame, then asks for none, and paints nothing in a frame another drawer asks for', async () => {
    // Arrange: Lesson 1's spiral, with no drawing of the page's own
    const { asked, loop, settle, painted } = await onLoop()
    settle()
    const first = painted()
    const resting = asked.length

    // Act: another drawer's frame
    loop.wake()
    settle()

    // Assert
    expect(first).toBe(1)
    expect(resting).toBe(0)
    expect(painted()).toBe(1)
  })

  it("asks for every frame of a tap's flash and its bead's name, then for none", async () => {
    // Arrange: a page's marks that hold still, saying where the beads landed
    let beads: readonly BeadHit[] = []
    let drawnAt = 0
    const { asked, canvas, settle } = await onLoop({
      overlay: (f) => {
        beads = f.beads
        drawnAt = f.now
      },
      overlayWants: () => false,
    })
    settle()
    const bead = beads.find((b) => b.s === A3 - A2)
    if (bead === undefined) throw new Error('no bead drawn for A3')
    const at = { clientX: bead.x, clientY: bead.y }
    const tapped = performance.now()

    // Act: a tap on A3, and every frame the page asks for after it
    canvas.dispatchEvent(new MouseEvent('pointerdown', at))
    canvas.dispatchEvent(new MouseEvent('pointerup', at))
    const frames = settle()

    // Assert: the name shows for 1.8 s, outlasting the 0.7 s flash; a frame
    // each 16 ms, the last of them painted after the 1.8 s, which takes the
    // name away
    expect(frames).toBe(Math.ceil(1800 / 16))
    expect(drawnAt - tapped).toBeGreaterThanOrEqual(1800)
    expect(asked).toHaveLength(0)
  })

  it("asks for every frame of a key's flash once unrolled, where no name shows, then for none", async () => {
    // Arrange: the keys, at once under reduced motion
    const { asked, painted, root, settle, spiral } = await onLoop()
    spiral.setUnrolled(true)
    settle()
    const before = painted()

    // Act
    root.querySelector<HTMLElement>('[data-key]')?.click()
    const frames = settle()

    // Assert: the 0.7 s flash, a frame each 16 ms, every one painted, the
    // last after the 0.7 s, which takes the flash away
    expect(frames).toBe(Math.ceil(700 / 16))
    expect(painted() - before).toBe(frames)
    expect(asked).toHaveLength(0)
  })

  it('moves the camera over the axis on every frame, then asks for none', async () => {
    // Arrange: motion on, the spiral held still, as Lesson 10's hero holds it
    const { asked, settle, spiral } = await onLoop({}, false)
    spiral.setTurning(false)
    settle()

    // Act
    spiral.setView('top')
    const frames = settle()

    // Assert: the 1.2 s move, a frame each 16 ms, lands 1e-15 short of the
    // top in rounding, and one more frame sets it there
    expect(frames).toBe(Math.ceil(1200 / 16) + 1)
    expect(spiral.top).toBe(1)
    expect(asked).toHaveLength(0)
  })

  it('looks down its axis from its first frame when the page starts it there, with no move to make', async () => {
    // Arrange: motion on, the camera started over the axis, as Lesson 10's hero mounts it
    const { asked, settle, spiral } = await onLoop({ view: 'top' }, false)
    const before = spiral.top

    // Act
    spiral.setTurning(false)
    const frames = settle()

    // Assert: over the axis before its first frame, which is its only one
    expect(before).toBe(1)
    expect(frames).toBe(1)
    expect(spiral.top).toBe(1)
    expect(asked).toHaveLength(0)
  })

  it('turns by itself on every frame while motion plays, as Lesson 1 shows it', async () => {
    // Arrange: motion on, the spiral free to turn
    const { painted, settle, spiral } = await onLoop({}, false)
    const yaw = spiral.yaw

    // Act: two seconds of frames
    const frames = settle(120)

    // Assert: still asking, every frame painted, turned on
    expect(frames).toBe(120)
    expect(painted()).toBe(120)
    expect(spiral.yaw).toBeGreaterThan(yaw)
  })

  it('asks for no frame while its canvas has no room, even free to turn, and paints once it has', async () => {
    // Arrange: motion on, the spiral free to turn, its box collapsed
    const t = await onLoop({}, false)
    const box = vi
      .spyOn(t.canvas, 'getBoundingClientRect')
      .mockReturnValue(new DOMRect(0, 0, 0, 0))
    const idle = t.settle()
    const yaw = t.spiral.yaw

    // Act: the box opens, and its observer says so
    box.mockReturnValue(new DOMRect(0, 0, 300, 190))
    t.resize(t.canvas)
    const opened = t.settle(10)

    // Assert
    expect(idle).toBe(1)
    expect(yaw).toBe(0)
    expect(opened).toBe(10)
  })

  it("draws every frame the page's overlay asks for, then asks for none", async () => {
    // Arrange: marks that move for 25 frames once started, as a bead slide does
    let left = 0
    const { asked, loop, painted, settle } = await onLoop({
      overlay: () => {
        left = Math.max(0, left - 1)
      },
      overlayWants: () => left > 0,
    })
    settle()
    const before = painted()

    // Act: the slide starts, and the page wakes the loop for it
    left = 25
    loop.wake()
    const frames = settle()

    // Assert
    expect(frames).toBe(25)
    expect(painted() - before).toBe(25)
    expect(asked).toHaveLength(0)
  })

  const keys = (): KeysLayer => ({
    keyPos: () => ({ x: 0, y: 0 }),
    draw: () => [],
  })
  const quiet: [string, SpiralOptions][] = [
    ['an overlay', { overlay: () => undefined }],
    ['keys of its own', { keys }],
  ]
  it.each(quiet)(
    "draws every frame it is on with %s that says nothing of its frames, as Lesson 2's copies do",
    async (_what, opts) => {
      // Arrange
      const { painted, settle } = await onLoop(opts)

      // Act
      const frames = settle(100)

      // Assert
      expect(frames).toBe(100)
      expect(painted()).toBe(100)
    },
  )

  it('paints once for each change at rest, and asks for nothing after it', async () => {
    // Arrange
    const t = await onLoop()
    t.settle()
    const { Names } = await import('./names')
    const changes: [string, () => void][] = [
      ['new labels', () => t.spiral.setLabels('name')],
      ['a lit key', () => t.spiral.light(C_SHARP_4)],
      ['a new selection', () => t.spiral.select(B_FLAT_4)],
      ['the focus', () => t.canvas.focus()],
      ['flats', () => Names.set('flats')],
      ['the camera, at once', () => t.spiral.setView('top')],
      ['the keys, at once', () => t.spiral.setUnrolled(true)],
      ['a new size', () => t.resize(t.canvas)],
      ['a new pixel ratio', t.zoom],
      ['a font loaded', t.fontsLoad],
    ]

    // Act
    const each = changes.map(([what, change]): [string, number] => {
      const before = t.painted()
      change()
      t.settle()
      return [what, t.painted() - before]
    })

    // Assert
    expect(each).toEqual(changes.map(([what]) => [what, 1]))
    expect(t.asked).toHaveLength(0)
  })

  const unheard: [string, (canvas: HTMLCanvasElement) => void][] = [
    ['a pixel ratio', () => vi.stubGlobal('devicePixelRatio', 2)],
    [
      'a canvas width',
      (canvas) =>
        Object.defineProperty(canvas, 'clientWidth', {
          configurable: true,
          value: 320,
        }),
    ],
  ]
  it.each(unheard)(
    'paints %s that changed with no word of it at the next input on the page',
    async (_what, change) => {
      // Arrange: at rest, then the change, which wakes nothing
      const t = await onLoop()
      t.settle()
      const before = t.painted()
      change(t.canvas)
      const unasked = t.asked.length

      // Act: a tap anywhere on the page
      document.body.dispatchEvent(new Event('pointerdown'))
      t.settle()

      // Assert
      expect(unasked).toBe(0)
      expect(t.painted() - before).toBe(1)
      expect(t.asked).toHaveLength(0)
    },
  )
})
