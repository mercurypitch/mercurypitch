// ============================================================
// Lesson spiral tests — two copies on one page, each with its own state
// ============================================================
//
// And a note the viewer plays on a page with one sound at a time: a tap
// on a bead the last frame drew, a key, Enter on the slider or an
// activation claims the page's owner and is stopped by the next claim,
// heard as the voices a fake AudioContext records.

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type { HandLoop } from './frame-loop.test-fixtures'
import { handLoop } from './frame-loop.test-fixtures'
import { Names } from './names'
import type { SoundOwner } from './now-playing'
import { createSoundOwner } from './now-playing'
import type * as SoundKit from './sound'
import { AUDIBLE, FakeContext, valueAt } from './sound-doubles.test-fixtures'
import type { Spiral, SpiralOptions } from './spiral'
import { mountSpiral } from './spiral'
import type { BeadHit } from './spiral-draw'

/** The lowest bead, A2: a bead's `s` counts semitones from it. */
const A2 = 45
const A3 = 57
const A4 = 69
const C_SHARP_4 = 61
const B_FLAT_4 = 70

/** The page's toast, where "Sound is off" is said. */
const TOAST =
  '<div id="toast"><p id="toastText"></p><button id="toastBtn" hidden></button></div>'

/** A spiral's markup: the canvas, the hint, the readout and the unroll button. */
function spiralRoot(): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML =
    '<canvas></canvas><p data-spiral-hint>Drag to turn</p><b data-spiral-readout></b><button type="button" data-spiral-unroll><span>Unroll the spiral</span></button>'
  document.body.appendChild(root)
  return root
}

function twoCopies(opts: SpiralOptions = {}): [HTMLElement, HTMLElement] {
  return [spiralRoot(), spiralRoot()]
    .map((root) => {
      mountSpiral(root, opts)
      return root
    })
    .slice(0, 2) as [HTMLElement, HTMLElement]
}

const said = (root: HTMLElement): string | null =>
  root.querySelector('canvas')?.getAttribute('aria-valuetext') ?? null
const readout = (root: HTMLElement): string =>
  root.querySelector('[data-spiral-readout]')?.textContent ?? ''
const unrollLabel = (root: HTMLElement): string =>
  root.querySelector('[data-spiral-unroll] span')?.textContent ?? ''
const hint = (root: HTMLElement): string =>
  root.querySelector('[data-spiral-hint]')?.textContent ?? ''

function canvasOf(root: HTMLElement): HTMLCanvasElement {
  const canvas = root.querySelector('canvas')
  if (canvas === null) throw new Error('no canvas')
  return canvas
}

/** Each voice the fake context has started, by its pitch in hertz. */
const voicesOn = (ctx: FakeContext): number[] =>
  ctx.oscillators.map((o) => o.frequency.events[0]?.[1] ?? 0)

interface Tappable extends HandLoop {
  readonly spiral: Spiral
  readonly root: HTMLElement
  readonly canvas: HTMLCanvasElement
  readonly Sound: typeof SoundKit.Sound
  /** The page's own owner, as loaded with this spiral. */
  readonly NowPlaying: SoundOwner
  readonly ctx: FakeContext
  /** A tap on the bead the last frame drew for `midi`, as a finger makes it. */
  tap(midi: number): void
}

/**
 * A spiral on screen with sound on over a fake AudioContext, drawn once on
 * the page's frame loop, run by hand, so that a tap can land on a bead it
 * drew; with a key for A4. The spiral, its sound and the page's owner load
 * afresh over that loop.
 */
async function tappable(opts: SpiralOptions = {}): Promise<Tappable> {
  const hand = await handLoop()
  FakeContext.last = null
  vi.stubGlobal('AudioContext', FakeContext)
  const { Sound } = await import('./sound')
  const { NowPlaying } = await import('./now-playing')
  const { mountSpiral: mount } = await import('./spiral')
  Sound.set('on')
  const ctx = FakeContext.last
  if (ctx === null) throw new Error('no context was made')
  const root = spiralRoot()
  root.insertAdjacentHTML(
    'beforeend',
    `<button type="button" data-key="${A4}">A4</button>`,
  )
  const canvas = canvasOf(root)
  hand.paints(canvas)
  let beads: readonly BeadHit[] = []
  const spiral = mount(root, {
    ...opts,
    overlay: (f) => {
      beads = f.beads
    },
  })
  hand.see(root)
  hand.frame()
  return {
    ...hand,
    spiral,
    root,
    canvas,
    Sound,
    NowPlaying,
    ctx,
    tap(midi) {
      const bead = beads.find((b) => b.s === midi - A2)
      if (bead === undefined) throw new Error(`no bead drawn for ${midi}`)
      const at = { clientX: bead.x, clientY: bead.y }
      canvas.dispatchEvent(new MouseEvent('pointerdown', at))
      canvas.dispatchEvent(new MouseEvent('pointerup', at))
    },
  }
}

