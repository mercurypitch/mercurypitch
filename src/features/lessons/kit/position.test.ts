// ============================================================
// Lesson position tests — the furthest step each lesson remembers
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import { Positions, rememberSteps } from './position'
import { Done } from './progress'
import { createStepDeck } from './step-deck'

/** A lesson page's step deck of `count` steps, each with a toy of its own. */
function deckPage(count: number): void {
  const steps = Array.from(
    { length: count },
    (_, i) =>
      `<div class="step" data-step="${i + 1}"><h3>Step ${i + 1}</h3></div>`,
  ).join('')
  const toys = Array.from(
    { length: count },
    (_, i) => `<div class="toy" data-toy="${i + 1}"></div>`,
  ).join('')
  document.body.innerHTML = `<section id="lesson"><div class="progress"><i></i><i></i><i></i><i></i></div><div id="stepsText">${steps}</div><div id="stepsStage"><div class="stage-card">${toys}</div></div><b id="stepNow"></b><span id="deckNextLabel"></span></section><section id="sing"></section>`
}

const deck = (): ReturnType<typeof createStepDeck> =>
  createStepDeck({
    toyFor: (n) => n,
    after: { label: 'Sing it', selector: '#sing' },
  })

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  window.location.hash = ''
  document.body.textContent = ''
})

describe('Positions', () => {
  it('keeps the furthest step reached, not the last', () => {
    // Arrange
    Positions.reach(2, { step: 4, of: 6 })

    // Act: scrolling back up to the cold open
    Positions.reach(2, { step: 2, of: 6 })

    // Assert
    expect(Positions.get(2)).toEqual({ step: 4, of: 6 })
  })

  it('starts again from the step reached once the lesson has a different number of steps', () => {
    // Arrange
    Positions.reach(2, { step: 5, of: 6 })

    // Act
    Positions.reach(2, { step: 2, of: 7 })

    // Assert
    expect(Positions.get(2)).toEqual({ step: 2, of: 7 })
  })

  it("forgets a lesson's step once it is marked done, and only that lesson's", () => {
    // Arrange
    Positions.reach(3, { step: 3, of: 6 })
    Positions.reach(4, { step: 2, of: 5 })

    // Act
    Done.set(3, true)

    // Assert
    expect(Positions.all()).toEqual({ 4: { step: 2, of: 5 } })
  })

  it('ignores whatever it finds in storage that is not a step of a deck', () => {
    // Arrange
    localStorage.setItem(
      'fyp-pos',
      JSON.stringify({
        1: { step: 2, of: 6 },
        2: { step: 9, of: 6 },
        3: { step: 1.5, of: 6 },
        4: 'step 3',
        5: { step: 0, of: 6 },
        x: { step: 2, of: 6 },
      }),
    )

    // Act
    const kept = Positions.all()

    // Assert
    expect(kept).toEqual({ 1: { step: 2, of: 6 } })
  })

  it('reads storage that is not a map of lessons as nothing kept', () => {
    // Arrange
    const stored = ['[1, 2]', '"3"', 'not json', 'null']

    // Act
    const read = stored.map((raw) => {
      localStorage.setItem('fyp-pos', raw)
      return Positions.all()
    })

    // Assert
    expect(read).toEqual([{}, {}, {}, {}])
  })

  it('remembers nothing, and never throws, in a browser that refuses storage', () => {
    // Arrange
    const refuse = (): never => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    }
    vi.spyOn(localStorage, 'getItem').mockImplementation(refuse)
    vi.spyOn(localStorage, 'setItem').mockImplementation(refuse)

    // Act
    const reach = (): void => Positions.reach(2, { step: 3, of: 6 })

    // Assert
    expect(reach).not.toThrow()
    expect(Positions.get(2)).toBeNull()
  })

  it('tells its subscribers of each change and of nothing else', () => {
    // Arrange
    let heard = 0
    const off = Positions.subscribe(() => {
      heard += 1
    })

    // Act: one change, two that change nothing, then one after unsubscribing
    Positions.reach(2, { step: 3, of: 6 })
    Positions.reach(2, { step: 2, of: 6 })
    Positions.clear(5)
    off()
    Positions.reach(2, { step: 4, of: 6 })

    // Assert
    expect(heard).toBe(1)
  })
})

describe('rememberSteps', () => {
  it('remembers the steps the viewer moves to, not the step the page opens on', () => {
    // Arrange: a page opened at step 3 from a "Continue" link
    deckPage(4)
    window.location.hash = '#step-3'
    const steps = deck()
    steps.start()
    rememberSteps(2, steps)
    const opened = Positions.get(2)

    // Act
    steps.show(4)

    // Assert
    expect(opened).toBeNull()
    expect(Positions.get(2)).toEqual({ step: 4, of: 4 })
  })

  it('remembers nothing for a lesson already done', () => {
    // Arrange
    deckPage(4)
    Done.set(2, true)
    const steps = deck()
    steps.start()
    rememberSteps(2, steps)

    // Act
    steps.show(3)

    // Assert
    expect(Positions.get(2)).toBeNull()
  })
})
