// ============================================================
// Lesson spiral tests — two copies on one page, each with its own state
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import './browser-doubles.test-fixtures'
import { Names } from './names'
import type { SpiralOptions } from './spiral'
import { mountSpiral } from './spiral'

const C_SHARP_4 = 61
const B_FLAT_4 = 70

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

afterEach(() => {
  Names.set('sharps')
  document.body.textContent = ''
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
