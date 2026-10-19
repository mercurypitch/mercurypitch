// ============================================================
// Lesson dial tests — two copies on one page, each with its own parts
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import './browser-doubles.test-fixtures'
import { mountDial } from './dial'

/** A dial's markup, its slider at 333 of 1000 (A3, near enough). */
function dialRoot(): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML =
    '<canvas></canvas><input type="range" min="0" max="1000" value="333"><b data-dial-hz></b><b data-dial-period></b><b data-dial-note></b>'
  document.body.appendChild(root)
  return root
}

const part = (root: HTMLElement, selector: string): string =>
  root.querySelector(selector)?.textContent ?? ''

afterEach(() => {
  document.body.textContent = ''
})

describe('mountDial', () => {
  it('turns one copy without moving the other', () => {
    // Arrange
    const a = dialRoot()
    const b = dialRoot()
    const dialA = mountDial(a)
    const dialB = mountDial(b)
    const slider = a.querySelector('input')
    if (slider === null) throw new Error('no slider')
    slider.value = '1000'

    // Act
    slider.dispatchEvent(new Event('input'))

    // Assert
    expect(dialA.frequency).toBeCloseTo(880, 6)
    expect(part(a, '[data-dial-note]')).toBe('A5')
    expect(part(a, '[data-dial-hz]')).toBe('880Hz')
    expect(dialB.frequency).toBeCloseTo(219.85, 2)
    expect(part(b, '[data-dial-note]')).toBe('A3')
    expect(part(b, '[data-dial-hz]')).toBe('220Hz')
  })
})
