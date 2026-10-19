// ============================================================
// Lesson step deck tests — an address that names a step opens the deck there
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import './browser-doubles.test-fixtures'
import { createStepDeck, registerToy, stepFromHash } from './step-deck'

/** A deck of `count` steps, each with a toy of its own. */
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
  document.body.innerHTML = `<section id="lesson"><div class="progress"><i></i><i></i><i></i></div><div id="stepsText">${steps}</div><div id="stepsStage"><div class="stage-card">${toys}</div></div><b id="stepNow"></b><span id="deckNextLabel"></span></section><section id="quiz"></section>`
}

afterEach(() => {
  window.location.hash = ''
  document.body.textContent = ''
})

describe('stepFromHash', () => {
  it('reads the step an address names, and none from any other address', () => {
    // Act
    const named = stepFromHash('#step-3', 6)
    const others = ['#step-0', '#step-7', '#step-3a', '#lesson', ''].map((h) =>
      stepFromHash(h, 6),
    )

    // Assert
    expect(named).toBe(3)
    expect(others).toEqual([null, null, null, null, null])
  })
})

describe('createStepDeck', () => {
  it('opens on the step the address names and tells every toy', () => {
    // Arrange
    deckPage(3)
    window.location.hash = '#step-3'
    const heard: number[] = []
    const deck = createStepDeck({
      toyFor: (n) => n,
      after: { label: 'The quick check', selector: '#quiz' },
    })
    registerToy({ onStep: (n) => heard.push(n) })

    // Act
    deck.start()

    // Assert
    expect(deck.current).toBe(3)
    expect(heard).toEqual([3])
    expect(
      document.querySelector('.toy.is-active')?.getAttribute('data-toy'),
    ).toBe('3')
    expect(document.getElementById('stepNow')?.textContent).toBe('3')
  })
})
