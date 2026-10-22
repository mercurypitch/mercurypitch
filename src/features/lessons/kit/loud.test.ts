// ============================================================
// Lesson loudness toy tests — the flag names what a move did, a key's step too
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import './browser-doubles.test-fixtures'
import { mountLoud } from './loud'

/** The toy's markup: the canvas, both sliders and the flag, "how fast" at 333 of 1000 (220 Hz). */
function loudRoot(): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML =
    '<canvas></canvas><p class="viz-status"><span data-loud-flag></span></p><input type="range" min="0" max="100" value="50" data-loud="far"><input type="range" min="0" max="1000" value="333" data-loud="fast">'
  document.body.appendChild(root)
  return root
}

const flag = (root: HTMLElement): string =>
  root.querySelector('[data-loud-flag]')?.textContent ?? ''

/** Moves "how fast" one step up, as an arrow key does. */
function stepUp(root: HTMLElement): void {
  const fast = root.querySelector<HTMLInputElement>('[data-loud="fast"]')
  if (fast === null) return
  fast.value = String(Number(fast.value) + 1)
  fast.dispatchEvent(new Event('input'))
}

afterEach(() => {
  document.body.textContent = ''
})

describe('mountLoud', () => {
  it('names a climb that a keyboard makes a step at a time, each step under half a hertz', () => {
    // Arrange: one step here is about 0.46 Hz
    const root = loudRoot()
    mountLoud(root)

    // Act
    stepUp(root)
    const afterOne = flag(root)
    stepUp(root)

    // Assert
    expect(afterOne).toBe('')
    expect(flag(root)).toBe('Pitch: climbing')
  })

  it('says "unchanged" for a move of how far, whatever its size', () => {
    // Arrange
    const root = loudRoot()
    mountLoud(root)
    const far = root.querySelector<HTMLInputElement>('[data-loud="far"]')

    // Act
    if (far !== null) far.value = '51'
    far?.dispatchEvent(new Event('input'))

    // Assert
    expect(flag(root)).toBe('Pitch: unchanged')
  })
})