afterEach(() => {
  Names.set('sharps')
  document.body.textContent = ''
  vi.useRealTimers()
  vi.restoreAllMocks()
  // jsdom has no AudioContext: leave none behind, without unstubbing the
  // browser doubles' globals as `vi.unstubAllGlobals` would
  vi.stubGlobal('AudioContext', undefined)
})

describe('mountSpiral', () => {
  it("lights a black key's bead on the copy that played it, and on no other", async () => {
    // Arrange: Lesson 2's copies light the "?" beads as they are heard
    const a = mountSpiral(spiralRoot(), { lightOnPlay: true })
    const b = mountSpiral(spiralRoot(), { lightOnPlay: true })

    // Act
    await a.play(C_SHARP_4, { audible: false, dur: 0 })

    // Assert: the readout names it in signs, its sign spoken as a word
    expect([...a.lit]).toEqual([C_SHARP_4])
    expect(readout(a.root)).toBe('C♯ sharp 4277 Hz')
    expect([...b.lit]).toEqual([])
    expect(readout(b.root)).toBe('')
  })

  it("keeps a black key unnamed on a page that does not light it, as Lesson 1's does", async () => {
    // Arrange
    const spiral = mountSpiral(spiralRoot())

    // Act
    await spiral.play(C_SHARP_4, { audible: false, dur: 0 })

    // Assert
    expect([...spiral.lit]).toEqual([])
    expect(readout(spiral.root)).toBe('?277 Hz')
  })

  it("moves only the focused copy's selection from the keyboard", () => {
    // Arrange: both open on A3
    const [a, b] = twoCopies()

    // Act
    a.querySelector('canvas')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp' }),
    )

    // Assert
    expect(said(a)).toBe('A sharp 3, 233 hertz')
    expect(said(b)).toBe('A3, 220 hertz')
  })

  it("re-says every copy's note when the page switches to flats", () => {
    // Arrange
    const a = mountSpiral(spiralRoot())
    const b = mountSpiral(spiralRoot())
    a.select(C_SHARP_4)
    b.select(B_FLAT_4)

    // Act
    Names.set('flats')

    // Assert
    expect(said(a.root)).toBe('D flat 4, 277 hertz')
    expect(said(b.root)).toBe('B flat 4, 466 hertz')
  })

  it('keeps the selection inside the notes the page shows', () => {
    // Arrange: a keyboard that shows only the octave A3 to A4
    const root = spiralRoot()
    const spiral = mountSpiral(root, { range: () => [57, 69] })
    const canvas = root.querySelector('canvas')

    // Act: down from A3, then a jump past A4
    canvas?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    const low = spiral.selected
    spiral.select(80)

    // Assert
    expect(low).toBe(57)
    expect(spiral.selected).toBe(69)
    expect(canvas?.getAttribute('aria-valuemin')).toBe('12')
    expect(canvas?.getAttribute('aria-valuemax')).toBe('24')
  })

  it('looks straight down its axis and back, at once under reduced motion', () => {
    // Arrange
    const spiral = mountSpiral(spiralRoot())

    // Act
    spiral.setView('top')
    const down = spiral.top
    spiral.setView('side')

    // Assert
    expect([down, spiral.top]).toEqual([1, 0])
  })

  it("unrolls one copy, leaving the other's button and hint alone", () => {
    // Arrange
    const [a, b] = twoCopies()

    // Act
    a.querySelector<HTMLButtonElement>('[data-spiral-unroll]')?.click()

    // Assert
    expect(unrollLabel(a)).toBe('Roll it back up')
    expect(hint(a)).toBe('Tap any key to hear it')
    expect(unrollLabel(b)).toBe('Unroll the spiral')
    expect(hint(b)).toBe('Drag to turn')
  })

  it('turns one bead a press with no drag, and hides the turn buttons once unrolled', () => {
    // Arrange: the spiral with its Turn left and Turn right buttons
    const root = spiralRoot()
    root.insertAdjacentHTML(
      'beforeend',
      '<button type="button" data-spiral-turn="-1">Turn left</button><button type="button" data-spiral-turn="1">Turn right</button>',
    )
    const spiral = mountSpiral(root)
    const [left, right] = Array.from(
      root.querySelectorAll<HTMLButtonElement>('[data-spiral-turn]'),
    )
    const bead = (Math.PI * 2) / 12

    // Act: under reduced motion each press lands at once
    right.click()
    const once = spiral.yaw
    left.click()
    left.click()
    const back = spiral.yaw
    spiral.setUnrolled(true)

    // Assert
    expect(once).toBeCloseTo(bead)
    expect(back).toBeCloseTo(-bead)
    expect([left.hidden, right.hidden]).toEqual([true, true])
  })

  it('plays the selected note on a click no pointer made, as a screen reader double-tap sends', () => {
    // Arrange: B3 picked with the arrows, as a swipe up picks it
    const spiral = mountSpiral(spiralRoot())
    const canvas = spiral.root.querySelector('canvas')
    canvas?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
    canvas?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))

    // Act
    canvas?.dispatchEvent(new MouseEvent('click'))

    // Assert
    expect(readout(spiral.root)).toBe('B3247 Hz')
  })

  it("takes a finger's own click, right after its pointerup, as no second play", () => {
    // Arrange: a tap that lands on no bead (jsdom draws none)
    const spiral = mountSpiral(spiralRoot())
    const canvas = spiral.root.querySelector('canvas')

    // Act
    canvas?.dispatchEvent(new MouseEvent('pointerup'))
    canvas?.dispatchEvent(new MouseEvent('click'))

    // Assert
    expect(readout(spiral.root)).toBe('')
  })
})

