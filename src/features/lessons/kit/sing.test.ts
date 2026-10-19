// ============================================================
// Lesson sing tests — two sing cards on one page, each with its own ring
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import './browser-doubles.test-fixtures'
import { mountRing, mountSing } from './sing'
import { Sound } from './sound'

const STILLS = { blue: '/stills/blue.webp', orange: '/stills/orange.webp' }

/** A sing card's markup: the ring's parts, and a button for A3 and for A4. */
function singCard(): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = `<div class="ring"><svg><circle class="ring-progress" r="182"></circle><circle class="ring-breath" r="150"></circle><g class="ring-ripples"></g></svg><img class="ring-merc" alt=""><p class="ring-note"></p><p class="ring-state"></p></div><button type="button" class="low">A3</button><button type="button" class="high">A4</button>`
  document.body.appendChild(root)
  mountSing(root, {
    stills: STILLS,
    notes: [
      { button: button(root, '.low'), which: 'blue', midi: 57 },
      { button: button(root, '.high'), which: 'orange', midi: 69 },
    ],
  })
  return root
}

function button(root: HTMLElement, selector: string): HTMLButtonElement {
  const b = root.querySelector<HTMLButtonElement>(selector)
  if (b === null) throw new Error(`no ${selector}`)
  return b
}

const text = (root: HTMLElement, selector: string): string =>
  root.querySelector(selector)?.textContent ?? ''
const waiting = (root: HTMLElement): boolean[] =>
  Array.from(root.querySelectorAll('button')).map((b) => b.disabled)

afterEach(() => {
  Sound.set('unset')
  document.body.textContent = ''
})

describe('mountSing', () => {
  it("runs the ring of the card whose button was pressed, and holds only that card's buttons", () => {
    // Arrange
    const a = singCard()
    const b = singCard()

    // Act
    button(a, '.high').click()

    // Assert: the orange Merc sings A4 in card A; card B is untouched
    expect(text(a, '.ring-note')).toBe('A4 · 440 Hz')
    expect(text(a, '.ring-state')).toBe('Listen')
    expect(a.querySelector('img')?.getAttribute('src')).toBe(STILLS.orange)
    expect(waiting(a)).toEqual([true, true])
    expect(text(b, '.ring-state')).toBe('')
    expect(waiting(b)).toEqual([false, false])
  })

  it("says a run's own words over the ring's, as a guide's silent count-in does", () => {
    // Arrange: a ring on its own, as Lesson 2's slide guide drives it
    const root = document.createElement('div')
    root.innerHTML = `<div class="ring"><svg><circle class="ring-progress" r="182"></circle><circle class="ring-breath" r="150"></circle><g class="ring-ripples"></g></svg><img class="ring-merc" alt=""><p class="ring-note"></p><p class="ring-state"></p></div>`
    document.body.appendChild(root)
    const ringEl = root.querySelector<HTMLElement>('.ring')
    if (ringEl === null) throw new Error('no ring')
    const ring = mountRing(ringEl, { stills: STILLS })

    // Act
    void ring.run({
      which: 'blue',
      label: 'A3 · 220 Hz',
      listen: 1,
      turn: 4.2,
      ripples: false,
      words: { listen: 'Get ready' },
    })

    // Assert
    expect(text(root, '.ring-state')).toBe('Get ready')
    expect(ring.busy).toBe(true)
  })
})
