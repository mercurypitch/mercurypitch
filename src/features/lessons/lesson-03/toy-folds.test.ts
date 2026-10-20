// ============================================================
// Lesson 3 folds toy tests — Stretch's scale and words, Sing held
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { foldsReadout, mountFolds, noteAt, stretchHz, stretchText, } from './toy-folds'

/** The toy's markup, as learn/03.html has it. */
function foldsRoot(): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = `<canvas></canvas><span data-folds-count></span><span data-folds-ro></span>
    <p data-folds-live></p><button data-folds="breathe"></button>
    <button data-folds="sing" aria-pressed="false"></button>
    <button data-folds="slow" aria-pressed="false"></button>
    <b data-folds-note></b><input type="range" data-folds="stretch" min="0" max="1000" value="500">`
  document.body.appendChild(root)
  return root
}

const el = (root: HTMLElement, selector: string): HTMLElement => {
  const found = root.querySelector<HTMLElement>(selector)
  if (found === null) throw new Error(`no ${selector}`)
  return found
}

afterEach(() => {
  document.body.textContent = ''
})

describe("Stretch's scale (FACTS 48)", () => {
  it('runs from 110 Hz to 440 Hz, A3 in the middle', () => {
    expect(stretchHz(0)).toBeCloseTo(110, 6)
    expect(stretchHz(500)).toBeCloseTo(220, 6)
    expect(stretchHz(1000)).toBeCloseTo(440, 6)
  })

  it('names a note only within 15 cents of it', () => {
    expect(noteAt(220)).toBe(57)
    expect(noteAt(220 * 2 ** (14 / 1200))).toBe(57)
    expect(noteAt(220 * 2 ** (40 / 1200))).toBeNull()
  })
})

describe("the folds' words", () => {
  it('say the rate in swings a second, and slowed 220 times (FACTS 22)', () => {
    expect(stretchText(220)).toBe(
      '220 hertz, A3: the folds open and close 220 times a second',
    )
    expect(foldsReadout(220, false)).toBe('220 Hz: 220 swings a second')
    expect(foldsReadout(220, true)).toBe('slowed 220 times: 1 a second')
    expect(foldsReadout(440, true)).toBe('slowed 220 times: 2 a second')
  })

  it('speak a black key by its sharp, and leave a pitch between notes unnamed', () => {
    expect(stretchText(233.08)).toBe(
      '233 hertz, A sharp 3: the folds open and close 233 times a second',
    )
    expect(stretchText(227)).toBe(
      '227 hertz: the folds open and close 227 times a second',
    )
  })
})

describe('mountFolds', () => {
  it('sings while Sing is held, and says so', () => {
    // Arrange
    const root = foldsRoot()
    mountFolds(root)
    const sing = el(root, '[data-folds="sing"]')

    // Act
    sing.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    const held = sing.getAttribute('aria-pressed')
    const whileHeld = el(root, '[data-folds-live]').textContent
    sing.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }))

    // Assert
    expect(held).toBe('true')
    expect(whileHeld).toBe(
      'Singing: the folds open and close 220 times a second.',
    )
    expect(sing.getAttribute('aria-pressed')).toBe('false')
    expect(el(root, '[data-folds-live]').textContent).toBe(
      'Breathing: the folds are apart.',
    )
  })

  it('turns Stretch into a pitch, its words and its readout', () => {
    // Arrange
    const root = foldsRoot()
    mountFolds(root)
    const stretch = el(root, '[data-folds="stretch"]') as HTMLInputElement

    // Act
    stretch.value = '1000'
    stretch.dispatchEvent(new Event('input'))
    el(root, '[data-folds="slow"]').click()

    // Assert
    expect(stretch.getAttribute('aria-valuetext')).toBe(
      '440 hertz, A4: the folds open and close 440 times a second',
    )
    expect(el(root, '[data-folds-ro]').textContent).toBe(
      'slowed 220 times: 2 a second',
    )
  })
})