describe("mountSpiral: a note the viewer plays, and the page's owner", () => {
  it.each([
    ['a tap on its bead', 440, (t: Tappable) => t.tap(A4)],
    [
      'a key',
      440,
      (t: Tappable) => t.root.querySelector<HTMLElement>('[data-key]')?.click(),
    ],
    [
      'Enter on the slider',
      220,
      (t: Tappable) =>
        t.canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })),
    ],
    [
      'an activation with no pointer',
      220,
      (t: Tappable) => t.canvas.dispatchEvent(new MouseEvent('click')),
    ],
  ])(
    'stops the sound that held the page when the viewer plays a note by %s',
    async (_way, heard, play) => {
      // Arrange: another sound holds the page's owner; the selection is A3
      const owner = createSoundOwner()
      const t = await tappable({ owner })
      let stopped = 0
      owner.claim(() => {
        stopped += 1
      })

      // Act
      play(t)

      // Assert: that sound stopped once, and the note sounds
      expect(stopped).toBe(1)
      expect(voicesOn(t.ctx)).toEqual([heard])
    },
  )

  it('stops its note where it stands when another sound claims the page', async () => {
    // Arrange: a bead tapped 0.3 s ago, its note 0.9 s long
    const owner = createSoundOwner()
    const t = await tappable({ owner })
    t.tap(A3)
    vi.advanceTimersByTime(300)
    t.ctx.currentTime = 0.3

    // Act
    owner.claim(() => undefined)

    // Assert: silent within 0.15 s, long before the note's end
    const envelope = t.ctx.gains[1].gain.events
    expect(valueAt(envelope, 0.45, 0)).toBeLessThan(AUDIBLE)
    expect(t.ctx.oscillators[0].stops.at(-1) ?? Infinity).toBeLessThan(0.45)
  })

  it('lets the owner go when its note ends, with the stop it claimed it with', async () => {
    // Arrange: an owner that keeps what it is told, and a bead tapped
    const claimed: (() => void)[] = []
    const released: (() => void)[] = []
    const t = await tappable({
      owner: {
        claim: (stop) => {
          claimed.push(stop)
        },
        release: (stop) => {
          released.push(stop)
        },
      },
    })
    t.tap(A3)
    const early = released.length

    // Act: the note's 0.9 s
    vi.advanceTimersByTime(900)

    // Assert
    expect(early).toBe(0)
    expect(claimed).toHaveLength(1)
    expect(released).toEqual(claimed)
  })

  it("with no owner, plays its note through and leaves the page's owner alone", async () => {
    // Arrange: another sound holds the page's own owner
    const t = await tappable()
    let stopped = 0
    t.NowPlaying.claim(() => {
      stopped += 1
    })

    // Act: a tap, and 0.3 s of its note
    t.tap(A3)
    vi.advanceTimersByTime(300)

    // Assert: that sound plays on, and the note sounds, not yet let go
    expect(stopped).toBe(0)
    expect(voicesOn(t.ctx)).toEqual([220])
    expect(t.ctx.oscillators[0].stops).toEqual([])
  })

  it('with sound off, sounds nothing, but lights the bead and says it is seen, not heard', async () => {
    // Arrange: Lesson 2's lit beads, on a page with an owner and its toast
    const t = await tappable({ owner: createSoundOwner(), lightOnPlay: true })
    document.body.insertAdjacentHTML('beforeend', TOAST)
    t.Sound.set('off')

    // Act
    t.tap(C_SHARP_4)

    // Assert
    expect(voicesOn(t.ctx)).toEqual([])
    expect([...t.spiral.lit]).toEqual([C_SHARP_4])
    expect(readout(t.root)).toBe('C♯ sharp 4277 Hz')
    expect(document.getElementById('toastText')?.textContent).toBe(
      "Sound is off, so you'll see this one but not hear it.",
    )
  })
})
